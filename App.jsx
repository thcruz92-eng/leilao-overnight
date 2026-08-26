import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from "recharts";

/* ============================================================
   PERSISTÊNCIA — fora do Claude, usamos o localStorage do
   navegador com a mesma interface do antigo window.storage,
   para não mexer em nenhuma chamada existente.
   Guarda só CONFIGURAÇÃO (carteira, benchmarks, marcados,
   ordem de colunas). A base de preços vem da rede.
   ============================================================ */
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      if (v === null) throw new Error("chave ausente");
      return { key, value: v };
    },
    async set(key, value) { localStorage.setItem(key, String(value)); return { key, value }; },
    async delete(key) { localStorage.removeItem(key); return { key, deleted: true }; },
    async list(prefix = "") {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return { keys, prefix };
    },
  };
}

/* ---------- fontes de dados ---------- */
const URL_BASE = "/base_b3.json";                    // COTAHIST, publicado pelo GitHub Actions
const URL_COTACAO = "/.netlify/functions/cotacao";   // cotação ao vivo (Yahoo via Netlify)
const LOTE_COTACAO = 100;

/* data do pregão (meia-noite UTC do dia-calendário de Brasília) */
export function tsPregao(d) {
  const [y, m, dd] = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    .split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
}

/* Base histórica oficial -> mesmo formato do merge já existente */
export async function fetchBaseRemota() {
  const r = await fetch(URL_BASE, { cache: "no-cache" });
  if (!r.ok) throw new Error(`HTTP ${r.status} ao buscar a base`);
  const json = await r.json();
  const campos = json.campos || ["iso", "abertura", "maxima", "minima", "fechamento", "volume", "quantidade"];
  const ix = Object.fromEntries(campos.map((c, i) => [c, i]));
  const incoming = new Map();
  for (const [ativo, linhas] of Object.entries(json.dados || {})) {
    const m = new Map();
    for (const l of linhas) {
      const [y, mo, d] = String(l[ix.iso]).split("-").map(Number);
      m.set(Date.UTC(y, mo - 1, d), {
        abertura: l[ix.abertura], maxima: l[ix.maxima], minima: l[ix.minima],
        fech: l[ix.fechamento], vol: l[ix.volume], qtd: l[ix.quantidade] ?? null,
      });
    }
    incoming.set(ativo, m);
  }
  return {
    incoming,
    meta: {
      geradoEm: json.gerado_em || null,
      ultimoPregao: json.ultimo_pregao || null,
      ativos: json.total_ativos ?? incoming.size,
      registros: json.total_registros ?? null,
    },
  };
}

/* Retrato do pregão em andamento, no instante da chamada */
export async function fetchCotacoesAoVivo(tickers) {
  const incoming = new Map();
  let estado = null, consultadoEm = null, ausentes = [];
  for (let i = 0; i < tickers.length; i += LOTE_COTACAO) {
    const lote = tickers.slice(i, i + LOTE_COTACAO);
    const r = await fetch(`${URL_COTACAO}?tickers=${lote.join(",")}`);
    if (!r.ok) throw new Error(`HTTP ${r.status} na cotação ao vivo`);
    const json = await r.json();
    consultadoEm = json.consultadoEm || consultadoEm;
    ausentes = ausentes.concat(json.ausentes || []);
    for (const [ativo, q] of Object.entries(json.dados || {})) {
      if (!(q.fechamento > 0)) continue;
      estado = estado || q.estadoMercado || null;
      const ts = tsPregao(q.atualizadoEm ? new Date(q.atualizadoEm) : new Date());
      const m = new Map();
      m.set(ts, {
        abertura: q.abertura ?? q.fechamento,
        maxima: q.maxima ?? q.fechamento,
        minima: q.minima ?? q.fechamento,
        fech: q.fechamento,
        vol: q.volume ?? 0,
        qtd: q.quantidade ?? null,
      });
      incoming.set(ativo, m);
    }
  }
  return { incoming, estado, consultadoEm, ausentes };
}

/* ============================================================
   LEILÃO OVERNIGHT v3
   - Base ACUMULADA e persistente (salva neste navegador via window.storage)
   - Merge de novos CSVs: datas novas são acrescentadas; datas iguais são
     mantidas (ou revisadas se o CSV novo trouxer valores diferentes)
   - Aba "Ativos" para navegar no histórico de cada papel
   - Botão "Baixar consolidado": todas as colunas, ordenado por ativo A→Z
     e, dentro de cada ativo, da data mais nova para a mais antiga
   - Ranking com janelas flexíveis + alocação (0,1% do volume, alvo R$ 2M)
   ============================================================ */

const T = {
  bg: "#0E1116",
  panel: "#161B22",
  panelSoft: "#1C232C",
  line: "#28313D",
  text: "#E8E4DA",
  dim: "#8B94A1",
  faint: "#5C6672",
  up: "#3FBF8F",
  down: "#E06055",
  amber: "#F0B347",
  amberSoft: "rgba(240,179,71,0.12)",
  mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
  sans: "'Segoe UI', system-ui, -apple-system, sans-serif",
};

const LOOKBACKS = [
  { label: "2 sem", days: 10 },
  { label: "1 mês", days: 21 },
  { label: "3 meses", days: 63 },
  { label: "5 meses", days: 105 },
  { label: "6 meses", days: 126 },
  { label: "12 meses", days: 252 },
];

