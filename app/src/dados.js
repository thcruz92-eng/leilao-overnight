/* Fontes de dados: base oficial (COTAHIST), cotação ao vivo (Yahoo), leitura de CSV, calendário de pregões e encadeamento de tickers. */

export const GITHUB_DONO = "thcruz92-eng",
  GITHUB_REPO = "leilao-overnight",
  GITHUB_RAMO = "main",
  URL_BASE_GITHUB = `https://raw.githubusercontent.com/${GITHUB_DONO}/${GITHUB_REPO}/${GITHUB_RAMO}/public/base_b3.json`,
  URLS_BASE = [URL_BASE_GITHUB, "/base_b3.json", "/public/base_b3.json"],
  URL_BASE = URLS_BASE[0],
  URL_COTACAO = "/.netlify/functions/cotacao",
  LOTE_COTACAO = 100;

export function tsPregao(e) {
  let [t, r, n] = e
    .toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    })
    .split("-")
    .map(Number);
  return Date.UTC(t, r - 1, n);
}

export async function buscarBaseOficial() {
  let e = null,
    t = null;
  for (let i of URLS_BASE)
    try {
      let s = await fetch(i, {
        cache: "no-cache",
      });
      if (s.ok) {
        e = s;
        break;
      }
      t = `HTTP ${s.status}`;
    } catch (s) {
      t = s.message;
    }
  if (!e) throw new Error(`${t} ao buscar a base`);
  let r = await e.json(),
    n = r.campos || [
      "iso",
      "abertura",
      "maxima",
      "minima",
      "fechamento",
      "volume",
      "quantidade",
    ],
    a = Object.fromEntries(n.map((i, s) => [i, s])),
    o = new Map();
  for (let [i, s] of Object.entries(r.dados || {})) {
    let l = new Map();
    for (let c of s) {
      let [u, f, p] = String(c[a.iso]).split("-").map(Number);
      l.set(Date.UTC(u, f - 1, p), {
        abertura: c[a.abertura],
        maxima: c[a.maxima],
        minima: c[a.minima],
        fech: c[a.fechamento],
        vol: c[a.volume],
        qtd: c[a.quantidade] ?? null,
      });
    }
    o.set(i, l);
  }
  return {
    incoming: o,
    meta: {
      geradoEm: r.gerado_em || null,
      ultimoPregao: r.ultimo_pregao || null,
      ativos: r.total_ativos ?? o.size,
      registros: r.total_registros ?? null,
    },
  };
}

export async function buscarCotacoesAoVivo(e) {
  let t = new Map(),
    r = null,
    n = null,
    a = [],
    o = [];
  for (let i = 0; i < e.length; i += LOTE_COTACAO) {
    let s = e.slice(i, i + LOTE_COTACAO),
      l = await fetch(`${URL_COTACAO}?tickers=${s.join(",")}`);
    if (!l.ok) throw new Error(`HTTP ${l.status} na cotação ao vivo`);
    let c = await l.json();
    ((n = c.consultadoEm || n),
      (a = a.concat(c.ausentes || [])),
      (o = o.concat(c.falhas || [])));
    for (let [u, f] of Object.entries(c.dados || {})) {
      if (!(f.fechamento > 0)) continue;
      r = r || f.estadoMercado || null;
      let p = tsPregao(f.atualizadoEm ? new Date(f.atualizadoEm) : new Date()),
        h = new Map();
      (h.set(p, {
        abertura: f.abertura ?? f.fechamento,
        maxima: f.maxima ?? f.fechamento,
        minima: f.minima ?? f.fechamento,
        fech: f.fechamento,
        vol: f.volume ?? 0,
        qtd: f.quantidade ?? null,
      }),
        t.set(u, h));
    }
  }
  return {
    incoming: t,
    estado: r,
    consultadoEm: n,
    ausentes: a,
    falhas: o,
  };
}

function lerDinheiro(e) {
  if (e == null) return NaN;
  let t = String(e)
      .replace(/R\$/g, "")
      .trim()
      .replace(/\./g, "")
      .replace(",", "."),
    r = parseFloat(t);
  return isNaN(r) ? NaN : r;
}

export function lerDataBR(e) {
  if (!e) return null;
  let t = String(e)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return t ? Date.UTC(+t[3], +t[2] - 1, +t[1]) : null;
}

export function linhasParaBase(e) {
  let t = new Map(),
    r = 0;
  for (let a of e) {
    if (!a || a.length < 7) {
      r++;
      continue;
    }
    let o = String(a[0] || "")
      .replace(/[\x00-\x1f]/g, "")
      .trim()
      .toUpperCase();
    if (!o || !/^[A-Z0-9$^.]{4,10}$/.test(o) || o.startsWith("ATIVO")) {
      r++;
      continue;
    }
    let i = lerDataBR(a[1]);
    if (i == null) {
      r++;
      continue;
    }
    let s = lerDinheiro(a[2]),
      l = lerDinheiro(a[3]),
      c = lerDinheiro(a[4]),
      u = lerDinheiro(a[5]),
      f = lerDinheiro(a[6]),
      p = a.length >= 8 ? lerDinheiro(a[7]) : NaN;
    if (![s, l, c, u, f].every(Number.isFinite)) {
      r++;
      continue;
    }
    (t.has(o) || t.set(o, new Map()),
      t.get(o).has(i) ||
        t.get(o).set(i, {
          abertura: s,
          maxima: l,
          minima: c,
          fech: u,
          c6: f,
          c7: p,
        }));
  }
  let n = new Map();
  for (let [a, o] of t) {
    let i = Array.from(o.values()),
      s = i.filter((u) => Number.isFinite(u.c7) && u.c7 > 0 && u.c6 > 0),
      l = "c6";
    if (s.length >= Math.max(3, i.length * 0.5)) {
      let u = (f, p) => {
        let h = s
          .slice(0, 60)
          .map((g) => Math.abs(g[f] / g[p] - g.fech) / g.fech);
        return (h.sort((g, m) => g - m), h[Math.floor(h.length / 2)]);
      };
      l = u("c6", "c7") <= u("c7", "c6") ? "c6" : "c7";
    }
    let c = new Map();
    for (let [u, f] of o) {
      let p = l === "c6" ? f.c6 : Number.isFinite(f.c7) ? f.c7 : f.c6,
        h = l === "c6" ? (Number.isFinite(f.c7) ? f.c7 : null) : f.c6;
      c.set(u, {
        abertura: f.abertura,
        maxima: f.maxima,
        minima: f.minima,
        fech: f.fech,
        vol: p,
        qtd: h,
      });
    }
    n.set(a, c);
  }
  return {
    incoming: n,
    bad: r,
  };
}

export function mesclarNaBase(e, t, r = {}) {
  let { somenteTs: n = null } = r,
    a = 0,
    o = 0,
    i = 0,
    s = 0,
    l = new Map(),
    c = new Set(),
    u = (f, p) =>
      f.abertura === p.abertura &&
      f.maxima === p.maxima &&
      f.minima === p.minima &&
      f.fech === p.fech &&
      f.vol === p.vol &&
      (f.qtd ?? null) === (p.qtd ?? null);
  for (let [f, p] of t) {
    e.has(f) || e.set(f, new Map());
    let h = e.get(f);
    for (let [g, m] of p) {
      if (n != null && g !== n) {
        (s++, l.set(f, g));
        continue;
      }
      let x = h.get(g);
      x
        ? u(x, m)
          ? i++
          : (h.set(g, m), o++, c.add(f))
        : (h.set(g, m), a++, c.add(f));
    }
  }
  return {
    added: a,
    revised: o,
    kept: i,
    changed: c,
    recusados: s,
    recusadosPor: l,
  };
}

export const LIMITE_SALTO = 0.2,
  LIMITE_SALTO_ABERTURA = 0.12;