const DOW = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const fmtBRL = (v, dec = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtPct = (v, dec = 2) =>
  (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + "%";
const fmtDate = (ts) => new Date(ts).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const numBR = (v, dec = 2) => v.toFixed(dec).replace(".", ",");

/* ---------- parsing ---------- */
function parseMoney(s) {
  if (s == null) return NaN;
  const clean = String(s).replace(/R\$/g, "").trim().replace(/\./g, "").replace(",", ".");
  const v = parseFloat(clean);
  return isNaN(v) ? NaN : v;
}
function parseDateBR(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return Date.UTC(+m[3], +m[2] - 1, +m[1]);
}

/* Converte linhas de CSV (7 ou 8 colunas) em Map ticker -> Map ts -> registro.
   No formato de 8 colunas, detecta por ticker qual coluna é o volume financeiro
   (financeiro ÷ quantidade ≈ preço de fechamento). */
export function parseRowsToIncoming(rows) {
  const raw = new Map();
  let bad = 0;
  for (const r of rows) {
    if (!r || r.length < 7) { bad++; continue; }
    const ativo = String(r[0] || "").replace(/[\x00-\x1f]/g, "").trim().toUpperCase();
    // aceita tickers de 4 a 10 caracteres: cobre IBOV (4) e papéis como PETR4, BPAC11
    if (!ativo || !/^[A-Z0-9$^.]{4,10}$/.test(ativo) || ativo.startsWith("ATIVO")) { bad++; continue; }
    const ts = parseDateBR(r[1]);
    if (ts == null) { bad++; continue; }
    const abertura = parseMoney(r[2]);
    const maxima = parseMoney(r[3]);
    const minima = parseMoney(r[4]);
    const fech = parseMoney(r[5]);
    const c6 = parseMoney(r[6]);
    const c7 = r.length >= 8 ? parseMoney(r[7]) : NaN;
    if (![abertura, maxima, minima, fech, c6].every(Number.isFinite)) { bad++; continue; }
    if (!raw.has(ativo)) raw.set(ativo, new Map());
    if (!raw.get(ativo).has(ts)) raw.get(ativo).set(ts, { abertura, maxima, minima, fech, c6, c7 });
  }
  // decidir coluna do volume financeiro por ticker
  const incoming = new Map();
  for (const [ativo, m] of raw) {
    const arr = Array.from(m.values());
    const with8 = arr.filter((r) => Number.isFinite(r.c7) && r.c7 > 0 && r.c6 > 0);
    let volCol = "c6";
    if (with8.length >= Math.max(3, arr.length * 0.5)) {
      const err = (num, den) => {
        const errs = with8.slice(0, 60).map((r) => Math.abs(r[num] / r[den] - r.fech) / r.fech);
        errs.sort((a, b) => a - b);
        return errs[Math.floor(errs.length / 2)];
      };
      volCol = err("c6", "c7") <= err("c7", "c6") ? "c6" : "c7";
    }
    const out = new Map();
    for (const [ts, r] of m) {
      const vol = volCol === "c6" ? r.c6 : (Number.isFinite(r.c7) ? r.c7 : r.c6);
      const qtd = volCol === "c6" ? (Number.isFinite(r.c7) ? r.c7 : null) : r.c6;
      out.set(ts, { abertura: r.abertura, maxima: r.maxima, minima: r.minima, fech: r.fech, vol, qtd });
    }
    incoming.set(ativo, out);
  }
  return { incoming, bad };
}

/* Merge: datas novas entram; datas existentes são revisadas se o novo CSV
   trouxer valores diferentes. Nada é apagado. */
export function mergeIntoStore(store, incoming) {
  let added = 0, revised = 0, kept = 0;
  const changed = new Set();
  const same = (a, b) =>
    a.abertura === b.abertura && a.maxima === b.maxima && a.minima === b.minima &&
    a.fech === b.fech && a.vol === b.vol && (a.qtd ?? null) === (b.qtd ?? null);
  for (const [ativo, m] of incoming) {
    if (!store.has(ativo)) store.set(ativo, new Map());
    const dst = store.get(ativo);
    for (const [ts, row] of m) {
      const old = dst.get(ts);
      if (!old) { dst.set(ts, row); added++; changed.add(ativo); }
      else if (!same(old, row)) { dst.set(ts, row); revised++; changed.add(ativo); }
      else kept++;
    }
  }
  return { added, revised, kept, changed };
}

/* Dataset derivado da base acumulada: calcula overnight, var. do dia e posição no range */
export function computeDataset(store, feePct) {
  const fee = feePct / 100;
  const byTicker = new Map();
  const allDates = new Set();
  for (const [ativo, m] of store) {
    const arr = Array.from(m.entries())
      .map(([ts, r]) => ({ ts, ...r }))
      .sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < arr.length; i++) {
      allDates.add(arr[i].ts);
      const row = arr[i];
      if (i > 0) {
        const prev = arr[i - 1];
        row.over = row.abertura / prev.fech - 1 - fee;
        row.varDia = row.fech / prev.fech - 1;
      } else { row.over = null; row.varDia = null; }
      const range = row.maxima - row.minima;
      row.posRange = range > 0 ? (row.fech - row.minima) / range : 0.5;
    }
    byTicker.set(ativo, arr);
  }
  const dates = Array.from(allDates).sort((a, b) => a - b);
  return { byTicker, dates };
}

/* ---------- persistência (window.storage), agrupada pela 1ª letra ---------- */
const KEY_PREFIX = "ovr3:g:";
function serializeGroup(store, letter) {
  const obj = {};
  for (const [ativo, m] of store) {
    if (ativo[0] !== letter) continue;
    obj[ativo] = Array.from(m.entries()).map(([ts, r]) =>
      [ts, r.abertura, r.maxima, r.minima, r.fech, r.vol, r.qtd ?? null]);
  }
  return JSON.stringify(obj);
}
function deserializeGroup(json, store) {
  const obj = JSON.parse(json);
  for (const ativo of Object.keys(obj)) {
    const m = new Map();
    for (const [ts, o, h, l, c, v, q] of obj[ativo]) {
      m.set(ts, { abertura: o, maxima: h, minima: l, fech: c, vol: v, qtd: q ?? null });
    }
    store.set(ativo, m);
  }
}
async function saveStore(store, letters) {
  const errs = [];
  for (const letter of letters) {
    try {
      await window.storage.set(KEY_PREFIX + letter, serializeGroup(store, letter));
    } catch (e) { errs.push(letter); }
  }
  return errs;
}
async function loadStore() {
  const store = new Map();
  try {
    const res = await window.storage.list(KEY_PREFIX);
    const keys = res?.keys || [];
    for (const k of keys) {
      try {
        const r = await window.storage.get(k);
        if (r?.value) deserializeGroup(r.value, store);
      } catch (e) { /* chave ausente */ }
    }
  } catch (e) { /* storage indisponível */ }
  return store;
}
async function clearStore() {
  try {
    const res = await window.storage.list(KEY_PREFIX);
    for (const k of (res?.keys || [])) {
      try { await window.storage.delete(k); } catch (e) {}
    }
  } catch (e) {}
}

/* ---------- ranking e sinais (iguais à v2) ---------- */
const BENCH_NAMES = ["IBOV", "BOVA11", "IBOVESPA", "BVSP", "^BVSP", "WIN$N", "INDFUT"];
function findBench(byTicker) {
  for (const n of BENCH_NAMES) if (byTicker.has(n)) return n;
  return null;
}
/* bench = { mode:'rv', ticker } ou { mode:'rf', annual (% a.a.) } */
function benchVarInWindow(ds, bench, winSet, nDias) {
  if (!bench) return null;
  if (bench.mode === "rf") return Math.pow(1 + bench.annual / 100, nDias / 252) - 1;
  if (bench.ticker && ds.byTicker.has(bench.ticker)) {
    const bw = ds.byTicker.get(bench.ticker).filter((r) => winSet.has(r.ts));
    if (bw.length >= 2) return bw[bw.length - 1].fech / bw[0].fech - 1;
  }
  return null;
}

function computeRanking(ds, refTs, lbDays, minVolMM, topN, criterio, bench) {
  const { byTicker, dates } = ds;
  const refIdx = dates.indexOf(refTs);
  if (refIdx < 0) return { rows: [], windowDates: [] };
  const start = Math.max(0, refIdx - lbDays + 1);
  const windowDates = dates.slice(start, refIdx + 1);
  const winSet = new Set(windowDates);
  const minVol = minVolMM * 1e6;
  const out = [];
  const benchTicker = bench?.mode === "rv" ? bench.ticker : null;
  const ibovVar = benchVarInWindow(ds, bench, winSet, windowDates.length);
  for (const [ativo, arr] of byTicker) {
    if (ativo === benchTicker) continue;
    const inWin = arr.filter((r) => winSet.has(r.ts));
    const overs = inWin.filter((r) => r.over != null).map((r) => r.over);
    const nMin = Math.max(5, Math.floor(0.7 * windowDates.length));
    if (inWin.length < nMin || overs.length < 5) continue;
    const volMed = inWin.reduce((s, r) => s + r.vol, 0) / inWin.length;
    if (volMed < minVol) continue;
    const mean = overs.reduce((s, v) => s + v, 0) / overs.length;
    const sd = Math.sqrt(overs.reduce((s, v) => s + (v - mean) ** 2, 0) / (overs.length - 1 || 1));
    const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(252) : 0;
    const win = overs.filter((v) => v > 0).length / overs.length;
    let eq = 1, peak = 1, maxDD = 0;
    const curve = overs.map((v) => {
      eq *= 1 + v;
      if (eq > peak) peak = eq;
      const dd = eq / peak - 1;
      if (dd < maxDD) maxDD = dd;
      return eq;
    });
    const comp = eq - 1; // resultado acumulado da estratégia na janela
    const stockVar = inWin[inWin.length - 1].fech / inWin[0].fech - 1; // variação da ação no período
    const atRef = inWin[inWin.length - 1];
    out.push({
      ativo, n: overs.length, volMed, mean, sharpe, win, curve,
      comp, maxDD, stockVar, alfaIbov: ibovVar != null ? comp - ibovVar : null,
      lastClose: atRef.fech, lastTs: atRef.ts,
    });
  }
  const keyFn = criterio === "media" ? (r) => r.mean : criterio === "win" ? (r) => r.win : (r) => r.sharpe;
  out.sort((a, b) => keyFn(b) - keyFn(a));
  return { rows: out, windowDates, ibovVar };
}

function computeSignals(ds, refTs, minVolMM, benchTicker) {
  const out = [];
  const minVol = minVolMM * 1e6;
  for (const [ativo, arr] of ds.byTicker) {
    if (ativo === benchTicker) continue;
    const idx = arr.findIndex((r) => r.ts === refTs);
    if (idx < 1) continue;
    const row = arr[idx];
    const w = arr.slice(Math.max(0, idx - 19), idx + 1);
    const volMed = w.reduce((s, r) => s + r.vol, 0) / w.length;
    if (volMed < minVol) continue;
    if (row.varDia != null && row.varDia <= -0.02 && row.posRange <= 0.15) {
      out.push({ ativo, varDia: row.varDia, posRange: row.posRange, volMed });
    }
  }
  out.sort((a, b) => a.varDia - b.varDia);
  return out;
}

/* ---------- exportação consolidada ---------- */
function buildConsolidatedCSV(store) {
  const tickers = Array.from(store.keys()).sort(); // A -> Z
  const hasQtd = tickers.some((t) => {
    for (const r of store.get(t).values()) if (r.qtd != null) return true;
    return false;
  });
  const lines = [];
  for (const t of tickers) {
    const rows = Array.from(store.get(t).entries()).sort((a, b) => b[0] - a[0]); // mais novo em cima
    for (const [ts, r] of rows) {
      const base = [
        t, fmtDate(ts), numBR(r.abertura), numBR(r.maxima), numBR(r.minima),
        numBR(r.fech), numBR(r.vol, 2),
      ];
      if (hasQtd) base.push(r.qtd != null ? String(Math.round(r.qtd)) : "");
      lines.push(base.join(";"));
    }
  }
  return lines.join("\r\n");
}
function downloadCSV(text, filename) {
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- carteira ponderada, benchmarks customizados e mês a mês ---------- */
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ymOf = (ts) => { const d = new Date(ts); return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1); };
function bestOf(o) {
  const cand = Object.entries(o).filter(([, v]) => v != null);
  if (cand.length === 0) return null;
  cand.sort((a, b) => b[1] - a[1]);
  return cand[0][0];
}

/* série diária da carteira: over e pos ponderados pelos valores investidos */
function buildCarteiraSeries(ds, carteira, ymIni, ymFim) {
  const membros = carteira.filter((c) => c.valor > 0 && ds.byTicker.has(c.ativo));
  if (membros.length === 0) return [];
  const idx = membros.map((m) => ({ ...m, map: new Map(ds.byTicker.get(m.ativo).map((r) => [r.ts, r])) }));
  const out = [];
  for (const ts of ds.dates) {
    const ym = ymOf(ts);
    if (ym < ymIni || ym > ymFim) continue;
    let wOver = 0, sOver = 0, wPos = 0, sPos = 0;
    for (const m of idx) {
      const r = m.map.get(ts);
      if (!r) continue;
      if (r.over != null) { sOver += m.valor * r.over; wOver += m.valor; }
      if (r.varDia != null) { sPos += m.valor * r.varDia; wPos += m.valor; }
    }
    if (wOver > 0 || wPos > 0) {
      out.push({ ts, over: wOver > 0 ? sOver / wOver : null, pos: wPos > 0 ? sPos / wPos : null });
    }
  }
  return out;
}

/* retornos diários de um benchmark segundo a especificação:
   {type:'custom', points} | {type:'rf', annual} | {type:'ticker', t} */
function benchDaily(ds, spec, ts) {
  if (!spec) return null;
  if (spec.type === "custom") return spec.map.get(ts) ?? null;
  if (spec.type === "ticker" && ds.byTicker.has(spec.t)) {
    const r = spec.map.get(ts);
    return r?.varDia ?? null;
  }
  return null; // rf tratado por mês
}
function specWithMap(ds, spec) {
  if (!spec) return null;
  if (spec.type === "custom") return { ...spec, map: new Map(spec.points) };
  if (spec.type === "ticker" && ds.byTicker.has(spec.t))
    return { ...spec, map: new Map(ds.byTicker.get(spec.t).map((r) => [r.ts, r])) };
  return spec;
}

/* matriz mês a mês da carteira: OVER, POS, BENCH e IBOV */
function computeMesames(ds, carteira, benchSpec, ibovTicker, ymIni, ymFim) {
  const serie = buildCarteiraSeries(ds, carteira, ymIni, ymFim);
  if (serie.length === 0) return null;
  const acc = new Map(); // ym -> {over,pos,bench,ibov, nOver...}
  const push = (ym, key, v) => {
    if (v == null) return;
    if (!acc.has(ym)) acc.set(ym, { over: 1, pos: 1, bench: 1, ibov: 1, nOver: 0, nPos: 0, nBench: 0, nIbov: 0 });
    const o = acc.get(ym);
    o[key] *= 1 + v;
    o["n" + key[0].toUpperCase() + key.slice(1)]++;
  };
  for (const r of serie) { push(ymOf(r.ts), "over", r.over); push(ymOf(r.ts), "pos", r.pos); }
  const bs = specWithMap(ds, benchSpec);
  const ib = ibovTicker ? specWithMap(ds, { type: "ticker", t: ibovTicker }) : null;
  for (const r of serie) {
    if (bs && bs.type !== "rf") push(ymOf(r.ts), "bench", benchDaily(ds, bs, r.ts));
    if (ib) push(ymOf(r.ts), "ibov", benchDaily(ds, ib, r.ts));
  }
  if (bs && bs.type === "rf") {
    const mensal = Math.pow(1 + bs.annual / 100, 1 / 12) - 1;
    for (const ym of acc.keys()) { const o = acc.get(ym); o.bench = 1 + mensal; o.nBench = 1; }
  }
  const years = Array.from(new Set(Array.from(acc.keys()).map((ym) => Math.floor(ym / 100)))).sort((a, b) => b - a);
  const cell = (ym, k) => {
    const o = acc.get(ym);
    if (!o) return null;
    const n = o["n" + k[0].toUpperCase() + k.slice(1)];
    return n > 0 ? o[k] - 1 : null;
  };
  const KEYS = ["over", "pos", "bench", "ibov"];
  const grid = years.map((y) => {
    const meses = MESES.map((_, i) => {
      const ym = y * 100 + i + 1;
      return { over: cell(ym, "over"), pos: cell(ym, "pos"), bench: cell(ym, "bench"), ibov: cell(ym, "ibov") };
    });
    const anual = {};
    for (const k of KEYS) {
      let acc2 = 1, has = false;
      for (const m of meses) if (m[k] != null) { acc2 *= 1 + m[k]; has = true; }
      anual[k] = has ? acc2 - 1 : null;
    }
    return { year: y, meses, anual, best: bestOf(anual) };
  });
  const total = {};
  for (const k of KEYS) {
    let acc2 = 1, has = false;
    for (const g of grid) if (g.anual[k] != null) { acc2 *= 1 + g.anual[k]; has = true; }
    total[k] = has ? acc2 - 1 : null;
  }
  return { grid, total, best: bestOf(total), serie };
}

/* leitura de arquivo de benchmark (csv/xlsx, 2 colunas: data; resultado diário) */
function excelSerialToTs(n) { return Math.round((n - 25569) * 86400000); }
async function parseBenchmarkFile(file) {
  const isXls = /\.(xlsx|xls)$/i.test(file.name);
  let rows = [];
  if (isXls) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  } else {
    const text = await new Promise((res, rej) => {
      const rd = new FileReader();
      rd.onload = () => res(rd.result); rd.onerror = () => rej(new Error("leitura"));
      rd.readAsText(file, "ISO-8859-1");
    });
    rows = Papa.parse(text, { delimiter: "", skipEmptyLines: true }).data;
  }
  const pts = []; let anyPct = false;
  for (const r of rows) {
    if (!r || r.length < 2) continue;
    let ts = null;
    const d0 = r[0];
    if (typeof d0 === "number" && d0 > 20000 && d0 < 80000) ts = excelSerialToTs(d0);
    else ts = parseDateBR(String(d0));
    if (ts == null) continue;
    let v = r[1];
    if (typeof v === "string") {
      if (v.includes("%")) anyPct = true;
      v = parseFloat(v.replace(/%/g, "").trim().replace(/\./g, "").replace(",", "."));
      if (isNaN(v)) v = parseFloat(String(r[1]).replace(/%/g, "").trim());
    }
    if (typeof v !== "number" || isNaN(v)) continue;
    pts.push([ts, v]);
  }
  if (pts.length === 0) return { points: [], asPercent: false };
  const absMed = pts.map((p) => Math.abs(p[1])).sort((a, b) => a - b)[Math.floor(pts.length / 2)];
  const asPercent = anyPct || absMed > 0.5; // valores tipo 0,45 => 0,45% ; tipo 0,0045 => já é fração
  const seen = new Map();
  for (const [ts, v] of pts) seen.set(ts, asPercent ? v / 100 : v);
  const points = Array.from(seen.entries()).sort((a, b) => a[0] - b[0]);
  return { points, asPercent };
}