function medianaFech(e, t, r) {
  let n = [];
  for (let a = Math.max(0, t); a <= Math.min(e.length - 1, r); a++)
    e[a].fech > 0 && n.push(e[a].fech);
  return n.length < 3
    ? NaN
    : (n.sort((a, o) => a - o), n[Math.floor(n.length / 2)]);
}

function serieDoAtivo(e, t, r, n = "") {
  let a = new Map(),
    o = new Map(),
    i = new Map(),
    s = [],
    l = new Map();
  for (let c = 0; c < e.length; c++) {
    let u = e[c];
    if (c === 0) {
      (a.set(u.ts, null), o.set(u.ts, null), i.set(u.ts, 0));
      continue;
    }
    let f = e[c - 1],
      p = t.get(u.ts) - t.get(f.ts);
    if (p !== 1 || !(f.fech > 0) || !(u.abertura > 0)) {
      (a.set(u.ts, null), o.set(u.ts, null), i.set(u.ts, p > 1 ? p - 1 : 0));
      continue;
    }
    let h = u.abertura / f.fech - 1 - r,
      g = u.fech / f.fech - 1;
    i.set(u.ts, 0);
    let m = Math.abs(h),
      x = m > LIMITE_SALTO,
      y = NaN;
    if (!x && m > LIMITE_SALTO_ABERTURA) {
      let b = medianaFech(e, c - 5, c - 1),
        S = medianaFech(e, c, c + 4);
      ((y = b > 0 ? S / b : NaN),
        (x = Number.isFinite(y) && Math.abs(y / (1 + h) - 1) < 0.15));
    }
    if (x) {
      (a.set(u.ts, null),
        o.set(u.ts, null),
        s.push({
          ativo: n,
          ts: u.ts,
          gap: h,
          varDia: g,
          fechAnt: f.fech,
          abertura: u.abertura,
          qtdAnt: f.qtd ?? null,
          qtd: u.qtd ?? null,
          volAnt: f.vol ?? null,
          vol: u.vol ?? null,
          razaoPreco: u.abertura / f.fech,
          razaoNivel: Number.isFinite(y) ? y : null,
        }));
      continue;
    }
    (a.set(u.ts, h),
      o.set(u.ts, g),
      l.set(u.ts, {
        fechAnt: f.fech,
        abertura: u.abertura,
        fech: u.fech,
      }));
  }
  return {
    over: a,
    varDia: o,
    furo: i,
    eventos: s,
    linhas: l,
  };
}

export function montarDataset(e, t) {
  let r = t / 100,
    n = new Map(),
    a = new Set(),
    o = new Map();
  for (let [c, u] of e) {
    let f = Array.from(u.entries())
      .map(([p, h]) => ({
        ts: p,
        ...h,
      }))
      .sort((p, h) => p.ts - h.ts);
    for (let p of f) a.add(p.ts);
    o.set(c, f);
  }
  let i = Array.from(a).sort((c, u) => c - u),
    s = new Map(i.map((c, u) => [c, u])),
    l = [];
  for (let [c, u] of o) {
    let f = serieDoAtivo(u, s, r, c);
    l.push(...f.eventos);
    for (let p of u) {
      ((p.over = f.over.get(p.ts) ?? null),
        (p.varDia = f.varDia.get(p.ts) ?? null),
        (p.furo = f.furo.get(p.ts) ?? 0));
      let h = p.maxima - p.minima;
      p.posRange = h > 0 ? (p.fech - p.minima) / h : 0.5;
    }
    n.set(c, u);
  }
  return (
    l.sort((c, u) => u.ts - c.ts),
    {
      byTicker: n,
      dates: i,
      eventos: l,
      posNoCalendario: s,
    }
  );
}

export const FERIADOS_B3 = new Set([
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-04-03",
  "2026-04-21",
  "2026-05-01",
  "2026-06-04",
  "2026-09-07",
  "2026-10-12",
  "2026-11-02",
  "2026-11-15",
  "2026-11-20",
  "2026-12-24",
  "2026-12-25",
  "2026-12-31",
  "2027-01-01",
  "2027-02-08",
  "2027-02-09",
  "2027-03-26",
  "2027-04-21",
  "2027-05-01",
  "2027-05-27",
  "2027-09-07",
  "2027-10-12",
  "2027-11-02",
  "2027-11-15",
  "2027-11-20",
  "2027-12-24",
  "2027-12-25",
  "2027-12-31",
]);

/* pregão seguinte a `e` (pula fim de semana e feriado da B3) */
export function proximoDiaUtil(e) {
  const DIA_MS = 86400000;
  let t = e + DIA_MS;
  for (let r = 0; r < 15; r++, t += DIA_MS) {
    let n = new Date(t).getUTCDay();
    if (!(n === 0 || n === 6) && !FERIADOS_B3.has(new Date(t).toISOString().slice(0, 10))) return t;
  }
  return null;
}

export function ultimoPregaoEsperado(e = new Date()) {
  let t = e.toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    }),
    r = +e.toLocaleString("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }),
    [n, a, o] = t.split("-").map(Number),
    i = new Date(Date.UTC(n, a - 1, o));
  r < 23 && (i = new Date(i.getTime() - 86400000));
  for (let s = 0; s < 15; s++) {
    let l = i.getUTCDay(),
      c = i.toISOString().slice(0, 10);
    if (l !== 0 && l !== 6 && !FERIADOS_B3.has(c)) return i.getTime();
    i = new Date(i.getTime() - 86400000);
  }
  return i.getTime();
}

export const TICKERS_EXEMPLO = [
    "MGLU3",
    "PRIO3",
    "PETR4",
    "CMIN3",
    "EMBJ3",
    "BRAV3",
  ],
  TICKERS_ANTIGOS = {
    EMBJ3: ["EMBR3"],
    BRAV3: ["RRRP3"],
    AZZA3: ["ARZZ3"],
    MBRF3: ["MRFG3"],
    BHIA3: ["VIIA3"],
    AXIA3: ["ELET3"],
    AXIA6: ["ELET6"],
    MOTV3: ["CCRO3"],
    NATU3: ["NTCO3"],
    ISAE4: ["TRPL4"],
    ALOS3: ["ALSO3"],
  },
  TICKERS_IGNORADOS = new Set(["IBOV11"]);

export function serieEncadeada(e, t, r, n) {
  let a = n / 100,
    o = [];
  if (r && TICKERS_ANTIGOS[t])
    for (let p of TICKERS_ANTIGOS[t]) {
      let h = e.byTicker.get(p);
      h && o.push(...h);
    }
  let i = e.byTicker.get(t);
  if ((i && o.push(...i), o.length === 0))
    return {
      over: new Map(),
      varDia: new Map(),
      linhas: new Map(),
    };
  let s = Array.from(new Map(o.map((p) => [p.ts, p])).values()).sort(
      (p, h) => p.ts - h.ts,
    ),
    l = e.posNoCalendario ?? new Map(e.dates.map((p, h) => [p, h])),
    c = serieDoAtivo(s, l, a, t),
    u = new Map(),
    f = new Map();
  for (let [p, h] of c.over) h != null && u.set(p, h);
  for (let [p, h] of c.varDia) h != null && f.set(p, h);
  return {
    over: u,
    varDia: f,
    linhas: c.linhas,
  };
}