/* desenha o painel mês a mês num canvas e baixa como PNG */
function exportMesamesPNG(comp, tituloCarteira, metricLabel, labelPeriodo, colLabels) {
  const rows = comp.grid;
  const colW = 60, rowH = 26, labW = 50, sumW = 76, bestW = 66;
  const w = labW + 12 * colW + 10 + sumW * 4 + bestW + 24;
  const h = 78 + (rows.length + 1) * rowH + 40;
  const cv = document.createElement("canvas");
  const scale = 2;
  cv.width = w * scale; cv.height = h * scale;
  const c = cv.getContext("2d");
  c.scale(scale, scale);
  const C = { bg: "#0E1116", panel: "#161B22", line: "#28313D", text: "#E8E4DA", dim: "#8B94A1", up: "#1F5C44", down: "#6B2B27", upT: "#7BE0B4", downT: "#F0A09A", amber: "#F0B347" };
  c.fillStyle = C.bg; c.fillRect(0, 0, w, h);
  c.fillStyle = C.amber; c.font = "700 14px monospace";
  c.fillText(`${tituloCarteira} — MÊS A MÊS`, 12, 24);
  c.fillStyle = C.dim; c.font = "11px monospace";
  c.fillText(`matriz: ${metricLabel} · período: ${labelPeriodo} · gerado em ${new Date().toLocaleDateString("pt-BR")}`, 12, 42);
  const x0 = 12, y0 = 56;
  c.font = "10px monospace"; c.fillStyle = C.dim;
  MESES.forEach((m, i) => c.fillText(m, x0 + labW + i * colW + 16, y0 + 14));
  const xSum = x0 + labW + 12 * colW + 10;
  colLabels.forEach((t, i) => c.fillText(String(t).slice(0, 9), xSum + i * sumW + 4, y0 + 14));
  c.fillText("MELHOR", xSum + 4 * sumW + 6, y0 + 14);
  const pct = (v, dec = 1) => (v * 100).toFixed(dec).replace(".", ",") + "%";
  const metricKey = comp.metricKey;
  rows.forEach((g, ri) => {
    const y = y0 + 20 + ri * rowH;
    c.fillStyle = C.text; c.font = "700 11px monospace";
    c.fillText(String(g.year), x0, y + 17);
    g.meses.forEach((m, mi) => {
      const v = m[metricKey];
      const x = x0 + labW + mi * colW;
      if (v == null) { c.fillStyle = C.panel; c.fillRect(x, y, colW - 3, rowH - 3); }
      else {
        c.fillStyle = v >= 0 ? C.up : C.down;
        c.fillRect(x, y, colW - 3, rowH - 3);
        c.fillStyle = v >= 0 ? C.upT : C.downT;
        c.font = "10px monospace";
        c.fillText(pct(v), x + 4, y + 16);
      }
    });
    ["over", "pos", "bench", "ibov"].forEach((k, i) => {
      const v = g.anual[k];
      const x = xSum + i * sumW;
      c.fillStyle = v == null ? C.panel : v >= 0 ? C.up : C.down;
      c.fillRect(x, y, sumW - 4, rowH - 3);
      if (v != null) {
        c.fillStyle = v >= 0 ? C.upT : C.downT;
        c.font = "700 10px monospace";
        c.fillText(pct(v), x + 4, y + 16);
      }
    });
    c.fillStyle = C.amber; c.font = "700 9px monospace";
    if (g.best) c.fillText(String(colLabels[["over","pos","bench","ibov"].indexOf(g.best)] ?? g.best).slice(0, 9), xSum + 4 * sumW + 6, y + 16);
  });
  const yT = y0 + 20 + rows.length * rowH + 8;
  c.strokeStyle = C.line; c.beginPath(); c.moveTo(x0, yT - 4); c.lineTo(w - 12, yT - 4); c.stroke();
  c.fillStyle = C.text; c.font = "700 11px monospace";
  c.fillText("TOTAL", x0, yT + 14);
  ["over", "pos", "bench", "ibov"].forEach((k, i) => {
    const v = comp.total[k];
    if (v != null) {
      c.fillStyle = v >= 0 ? C.upT : C.downT;
      c.fillText(pct(v, 1), xSum + i * sumW + 4, yT + 14);
    }
  });
  c.fillStyle = C.amber;
  if (comp.best) c.fillText("★", xSum + 4 * sumW + 6, yT + 14);
  cv.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mes_a_mes.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}

/* ---------- componentes visuais ---------- */
function Spark({ curve, w = 96, h = 26 }) {
  if (!curve || curve.length < 2) return null;
  const min = Math.min(...curve, 1), max = Math.max(...curve, 1);
  const span = max - min || 1;
  const pts = curve.map((v, i) => {
    const x = (i / (curve.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 3) - 1.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const upTrend = curve[curve.length - 1] >= 1;
  return (
    <svg width={w} height={h} style={{ display: "block" }} aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke={upTrend ? T.up : T.down} strokeWidth="1.5" />
    </svg>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px", borderRadius: 6, cursor: "pointer",
        fontFamily: T.mono, fontSize: 12.5, letterSpacing: 0.3,
        border: `1px solid ${active ? T.amber : T.line}`,
        background: active ? T.amberSoft : "transparent",
        color: active ? T.amber : T.dim,
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: T.faint, fontFamily: T.mono }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  background: T.panelSoft, border: `1px solid ${T.line}`, borderRadius: 6,
  color: T.text, padding: "7px 10px", fontFamily: T.mono, fontSize: 13, minWidth: 90,
};
const btnStyle = {
  ...inputStyle, cursor: "pointer", minWidth: 0,
};

function AuctionClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const target = new Date(brt); target.setHours(17, 55, 0, 0);
  const diff = target - brt;
  const dow = brt.getDay();
  const isWeekend = dow === 0 || dow === 6;
  let msg, urgent = false;
  if (isWeekend) msg = "mercado fechado";
  else if (diff > 0 && diff < 8 * 3600e3) {
    const hh = Math.floor(diff / 3600e3), mm = Math.floor((diff % 3600e3) / 60e3), ss = Math.floor((diff % 60e3) / 1e3);
    msg = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")} para o leilão`;
    urgent = diff < 45 * 60e3;
  } else msg = "fora da janela do leilão";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, fontFamily: T.mono, fontSize: 13,
      color: urgent ? T.amber : T.dim, padding: "6px 14px", borderRadius: 999,
      border: `1px solid ${urgent ? T.amber : T.line}`, background: urgent ? T.amberSoft : "transparent",
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: 99, background: urgent ? T.amber : T.faint,
        boxShadow: urgent ? `0 0 8px ${T.amber}` : "none",
      }} />
      {msg}
    </div>
  );
}

/* ---------- carteira: editor compartilhado (Comparar + Mês a mês) ---------- */
function CarteiraEditor({ carteira, onChange, tickers, marked, sizing, rank }) {
  const [novoAtivo, setNovoAtivo] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const total = carteira.reduce((s, c) => s + c.valor, 0);
  const add = () => {
    const v = parseFloat(String(novoValor).replace(",", "."));
    if (!novoAtivo || !(v > 0) || carteira.some((c) => c.ativo === novoAtivo)) return;
    onChange([...carteira, { ativo: novoAtivo, valor: v }]);
    setNovoAtivo(""); setNovoValor("");
  };
  const importarMarcados = () => {
    if (!marked || marked.size === 0) return;
    const next = Array.from(marked).map((a) => ({
      ativo: a,
      valor: sizing?.alloc.get(a)?.valor ?? 100000,
    }));
    onChange(next);
  };
  return (
    <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontWeight: 650, fontSize: 15 }}>Carteira analisada</span>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.faint }}>
          {carteira.length} ativos · total R$ {fmtBRL(total)}
        </span>
        <span style={{ flex: 1 }} />
        {marked && marked.size > 0 && (
          <button onClick={importarMarcados} style={{ ...btnStyle, fontSize: 11.5, color: T.up, borderColor: T.up }}>
            ★ importar {marked.size} marcados da aba Hoje
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: carteira.length ? 12 : 0 }}>
        <select value={novoAtivo} onChange={(e) => setNovoAtivo(e.target.value)} style={{ ...inputStyle, minWidth: 110 }}>
          <option value="">ativo…</option>
          {tickers.filter((t) => !carteira.some((c) => c.ativo === t)).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="number" placeholder="valor (R$)" min="0" step="1000" value={novoValor}
          onChange={(e) => setNovoValor(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          style={{ ...inputStyle, width: 130 }} />
        <button onClick={add} style={{ ...btnStyle, color: T.amber, borderColor: T.amber }}>+ adicionar</button>
        {carteira.length > 0 && (
          <button onClick={() => onChange([])} style={{ ...btnStyle, color: T.faint, fontSize: 11.5 }}>limpar carteira</button>
        )}
      </div>
      {carteira.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {carteira.map((c) => (
            <span key={c.ativo} style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 10px",
              border: `1px solid ${T.line}`, borderRadius: 6, fontFamily: T.mono, fontSize: 12,
              background: T.panelSoft,
            }}>
              <b style={{ color: T.amber }}>{c.ativo}</b>
              <input type="number" value={c.valor} min="0" step="1000"
                onChange={(e) => {
                  const v = Math.max(0, +e.target.value || 0);
                  onChange(carteira.map((x) => (x.ativo === c.ativo ? { ...x, valor: v } : x)));
                }}
                style={{ ...inputStyle, width: 100, padding: "3px 6px", fontSize: 11.5 }} />
              <span style={{ color: T.faint, fontSize: 11 }}>
                {total > 0 ? Math.round((c.valor / total) * 100) + "%" : ""}
              </span>
              <button onClick={() => onChange(carteira.filter((x) => x.ativo !== c.ativo))}
                title="remover" style={{ background: "none", border: "none", color: T.down, cursor: "pointer", fontSize: 13, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- benchmarks: upload nomeado e linha de gestão ---------- */
function BmUploader({ onAdd }) {
  const [name, setName] = useState("");
  const ref = useRef(null);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <input type="text" placeholder="nome do benchmark" value={name} maxLength={30}
        onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, width: 190 }} />
      <button onClick={() => ref.current?.click()} style={{ ...btnStyle, color: T.amber, borderColor: T.amber }}>
        + carregar planilha
      </button>
      <input ref={ref} type="file" accept=".csv,.txt,.xlsx,.xls" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(f, name.trim()); e.target.value = ""; setName(""); }} />
    </div>
  );
}
function BmRow({ bm, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [nm, setNm] = useState(bm.name);
  const [confirm, setConfirm] = useState(false);
  const ini = bm.points[0]?.[0], fim = bm.points[bm.points.length - 1]?.[0];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "7px 10px", border: `1px solid ${T.line}`, borderRadius: 6, fontFamily: T.mono, fontSize: 12 }}>
      {editing ? (
        <>
          <input value={nm} maxLength={30} onChange={(e) => setNm(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { onRename(bm.id, nm.trim() || bm.name); setEditing(false); } }}
            style={{ ...inputStyle, width: 180, padding: "4px 8px" }} autoFocus />
          <button onClick={() => { onRename(bm.id, nm.trim() || bm.name); setEditing(false); }}
            style={{ ...btnStyle, padding: "3px 10px", fontSize: 11, color: T.up, borderColor: T.up }}>salvar</button>
        </>
      ) : (
        <b style={{ color: T.text }}>{bm.name}</b>
      )}
      <span style={{ color: T.faint }}>{bm.points.length} pregões</span>
      {ini != null && <span style={{ color: T.faint }}>{fmtDate(ini)} → {fmtDate(fim)}</span>}
      <span style={{ flex: 1 }} />
      {!editing && (
        <button onClick={() => { setNm(bm.name); setEditing(true); }}
          style={{ ...btnStyle, padding: "3px 10px", fontSize: 11, color: T.dim }}>renomear</button>
      )}
      <button onClick={() => { if (confirm) onRemove(bm.id); else { setConfirm(true); setTimeout(() => setConfirm(false), 4000); } }}
        style={{ ...btnStyle, padding: "3px 10px", fontSize: 11, color: confirm ? T.down : T.faint, borderColor: confirm ? T.down : T.line }}>
        {confirm ? "confirmar exclusão?" : "excluir"}
      </button>
    </div>
  );
}