export function encadearDataset(e, t) {
  if (!e) return e;
  let r = t / 100,
    n = e.posNoCalendario ?? new Map(e.dates.map((o, i) => [o, i])),
    a = new Map(e.byTicker);
  for (let [o, i] of Object.entries(TICKERS_ANTIGOS)) {
    let s = e.byTicker.get(o);
    if (!s) continue;
    let l = [],
      c = false;
    for (let p of i) {
      let h = e.byTicker.get(p);
      h && h.length && (l.push(...h), (c = true));
    }
    if (!c) continue;
    l.push(...s);
    let u = Array.from(
        new Map(
          l.map((p) => [
            p.ts,
            {
              ...p,
            },
          ]),
        ).values(),
      ).sort((p, h) => p.ts - h.ts),
      f = serieDoAtivo(u, n, r, o);
    for (let p of u) {
      ((p.over = f.over.get(p.ts) ?? null),
        (p.varDia = f.varDia.get(p.ts) ?? null),
        (p.furo = f.furo.get(p.ts) ?? 0));
      let h = p.maxima - p.minima;
      p.posRange = h > 0 ? (p.fech - p.minima) / h : 0.5;
    }
    a.set(o, u);
    for (let p of i) a.delete(p);
  }
  return {
    ...e,
    byTicker: a,
  };
}

const PREFIXO_BASE_LOCAL = "ovr3:g:";

function serializarGrupo(e, t) {
  let r = {};
  for (let [n, a] of e)
    n[0] === t &&
      (r[n] = Array.from(a.entries()).map(([o, i]) => [
        o,
        i.abertura,
        i.maxima,
        i.minima,
        i.fech,
        i.vol,
        i.qtd ?? null,
      ]));
  return JSON.stringify(r);
}

function desserializarGrupo(e, t) {
  let r = JSON.parse(e);
  for (let n of Object.keys(r)) {
    let a = new Map();
    for (let [o, i, s, l, c, u, f] of r[n])
      a.set(o, {
        abertura: i,
        maxima: s,
        minima: l,
        fech: c,
        vol: u,
        qtd: f ?? null,
      });
    t.set(n, a);
  }
}

export async function salvarBaseLocal(e, t) {
  let r = [];
  for (let n of t)
    try {
      await window.storage.set(PREFIXO_BASE_LOCAL + n, serializarGrupo(e, n));
    } catch {
      r.push(n);
    }
  return r;
}

export async function carregarBaseLocal() {
  let e = new Map();
  try {
    let r = (await window.storage.list(PREFIXO_BASE_LOCAL))?.keys || [];
    for (let n of r)
      try {
        let a = await window.storage.get(n);
        a?.value && desserializarGrupo(a.value, e);
      } catch {}
  } catch {}
  return e;
}

export async function apagarBaseLocal() {
  try {
    let e = await window.storage.list(PREFIXO_BASE_LOCAL);
    for (let t of e?.keys || [])
      try {
        await window.storage.delete(t);
      } catch {}
  } catch {}
}

const NOMES_IBOV = [
  "IBOV",
  "BOVA11",
  "IBOVESPA",
  "BVSP",
  "^BVSP",
  "WIN$N",
  "INDFUT",
];

export function acharIbov(e) {
  for (let t of NOMES_IBOV) if (e.has(t)) return t;
  return null;
}

export function dentroDoPregao(e = new Date()) {
  let t = new Date(
      e.toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
      }),
    ),
    r = t.getDay();
  if (r === 0 || r === 6) return false;
  let n = t.getHours() * 60 + t.getMinutes();
  return n >= 600 && n < 1080;
}

export function estadoDoPregao(e = new Date()) {
  let t = new Date(
      e.toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
      }),
    ),
    r = t.getDay();
  if (r === 0 || r === 6)
    return {
      aberto: false,
      pct: 1,
      minutosParaLeilao: null,
    };
  let n = t.getHours() * 60 + t.getMinutes(),
    a = 600,
    o = 1075;
  return n < a
    ? {
        aberto: false,
        pct: 0,
        minutosParaLeilao: o - n,
        antesDaAbertura: true,
      }
    : n >= o
      ? {
          aberto: false,
          pct: 1,
          minutosParaLeilao: 0,
        }
      : {
          aberto: true,
          pct: (n - a) / (o - a),
          minutosParaLeilao: o - n,
        };
}