/* ================================ APP ================================ */
export default function App() {
  const storeRef = useRef(new Map()); // ticker -> Map ts -> registro
  const [dataRev, setDataRev] = useState(0); // incrementa a cada mudança na base
  const [booting, setBooting] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [mergeMsg, setMergeMsg] = useState(null);
  const [saveWarn, setSaveWarn] = useState(null);
  const [baseMeta, setBaseMeta] = useState(null);     // metadados do COTAHIST publicado
  const [baseErro, setBaseErro] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [aoVivo, setAoVivo] = useState(null);         // {estado, consultadoEm, n}
  const [buscandoVivo, setBuscandoVivo] = useState(false);
  const [tab, setTab] = useState("hoje");

  const [feePct, setFeePct] = useState(0.046);
  const [lbDays, setLbDays] = useState(10);
  const [customLb, setCustomLb] = useState("");
  const [minVolMM, setMinVolMM] = useState(40);
  const [topN, setTopN] = useState(10);
  const [criterio, setCriterio] = useState("sharpe");
  const [capitalAlvo, setCapitalAlvo] = useState(2000000);
  const [maxImpact, setMaxImpact] = useState(0.1);
  const [refTs, setRefTs] = useState(null);
  // ----- carteira compartilhada (Comparar + Mês a mês) -----
  const [carteira, setCarteira] = useState([]); // [{ativo, valor}]
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("ovr3:carteira");
        if (r?.value) setCarteira(JSON.parse(r.value));
      } catch (e) { /* sem carteira salva */ }
    })();
  }, []);
  const saveCarteira = (next) => {
    setCarteira(next);
    window.storage.set("ovr3:carteira", JSON.stringify(next)).catch(() => {});
  };

  // ----- benchmarks customizados (nome + série diária de resultados) -----
  const [customBms, setCustomBms] = useState([]); // [{id, name, points}]
  const [bmMsg, setBmMsg] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const idx = await window.storage.get("ovr3:bmidx");
        if (!idx?.value) return;
        const list = JSON.parse(idx.value);
        const out = [];
        for (const it of list) {
          try {
            const r = await window.storage.get("ovr3:bm:" + it.id);
            if (r?.value) out.push({ id: it.id, name: it.name, points: JSON.parse(r.value) });
          } catch (e) { /* item ausente */ }
        }
        setCustomBms(out);
      } catch (e) { /* sem índice */ }
    })();
  }, []);
  const persistBmIndex = (list) =>
    window.storage.set("ovr3:bmidx", JSON.stringify(list.map(({ id, name }) => ({ id, name })))).catch(() => {});
  const addBenchmark = async (file, name) => {
    try {
      const { points, asPercent } = await parseBenchmarkFile(file);
      if (points.length < 5) { setBmMsg("Arquivo sem dados válidos (esperado: coluna de data + coluna de resultado diário)."); return; }
      const id = String(Date.now());
      const item = { id, name: (name || file.name.replace(/\.[^.]+$/, "")).slice(0, 30), points };
      const next = [...customBms, item];
      setCustomBms(next);
      persistBmIndex(next);
      window.storage.set("ovr3:bm:" + id, JSON.stringify(points)).catch(() => {});
      setBmMsg(`"${item.name}": ${points.length} pregões carregados (valores lidos como ${asPercent ? "porcentagem" : "fração decimal"}).`);
    } catch (e) { setBmMsg("Falha ao ler o arquivo do benchmark."); }
  };
  const renameBenchmark = (id, name) => {
    const next = customBms.map((b) => (b.id === id ? { ...b, name: name.slice(0, 30) } : b));
    setCustomBms(next); persistBmIndex(next);
  };
  const removeBenchmark = async (id) => {
    const next = customBms.filter((b) => b.id !== id);
    setCustomBms(next); persistBmIndex(next);
    try { await window.storage.delete("ovr3:bm:" + id); } catch (e) {}
    setCmpSelBms((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setMmBench((prev) => (prev.type === "custom" && prev.id === id ? { type: "rf", annual: 12 } : prev));
  };

  const [perIni, setPerIni] = useState(null);
  const [perFim, setPerFim] = useState(null);
  const [cmpView, setCmpView] = useState("acum");     // 'acum' | 'diario'
  const [cmpSelBms, setCmpSelBms] = useState(() => new Set());
  const [mmMetric, setMmMetric] = useState("over");
  const [mmBench, setMmBench] = useState({ type: "rf", annual: 12 });

  const [showAll, setShowAll] = useState(false);
  const [tickerSel, setTickerSel] = useState(null);
  const [viewSort, setViewSort] = useState(null);        // {key, dir:'desc'|'asc'} — só reordena a exibição
  const DEFAULT_COLS = ["mark","idx","ativo","media","win","sharpe","comp","maxDD","stockVar","alfa","volMed","cap","sugestao","acoes","acum","curva"];
  const [colOrder, setColOrder] = useState(DEFAULT_COLS);
  const dragCol = useRef(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("ovr3:colOrder");
        if (r?.value) {
          const saved = JSON.parse(r.value).filter((c) => DEFAULT_COLS.includes(c));
          const missing = DEFAULT_COLS.filter((c) => !saved.includes(c));
          if (saved.length) setColOrder([...saved, ...missing]);
        }
      } catch (e) { /* sem ordem salva */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const moveCol = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    setColOrder((prev) => {
      const next = prev.filter((c) => c !== fromId);
      next.splice(next.indexOf(toId), 0, fromId);
      window.storage.set("ovr3:colOrder", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const headerSort = (key) => {
    setViewSort((prev) => prev && prev.key === key
      ? (prev.dir === "desc" ? { key, dir: "asc" } : null)
      : { key, dir: "desc" });
  };
  const [confirmClear, setConfirmClear] = useState(false);
  const [marked, setMarked] = useState(() => new Set());
  const fileRef = useRef(null);

  /* marcados do dia: carregar/salvar */
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("ovr3:marcados");
        if (r?.value) setMarked(new Set(JSON.parse(r.value)));
      } catch (e) { /* sem marcados salvos */ }
    })();
  }, []);
  const toggleMark = useCallback((ativo) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(ativo)) next.delete(ativo); else next.add(ativo);
      window.storage.set("ovr3:marcados", JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }, []);

  /* sincroniza com o COTAHIST publicado — sempre sobrescreve o histórico */
  const sincronizarBase = useCallback(async () => {
    setSincronizando(true); setBaseErro(null);
    try {
      const { incoming, meta } = await fetchBaseRemota();
      const { added, revised } = mergeIntoStore(storeRef.current, incoming);
      setBaseMeta(meta);
      setDataRev((r) => r + 1);
      setMergeMsg(`Base oficial sincronizada: ${fmtBRL(added)} pregões novos, ${fmtBRL(revised)} revisados.`);
      return true;
    } catch (e) {
      setBaseErro(e.message || "falha ao sincronizar a base");
      return false;
    } finally {
      setSincronizando(false);
    }
  }, []);

  /* carregar ao abrir: primeiro o que estiver salvo local, depois o oficial por cima */
  useEffect(() => {
    (async () => {
      storeRef.current = await loadStore();
      setDataRev((r) => r + 1);
      await sincronizarBase();
      setBooting(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ds = useMemo(() => {
    if (storeRef.current.size === 0) return null;
    return computeDataset(storeRef.current, feePct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataRev, feePct]);

  useEffect(() => {
    if (ds && (refTs == null || !ds.dates.includes(refTs))) {
      setRefTs(ds.dates[ds.dates.length - 1] ?? null);
    }
    if (ds && tickerSel == null) setTickerSel(Array.from(ds.byTicker.keys()).sort()[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds]);

  /* upload + merge */
  const handleFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []).filter((f) => f && /\.(csv|txt)$/i.test(f.name));
    if (files.length === 0) return;
    setParsing(true); setMergeMsg(null); setSaveWarn(null);
    const readOne = (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          Papa.parse(reader.result, {
            delimiter: ";", skipEmptyLines: true,
            complete: (res) => resolve(res.data),
            error: () => resolve([]),
          });
        };
        reader.onerror = () => resolve([]);
        reader.readAsText(file, "ISO-8859-1");
      });
    Promise.all(files.map(readOne)).then(async (all) => {
      const { incoming } = parseRowsToIncoming(all.flat());
      const { added, revised, kept, changed } = mergeIntoStore(storeRef.current, incoming);
      setDataRev((r) => r + 1);
      setMergeMsg(
        `${files.length} arquivo(s): ${fmtBRL(added)} pregões novos, ${fmtBRL(revised)} revisados, ${fmtBRL(kept)} já existiam (mantidos). ` +
        `Atenção: o que o COTAHIST cobrir será sobrescrito na próxima sincronização.`
      );
      setParsing(false);
      // persistir só os grupos alterados
      const letters = new Set(Array.from(changed).map((t) => t[0]));
      const errs = await saveStore(storeRef.current, letters);
      if (errs.length) setSaveWarn(`Falha ao salvar grupos: ${errs.join(", ")} — os dados seguem na sessão, tente carregar de novo para regravar.`);
    });
  }, []);

  const autoBench = useMemo(() => (ds ? findBench(ds.byTicker) : null), [ds]);
  const benchObj = useMemo(() => (autoBench ? { mode: "rv", ticker: autoBench, label: autoBench } : null), [autoBench]);
  const benchLabel = benchObj?.label ?? "IBOV";
  const benchTickerRV = benchObj?.ticker ?? null;

  // ----- derivados da carteira (dependem de ds) -----
  const carteiraYms = useMemo(() => {
    if (!ds || carteira.length === 0) return [];
    const set = new Set();
    for (const c of carteira) {
      if (!ds.byTicker.has(c.ativo)) continue;
      for (const r of ds.byTicker.get(c.ativo)) set.add(ymOf(r.ts));
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [ds, carteira]);
  useEffect(() => {
    if (carteiraYms.length > 0) {
      if (perIni == null || !carteiraYms.includes(perIni)) setPerIni(carteiraYms[0]);
      if (perFim == null || !carteiraYms.includes(perFim)) setPerFim(carteiraYms[carteiraYms.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carteiraYms]);

  const mesames = useMemo(() => {
    if (!ds || (tab !== "mesames" && tab !== "comparar") || carteira.length === 0 || perIni == null || perFim == null) return null;
    let spec = mmBench;
    if (spec.type === "custom") {
      const bm = customBms.find((b) => b.id === spec.id);
      spec = bm ? { type: "custom", id: bm.id, points: bm.points } : { type: "rf", annual: 12 };
    }
    const r = computeMesames(ds, carteira, spec, benchTickerRV, perIni, perFim);
    if (r) r.metricKey = mmMetric;
    return r;
  }, [ds, tab, carteira, perIni, perFim, mmBench, mmMetric, customBms, benchTickerRV]);


  const rank = useMemo(() => {
    if (!ds || refTs == null) return null;
    return computeRanking(ds, refTs, lbDays, minVolMM, topN, criterio, benchObj);
  }, [ds, refTs, lbDays, minVolMM, topN, criterio, benchObj]);

  const signals = useMemo(() => {
    if (!ds || refTs == null) return [];
    return computeSignals(ds, refTs, minVolMM, benchTickerRV);
  }, [ds, refTs, minVolMM, benchTickerRV]);

  // alocação da noite: desce o ranking respeitando o teto de impacto até o capital alvo
  const sizing = useMemo(() => {
    if (!rank || rank.rows.length === 0) return null;
    const alloc = new Map();
    let cum = 0;
    const capTotal = rank.rows.reduce((s, r) => s + (r.volMed * maxImpact) / 100, 0);
    for (let i = 0; i < rank.rows.length; i++) {
      const r = rank.rows[i];
      const cap = (r.volMed * maxImpact) / 100;
      const falta = capitalAlvo - cum;
      if (falta <= 0) break;
      const vRound = Math.floor(Math.min(cap, falta) / 100) * 100;
      if (vRound <= 0) continue;
      cum += vRound;
      alloc.set(r.ativo, { valor: vRound, cap, cum });
    }
    return { alloc, total: cum, capTotal, nUsados: alloc.size };
  }, [rank, capitalAlvo, maxImpact]);

  const refDate = refTs != null ? new Date(refTs) : null;
  const refDow = refDate ? refDate.getUTCDay() : null;

  const staleTickers = useMemo(() => {
    if (!ds || refTs == null) return 0;
    let stale = 0;
    for (const [, arr] of ds.byTicker) if (arr[arr.length - 1].ts < refTs) stale++;
    return stale;
  }, [ds, refTs]);

  const dowGuide = (() => {
    if (refDow == null) return null;
    switch (refDow) {
      case 1: return { warn: false, text: "Montagem de segunda → venda terça na abertura. Overnight normal." };
      case 2: return { warn: false, text: "Montagem de terça → venda quarta na abertura. Historicamente uma das boas montagens." };
      case 3: return { warn: false, text: "Montagem de quarta → venda quinta na abertura. Se houver sinais de reversão, priorize-os." };
      case 4: return lbDays <= 21
        ? { warn: false, text: "Quinta com janela curta e re-ranqueamento frequente: no backtest fora da amostra a montagem ficou ~neutra (-0,02%). Pode operar normalmente — mas é o dia mais fraco da semana junto com quarta." }
        : { warn: true, text: "QUINTA com janela longa: o gap quinta→sexta foi negativo no backtest (-0,13% na carteira de 12 meses). Sugestão validada: monte normalmente, mas não venda na abertura de sexta — segure e venda na abertura de segunda. Com janela curta re-ranqueada diariamente, esse ajuste não é necessário." };
      case 5: return { warn: false, text: "Montagem de sexta → venda segunda na abertura. Melhor overnight da semana no backtest (+0,26% na carteira, fora da amostra)." };
      default: return { warn: false, text: "Data de referência cai em fim de semana — verifique os dados." };
    }
  })();

  const tickers = useMemo(
    () => (ds ? Array.from(ds.byTicker.keys()).sort() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ds]
  );
  const tickerRows = useMemo(() => {
    if (!ds || !tickerSel || !ds.byTicker.has(tickerSel)) return [];
    return ds.byTicker.get(tickerSel).slice().reverse(); // mais novo em cima
  }, [ds, tickerSel]);

  const totalRows = useMemo(() => {
    let n = 0;
    for (const [, m] of storeRef.current) n += m.size;
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataRev]);

  const handleClear = async () => {
    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 4000); return; }
    await clearStore();
    storeRef.current = new Map();
    setDataRev((r) => r + 1);
    setRefTs(null); setTickerSel(null); setMergeMsg(null); setConfirmClear(false);
  };

  /* Retrato do pregão em andamento — o "clique" que substitui o download manual.
     O que entrar aqui é provisório: o COTAHIST sobrescreve à noite. */
  const buscarAoVivo = useCallback(async () => {
    const lista = Array.from(storeRef.current.keys());
    if (lista.length === 0) return;
    setBuscandoVivo(true); setBaseErro(null);
    try {
      const { incoming, estado, consultadoEm, ausentes } = await fetchCotacoesAoVivo(lista);
      const { added, revised } = mergeIntoStore(storeRef.current, incoming);
      setDataRev((r) => r + 1);
      setAoVivo({ estado, consultadoEm, n: incoming.size });
      setMergeMsg(
        `Cotação ao vivo: ${incoming.size} ativos (${fmtBRL(added)} pregões novos, ${fmtBRL(revised)} atualizados)` +
        (ausentes.length ? ` · ${ausentes.length} sem retorno` : "") +
        `. Valores provisórios até o COTAHIST da noite.`
      );
    } catch (e) {
      setBaseErro(e.message || "falha ao buscar cotação ao vivo");
    } finally {
      setBuscandoVivo(false);
    }
  }, []);

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{
      padding: "8px 16px", cursor: "pointer", background: "transparent",
      border: "none", borderBottom: `2px solid ${tab === id ? T.amber : "transparent"}`,
      color: tab === id ? T.text : T.faint, fontFamily: T.mono, fontSize: 13, letterSpacing: 0.5,
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans }}>
      <style>{`
        input[type=number]::-webkit-inner-spin-button{opacity:.4}
        select option{background:${T.panel}}
        tr.rowhover:hover td{background:${T.panelSoft}}
        @media (prefers-reduced-motion: reduce){*{transition:none!important}}
        button:focus-visible, input:focus-visible, select:focus-visible{outline:2px solid ${T.amber}; outline-offset:1px}
      `}</style>

      <header style={{
        display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between",
        padding: "18px 26px 0", borderBottom: `1px solid ${T.line}`,
      }}>
        <div>
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 2.5, color: T.amber }}>B3 · ESTRATÉGIA OVERNIGHT</div>
          <h1 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 650, letterSpacing: -0.3 }}>
            Leilão Overnight <span style={{ fontSize: 12, color: T.faint, fontFamily: T.mono }}>v10</span>
          </h1>
        </div>
        <AuctionClock />
        <div style={{ width: "100%", display: "flex", gap: 4 }}>
          {tabBtn("hoje", "HOJE")}
          {tabBtn("base", "BASE DE DADOS")}
          {tabBtn("comparar", "COMPARAR ESTRATÉGIAS")}
          {tabBtn("mesames", "MÊS A MÊS")}
        </div>
      </header>

      <main style={{ width: "100%", maxWidth: "none", margin: 0, padding: "22px 28px 60px", boxSizing: "border-box" }}>
        {booting && (
          <div style={{ fontFamily: T.mono, color: T.faint, padding: 40, textAlign: "center" }}>
            Sincronizando com a base oficial da B3…
          </div>
        )}

        {/* barra da base: sempre visível após boot */}
        {!booting && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
            fontFamily: T.mono, fontSize: 12, color: T.dim, marginBottom: 18,
          }}>
            {ds ? (
              <>
                <span style={{ color: T.text }}>{tickers.length} ativos</span>
                <span>{fmtBRL(totalRows)} registros</span>
                <span>{fmtDate(ds.dates[0])} → {fmtDate(ds.dates[ds.dates.length - 1])}</span>
                {baseMeta?.ultimoPregao && (
                  <span style={{ color: T.faint }}>COTAHIST até {baseMeta.ultimoPregao.split("-").reverse().join("/")}</span>
                )}
                {aoVivo && (
                  <span style={{ color: T.up }}>
                    ● ao vivo {aoVivo.n} ativos
                    {aoVivo.consultadoEm ? ` · ${new Date(aoVivo.consultadoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}` : ""}
                    {aoVivo.estado && aoVivo.estado !== "REGULAR" ? ` · mercado ${aoVivo.estado}` : ""}
                  </span>
                )}
                {staleTickers > 0 && tab === "hoje" && (
                  <span style={{ color: T.amber }}>⚠ {staleTickers} ativos sem dados até a data de referência</span>
                )}
              </>
            ) : (
              <span>Base vazia — sincronize com a B3 ou carregue um CSV.</span>
            )}
            <span style={{ flex: 1 }} />
            <button style={{ ...btnStyle, color: T.up, borderColor: T.up }}
              onClick={buscarAoVivo} disabled={buscandoVivo || !ds}>
              {buscandoVivo ? "buscando…" : "● cotação de agora"}
            </button>
            <button style={{ ...btnStyle, color: T.amber, borderColor: T.amber }}
              onClick={sincronizarBase} disabled={sincronizando}>
              {sincronizando ? "sincronizando…" : "↻ sincronizar base"}
            </button>
            <button style={btnStyle}
              onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? "processando…" : "+ CSV manual"}
            </button>
            {ds && (
              <button style={btnStyle}
                onClick={() => downloadCSV(buildConsolidatedCSV(storeRef.current),
                  `consolidado_overnight_${new Date().toISOString().slice(0, 10)}.csv`)}>
                ⬇ baixar consolidado
              </button>
            )}
            {ds && (
              <button style={{ ...btnStyle, color: confirmClear ? T.down : T.faint, borderColor: confirmClear ? T.down : T.line }}
                onClick={handleClear}>
                {confirmClear ? "confirmar limpeza?" : "limpar base"}
              </button>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept=".csv,.txt" multiple style={{ display: "none" }}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

        {mergeMsg && (
          <div style={{
            border: `1px solid ${T.line}`, background: T.panel, borderRadius: 8,
            padding: "9px 14px", marginBottom: 16, fontFamily: T.mono, fontSize: 12, color: T.up,
          }}>{mergeMsg}</div>
        )}
        {baseErro && (
          <div style={{
            border: `1px solid ${T.down}`, background: T.panel, borderRadius: 8,
            padding: "9px 14px", marginBottom: 16, fontFamily: T.mono, fontSize: 12, color: T.down,
          }}>{baseErro} — os dados já carregados seguem disponíveis.</div>
        )}
        {saveWarn && (
          <div style={{
            border: `1px solid ${T.down}`, background: T.panel, borderRadius: 8,
            padding: "9px 14px", marginBottom: 16, fontFamily: T.mono, fontSize: 12, color: T.down,
          }}>{saveWarn}</div>
        )}

        {/* zona de upload quando vazio */}
        {!booting && !ds && (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            style={{
              border: `1.5px dashed ${T.line}`, borderRadius: 12, padding: "70px 30px",
              textAlign: "center", cursor: "pointer", background: T.panel,
            }}
          >
            <div style={{ fontFamily: T.mono, fontSize: 13, color: T.amber, letterSpacing: 1.5, marginBottom: 10 }}>
              {parsing ? "PROCESSANDO..." : "BASE VAZIA"}
            </div>
            <div style={{ color: T.dim, fontSize: 14, maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
              A base oficial não pôde ser lida. Ela é publicada em <code style={{ fontFamily: T.mono, color: T.faint }}>{URL_BASE}</code> pela
              rotina de coleta do COTAHIST — se este é o primeiro acesso, rode a carga inicial no GitHub Actions.
              <div style={{ marginTop: 14 }}>
                <button style={{ ...btnStyle, color: T.amber, borderColor: T.amber, marginRight: 8 }}
                  onClick={(e) => { e.stopPropagation(); sincronizarBase(); }} disabled={sincronizando}>
                  {sincronizando ? "sincronizando…" : "↻ tentar de novo"}
                </button>
                <button style={btnStyle} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                  + carregar CSV manualmente
                </button>
              </div>
              <div style={{ marginTop: 14, fontSize: 12.5, color: T.faint }}>
                Formato aceito no CSV manual: Ativo;Data;Abertura;Máxima;Mínima;Fechamento;Volume R$[;Quantidade].
                Overnight = abertura(D) ÷ fechamento(D−1) − 1 − taxa.
              </div>
            </div>
          </div>
        )}

        {/* ======================= ABA OPERAÇÃO ======================= */}
        {ds && tab === "hoje" && (
          <>
            <section style={{
              background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10,
              padding: "16px 18px", marginBottom: 20,
            }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: T.faint, fontFamily: T.mono, marginRight: 4 }}>
                  Janela de análise
                </span>
                {LOOKBACKS.map((l) => (
                  <Chip key={l.days} active={lbDays === l.days && !customLb} onClick={() => { setLbDays(l.days); setCustomLb(""); }}>
                    {l.label}
                  </Chip>
                ))}
                <input
                  type="number" min="5" max="600" placeholder="custom (pregões)"
                  value={customLb}
                  onChange={(e) => {
                    setCustomLb(e.target.value);
                    const v = parseInt(e.target.value, 10);
                    if (v >= 5) setLbDays(v);
                  }}
                  style={{ ...inputStyle, width: 150, borderColor: customLb ? T.amber : T.line }}
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end" }}>
                <Field label="Data de referência">
                  <select value={refTs ?? ""} onChange={(e) => setRefTs(+e.target.value)} style={{ ...inputStyle, minWidth: 130 }}>
                    {ds.dates.slice().reverse().slice(0, 400).map((t) => (
                      <option key={t} value={t}>{fmtDate(t)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Volume mín. (R$ MM)">
                  <input type="number" min="0" value={minVolMM} onChange={(e) => setMinVolMM(+e.target.value || 0)} style={inputStyle} />
                </Field>
                <Field label="Top N">
                  <input type="number" min="1" max="40" value={topN} onChange={(e) => setTopN(Math.max(1, +e.target.value || 10))} style={inputStyle} />
                </Field>
                <Field label="Critério / ordenação">
                  <div style={{ display: "flex", gap: 6 }}>
                    <Chip active={criterio === "sharpe"} onClick={() => setCriterio("sharpe")}>Sharpe</Chip>
                    <Chip active={criterio === "media"} onClick={() => setCriterio("media")}>Média/dia</Chip>
                    <Chip active={criterio === "win"} onClick={() => setCriterio("win")}>Win</Chip>
                  </div>
                </Field>
                <Field label="Taxa por operação (%)">
                  <input type="number" step="0.001" min="0" value={feePct} onChange={(e) => setFeePct(+e.target.value || 0)} style={inputStyle} />
                </Field>
                <Field label="Capital alvo (R$)">
                  <input type="number" step="100000" min="100000" value={capitalAlvo}
                    onChange={(e) => setCapitalAlvo(Math.max(100000, +e.target.value || 2000000))}
                    style={{ ...inputStyle, width: 120 }} />
                </Field>
                <Field label="Impacto máx (% do vol)">
                  <input type="number" step="0.01" min="0.01" max="5" value={maxImpact}
                    onChange={(e) => setMaxImpact(Math.max(0.01, +e.target.value || 0.1))}
                    style={inputStyle} />
                </Field>
              </div>
            </section>

            {dowGuide && (
              <div style={{
                border: `1px solid ${dowGuide.warn ? T.amber : T.line}`,
                background: dowGuide.warn ? T.amberSoft : T.panel,
                borderRadius: 10, padding: "12px 16px", marginBottom: 20,
                fontSize: 13.5, lineHeight: 1.55, color: dowGuide.warn ? T.amber : T.dim,
              }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1.5, marginRight: 10, color: dowGuide.warn ? T.amber : T.faint }}>
                  MONTAGEM DE {DOW[refDow]?.toUpperCase()}
                </span>
                {dowGuide.text}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 20, alignItems: "start" }}
              className="grid-main">
              <style>{`@media(max-width:960px){.grid-main{grid-template-columns:1fr!important}}`}</style>

              <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 650, fontSize: 15 }}>Ranking e alocação da noite</span>
                    <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.faint, marginLeft: 10 }}>
                      últimos {rank?.windowDates?.length ?? lbDays} pregões até {refDate ? fmtDate(refTs) : "—"}
                    </span>
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.faint }}>
                    {rank?.rows.length ?? 0} ativos elegíveis
                  </span>
                </div>
                {sizing && (
                  <div style={{
                    padding: "10px 18px", borderBottom: `1px solid ${T.line}`, display: "flex",
                    flexWrap: "wrap", gap: 16, fontFamily: T.mono, fontSize: 12, alignItems: "baseline",
                  }}>
                    <span style={{ color: T.text }}>
                      Sugestão: <span style={{ color: T.amber, fontWeight: 700 }}>R$ {fmtBRL(sizing.total)}</span> em {sizing.nUsados} ativos
                    </span>
                    <span style={{ color: T.faint }}>impacto máx {maxImpact.toLocaleString("pt-BR")}% do vol. médio por papel</span>
                    <span style={{ color: T.faint }}>capacidade da lista: R$ {fmtBRL(sizing.capTotal / 1e6, 1)}M</span>
                    {rank?.ibovVar != null && (
                      <span style={{ color: rank.ibovVar >= 0 ? T.up : T.down }}>
                        {benchLabel} no período: {fmtPct(rank.ibovVar, 2)}
                      </span>
                    )}
                    {!benchObj && (
                      <span style={{ color: T.faint }}>
                        (carregue IBOV/BOVA11 ou configure um benchmark para habilitar os comparativos)
                      </span>
                    )}
                    {marked.size > 0 && (() => {
                      const tot = rank.rows.filter((r) => marked.has(r.ativo))
                        .reduce((s, r) => s + (sizing.alloc.get(r.ativo)?.valor ?? 0), 0);
                      return (
                        <>
                          <span style={{ color: T.up }}>
                            ★ {marked.size} marcados = R$ {fmtBRL(tot)}
                          </span>
                          <button
                            onClick={() => {
                              setMarked(new Set());
                              window.storage.set("ovr3:marcados", "[]").catch(() => {});
                            }}
                            style={{ ...btnStyle, padding: "3px 10px", fontSize: 11, color: T.faint }}>
                            desmarcar tudo
                          </button>
                        </>
                      );
                    })()}
                    {sizing.total < 1000000 && (
                      <span style={{ color: T.down }}>⚠ não fecha R$ 1M — reduza o volume mínimo ou aumente o impacto máximo</span>
                    )}
                    {sizing.total >= 1000000 && sizing.total < capitalAlvo && (
                      <span style={{ color: T.amber }}>lista inteira não alcança o alvo de R$ {fmtBRL(capitalAlvo / 1e6, 1)}M</span>
                    )}
                  </div>
                )}
                {(() => {
                  // definição das colunas: label, alinhamento, chave de ordenação e render
                  const COLS = {
                    mark:    { label: "★", al: "left", sort: null },
                    idx:     { label: "#", al: "left", sort: null },
                    ativo:   { label: "ATIVO", al: "left", sort: null },
                    media:   { label: "MÉDIA/DIA", al: "right", sort: (r) => r.mean },
                    win:     { label: "WIN", al: "right", sort: (r) => r.win },
                    sharpe:  { label: "SHARPE", al: "right", sort: (r) => r.sharpe },
                    comp:    { label: "COMPOSTO", al: "right", sort: (r) => r.comp },
                    maxDD:   { label: "MAX DD", al: "right", sort: (r) => r.maxDD },
                    stockVar:{ label: "AÇÃO PERÍODO", al: "right", sort: (r) => r.stockVar },
                    alfa:    { label: `α vs ${benchLabel}`, al: "right", sort: (r) => r.alfaIbov ?? -1e9 },
                    volMed:  { label: "VOL MÉD (MM)", al: "right", sort: (r) => r.volMed },
                    cap:     { label: `CAP ${maxImpact.toLocaleString("pt-BR")}%`, al: "right", sort: null },
                    sugestao:{ label: "SUGESTÃO (R$)", al: "right", sort: (r) => sizing?.alloc.get(r.ativo)?.valor ?? -1 },
                    acoes:   { label: "AÇÕES", al: "right", sort: null },
                    acum:    { label: "ACUM.", al: "right", sort: null },
                    curva:   { label: "CURVA", al: "right", sort: null },
                  };
                  const base = rank?.rows ?? [];
                  const subset = showAll ? base : base.slice(0, Math.max(topN, sizing?.nUsados ?? 0));
                  let displayRows = subset.map((r, i) => ({ r, rankIdx: i }));
                  if (viewSort && COLS[viewSort.key]?.sort) {
                    const k = COLS[viewSort.key].sort;
                    displayRows = displayRows.slice().sort((a, b) =>
                      viewSort.dir === "desc" ? k(b.r) - k(a.r) : k(a.r) - k(b.r));
                  }
                  const renderCell = (id, r, rankIdx, ctx) => {
                    const { al, isMarked, cruzou1M, acoes } = ctx;
                    const tdBase = { padding: "8px 12px", textAlign: COLS[id].al, whiteSpace: "nowrap" };
                    switch (id) {
                      case "mark": return (
                        <td key={id} style={{ padding: "8px 6px 8px 12px" }}>
                          <input type="checkbox" checked={isMarked} onChange={() => toggleMark(r.ativo)}
                            style={{ accentColor: T.up, width: 15, height: 15, cursor: "pointer" }}
                            title="marcar para operar hoje" />
                        </td>);
                      case "idx": return <td key={id} style={{ ...tdBase, color: T.faint }}>{rankIdx + 1}</td>;
                      case "ativo": return (
                        <td key={id} style={{ ...tdBase, fontWeight: 700, color: isMarked ? T.up : al ? T.amber : T.text, cursor: "pointer" }}
                          onClick={() => { setTickerSel(r.ativo); setTab("base"); }}
                          title="ver histórico do ativo">{r.ativo}</td>);
                      case "media": return <td key={id} style={{ ...tdBase, color: r.mean >= 0 ? T.up : T.down }}>{fmtPct(r.mean, 3)}</td>;
                      case "win": return <td key={id} style={{ ...tdBase, color: T.dim }}>{fmtPct(r.win, 0)}</td>;
                      case "sharpe": return <td key={id} style={{ ...tdBase, color: T.dim }}>{r.sharpe.toFixed(2)}</td>;
                      case "comp": return <td key={id} style={{ ...tdBase, color: r.comp >= 0 ? T.up : T.down, fontWeight: 600 }}>{fmtPct(r.comp, 1)}</td>;
                      case "maxDD": return <td key={id} style={{ ...tdBase, color: T.down }}>{fmtPct(r.maxDD, 1)}</td>;
                      case "stockVar": return (
                        <td key={id} style={{ ...tdBase, color: r.stockVar >= 0 ? T.up : T.down }}
                          title="variação da ação (fechamento a fechamento) no período">{fmtPct(r.stockVar, 1)}</td>);
                      case "alfa": return (
                        <td key={id} style={{ ...tdBase, color: r.alfaIbov == null ? T.faint : r.alfaIbov >= 0 ? T.up : T.down }}
                          title="estratégia composta menos variação do benchmark no período">
                          {r.alfaIbov == null ? "—" : fmtPct(r.alfaIbov, 1)}</td>);
                      case "volMed": return <td key={id} style={{ ...tdBase, color: T.dim }}>{fmtBRL(r.volMed / 1e6)}</td>;
                      case "cap": return <td key={id} style={{ ...tdBase, color: T.faint }}>{fmtBRL((r.volMed * maxImpact) / 100 / 1000)}k</td>;
                      case "sugestao": return (
                        <td key={id} style={{ ...tdBase, color: al ? T.text : T.faint, fontWeight: al ? 700 : 400 }}>
                          {al ? fmtBRL(al.valor) : "—"}</td>);
                      case "acoes": return (
                        <td key={id} style={{ ...tdBase, color: al ? T.text : T.faint }}
                          title={al && r.lastClose ? `fechamento R$ ${numBR(r.lastClose)} em ${fmtDate(r.lastTs)}` : undefined}>
                          {acoes != null ? fmtBRL(acoes) : "—"}</td>);
                      case "acum": return (
                        <td key={id} style={{ ...tdBase, color: T.faint, fontSize: 11 }}>
                          {al ? fmtBRL(al.cum / 1e6, 2) + "M" : ""}
                          {cruzou1M && <span style={{ color: T.amber, marginLeft: 6 }}>◈ 1M</span>}</td>);
                      case "curva": return <td key={id} style={{ padding: "6px 12px" }}><Spark curve={r.curve} /></td>;
                      default: return null;
                    }
                  };
                  return (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.mono, fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ color: T.faint, fontSize: 10.5, letterSpacing: 1 }}>
                            {colOrder.map((id) => {
                              const cdef = COLS[id];
                              const sortable = !!cdef.sort;
                              const active = viewSort?.key === id;
                              return (
                                <th key={id}
                                  draggable
                                  onDragStart={(e) => { dragCol.current = id; e.dataTransfer.effectAllowed = "move"; }}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => { e.preventDefault(); moveCol(dragCol.current, id); dragCol.current = null; }}
                                  onClick={sortable ? () => headerSort(id) : undefined}
                                  title={sortable
                                    ? "clique: ordena ▼ / ▲ · arraste para mover a coluna"
                                    : "arraste para mover a coluna"}
                                  style={{
                                    textAlign: cdef.al, padding: "9px 12px",
                                    borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap",
                                    cursor: sortable ? "pointer" : "grab", userSelect: "none",
                                    color: active ? T.amber : T.faint,
                                  }}>
                                  {cdef.label}{active ? (viewSort.dir === "desc" ? " ▼" : " ▲") : ""}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map(({ r, rankIdx }) => {
                            const inTop = rankIdx < topN;
                            const al = sizing?.alloc.get(r.ativo);
                            const cruzou1M = al && al.cum >= 1000000 && (al.cum - al.valor) < 1000000;
                            const isMarked = marked.has(r.ativo);
                            let acoes = null;
                            if (al && r.lastClose > 0) {
                              const bruto = al.valor / r.lastClose;
                              const lote = Math.floor(bruto / 100) * 100;
                              acoes = lote >= 100 ? lote : Math.floor(bruto);
                            }
                            const ctx = { al, isMarked, cruzou1M, acoes };
                            return (
                              <tr key={r.ativo} className="rowhover" style={{
                                borderLeft: isMarked ? `3px solid ${T.up}` : al ? `3px solid ${T.amber}` : "3px solid transparent",
                                background: isMarked ? "rgba(63,191,143,0.08)" : "transparent",
                                opacity: al || inTop || isMarked ? 1 : 0.5,
                                borderBottom: cruzou1M && !viewSort ? `1px dashed ${T.amber}` : "none",
                              }}>
                                {colOrder.map((id) => renderCell(id, r, rankIdx, ctx))}
                              </tr>
                            );
                          })}
                          {rank && rank.rows.length === 0 && (
                            <tr><td colSpan={16} style={{ padding: "26px 18px", color: T.faint, textAlign: "center", fontFamily: T.sans, fontSize: 13.5 }}>
                              Nenhum ativo elegível nessa janela. Reduza o volume mínimo ou aumente a janela — janelas curtas exigem que o ativo tenha negociado em pelo menos 70% dos pregões.
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
                {rank && rank.rows.length > Math.max(topN, sizing?.nUsados ?? 0) && (
                  <button onClick={() => setShowAll((s) => !s)} style={{
                    width: "100%", padding: "10px", background: "transparent", border: "none",
                    borderTop: `1px solid ${T.line}`, color: T.faint, cursor: "pointer",
                    fontFamily: T.mono, fontSize: 11.5, letterSpacing: 1,
                  }}>
                    {showAll ? "MOSTRAR SÓ A ALOCAÇÃO" : `MOSTRAR TODOS OS ${rank.rows.length}`}
                  </button>
                )}
              </section>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 4 }}>Sinais de reversão hoje</div>
                  <div style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.5, marginBottom: 12 }}>
                    Caiu ≥ 2% e fechou no fundo 15% do range em {refDate ? fmtDate(refTs) : "—"}.
                    No backtest fora da amostra: +0,15%/operação, win 60%.
                  </div>
                  {signals.length === 0 && (
                    <div style={{ fontFamily: T.mono, fontSize: 12, color: T.faint }}>Nenhum sinal na data de referência.</div>
                  )}
                  {signals.map((s) => (
                    <div key={s.ativo} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "baseline",
                      padding: "7px 0", borderTop: `1px solid ${T.line}`, fontFamily: T.mono, fontSize: 12.5,
                    }}>
                      <span style={{ fontWeight: 700, cursor: "pointer" }}
                        onClick={() => { setTickerSel(s.ativo); setTab("base"); }}>{s.ativo}</span>
                      <span style={{ color: T.down }}>{fmtPct(s.varDia, 1)}</span>
                      <span style={{ color: T.faint, fontSize: 11 }}>range {Math.round(s.posRange * 100)}%</span>
                      <span style={{ color: T.faint, fontSize: 11 }}>R$ {fmtBRL(s.volMed / 1e6)}MM</span>
                    </div>
                  ))}
                </section>

                <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 10 }}>O que o backtest mostrou por janela</div>
                  <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.6 }}>
                    Walk-forward sem look-ahead (jul/25 → fev/26), top 10 por Sharpe:
                  </div>
                  <table style={{ width: "100%", fontFamily: T.mono, fontSize: 11.5, marginTop: 10, borderCollapse: "collapse" }}>
                    <tbody>
                      {[
                        ["2 sem · re-rank diário", "+0,115%/d", "Sharpe 3,96", T.up],
                        ["12 meses · re-rank diário", "+0,090%/d", "Sharpe 3,00", T.up],
                        ["3–6 meses", "fraco", "evitar", T.faint],
                      ].map(([a, b, c, cor]) => (
                        <tr key={a} style={{ borderTop: `1px solid ${T.line}` }}>
                          <td style={{ padding: "6px 0", color: T.dim }}>{a}</td>
                          <td style={{ padding: "6px 0", textAlign: "right", color: cor }}>{b}</td>
                          <td style={{ padding: "6px 0 6px 10px", textAlign: "right", color: T.faint }}>{c}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.55, marginTop: 10 }}>
                    Extremos funcionam; janelas intermediárias, não. Como a posição é zerada toda manhã,
                    trocar a cesta diariamente não custa nada.
                  </div>
                </section>

                <div style={{ fontSize: 11, color: T.faint, lineHeight: 1.6, padding: "0 4px" }}>
                  Estatísticas descritivas do seu próprio histórico — não é recomendação de investimento.
                  Resultado passado não garante regime futuro.
                </div>
              </div>
            </div>
          </>
        )}

        {/* ======================= ABA ATIVOS ======================= */}
        {ds && tab === "base" && (
          <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              padding: "14px 18px", borderBottom: `1px solid ${T.line}`,
              display: "flex", flexWrap: "wrap", gap: 22, alignItems: "center",
              fontFamily: T.mono, fontSize: 12, color: T.dim, background: T.panelSoft,
            }}>
              <span style={{ fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: T.faint }}>
                Origem dos dados
              </span>
              <span>histórico: <b style={{ color: T.text }}>COTAHIST / B3</b>
                {baseMeta?.geradoEm ? ` · coletado em ${new Date(baseMeta.geradoEm).toLocaleString("pt-BR")}` : ""}
              </span>
              <span>dia em andamento: <b style={{ color: T.text }}>cotação ao vivo</b>
                {aoVivo?.consultadoEm ? ` · ${new Date(aoVivo.consultadoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : " · não consultada"}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ color: T.faint }}>o COTAHIST sobrescreve o histórico a cada sincronização</span>
            </div>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
              <Field label="Ativo">
                <select value={tickerSel ?? ""} onChange={(e) => setTickerSel(e.target.value)} style={{ ...inputStyle, minWidth: 120 }}>
                  {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              {tickerRows.length > 0 && (() => {
                const overs = tickerRows.filter((r) => r.over != null).map((r) => r.over);
                const mean = overs.reduce((s, v) => s + v, 0) / (overs.length || 1);
                const win = overs.filter((v) => v > 0).length / (overs.length || 1);
                const volMed = tickerRows.reduce((s, r) => s + r.vol, 0) / tickerRows.length;
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontFamily: T.mono, fontSize: 12, color: T.dim }}>
                    <span>{tickerRows.length} pregões</span>
                    <span>{fmtDate(tickerRows[tickerRows.length - 1].ts)} → <b style={{ color: T.text }}>{fmtDate(tickerRows[0].ts)}</b></span>
                    <span>over médio: <b style={{ color: mean >= 0 ? T.up : T.down }}>{fmtPct(mean, 3)}</b></span>
                    <span>win: {fmtPct(win, 0)}</span>
                    <span>vol médio: R$ {fmtBRL(volMed / 1e6)}MM</span>
                  </div>
                );
              })()}
            </div>
            <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.mono, fontSize: 12.5 }}>
                <thead>
                  <tr style={{ color: T.faint, fontSize: 10.5, letterSpacing: 1, position: "sticky", top: 0, background: T.panel }}>
                    {["DATA", "ABERTURA", "MÁXIMA", "MÍNIMA", "FECHAMENTO", "VOLUME (R$)", "QTD", "OVER (na abertura)"].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 0 ? "left" : "right", padding: "9px 12px",
                        borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickerRows.map((r) => (
                    <tr key={r.ts} className="rowhover">
                      <td style={{ padding: "7px 12px", color: T.dim }}>{fmtDate(r.ts)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right" }}>{numBR(r.abertura)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: T.dim }}>{numBR(r.maxima)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: T.dim }}>{numBR(r.minima)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right" }}>{numBR(r.fech)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: T.dim }}>{fmtBRL(r.vol)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: T.faint }}>{r.qtd != null ? fmtBRL(r.qtd) : "—"}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: r.over == null ? T.faint : r.over >= 0 ? T.up : T.down }}>
                        {r.over == null ? "—" : fmtPct(r.over, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {/* ======================= ABA COMPARAR ESTRATÉGIAS ======================= */}
        {ds && tab === "comparar" && (() => {
          const ymLabel = (ym) => `${String(ym % 100).padStart(2, "0")}/${Math.floor(ym / 100)}`;
          const PALETTE = ["#C77DFF", "#4CC9F0", "#F72585", "#B5E48C", "#FF9E00", "#90E0EF"];
          const serie = mesames?.serie ?? [];
          // séries diárias: OVER, POS, IBOV, benchmarks customizados selecionados
          const seriesDefs = [
            { key: "OVER", color: T.amber, get: new Map(serie.map((r) => [r.ts, r.over])) },
            { key: "POS", color: T.up, get: new Map(serie.map((r) => [r.ts, r.pos])) },
          ];
          if (benchTickerRV) {
            const m = new Map(ds.byTicker.get(benchTickerRV).map((r) => [r.ts, r.varDia]));
            seriesDefs.push({ key: benchLabel, color: "#5B9BD5", get: m });
          }
          customBms.filter((b) => cmpSelBms.has(b.id)).forEach((b, i) => {
            seriesDefs.push({ key: b.name, color: PALETTE[i % PALETTE.length], get: new Map(b.points) });
          });
          // datas: união dentro do período
          const inR = (ts) => { const ym = ymOf(ts); return ym >= (perIni ?? 0) && ym <= (perFim ?? 999999); };
          const allTs = new Set(serie.map((r) => r.ts));
          for (const sd of seriesDefs.slice(2)) for (const ts of sd.get.keys()) if (inR(ts)) allTs.add(ts);
          const tsList = Array.from(allTs).sort((a, b) => a - b);
          const cums = seriesDefs.map(() => 1);
          const chartData = tsList.map((ts) => {
            const row = { ts, label: fmtDate(ts) };
            seriesDefs.forEach((sd, i) => {
              const v = sd.get.get(ts);
              if (v != null) cums[i] *= 1 + v;
              row[sd.key] = cmpView === "acum"
                ? +(((cums[i]) - 1) * 100).toFixed(3)
                : (v != null ? +(v * 100).toFixed(3) : null);
            });
            return row;
          });
          // estatísticas por série (no período)
          const stats = seriesDefs.map((sd) => {
            const vals = tsList.map((ts) => sd.get.get(ts)).filter((v) => v != null);
            if (vals.length === 0) return { key: sd.key, color: sd.color, n: 0 };
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            const sd2 = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (vals.length - 1 || 1));
            let eq = 1, peak = 1, mdd = 0;
            for (const v of vals) { eq *= 1 + v; if (eq > peak) peak = eq; mdd = Math.min(mdd, eq / peak - 1); }
            return {
              key: sd.key, color: sd.color, n: vals.length,
              acum: eq - 1, media: mean, dp: sd2,
              posPct: vals.filter((v) => v > 0).length / vals.length,
              pior: Math.min(...vals), melhor: Math.max(...vals), mdd,
            };
          });
          return (
            <>
              {/* gestor de benchmarks */}
              <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
                <div style={{ fontWeight: 650, fontSize: 15, marginBottom: 4 }}>Benchmarks personalizados</div>
                <div style={{ fontSize: 12, color: T.faint, marginBottom: 12, lineHeight: 1.6 }}>
                  Planilha (.xlsx/.xls/.csv) com duas colunas: <b style={{ color: T.dim }}>data</b> e <b style={{ color: T.dim }}>resultado do dia</b> (com ou sem símbolo de %).
                  Dê um nome, e o benchmark fica salvo na lista para usar nos gráficos e no mês a mês.
                </div>
                <BmUploader onAdd={addBenchmark} />
                {bmMsg && <div style={{ fontFamily: T.mono, fontSize: 12, color: T.up, marginTop: 8 }}>{bmMsg}</div>}
                {customBms.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    {customBms.map((b) => (
                      <BmRow key={b.id} bm={b} onRename={renameBenchmark} onRemove={removeBenchmark} />
                    ))}
                  </div>
                )}
              </section>

              {/* carteira */}
              <CarteiraEditor carteira={carteira} onChange={saveCarteira} tickers={tickers.filter((t) => t !== benchTickerRV)}
                marked={marked} sizing={sizing} rank={rank} />

              {carteira.length === 0 && (
                <div style={{ padding: "30px", textAlign: "center", color: T.faint, fontSize: 13.5 }}>
                  Monte a carteira acima (ou importe os marcados da aba Hoje) para gerar o comparativo.
                </div>
              )}

              {carteira.length > 0 && serie.length > 0 && (
                <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", marginBottom: 14 }}>
                    <Field label="Visão">
                      <div style={{ display: "flex", gap: 6 }}>
                        <Chip active={cmpView === "acum"} onClick={() => setCmpView("acum")}>Acumulado</Chip>
                        <Chip active={cmpView === "diario"} onClick={() => setCmpView("diario")}>Resultado diário</Chip>
                      </div>
                    </Field>
                    <Field label="De">
                      <select value={perIni ?? ""} onChange={(e) => setPerIni(+e.target.value)} style={inputStyle}>
                        {carteiraYms.map((ym) => <option key={ym} value={ym}>{ymLabel(ym)}</option>)}
                      </select>
                    </Field>
                    <Field label="Até">
                      <select value={perFim ?? ""} onChange={(e) => setPerFim(+e.target.value)} style={inputStyle}>
                        {carteiraYms.map((ym) => <option key={ym} value={ym}>{ymLabel(ym)}</option>)}
                      </select>
                    </Field>
                    {customBms.length > 0 && (
                      <Field label="Benchmarks no gráfico">
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {customBms.map((b) => (
                            <Chip key={b.id} active={cmpSelBms.has(b.id)}
                              onClick={() => setCmpSelBms((prev) => { const n = new Set(prev); n.has(b.id) ? n.delete(b.id) : n.add(b.id); return n; })}>
                              {b.name}
                            </Chip>
                          ))}
                        </div>
                      </Field>
                    )}
                  </div>
                  <div style={{ width: "100%", height: 380 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData} margin={{ top: 6, right: 18, left: 0, bottom: 4 }}>
                        <XAxis dataKey="label" tick={{ fill: T.faint, fontSize: 10, fontFamily: T.mono }}
                          minTickGap={60} axisLine={{ stroke: T.line }} tickLine={false} />
                        <YAxis tick={{ fill: T.faint, fontSize: 10, fontFamily: T.mono }}
                          axisLine={{ stroke: T.line }} tickLine={false}
                          tickFormatter={(v) => v.toFixed(cmpView === "acum" ? 0 : 1) + "%"} width={54} />
                        <Tooltip contentStyle={{ background: T.panelSoft, border: `1px solid ${T.line}`, fontFamily: T.mono, fontSize: 12 }}
                          labelStyle={{ color: T.dim }} formatter={(v) => (v == null ? "—" : v.toFixed(2) + "%")} />
                        <Legend wrapperStyle={{ fontFamily: T.mono, fontSize: 12 }} />
                        <ReferenceLine y={0} stroke={T.line} />
                        {seriesDefs.map((sd) => (
                          <Line key={sd.key} type="monotone" dataKey={sd.key} stroke={sd.color}
                            dot={false} strokeWidth={sd.key === "OVER" ? 2 : 1.4} connectNulls={cmpView === "acum"} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ overflowX: "auto", marginTop: 14 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.mono, fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: T.faint, fontSize: 10.5, letterSpacing: 1 }}>
                          {["SÉRIE", "ACUMULADO", "MÉDIA/DIA", "DESVIO/DIA", "% DIAS POSITIVOS", "PIOR DIA", "MELHOR DIA", "MAX DD", "N"].map((h, i) => (
                            <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 10px", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map((st) => (
                          <tr key={st.key} className="rowhover">
                            <td style={{ padding: "7px 10px", fontWeight: 700, color: st.color }}>{st.key}</td>
                            {st.n === 0 ? <td colSpan={8} style={{ padding: "7px 10px", color: T.faint }}>sem dados no período</td> : <>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: st.acum >= 0 ? T.up : T.down, fontWeight: 700 }}>{fmtPct(st.acum, 1)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: st.media >= 0 ? T.up : T.down }}>{fmtPct(st.media, 3)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: T.dim }}>{fmtPct(st.dp, 2)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: T.dim }}>{fmtPct(st.posPct, 0)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: T.down }}>{fmtPct(st.pior, 2)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: T.up }}>{fmtPct(st.melhor, 2)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: T.down }}>{fmtPct(st.mdd, 1)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: T.faint }}>{st.n}</td>
                            </>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 11, color: T.faint, lineHeight: 1.6, marginTop: 10 }}>
                    Desvio/dia e % de dias positivos respondem se uma estratégia é melhor por oscilar menos;
                    pior/melhor dia e max drawdown mostram se ela só perde menos nos dias ruins e ganha mais nos bons.
                  </div>
                </section>
              )}
            </>
          );
        })()}

        {/* ======================= ABA MÊS A MÊS ======================= */}
        {ds && tab === "mesames" && (() => {
          const ymLabel = (ym) => `${String(ym % 100).padStart(2, "0")}/${Math.floor(ym / 100)}`;
          const labelPeriodo = perIni != null && perFim != null ? `${ymLabel(perIni)} a ${ymLabel(perFim)}` : "—";
          const benchColLabel = mmBench.type === "rf" ? `RF ${String(mmBench.annual).replace(".", ",")}%aa`
            : mmBench.type === "ticker" ? mmBench.t
            : (customBms.find((b) => b.id === mmBench.id)?.name ?? "BENCH");
          const colLabels = { over: "OVER", pos: "POS", bench: benchColLabel, ibov: benchLabel };
          const colColor = { over: T.amber, pos: T.up, bench: "#C77DFF", ibov: "#5B9BD5" };
          const metricOpts = [["over", "OVER"], ["pos", "POS"], ["bench", benchColLabel], ["ibov", benchLabel]];
          const tituloCarteira = carteira.length === 1 ? carteira[0].ativo : `Carteira (${carteira.length} ativos)`;
          return (
            <>
              <CarteiraEditor carteira={carteira} onChange={saveCarteira} tickers={tickers.filter((t) => t !== benchTickerRV)}
                marked={marked} sizing={sizing} rank={rank} />
              <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
                  <Field label="De (mês/ano)">
                    <select value={perIni ?? ""} onChange={(e) => setPerIni(+e.target.value)} style={inputStyle}>
                      {carteiraYms.map((ym) => <option key={ym} value={ym}>{ymLabel(ym)}</option>)}
                    </select>
                  </Field>
                  <Field label="Até (mês/ano)">
                    <select value={perFim ?? ""} onChange={(e) => setPerFim(+e.target.value)} style={inputStyle}>
                      {carteiraYms.map((ym) => <option key={ym} value={ym}>{ymLabel(ym)}</option>)}
                    </select>
                  </Field>
                  <Field label="Coluna BENCH compara com">
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <Chip active={mmBench.type === "rf"} onClick={() => setMmBench({ type: "rf", annual: mmBench.type === "rf" ? mmBench.annual : 12 })}>Renda fixa</Chip>
                      {mmBench.type === "rf" && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="number" step="0.1" min="0" value={mmBench.annual}
                            onChange={(e) => setMmBench({ type: "rf", annual: Math.max(0, +e.target.value || 0) })}
                            style={{ ...inputStyle, width: 70 }} />
                          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.faint }}>% a.a.</span>
                        </span>
                      )}
                      {customBms.map((b) => (
                        <Chip key={b.id} active={mmBench.type === "custom" && mmBench.id === b.id}
                          onClick={() => setMmBench({ type: "custom", id: b.id })}>{b.name}</Chip>
                      ))}
                      <select value={mmBench.type === "ticker" ? mmBench.t : ""}
                        onChange={(e) => e.target.value && setMmBench({ type: "ticker", t: e.target.value })}
                        style={{ ...inputStyle, minWidth: 100 }}>
                        <option value="">ativo…</option>
                        {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </Field>
                  <Field label="Matriz mensal mostra">
                    <div style={{ display: "flex", gap: 6 }}>
                      {metricOpts.map(([k, lb]) => (
                        <Chip key={k} active={mmMetric === k} onClick={() => setMmMetric(k)}>{lb}</Chip>
                      ))}
                    </div>
                  </Field>
                  <span style={{ flex: 1 }} />
                  {mesames && (
                    <button onClick={() => exportMesamesPNG(mesames, tituloCarteira,
                      colLabels[mmMetric], labelPeriodo, [colLabels.over, colLabels.pos, colLabels.bench, colLabels.ibov])}
                      style={{ ...btnStyle, color: T.amber, borderColor: T.amber }}>
                      ⬇ extrair imagem
                    </button>
                  )}
                </div>

                {carteira.length === 0 && (
                  <div style={{ padding: "40px 18px", textAlign: "center", color: T.faint, fontSize: 13.5 }}>
                    Monte a carteira acima para gerar o quadro.
                  </div>
                )}
                {carteira.length > 0 && !mesames && (
                  <div style={{ padding: "40px 18px", textAlign: "center", color: T.faint, fontSize: 13.5 }}>
                    Sem dados para o filtro selecionado.
                  </div>
                )}

                {mesames && (
                  <>
                    <div style={{ padding: "10px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", flexWrap: "wrap", gap: 18, fontFamily: T.mono, fontSize: 12.5, alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{tituloCarteira}</span>
                      <span style={{ color: T.faint }}>{labelPeriodo}</span>
                      <span style={{ color: T.faint }}>acumulado:</span>
                      {["over", "pos", "bench", "ibov"].map((k) => (
                        <span key={k} style={{ color: mesames.total[k] == null ? T.faint : mesames.total[k] >= 0 ? T.up : T.down }}>
                          <b style={{ color: colColor[k] }}>{colLabels[k]}</b> {mesames.total[k] == null ? "—" : fmtPct(mesames.total[k], 1)}
                        </span>
                      ))}
                      {mesames.best && (
                        <span style={{ color: colColor[mesames.best], fontWeight: 700 }}>★ melhor no período: {colLabels[mesames.best]}</span>
                      )}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ borderCollapse: "collapse", fontFamily: T.mono, fontSize: 11.5, width: "100%" }}>
                        <thead>
                          <tr style={{ color: T.faint, fontSize: 10, letterSpacing: 0.8 }}>
                            <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${T.line}` }}>ANO</th>
                            {MESES.map((m) => (
                              <th key={m} style={{ padding: "8px 6px", textAlign: "right", borderBottom: `1px solid ${T.line}` }}>{m.toUpperCase()}</th>
                            ))}
                            {["over", "pos", "bench", "ibov"].map((k) => (
                              <th key={k} style={{ padding: "8px 8px", textAlign: "right", borderBottom: `1px solid ${T.line}`, color: colColor[k], borderLeft: k === "over" ? `1px solid ${T.line}` : "none" }}>{colLabels[k]}</th>
                            ))}
                            <th style={{ padding: "8px 8px", textAlign: "center", borderBottom: `1px solid ${T.line}` }}>MELHOR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mesames.grid.map((g) => (
                            <tr key={g.year} className="rowhover">
                              <td style={{ padding: "6px 10px", fontWeight: 700 }}>{g.year}</td>
                              {g.meses.map((m, i) => {
                                const v = m[mmMetric];
                                return (
                                  <td key={i} style={{
                                    padding: "6px 6px", textAlign: "right",
                                    background: v == null ? "transparent" : v >= 0 ? "rgba(63,191,143,0.14)" : "rgba(224,96,85,0.14)",
                                    color: v == null ? T.faint : v >= 0 ? T.up : T.down,
                                  }}>{v == null ? "·" : fmtPct(v, 1)}</td>
                                );
                              })}
                              {["over", "pos", "bench", "ibov"].map((k, i) => (
                                <td key={k} style={{
                                  padding: "6px 8px", textAlign: "right", fontWeight: 700,
                                  borderLeft: i === 0 ? `1px solid ${T.line}` : "none",
                                  color: g.anual[k] == null ? T.faint : g.anual[k] >= 0 ? T.up : T.down,
                                }}>{g.anual[k] == null ? "—" : fmtPct(g.anual[k], 1)}</td>
                              ))}
                              <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: g.best ? colColor[g.best] : T.faint }}>
                                {g.best ? colLabels[g.best] : "—"}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: `2px solid ${T.line}` }}>
                            <td style={{ padding: "8px 10px", fontWeight: 700, color: T.amber }}>TOTAL</td>
                            <td colSpan={12} style={{ padding: "8px 6px", textAlign: "right", color: T.faint, fontSize: 10.5 }}>acumulado {labelPeriodo} →</td>
                            {["over", "pos", "bench", "ibov"].map((k, i) => (
                              <td key={k} style={{
                                padding: "8px 8px", textAlign: "right", fontWeight: 700,
                                borderLeft: i === 0 ? `1px solid ${T.line}` : "none",
                                color: mesames.total[k] == null ? T.faint : mesames.total[k] >= 0 ? T.up : T.down,
                              }}>{mesames.total[k] == null ? "—" : fmtPct(mesames.total[k], 1)}</td>
                            ))}
                            <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, color: mesames.best ? colColor[mesames.best] : T.faint }}>
                              {mesames.best ? "★ " + colLabels[mesames.best] : "—"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: "10px 18px", fontSize: 11, color: T.faint, lineHeight: 1.6 }}>
                      OVER = estratégia overnight na carteira, ponderada pelos valores · POS = manter posicionado nos mesmos ativos e proporções ·
                      BENCH = aplicar o total no benchmark escolhido · {benchLabel} = manter o total no índice. Anos parciais acumulam só os meses do filtro.
                    </div>
                  </>
                )}
              </section>
            </>
          );
        })()}
      </main>
    </div>
  );
}
