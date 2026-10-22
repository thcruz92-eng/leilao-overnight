/* Indicadores, estratégias, MIX e backtests. */
import {
  FERIADOS_B3,
  TICKERS_ANTIGOS,
  TICKERS_IGNORADOS,
  serieEncadeada,
} from "./dados.js";
import { COR_MIX_FIXO, COR_MIX_NR, MESES, anoMes } from "./tema.js";

/* Cesta padrão com vigência: [{ desde, itens: [{ ativo, valor }] }] em ordem
   de data. `desde` é a data da compra a partir da qual a versão vale (null =
   desde o início). Aceita também a cesta antiga, uma lista simples de itens. */
export function normalizarVigencias(t) {
  if (!Array.isArray(t) || t.length === 0) return [];
  if (!Array.isArray(t[0]?.itens))
    return [
      {
        desde: null,
        itens: t,
      },
    ];
  return t
    .filter((v) => v && Array.isArray(v.itens))
    .map((v) => ({
      desde: Number.isFinite(v.desde) ? v.desde : null,
      itens: v.itens,
    }))
    .sort((a, b) => (a.desde ?? -1 / 0) - (b.desde ?? -1 / 0));
}

/* versão da cesta que vale para a compra feita em `ts` */
export function vigenciaEm(versoes, ts) {
  let v = null;
  for (let x of versoes) (x.desde ?? -1 / 0) <= ts && (v = x);
  return v;
}

/* Curva do Overnight padrão: em cada noite, compra no fechamento os papéis
   da cesta que valia na data da compra e vende na abertura seguinte.
   t: lista de itens (cesta única) ou lista de vigências. */
export function curvaCarteira(e, t, r, n, a = () => LOTE_PADRAO) {
  let versoes = normalizarVigencias(t).map((v) => ({
    ...v,
    itens: v.itens.filter((c) => c && c.ativo && c.valor > 0),
  }));
  if (!versoes.some((v) => v.itens.length)) return [];
  let series = new Map(),
    serie = (ativo) => (
      series.has(ativo) || series.set(ativo, serieEncadeada(e, ativo, r, n)),
      series.get(ativo)
    ),
    s = (n || 0) / 100,
    l = [];
  for (let k = 0; k < e.dates.length; k++) {
    let c = e.dates[k],
      v = vigenciaEm(versoes, k > 0 ? e.dates[k - 1] : c);
    if (!v || v.itens.length === 0) continue;
    let u = 0,
      f = 0,
      p = 0,
      h = 0,
      g = [];
    for (let m of v.itens) {
      let x = serie(m.ativo).linhas.get(c);
      if (!x || !(x.fechAnt > 0)) continue;
      let y = a(m.ativo) > 0 ? a(m.ativo) : LOTE_PADRAO,
        S = lotesPara(m.valor, x.fechAnt, y) * y;
      if (S <= 0) continue;
      let T = S * x.fechAnt;
      ((u += T), (p += m.valor - T));
      let A = S * (x.abertura - x.fechAnt) - T * s;
      ((f += A),
        g.push({
          ativo: m.ativo,
          compra: T,
          resultado: A,
        }),
        h++);
    }
    u > 0 &&
      l.push({
        ts: c,
        ret: f / u,
        compra: u,
        resultado: f,
        sobra: p,
        n: h,
        itens: g,
      });
  }
  return l;
}

export const MODO_OVER = "opera",
  MODO_POSICAO = "posicao",
  baseDoModo = (e) => (e === MODO_POSICAO ? 1 : 0),
  acumularModo = (e, t, r) => (e === MODO_POSICAO ? t * (1 + r) : t + r),
  retornoDoModo = (e, t) => (e === MODO_POSICAO ? t - 1 : t);

export const compor = (e, t, r) => (e === MODO_POSICAO ? t * (1 + r) : t + r),
  descompor = (e, t, r) => (e === MODO_POSICAO ? t / r - 1 : t - r);

function modoDoBenchmark(e) {
  return e
    ? e.type === "ticker"
      ? e.modo === "over"
        ? MODO_OVER
        : MODO_POSICAO
      : e.type === "custom"
        ? e.modo === "pos"
          ? MODO_POSICAO
          : MODO_OVER
        : MODO_POSICAO
    : MODO_POSICAO;
}

export function statsDaCurva(e, t = null, r = null) {
  let n = e.filter((m) => (t == null || m.ts >= t) && (r == null || m.ts <= r));
  if (n.length === 0) return null;
  let a = n.map((m) => m.ret),
    o = a.reduce((m, x) => m + x, 0) / a.length,
    i = Math.sqrt(
      a.reduce((m, x) => m + (x - o) ** 2, 0) / (a.length - 1 || 1),
    ),
    s = 1,
    l = 1,
    c = 0,
    u = n.map(
      (m) => (
        (s = compor(MODO_OVER, s, m.ret)),
        s > l && (l = s),
        (c = Math.min(c, descompor(MODO_OVER, s, l))),
        {
          ts: m.ts,
          tsCompra: m.tsCompra ?? null,
          ret: m.ret,
          eq: s,
          itens: m.itens,
          compra: m.compra,
        }
      ),
    ),
    f = new Map(),
    p = new Map();
  for (let m of n)
    for (let x of m.itens || []) {
      let y = x.resultado / m.compra;
      (f.set(x.ativo, (f.get(x.ativo) ?? 0) + y),
        p.set(x.ativo, (p.get(x.ativo) ?? 0) + 1));
    }
  let h = s - 1,
    g = Array.from(f.entries())
      .map(([m, x]) => ({
        ativo: m,
        contrib: x,
        vezes: p.get(m) ?? 0,
        share: h > 0.0001 ? x / h : null,
      }))
      .sort((m, x) => x.contrib - m.contrib);
  return {
    curva: u,
    porAtivo: g,
    stats: {
      total: h,
      media: o,
      dp: i,
      posPct: a.filter((m) => m > 0).length / a.length,
      pior: Math.min(...a),
      melhor: Math.max(...a),
      mdd: c,
      n: a.length,
      semOperar: 0,
      noitesPossiveis: a.length,
      nAtivos: g.length,
    },
  };
}

export function pregaoAnterior(e, t) {
  let r = e?.posNoCalendario?.get(t);
  return r != null && r > 0 ? e.dates[r - 1] : null;
}

export function proximaData(e, t) {
  if (!e || e.length === 0) return null;
  let r = 0,
    n = e.length - 1,
    a = -1;
  for (; r <= n; ) {
    let o = (r + n) >> 1;
    e[o] > t ? ((a = o), (n = o - 1)) : (r = o + 1);
  }
  return a >= 0 ? e[a] : null;
}

export function recortarResultado(e, t, r = -1 / 0, n = 1 / 0, a = null) {
  if (!e || e.erro || !Array.isArray(e.curva)) return e;
  let o = [];
  for (let w of e.curva) {
    let _ = w.tsCompra ?? (t ? pregaoAnterior(t, w.ts) : null) ?? w.ts;
    _ < r ||
      _ > n ||
      (a && !a.has(_)) ||
      o.push({
        ...w,
        tsCompra: _,
      });
  }
  if (o.length === 0)
    return {
      erro: "Nenhuma noite neste recorte.",
    };
  let i = 1,
    s = 1,
    l = 0,
    c = o.map(
      (w) => (
        (i = compor(MODO_OVER, i, w.ret)),
        i > s && (s = i),
        (l = Math.min(l, descompor(MODO_OVER, i, s))),
        {
          ...w,
          eq: i,
        }
      ),
    ),
    u = c.map((w) => w.ret),
    f = u.reduce((w, _) => w + _, 0) / u.length,
    p = Math.sqrt(
      u.reduce((w, _) => w + (_ - f) ** 2, 0) / (u.length - 1 || 1),
    ),
    h = i - 1,
    g = new Map(),
    m = new Map();
  for (let w of c) {
    let _ = w.itens || [];
    for (let E of _) {
      let P =
        E.r != null
          ? E.r / _.length
          : w.compra > 0 && E.resultado != null
            ? E.resultado / w.compra
            : null;
      P != null &&
        (g.set(E.ativo, (g.get(E.ativo) ?? 0) + P),
        m.set(E.ativo, (m.get(E.ativo) ?? 0) + 1));
    }
  }
  let x = Array.from(m.entries())
      .map(([w, _]) => {
        let E = g.get(w) ?? null;
        return {
          ativo: w,
          vezes: _,
          contrib: E,
          share: E != null && h > 0.0001 ? E / h : null,
        };
      })
      .sort((w, _) => (_.contrib ?? 0) - (w.contrib ?? 0) || _.vezes - w.vezes),
    y = Math.max(r, e.possivelDe ?? c[0].tsCompra),
    b = Math.min(n, e.possivelAte ?? c[c.length - 1].tsCompra),
    S = 0;
  if (a) for (let w of a) w >= y && w <= b && S++;
  else if (t) for (let w of t.dates) w >= y && w <= b && S++;
  S = Math.max(S, c.length);
  let T = u.length,
    A = u.filter((w) => w > 0).length / T;
  return {
    ...e,
    curva: c,
    rets: u,
    ts: c.map((w) => w.ts),
    porAtivo: x,
    total: h,
    media: f,
    dp: p,
    mdd: l,
    n: T,
    acerto: A,
    pior: Math.min(...u),
    melhor: Math.max(...u),
    sharpe: p > 0 ? (f / p) * Math.sqrt(252) : null,
    cobertura: T / S,
    nAtivos: x.length,
    recorte: {
      de: y,
      ate: b,
    },
    stats: {
      total: h,
      media: f,
      dp: p,
      mdd: l,
      n: T,
      noitesPossiveis: S,
      semOperar: S - T,
      posPct: A,
      pior: Math.min(...u),
      melhor: Math.max(...u),
      nAtivos: x.length,
    },
  };
}

export function recortarResultados(e, t, r, n, a = null) {
  if (!e) return e;
  let o = {};
  for (let [i, s] of Object.entries(e))
    i !== "__correl" && (o[i] = recortarResultado(s, t, r, n, a));
  return ((o.__correl = correlacoes(o)), o);
}

export const LOTE_PADRAO = 100;

export function lotesPara(e, t, r) {
  let n = r > 0 ? r : LOTE_PADRAO;
  return !(e > 0) || !(t > 0) ? 0 : Math.max(1, Math.round(e / (t * n)));
}

export const VALOR_PADRAO = 10000;

export function qtdPara(e, t, r = LOTE_PADRAO) {
  let n = r > 0 ? r : LOTE_PADRAO;
  return !(e > 0) || !(t > 0) ? null : Math.floor(e / t / n + 1e-9) * n;
}

export function arredondarLote(e, t = LOTE_PADRAO) {
  let r = t > 0 ? t : LOTE_PADRAO;
  return e > 0 ? Math.max(r, Math.round(e / r) * r) : 0;
}

const JANELA_LIQUIDEZ = 20;

const DESCARTE_LIQUIDEZ = 0.1;

function mediaSemTopo(e, t = JANELA_LIQUIDEZ) {
  let r = e.length;
  if (r < Math.max(3, t / 2)) return null;
  let n = e.slice().sort((s, l) => s - l),
    a = Math.min(r - 1, Math.max(1, Math.floor(r * DESCARTE_LIQUIDEZ))),
    o = n.slice(0, r - a),
    i = 0;
  for (let s of o) i += s;
  return i / o.length;
}

export function liquidezNoDia(e, t, r, n = JANELA_LIQUIDEZ) {
  let a = e?.byTicker?.get(t),
    o = e?.dates;
  if (!a || a.length === 0 || !o || o.length === 0) return null;
  let i = -1;
  for (let c = o.length - 1; c >= 0; c--)
    if (o[c] <= r) {
      i = c;
      break;
    }
  if (i < 0) return null;
  let s = o[Math.max(0, i - n + 1)],
    l = [];
  for (let c = a.length - 1; c >= 0; c--)
    if (!(a[c].ts > r)) {
      if (a[c].ts < s) break;
      l.push(a[c].vol || 0);
    }
  return mediaSemTopo(l, n);
}

function liquidezMovel(e, t = JANELA_LIQUIDEZ) {
  let r = e.length,
    n = new Float64Array(r).fill(NaN);
  for (let a = 0; a < r; a++) {
    let o = [];
    for (let s = Math.max(0, a - t + 1); s <= a; s++)
      Number.isNaN(e[s]) || o.push(e[s]);
    let i = mediaSemTopo(o, t);
    i != null && (n[a] = i);
  }
  return n;
}

function mediaAparada(e, t = 0.1) {
  let r = e.length;
  if (r === 0) return null;
  if (r < 5) return e.reduce((i, s) => i + s, 0) / r;
  let n = e.slice().sort((i, s) => i - s),
    a = Math.floor(r * t);
  (a === 0 && (a = 1), r - 2 * a < 1 && (a = Math.floor((r - 1) / 2)));
  let o = n.slice(a, r - a);
  return o.reduce((i, s) => i + s, 0) / o.length;
}

export function backtestRanking(e, t) {
  let {
      tsIni: r,
      tsFim: n,
      lbDays: a,
      minVolMM: o,
      topN: i,
      criterio: s,
      benchTicker: l,
    } = t,
    { dates: c, byTicker: u } = e,
    f = c.findIndex((k) => k >= r),
    p = -1;
  for (let k = c.length - 1; k >= 0; k--)
    if (c[k] <= n) {
      p = k;
      break;
    }
  let h = Math.min(p, c.length - 2);
  if (f < 0 || p < 0 || h < f)
    return {
      erro: "Período sem noite fechada.",
    };
  let g = new Map(c.map((k, F) => [k, F])),
    m = c.length,
    x = o * 1000000,
    y = [];
  for (let [k, F] of u) {
    if (k === l || TICKERS_IGNORADOS.has(k)) continue;
    let q = new Float64Array(m).fill(NaN),
      N = new Float64Array(m).fill(NaN),
      j = new Float64Array(m).fill(NaN),
      I = new Float64Array(m).fill(NaN);
    for (let C of F) {
      let L = g.get(C.ts);
      L != null &&
        (C.over != null && (q[L] = C.over),
        C.varDia != null && (j[L] = C.varDia),
        C.posRange != null && (I[L] = C.posRange),
        (N[L] = C.vol));
    }
    y.push({
      ativo: k,
      over: q,
      vol: N,
      varDia: j,
      posRange: I,
      liq: liquidezMovel(N),
    });
  }
  let b = [],
    S = new Map(),
    T = new Map(),
    A = [],
    w = 1,
    _ = s === "reversao" ? 20 : a;
  for (let k = Math.max(f, _); k <= h; k++) {
    let F;
    if (s === "reversao") {
      let I = [];
      for (let C of y)
        Number.isNaN(C.varDia[k]) ||
          Number.isNaN(C.posRange[k]) ||
          C.varDia[k] > -0.02 ||
          C.posRange[k] > 0.15 ||
          (C.liq[k] >= x &&
            I.push({
              a: C,
              chave: -C.varDia[k],
            }));
      if (I.length === 0) continue;
      (I.sort((C, L) => L.chave - C.chave), (F = I.slice(0, i)));
    } else {
      let I = k - a + 1,
        C = [];
      for (let L of y) {
        if (!(L.liq[k] >= x)) continue;
        let B = [];
        for (let J = I; J <= k; J++)
          Number.isNaN(L.over[J]) || B.push(L.over[J]);
        if (B.length < 5) continue;
        let W;
        (s === "aparada"
          ? (W = mediaAparada(B))
          : s === "win"
            ? (W = B.filter((J) => J > 0).length / B.length)
            : (W = B.reduce((J, ie) => J + ie, 0) / B.length),
          C.push({
            a: L,
            chave: W,
          }));
      }
      if (C.length === 0) continue;
      (C.sort((L, B) => B.chave - L.chave), (F = C.slice(0, i)));
    }
    let q = [];
    for (let I of F) {
      let C = I.a.over[k + 1];
      Number.isNaN(C) ||
        q.push({
          ativo: I.a.ativo,
          r: C,
        });
    }
    if (q.length === 0) continue;
    let N = 1 / q.length,
      j = 0;
    for (let I of q)
      ((j += I.r * N),
        S.set(I.ativo, (S.get(I.ativo) ?? 0) + I.r * N),
        T.set(I.ativo, (T.get(I.ativo) ?? 0) + 1));
    ((w = compor(MODO_OVER, w, j)),
      b.push({
        ts: c[k + 1],
        tsCompra: c[k],
        ret: j,
        eq: w,
        itens: q.map((I) => ({
          ativo: I.ativo,
          r: I.r,
        })),
      }),
      A.push({
        ts: c[k + 1],
        tsCompra: c[k],
        ret: j,
        n: q.length,
        escolhidos: q.map((I) => I.ativo),
      }));
  }
  if (b.length === 0)
    return {
      erro: "Nenhuma noite operável no período.",
    };
  let E = b.map((k) => k.ret),
    P = E.reduce((k, F) => k + F, 0) / E.length,
    O = Math.sqrt(
      E.reduce((k, F) => k + (F - P) ** 2, 0) / (E.length - 1 || 1),
    ),
    R = 1,
    M = 0;
  for (let k of b)
    (k.eq > R && (R = k.eq), (M = Math.min(M, descompor(MODO_OVER, k.eq, R))));
  let H = w - 1,
    Y = Array.from(S.entries())
      .map(([k, F]) => ({
        ativo: k,
        contrib: F,
        vezes: T.get(k) ?? 0,
        share: H > 0.0001 ? F / H : null,
      }))
      .sort((k, F) => F.contrib - k.contrib),
    G = Math.max(0, h - Math.max(f, _) + 1);
  return {
    curva: b,
    diario: A,
    porAtivo: Y,
    possivelDe: c[Math.max(f, _)] ?? null,
    possivelAte: c[h] ?? null,
    stats: {
      total: H,
      media: P,
      dp: O,
      mdd: M,
      n: E.length,
      noitesPossiveis: G,
      semOperar: G - E.length,
      posPct: E.filter((k) => k > 0).length / E.length,
      pior: Math.min(...E),
      melhor: Math.max(...E),
      nAtivos: Y.length,
    },
  };
}

export function prepararIndicadores(e) {
  let { dates: t, byTicker: r } = e,
    n = t.length,
    a = new Map(t.map((l, c) => [l, c])),
    o = [];
  for (let [l, c] of r) {
    if (TICKERS_IGNORADOS.has(l)) continue;
    let u = new Float64Array(n).fill(NaN),
      f = new Float64Array(n).fill(NaN),
      p = new Float64Array(n).fill(NaN),
      h = new Float64Array(n).fill(NaN),
      g = new Float64Array(n).fill(NaN),
      m = new Float64Array(n).fill(NaN),
      x = new Float64Array(n).fill(NaN),
      y = new Float64Array(n).fill(NaN);
    for (let E of c) {
      let P = a.get(E.ts);
      P != null &&
        ((u[P] = E.fech),
        (p[P] = E.maxima),
        (h[P] = E.minima),
        (g[P] = E.vol),
        E.abertura > 0 && (f[P] = E.abertura),
        E.over != null && (m[P] = E.over),
        E.varDia != null && (x[P] = E.varDia),
        E.posRange != null && (y[P] = E.posRange));
    }
    for (let E = 1; E < n; E++) {
      if (Number.isNaN(m[E]) || Math.abs(m[E]) <= 0.12) continue;
      let P = medianaJanela(u, E - 5, E - 1),
        O = medianaJanela(u, E, E + 4),
        R = P > 0 ? O / P : NaN,
        M = 1 + m[E];
      ((Number.isFinite(R) && Math.abs(R / M - 1) < 0.15) ||
        Math.abs(m[E]) > 0.2) &&
        ((m[E] = NaN), (x[E] = NaN));
    }
    let b = new Float64Array(n).fill(NaN),
      S = new Float64Array(n).fill(NaN);
    for (let E = 0; E < n; E++)
      (p[E] > 0 && !Number.isNaN(u[E]) && (b[E] = u[E] / p[E] - 1),
        f[E] > 0 && !Number.isNaN(u[E]) && (S[E] = u[E] / f[E] - 1));
    let T = mediaMovel(S, 20),
      A = mediaMovel(m, 60),
      w = new Float64Array(n).fill(NaN);
    for (let E = 0; E < n; E++)
      !Number.isNaN(A[E]) && !Number.isNaN(T[E]) && (w[E] = A[E] - T[E]);
    let _ = {
      C: u,
      A: f,
      Hi: p,
      Lo: h,
      V: g,
      over: m,
      varDia: x,
      ibs: y,
      quedaDoTopo: b,
      intradia: S,
      intraMean20: T,
      tugWar: w,
      ret20: retornoEmN(u, 20),
      rsi14: rsiWilder(u, 14),
      rsi2: rsiWilder(u, 2),
      pos20: posicaoNoRange(p, h, u, 20),
      pos60: posicaoNoRange(p, h, u, 60),
      pctB: zScore(u, 20, 2),
      dma20: distanciaDaMedia(u, 20),
      dma200: distanciaDaMedia(u, 200),
      ret5: retornoEmN(u, 5),
      liq20: liquidezMovel(g, 20),
      ovWin60: fracaoPositiva(m, 60),
      ovWin120: fracaoPositiva(m, 120),
      ovMean60: A,
      ovMean120: mediaMovel(m, 120),
      ovApar20: mediaAparadaMovel(m, 20),
      ovLast: m,
    };
    o.push({
      ativo: l,
      ind: _,
    });
  }
  let i = new Float64Array(n).fill(NaN),
    s = new Float64Array(n).fill(NaN);
  for (let l = 0; l < n; l++) {
    let c = 0,
      u = 0,
      f = 0;
    for (let p of o) {
      if (!(p.ind.liq20[l] > 5000000)) continue;
      let h = p.ind.varDia[l];
      Number.isNaN(h) || (u++, (f += h), h < 0 && c++);
    }
    u >= 20 && ((i[l] = c / u), (s[l] = f / u));
  }
  return {
    ativos: o,
    dates: t,
    N: n,
    amplitude: i,
    retMercado: s,
  };
}

function medianaJanela(e, t, r) {
  let n = [];
  for (let a = Math.max(0, t); a <= Math.min(e.length - 1, r); a++)
    Number.isNaN(e[a]) || n.push(e[a]);
  return n.length < 3
    ? NaN
    : (n.sort((a, o) => a - o), n[Math.floor(n.length / 2)]);
}

function mediaMovel(e, t) {
  let r = e.length,
    n = new Float64Array(r).fill(NaN);
  for (let a = 0; a < r; a++) {
    let o = 0,
      i = 0;
    for (let s = Math.max(0, a - t + 1); s <= a; s++)
      Number.isNaN(e[s]) || ((o += e[s]), i++);
    i >= Math.max(3, t / 2) && (n[a] = o / i);
  }
  return n;
}

function mediaAparadaMovel(e, t) {
  let r = e.length,
    n = new Float64Array(r).fill(NaN);
  for (let a = 0; a < r; a++) {
    let o = [];
    for (let s = Math.max(0, a - t + 1); s <= a; s++)
      Number.isNaN(e[s]) || o.push(e[s]);
    if (o.length < Math.max(6, t / 2)) continue;
    let i = mediaAparada(o, 0.1);
    i != null && (n[a] = i);
  }
  return n;
}

function fracaoPositiva(e, t) {
  let r = e.length,
    n = new Float64Array(r).fill(NaN);
  for (let a = 0; a < r; a++) {
    let o = 0,
      i = 0;
    for (let s = Math.max(0, a - t + 1); s <= a; s++)
      Number.isNaN(e[s]) || (i++, e[s] > 0 && o++);
    i >= Math.max(3, t / 2) && (n[a] = o / i);
  }
  return n;
}

function rsiWilder(e, t) {
  let r = e.length,
    n = new Float64Array(r).fill(NaN),
    a = NaN,
    o = NaN,
    i = 0;
  for (let s = 1; s < r; s++) {
    if (Number.isNaN(e[s]) || Number.isNaN(e[s - 1])) continue;
    let l = e[s] - e[s - 1],
      c = l > 0 ? l : 0,
      u = l < 0 ? -l : 0;
    (Number.isNaN(a)
      ? ((a = c), (o = u), (i = 1))
      : ((a = (a * (t - 1) + c) / t), (o = (o * (t - 1) + u) / t), i++),
      i >= t && (n[s] = o > 0 ? 100 - 100 / (1 + a / o) : 100));
  }
  return n;
}

function posicaoNoRange(e, t, r, n) {
  let a = r.length,
    o = new Float64Array(a).fill(NaN);
  for (let i = 0; i < a; i++) {
    let s = -1 / 0,
      l = 1 / 0,
      c = 0;
    for (let u = Math.max(0, i - n + 1); u <= i; u++)
      Number.isNaN(e[u]) ||
        (e[u] > s && (s = e[u]), t[u] < l && (l = t[u]), c++);
    c >= Math.max(5, n / 2) &&
      s > l &&
      !Number.isNaN(r[i]) &&
      (o[i] = (r[i] - l) / (s - l));
  }
  return o;
}

function zScore(e, t, r) {
  let n = e.length,
    a = new Float64Array(n).fill(NaN);
  for (let o = 0; o < n; o++) {
    let i = [];
    for (let c = Math.max(0, o - t + 1); c <= o; c++)
      Number.isNaN(e[c]) || i.push(e[c]);
    if (i.length < Math.max(5, t / 2) || Number.isNaN(e[o])) continue;
    let s = i.reduce((c, u) => c + u, 0) / i.length,
      l = Math.sqrt(
        i.reduce((c, u) => c + (u - s) ** 2, 0) / (i.length - 1 || 1),
      );
    l > 0 && (a[o] = (e[o] - (s - r * l)) / (2 * r * l));
  }
  return a;
}

function distanciaDaMedia(e, t) {
  let r = mediaMovel(e, t),
    n = e.length,
    a = new Float64Array(n).fill(NaN);
  for (let o = 0; o < n; o++)
    r[o] > 0 && !Number.isNaN(e[o]) && (a[o] = e[o] / r[o] - 1);
  return a;
}

function retornoEmN(e, t) {
  let r = e.length,
    n = new Float64Array(r).fill(NaN);
  for (let a = t; a < r; a++)
    e[a - t] > 0 && !Number.isNaN(e[a]) && (n[a] = e[a] / e[a - t] - 1);
  return n;
}

export const SENTIDO_INDICADORES = {
    ibs: -1,
    rsi14: -1,
    rsi2: -1,
    pos20: -1,
    pos60: -1,
    dma20: -1,
    dma200: -1,
    pctB: -1,
    ret5: -1,
    ovWin60: 1,
    ovWin120: 1,
    ovMean60: 1,
    ovMean120: 1,
    ovLast: 1,
    ovApar20: 1,
    varDia: -1,
    quedaDoTopo: -1,
    intradia: -1,
    intraMean20: -1,
    ret20: -1,
    tugWar: 1,
  },
  ESTRATEGIAS = [
    {
      id: "reversao",
      nome: "Reversão Clássica",
      cor: "#C77DFF",
      resumo: "Caiu no dia e fechou colado na mínima.",
      explica:
        "Procura o papel que apanhou no pregão e terminou o dia no fundo da própria faixa, com o RSI já em terreno vendido. A aposta é que parte do exagero volte na abertura seguinte.",
      familia: "REV",
      frescor: "vivo",
      perdaAtraso: 0.066,
      pesos: {
        ibs: 2,
        rsi14: 1,
        pos20: 1,
      },
      filtro: (e) => e.ibs <= 0.2 && e.rsi14 < 45,
    },
    {
      id: "fundorange",
      nome: "Fundo de Range",
      cor: "#4CC9F0",
      resumo: "Perto do piso dos últimos 3 meses.",
      explica:
        "Em vez de olhar só o dia, mede onde o preço está dentro da faixa de 60 pregões. Pega o papel que está raspando o fundo do range e abaixo da média de 20 dias.",
      familia: "REV",
      frescor: "vivo",
      perdaAtraso: 0.059,
      pesos: {
        pos60: 2,
        ibs: 1,
        dma20: 1,
      },
      filtro: (e) => e.pos60 < 0.3 && e.ibs < 0.4,
    },
    {
      id: "premio",
      nome: "Prêmio Overnight",
      cor: "#80ED99",
      resumo: "Papéis que abrem em alta por hábito.",
      explica:
        "Não olha o dia de hoje: olha o histórico. Seleciona quem tem a maior frequência de abrir acima do fechamento anterior nos últimos 120 pregões. É a família de sinal mais diferente das outras — serve para diversificar.",
      familia: "PER",
      frescor: "tolera",
      perdaAtraso: 0.009,
      pesos: {
        ovWin120: 1,
        ovMean120: 1,
        ovWin60: 1,
      },
      filtro: (e) => e.ovWin120 > 0.5,
    },
    {
      id: "placar",
      nome: "Placar Geral",
      cor: "#FFB703",
      resumo: "Todos os indicadores somados.",
      explica:
        "Junta as duas famílias: quanto o papel apanhou (IBS, range, RSI) e quanto ele costuma abrir em alta (histórico de gap). É a estratégia mais estável do conjunto porque nenhum indicador isolado decide sozinho.",
      familia: "MIX",
      frescor: "vivo",
      perdaAtraso: 0.048,
      pesos: {
        ibs: 1,
        pos60: 1,
        rsi14: 1,
        ovWin120: 1,
        ovMean120: 1,
        ovLast: 1,
      },
      filtro: null,
    },
    {
      id: "panico",
      nome: "Pânico de Mercado",
      cor: "#FF6B6B",
      resumo: "Só dispara quando a bolsa inteira cai.",
      explica:
        "Fica quieta na maior parte do tempo. Só entra em dia de queda generalizada — mais de 60% dos papéis líquidos no vermelho — e aí compra os mais castigados. É a estratégia com a melhor relação retorno/risco do conjunto, justamente por operar pouco.",
      familia: "REV",
      frescor: "vivo",
      perdaAtraso: 0.103,
      pesos: {
        ibs: 2,
        pos60: 1,
        rsi14: 1,
      },
      filtro: null,
      regime: (e) => e.amplitude > 0.6,
    },
    {
      id: "teto",
      nome: "Longe da Máxima",
      cor: "#F15BB5",
      resumo: "Devolveu tudo o que tinha subido no dia.",
      explica:
        "Olha a MÁXIMA do pregão, não a mínima. Procura o papel que chegou a subir e terminou o dia bem abaixo do próprio topo — a alta apareceu e não se sustentou. Parte do que foi devolvido no fim do dia costuma voltar na abertura seguinte.",
      familia: "REV",
      frescor: "tolera",
      perdaAtraso: 0.025,
      pesos: {
        quedaDoTopo: 2,
        ibs: 1,
        pos20: 1,
      },
      filtro: null,
    },
    {
      id: "elastico",
      nome: "Elástico Longo",
      cor: "#8AC926",
      resumo: "Muito abaixo da média de 200 dias.",
      explica:
        "As outras reversões olham o dia ou o trimestre. Esta olha o ano: pega o papel que está pelo menos 5% abaixo da média de 200 pregões e ainda vem caindo no mês. É a estratégia mais estável do conjunto entre 2023 e 2026 — o resultado dela quase não muda de um período para o outro.",
      familia: "LNG",
      frescor: "vivo",
      perdaAtraso: 0.064,
      pesos: {
        dma200: 2,
        ret20: 1,
        ibs: 1,
      },
      filtro: (e) => e.dma200 < -0.05,
    },
    {
      id: "tracao",
      nome: "Cabo de Guerra",
      cor: "#D4A373",
      resumo: "Ganha de madrugada e devolve de dia.",
      explica:
        "Compara o que o papel rende NA NOITE com o que ele perde DENTRO do pregão. Quem tem esse descasamento — sobe na abertura, escorre durante o dia — é exatamente o perfil que interessa a quem só carrega a noite. Não olha o pregão de hoje: é hábito, como o Prêmio Overnight, mas usando também o lado de dentro do dia.",
      familia: "PER",
      frescor: "tolera",
      perdaAtraso: 0.003,
      pesos: {
        tugWar: 2,
        ovWin60: 1,
        intraMean20: 1,
      },
      filtro: (e) => e.tugWar > 0,
    },
  ],
  MARGEM_ABERTURA = 0.00266,
  TOP_ABERTURA = 8,
  ESTRATEGIA_ABERTURA = {
    id: "intraday",
    nome: "Leilão de Abertura",
    cor: "#5AC8FA",
    resumo:
      "Compra na abertura quem abriu mais fraco que os outros; vende no fechamento.",
  };

function percentis(e) {
  let t = [];
  for (let n = 0; n < e.length; n++) Number.isFinite(e[n]) && t.push([n, e[n]]);
  let r = new Array(e.length).fill(NaN);
  if (t.length < 10) return r;
  t.sort((n, a) => n[1] - a[1]);
  for (let n = 0; n < t.length; n++) r[t[n][0]] = (n + 0.5) / t.length;
  return r;
}

function avaliarAbertura(e, t, r) {
  let {
      minVolMM: n,
      precoMin: a,
      topN: o = TOP_ABERTURA,
      feePct: i = 0.046,
    } = r || {},
    s = i / 100;
  if (t < 121)
    return {
      erro: "Pregão sem histórico suficiente.",
    };
  let l = (n ?? 40) * 1000000,
    c = a ?? 1,
    u = [];
  for (let y = 0; y < e.ativos.length; y++) {
    let b = e.ativos[y].ind,
      S = b.C[t - 1],
      T = b.A[t];
    b.liq20[t - 1] >= l &&
      S >= c &&
      (!(T > 0) ||
        !(S > 0) ||
        u.push({
          k: y,
          ativo: e.ativos[y].ativo,
          fechAnt: S,
          abertura: T,
          gap: T / S - 1,
          ovWin60: b.ovWin60[t - 1],
          volMed: b.liq20[t - 1],
          precoAgora: Number.isFinite(b.C[t]) ? b.C[t] : null,
        }));
  }
  if (u.length < 20)
    return {
      erro: "Poucos ativos com abertura válida hoje.",
    };
  let f = percentis(u.map((y) => -y.gap)),
    p = percentis(u.map((y) => -y.ovWin60));
  for (let y = 0; y < u.length; y++) {
    if (!Number.isFinite(f[y]) || !Number.isFinite(p[y])) {
      u[y].placar = NaN;
      continue;
    }
    u[y].placar = (2 * f[y] + p[y]) / 3;
  }
  let h = u
    .filter((y) => Number.isFinite(y.placar))
    .sort((y, b) => b.placar - y.placar)
    .slice(0, o);
  for (let y of h)
    ((y.jaAndou =
      y.precoAgora > 0 && y.abertura > 0
        ? y.precoAgora / y.abertura - 1
        : null),
      (y.resultado = y.jaAndou != null ? y.jaAndou - s : null));
  let g = h.filter((y) => y.jaAndou != null),
    m = g.length ? g.reduce((y, b) => y + b.jaAndou, 0) / g.length : null,
    x = g.length
      ? {
          ret: g.reduce((y, b) => y + b.resultado, 0) / g.length,
          acertos: g.filter((y) => y.resultado > 0).length,
          total: g.length,
          parcial: g.length < h.length,
        }
      : null;
  return {
    itens: h,
    nElegiveis: u.length,
    gapMediano: h.length
      ? h.map((y) => y.gap).sort((y, b) => y - b)[Math.floor(h.length / 2)]
      : null,
    jaAndouMedio: m,
    margemRestante: m != null ? MARGEM_ABERTURA - m : MARGEM_ABERTURA,
    resultado: x,
  };
}

export const ORDEM_ESTRATEGIAS = [
    "mix",
    "mix_nr",
    "consenso",
    "intraday",
    ...ESTRATEGIAS.map((e) => e.id),
  ],
  GUIA_ESTRATEGIAS = {
    cesta_padrao: {
      nome: "Overnight padrão",
      cor: "#E8E8E8",
      grupo: "Referência",
      chaves: ["cesta fixa", "não escolhe nada", "régua de comparação"],
      linha:
        "Sua cesta manual de sempre, com os valores que você digitou. É a régua: estratégia que não bate isso não vale o trabalho.",
      pergunta:
        "Quanto eu teria feito comprando todo dia os mesmos papéis da minha cesta?",
      como: "Não escolhe nada. Usa a lista fixa montada na aba RESULTADOS (ativo + valor em R$), compra tudo no fechamento e vende na abertura. O peso de cada papel é o valor que você digitou — é a única série da lista que não usa peso igual.",
      janela:
        "Nenhuma. Não olha histórico para decidir, porque a lista já está decidida.",
      quantos: "Os que estiverem na cesta.",
      quandoPara:
        "Nas noites em que os papéis da cesta não têm gap calculável: feriado, papel sem pregão, ou noite descartada pelo filtro de evento corporativo.",
      naoConfunda:
        "É o único item da lista que não é uma estratégia. Todas as outras precisam ganhar dele para justificar a existência.",
    },
    media: {
      nome: "Escolha pela MÉDIA",
      cor: "#F0B347",
      grupo: "Motor de janela",
      chaves: [
        "média do gap",
        "usa a Janela de CONFIGURAÇÕES",
        "quem deu mais %",
      ],
      linha:
        "Ordena pela média simples do gap dentro da janela. Quem deu mais porcentagem por noite, entra.",
      pergunta:
        "Nos últimos N pregões, qual papel deu o maior ganho MÉDIO por noite?",
      como: "Para cada papel, soma os retornos overnight dos pregões da janela e divide pela quantidade. Ordena do maior para o menor, compra os Top N em peso igual. Fora liquidez mínima, não filtra nada.",
      janela: "A “Janela (pregões)” de CONFIGURAÇÕES — padrão 10 pregões.",
      quantos: "Top N.",
      quandoPara: "Nunca. Sempre existe alguém no topo da lista.",
      naoConfunda:
        "Média é tamanho, não frequência. Um papel parado nove noites que disparou 4% numa única pode liderar essa lista sozinho — é esse buraco que a MÉDIA APARADA tapa. Contra o Prêmio Overnight, que também só olha histórico de gap: a MÉDIA responde “quem deu mais %” numa janela curta que VOCÊ escolhe (padrão 10 pregões, dez pregões é o humor das últimas duas semanas); o Prêmio responde “em quem dá para confiar” com janelas fixas de 120 e 60 pregões, que são o hábito de seis meses. Papel que abriu em alta quase toda noite ganhando 0,3% e toma um tombo grande de vez em quando tem Prêmio ótimo e MÉDIA ruim; papel parado duas semanas que abriu +5% numa noite tem MÉDIA ótima e Prêmio ruim. Nenhuma das duas está errada — elas ordenam por coisas diferentes. É também por isso que mexer na “Janela (pregões)” de CONFIGURAÇÕES reordena esta lista e não move o Prêmio um milímetro.",
    },
    aparada: {
      nome: "Escolha pela MÉDIA APARADA",
      cor: "#4CC9F0",
      grupo: "Motor de janela",
      chaves: [
        "a MÉDIA sem os extremos",
        "corta as pontas",
        "tira a sorte da conta",
      ],
      linha:
        "Idêntica à MÉDIA, só que joga fora as melhores e as piores noites antes de tirar a média.",
      pergunta: "Descontando sorte e azar, quem continua bom?",
      como: "Mesmo motor da MÉDIA, mesma janela, mesmo Top N. Muda só a conta: descarta os 10% maiores e os 10% menores retornos da janela — pelo menos 1 de cada ponta quando há 5 noites ou mais — e tira a média do miolo.",
      janela: "A mesma da MÉDIA — “Janela (pregões)” de CONFIGURAÇÕES.",
      quantos: "Top N.",
      quandoPara: "Nunca.",
      naoConfunda:
        "MÉDIA e APARADA respondem à MESMA pergunta com contas diferentes. Divergência grande entre as duas quer dizer que o resultado do papel está apoiado em poucas noites extremas — na tabela de ranking isso aparece marcado com ⚠. Entre as três que só olham histórico de gap, ela fica no meio: é a MÉDIA sem a noite de sorte, e continua medindo TAMANHO — quem mede frequência é o Prêmio Overnight, com janela fixa e nota em percentil.",
    },
    reversao: {
      nome: "Queda Forte no Fundo",
      cor: "#C77DFF",
      grupo: "Motor de janela",
      chaves: [
        "regra fixa",
        "caiu 2%+ hoje",
        "fechou colado na mínima",
        "às vezes não opera",
      ],
      linha:
        "Regra dura, sem nota: caiu 2% ou mais no dia e fechou nos 15% mais baixos da faixa do pregão.",
      pergunta: "Quem apanhou feio HOJE e terminou o dia no chão?",
      como: "Não é ranking relativo, é aprovado ou reprovado. O papel precisa ter caído 2% ou mais no dia E ter fechado dentro dos 15% mais baixos entre a mínima e a máxima daquele pregão. Quem passa, entra — a pior queda primeiro, até completar o Top N.",
      janela:
        "Nenhuma para o sinal, que é do próprio pregão. Só o volume médio usa 20 pregões.",
      quantos: "Até Top N. Pode vir menos, pode vir nenhum.",
      quandoPara:
        "Em dia calmo ninguém cumpre as duas condições. Nessas noites o capital fica parado — é o que a coluna SEM SINAL conta.",
      naoConfunda:
        "É a reversão em forma de regra fixa. A Reversão Clássica faz a mesma aposta com régua diferente: esta é ABSOLUTA (caiu 2% e fechou nos 15% mais baixos do dia — passou ou não passou), a Clássica é RELATIVA (entre os que apanharam, ordena do que apanhou mais para o que apanhou menos). Isso muda o comportamento nos dois extremos: em pregão de queda geral esta aprova gente demais e o Top N vira sorteio, enquanto a Clássica continua entregando os dez piores; em pregão calmo esta não aprova ninguém e fica fora da noite, enquanto a Clássica sempre tem um “menos pior” para escolher.",
    },
    n_reversao: {
      nome: "Reversão Clássica",
      cor: "#C77DFF",
      grupo: "Motor de placar · família REVERSÃO",
      chaves: [
        "apanhou hoje",
        "fechou no fundo do dia",
        "RSI vendido",
        "nota relativa",
      ],
      linha:
        "Mesma aposta da Queda Forte no Fundo, mas por nota: quanto mais no fundo do próprio dia e mais sobrevendido, maior a nota.",
      pergunta: "Entre os que apanharam hoje, quem apanhou MAIS que os outros?",
      como: "Exige IBS ≤ 0,20 (fechou no quinto inferior da faixa do dia) e RSI(14) abaixo de 45. Entre os aprovados, dá nota juntando IBS (peso 2), RSI(14) (peso 1) e posição na faixa de 20 pregões (peso 1). Cada indicador vira percentil do dia antes de somar — é isso que permite somar RSI com posição de range, que são escalas incompatíveis.",
      janela:
        "IBS é do dia, RSI usa 14 pregões, a faixa usa 20. Nenhuma usa a “Janela (pregões)” de CONFIGURAÇÕES.",
      quantos: "Top N entre os aprovados.",
      quandoPara: "Quando ninguém passa no filtro de IBS e RSI.",
      naoConfunda:
        "Contra a Queda Forte no Fundo: aquela pergunta “caiu 2%?” em número absoluto; esta pergunta “caiu mais que os outros?” em posição relativa. Em pregão de queda geral a Queda Forte no Fundo aprova meio mercado e o Top N dela vira sorteio; esta continua entregando só os dez piores. Em pregão calmo é o contrário: a Queda Forte no Fundo fica fora da noite e esta sempre acha um “menos pior”. Contra as outras duas escalas de reversão do app: esta olha o DIA, o Fundo de Range olha o TRIMESTRE e o Elástico Longo olha o ANO.",
    },
    n_fundorange: {
      nome: "Fundo de Range",
      cor: "#4CC9F0",
      grupo: "Motor de placar · família REVERSÃO",
      chaves: [
        "piso de 3 meses",
        "não é o dia, é o trimestre",
        "abaixo da média de 20",
      ],
      linha:
        "Mede onde o preço está dentro da faixa de 60 pregões e pega quem está raspando o fundo.",
      pergunta: "Quem está no piso dos últimos três meses?",
      como: "Filtra por posição na faixa de 60 pregões abaixo de 0,30 e IBS abaixo de 0,40. Nota = posição na faixa de 60 (peso 2) + IBS (peso 1) + distância da média de 20 dias (peso 1).",
      janela: "60 pregões para a faixa, 20 para a média. Fixas.",
      quantos: "Top N entre os aprovados.",
      quandoPara:
        "Quando ninguém está ao mesmo tempo no fundo do trimestre e no fundo do dia.",
      naoConfunda:
        "A Reversão Clássica olha o DIA; esta olha o TRIMESTRE. Um papel pode ter subido hoje e ainda estar no fundo da faixa de 60 pregões.",
    },
    n_premio: {
      nome: "Prêmio Overnight",
      cor: "#80ED99",
      grupo: "Motor de placar · família HÁBITO",
      chaves: [
        "hábito, não estado",
        "frequência de abrir em alta",
        "120 pregões",
        "não olha o dia de hoje",
      ],
      linha:
        "Ignora o pregão de hoje. Procura quem tem o costume de abrir acima do fechamento anterior.",
      pergunta: "Quem abre em alta com mais FREQUÊNCIA nas últimas 120 noites?",
      como: "Filtra: precisa ter aberto em alta em mais de 50% das últimas 120 noites. Nota = frequência de acerto em 120 (peso 1) + gap médio em 120 (peso 1) + frequência de acerto em 60 (peso 1). Dois dos três fatores são frequência, não tamanho.",
      janela:
        "120 e 60 pregões, fixas. Mexer no controle “Janela” não move esta curva.",
      quantos: "Top N entre os aprovados.",
      quandoPara: "Quase nunca. Hábito não muda de um dia para o outro.",
      naoConfunda:
        "É a única estratégia da família HÁBITO — e é por isso que ela é indispensável para o Consenso Cruzado, que só aceita papel confirmado pelas duas famílias. Contra a MÉDIA e a MÉDIA APARADA, que também só olham histórico de gap e nada do pregão de hoje: as duas rodam no motor de janela, com a janela do controle (padrão 10 pregões), conta em número absoluto e nenhum filtro além da liquidez; este roda no motor de placar, com janelas FIXAS de 120 e 60 pregões, nota em percentil do dia e um filtro de entrada real — precisa ter aberto em alta em mais de 50% das últimas 120 noites. E ordena por FREQUÊNCIA (dois dos três fatores são taxa de acerto), não por tamanho do gap. Consequência prática: mexer no controle “Janela” move a MÉDIA e a APARADA e não mexe nesta curva. Não é defeito do controle.",
    },
    n_placar: {
      nome: "Placar Geral",
      cor: "#FFB703",
      grupo: "Motor de placar · terceira família",
      chaves: ["6 indicadores somados", "sem filtro nenhum", "uma nota só"],
      linha:
        "Uma nota só, feita de seis indicadores: quanto o papel apanhou mais quanto ele costuma abrir em alta.",
      pergunta:
        "Somando tudo que eu sei sobre o papel, quem tem a melhor nota hoje?",
      como: "Não tem filtro de entrada: todo papel líquido acima do preço mínimo entra na conta. Nota = IBS + posição na faixa de 60 + RSI(14) + frequência de gap em 120 + gap médio em 120 + gap de hoje, todos com peso 1 e todos convertidos em percentil do dia.",
      janela: "Cada indicador tem a sua (14, 60 e 120 pregões). Fixas.",
      quantos: "Top N.",
      quandoPara: "Nunca. Sem filtro, não há como reprovar ninguém.",
      naoConfunda:
        "Não é o MIX, e a confusão é justa — os dois “juntam tudo”, só que em níveis diferentes. Esta soma INDICADORES numa nota só; o MIX soma VOTOS DE ESTRATÉGIAS. Esta é uma estratégia igual às outras (e é um dos votantes do MIX); o MIX é o resultado das estratégias juntas. Aqui o universo é todo papel líquido acima do preço mínimo, sem filtro de entrada, e ninguém é reprovado; no MIX só existe papel que alguma estratégia já aprovou. Aqui os filtros e o regime de mercado são ignorados — em dia de pânico e em dia calmo a conta é a mesma; o MIX herda todos os filtros de quem votou. Aqui são Top N papéis e o desempate é a nota mais alta; no MIX o número de papéis vem do termômetro e a ordem é confirmação pelas duas famílias, depois votos, depois nota. A imagem que resolve: este é um juiz só, dando uma nota olhando todos os critérios de uma vez; o MIX é o júri. Na prática eles discordam assim: papel mediano em tudo, sem nada de errado, lidera esta lista e não entra no MIX, porque nenhuma estratégia individual o aprovou; papel com três votos mas um indicador péssimo entra no MIX e some desta lista, porque a nota afunda na média.",
    },
    n_panico: {
      nome: "Pânico de Mercado",
      cor: "#FF6B6B",
      grupo: "Motor de placar · família REVERSÃO",
      chaves: [
        "só em dia de queda geral",
        "+60% do mercado no vermelho",
        "dorme o resto do tempo",
      ],
      linha:
        "Filtro de regime: só entra quando mais de 60% dos papéis líquidos fecharam em queda.",
      pergunta: "O mercado inteiro apanhou hoje? Então quem apanhou mais?",
      como: "Antes de olhar papel nenhum, checa o termômetro do pregão. Se menos de 60% dos líquidos caíram, ela não opera — ponto final. Se passou, dá nota por IBS (peso 2) + posição na faixa de 60 (peso 1) + RSI(14) (peso 1) e compra os Top N.",
      janela: "O dia, mais 14 e 60 pregões nos indicadores.",
      quantos: "Top N, nas noites em que dispara.",
      quandoPara:
        "Na maior parte do tempo. É a que menos opera e a de melhor relação retorno/risco justamente por isso — a coluna COBERTURA mostra em que fatia das noites ela apareceu.",
      naoConfunda:
        "Não é “a Reversão Clássica com filtro”. Os indicadores são quase os mesmos, mas o gatilho é o MERCADO, não o papel. Em dia normal ela some da lista e a curva dela fica reta no gráfico — isso é o comportamento correto, não defeito.",
    },
    n_teto: {
      nome: "Longe da Máxima",
      cor: "#F15BB5",
      grupo: "Motor de placar · família REVERSÃO",
      chaves: ["máxima do dia", "devolveu a alta", "topo perdido"],
      linha:
        "Única estratégia que mede a distância entre o fechamento e a MÁXIMA do pregão.",
      pergunta:
        "Quem chegou a subir hoje e terminou o dia longe do próprio topo?",
      como: "Calcula fechamento ÷ máxima do dia − 1 (sempre negativo) e dá nota a quem devolveu mais: peso 2 nesse indicador, peso 1 no IBS e peso 1 na posição na faixa de 20 pregões. Sem filtro de entrada — ela sempre tem lista.",
      janela:
        "A máxima e o IBS são do dia; a faixa usa 20 pregões. Não obedece o controle “Janela”.",
      quantos: "Top N.",
      quandoPara: "Nunca — opera em 100% das noites com universo válido.",
      naoConfunda:
        "Parece o IBS e não é. O IBS divide pela faixa inteira do dia, então um papel de faixa estreita pode marcar IBS baixo tendo devolvido quase nada; este mede a queda em percentual do preço. Nos testes de 2023–2026 os dois escolhem o mesmo papel em cerca de metade das noites — na outra metade, discordam.",
    },
    n_elastico: {
      nome: "Elástico Longo",
      cor: "#8AC926",
      grupo: "Motor de placar · família LONGO PRAZO",
      chaves: ["média de 200 dias", "esticado para baixo", "reversão lenta"],
      linha:
        "A única que olha o ano inteiro: papel abaixo da média de 200 pregões e ainda caindo no mês.",
      pergunta:
        "Quem está esticado para baixo em relação à própria média longa?",
      como: "Exige fechamento pelo menos 5% abaixo da média de 200 pregões. Entre os aprovados, nota = distância da média de 200 (peso 2) + retorno de 20 pregões (peso 1) + IBS (peso 1).",
      janela: "200 pregões para a média, 20 para o retorno. Fixas.",
      quantos: "Top N entre os aprovados.",
      quandoPara:
        "Em mercado de alta ampla e prolongada, quando quase nada está abaixo da média longa.",
      naoConfunda:
        "É a terceira escala de reversão do app: a Clássica olha o DIA, o Fundo de Range olha o TRIMESTRE, esta olha o ANO. Por isso ela sobrevive a período em que as outras patinam — foi a mais estável entre 2023 e 2026 nos testes.",
    },
    n_tracao: {
      nome: "Cabo de Guerra",
      cor: "#D4A373",
      grupo: "Motor de placar · família PRÊMIO",
      chaves: [
        "noite ganha, dia devolve",
        "hábito do papel",
        "não olha o pregão de hoje",
      ],
      linha:
        "Mede o descasamento entre o que o papel rende na noite e o que ele perde dentro do pregão.",
      pergunta: "Quem tem o hábito de abrir em alta e escorrer durante o dia?",
      como: "Calcula ganho médio das últimas 60 noites menos o retorno médio abertura→fechamento dos últimos 20 pregões. Só entra quem tem essa conta positiva. Nota = essa diferença (peso 2) + frequência de gap positivo em 60 pregões (peso 1) + retorno médio de dia (peso 1, invertido).",
      janela: "60 pregões para a noite, 20 para o dia. Fixas.",
      quantos: "Top N entre os aprovados.",
      quandoPara: "Quando nenhum papel líquido tem a conta positiva — raro.",
      naoConfunda:
        "É prima do Prêmio Overnight, mas não igual: o Prêmio só conta quantas vezes o papel abriu em alta; esta desconta o que ele devolve durante o pregão. Nos testes rendeu mais que o Prêmio, mas com correlação mais alta com o resto do grupo — o Prêmio continua sendo o item que menos anda junto com os outros, e é por isso que ele fica.",
    },
    n_intraday: {
      nome: "Leilão de Abertura",
      cor: "#5AC8FA",
      grupo: "Motor intradiário · a outra perna do dia",
      chaves: [
        "compra na abertura",
        "vende no fechamento",
        "não é overnight",
        "trade de leilão",
      ],
      linha:
        "A única estratégia do app que opera o DIA em vez da NOITE: entra no leilão de abertura e sai no de fechamento.",
      pergunta:
        "Entre os que abriram hoje, quem abriu mais fraco que os outros?",
      como: "Às 10h ordena os líquidos por dois números: o gap da abertura (peso 2, invertido — quanto pior a abertura, maior a nota) e a frequência de gap positivo em 60 pregões (peso 1, também invertido — papel que não costuma abrir em alta). Compra os 8 primeiros em peso igual no leilão de abertura e vende tudo no leilão de fechamento do mesmo dia.",
      janela:
        "O gap é de hoje; o hábito usa 60 pregões até ONTEM. Nenhum indicador de hoje além da abertura entra — às 10h não existe máxima, mínima, fechamento nem volume do dia.",
      quantos:
        "8. Com 5 rende mais (0,344%/dia) e com 20 rende menos (0,159%); 8 é onde a margem ainda aguenta erro de execução.",
      quandoPara:
        "Nunca — tem lista em 100% dos pregões. Em 11% dos dias os 'mais fracos' na verdade abriram em alta; nesses dias ela rendeu ainda mais (+0,43%/dia).",
      naoConfunda:
        "Não é o inverso do overnight, é o complemento. A correlação entre as duas séries diárias em 719 pregões é −0,006 — praticamente zero. Metade do capital em cada uma rendeu 0,239% por dia com Sharpe 5,03 e tombo máximo de 7,0%, contra 0,212% e Sharpe 3,74 do overnight sozinho. E cuidado com o mais importante: a margem é 0,266% por dia com entrada no PREÇO DO LEILÃO. Entrando 0,1% acima sobra 0,165%; 0,2% acima, 0,065%; 0,3% acima, ela fica negativa. É trade de leilão, não de tela.",
    },
    n_consenso: {
      nome: "Consenso Cruzado",
      cor: "#FFD166",
      grupo: "Combinação (não tem indicador próprio)",
      chaves: [
        "só o que as DUAS famílias apontam",
        "apanhou hoje + abre em alta sempre",
        "lista curta",
      ],
      linha:
        "Fica só com os papéis apontados ao mesmo tempo por uma estratégia de reversão e pela de hábito.",
      pergunta:
        "Existe algum papel que apanhou hoje E que historicamente abre em alta?",
      como: "Roda as oito estratégias, junta os votos e descarta tudo que não tem voto das DUAS famílias — REVERSÃO (Reversão Clássica, Fundo de Range, Pânico, Longe da Máxima) e HÁBITO (Prêmio Overnight, Cabo de Guerra). O que sobra é ordenado por número de votos, até Top N no backtest e até os papéis dos dias normais do termômetro na aba OPERAR.",
      janela: "Herda as janelas de quem votou.",
      quantos: "Até Top N — costuma vir bem menos, às vezes zero.",
      quandoPara:
        "Sempre que nenhum papel é confirmado pelas duas famílias na mesma noite.",
      naoConfunda:
        "É o MIX em modo exigente: mesma matéria-prima (os votos), critério mais duro. Este só aceita papel com voto das duas famílias e para aí — se não tem cruzado, não opera, e por isso cobre uma fatia menor das noites. O MIX não exige a confirmação: põe os confirmados na frente, completa com os mais votados e fica com os primeiros. Compare pela coluna COBERTURA, não pelo resultado total: são números de quantidades diferentes de apostas.",
    },
    n_mix: {
      nome: "MIX · peso igual",
      cor: "#06D6A0",
      grupo: "Combinação (não tem indicador próprio)",
      chaves: [
        "votação das 8 estratégias",
        "confirmados na frente",
        "o termômetro decide quantos",
      ],
      linha:
        "A carteira da noite: junta o que as estratégias apontaram e fica com os mais confirmados — mais papéis depois de dia de queda.",
      pergunta:
        "Se eu tivesse que montar UMA carteira com o que o app inteiro está dizendo, qual seria?",
      como: "Roda as oito estratégias e conta os votos de cada papel (cada uma vota nos seus primeiros — “Papéis por estratégia” em CONFIGURAÇÕES). Ordena assim: primeiro quem tem voto das duas famílias ao mesmo tempo (REVERSÃO e HÁBITO), depois quem tem mais votos, depois a melhor nota. Fica com os primeiros, peso igual.",
      janela: "Herda as janelas de quem votou.",
      quantos:
        "O TERMÔMETRO decide: 5 papéis quando mais da metade dos papéis líquidos caiu no dia, 3 nos outros dias (ajustável em CONFIGURAÇÕES). Depois de dia de queda os cinco primeiros costumam pagar (0,20% a 0,27% por noite); depois de dia de alta, só o primeiro passa de 0,1%.",
      quandoPara: "Só quando nenhuma estratégia apontou nada.",
      naoConfunda:
        "Não é o Placar Geral. O Placar soma INDICADORES numa nota e é uma estratégia como as outras — inclusive um dos votantes daqui; o MIX soma VOTOS. O Placar calcula sobre todo papel líquido, sem filtro e sem olhar o regime do mercado; o MIX só vê papel que alguma estratégia aprovou e herda todos os filtros dela (o Pânico só vota em dia de queda geral, o Prêmio só vota em quem abre em alta em mais de metade das noites). O Placar é um juiz só; o MIX é o júri. Contra o Consenso Cruzado: o Consenso fica só com os papéis que têm voto de REVERSÃO e de HÁBITO ao mesmo tempo e para aí; o MIX põe esses na frente e completa as vagas com os mais votados.",
    },
    n_mix_nr: {
      nome: "MIX sem repetir",
      cor: COR_MIX_NR,
      grupo: "Combinação (não tem indicador próprio)",
      chaves: [
        "mesma ordem do MIX",
        "não repete o papel da noite anterior",
        "a vaga vai para o próximo",
      ],
      linha:
        "O MIX com uma regra a mais: papel comprado numa noite não pode ser comprado na noite seguinte.",
      pergunta:
        "Se eu não posso repetir o papel de ontem, qual é a carteira de hoje?",
      como: "Monta a mesma lista do MIX, na mesma ordem, com o mesmo número de papéis do termômetro. Antes de preencher as vagas, tira da lista os papéis da noite anterior; quem estava atrás sobe. Peso igual entre os escolhidos, como no MIX.",
      janela:
        "Herda as janelas de quem votou. A noite anterior é o pregão imediatamente antes da compra.",
      quantos:
        "O mesmo do MIX: o termômetro (5 em dia de queda, 3 nos demais, em CONFIGURAÇÕES).",
      quandoPara:
        "Só quando nenhuma estratégia apontou nada — ou quando, tirando os de ontem, a lista acaba. Noite sem compra zera a regra: no dia seguinte não há o que excluir.",
      naoConfunda:
        "No BACKTEST a noite anterior é a carteira que a própria estratégia teria montado ontem — é o alvo teórico, uma cadeia contínua desde o começo da base (por isso o resultado de uma noite não muda com o recorte De/Até). Na aba OPERAR a noite anterior é o que VOCÊ marcou em “acompanhar” no pregão anterior, em qualquer estratégia — é a sua entrada real, que nem sempre bate com a teórica porque a lista mexe entre a captura e o leilão. O Acompanhamento dia a dia segue a regra teórica, como o backtest.",
    },
    n_mix_nr_fixo: {
      nome: "MIX sem repetir · sem termômetro",
      cor: COR_MIX_FIXO,
      grupo: "Régua (só para comparar)",
      chaves: [
        "mesmo MIX sem repetir",
        "número fixo de papéis",
        "mostra o que o termômetro acrescenta",
      ],
      linha:
        "O MIX sem repetir levando sempre o número de papéis dos dias normais, mesmo depois de dia de queda. Serve de régua para ver o que o termômetro acrescenta.",
      pergunta: "Quanto o termômetro está rendendo a mais?",
      como: "Mesmo júri, mesma ordem e mesma regra de não repetir do MIX sem repetir. A única diferença: toda noite leva o número de “Papéis nos outros dias” de CONFIGURAÇÕES (3), sem subir para 5 depois de dia de queda.",
      janela: "Herda as janelas de quem votou.",
      quantos: "Sempre o número de “Papéis nos outros dias” (3).",
      quandoPara: "Só quando nenhuma estratégia apontou nada.",
      naoConfunda:
        "Não aparece no OPERAR: é régua, não carteira para seguir. No backtest de jun/2023 a set/2026 (R$ 10 mil por papel): sempre 3 papéis rendeu 0,159% por noite, R$ 47 por noite, tombo −10,5%; com o termômetro, 0,162%, R$ 70 por noite, tombo −8,0%. Quando não quiser mais ver, esconda em CONFIGURAÇÕES → Estratégias no COMPARAR.",
    },
  },
  JUIZES = {
    j_media: "media",
    j_aparada: "aparada",
    j_reversao: "reversao",
  },
  NOMES_SERIES = {
    carteira: "Carteira (cesta manual)",
    mix: "MIX · peso igual",
    mix_nr: "MIX sem repetir",
    mix_nr_fixo: "MIX sem repetir · sem termômetro",
    consenso: "Consenso Cruzado",
    ...Object.fromEntries(ESTRATEGIAS.map((e) => [e.id, e.nome])),
    j_media: "Escolha pela MÉDIA",
    j_aparada: "Escolha pela MÉDIA APARADA",
    j_reversao: "Queda Forte no Fundo",
  },
  CORES_SERIES = {
    carteira: "#E8E8E8",
    mix: "#06D6A0",
    mix_nr: COR_MIX_NR,
    mix_nr_fixo: COR_MIX_FIXO,
    consenso: "#FFD166",
    ...Object.fromEntries(ESTRATEGIAS.map((e) => [e.id, e.cor])),
    j_media: "#F0B347",
    j_aparada: "#4CC9F0",
    j_reversao: "#C77DFF",
  },
  GUIA_DA_SERIE = {
    carteira: "cesta_padrao",
    mix: "n_mix",
    mix_nr: "n_mix_nr",
    mix_nr_fixo: "n_mix_nr_fixo",
    consenso: "n_consenso",
    ...Object.fromEntries(ESTRATEGIAS.map((e) => ["" + e.id, "n_" + e.id])),
    j_media: "media",
    j_aparada: "aparada",
    j_reversao: "reversao",
  };

const INDICADORES_USADOS = Array.from(
  new Set(ESTRATEGIAS.flatMap((e) => Object.keys(e.pesos))),
);

function rankearIndicadores(e, t, r) {
  let n = new Map();
  for (let a of INDICADORES_USADOS) {
    let o = SENTIDO_INDICADORES[a] ?? 1,
      i = [];
    for (let l of r) {
      let c = e.ativos[l].ind[a][t];
      Number.isFinite(c) && i.push([l, c * o]);
    }
    if (i.length < 10) {
      n.set(a, null);
      continue;
    }
    i.sort((l, c) => l[1] - c[1]);
    let s = new Map();
    for (let l = 0; l < i.length; l++) s.set(i[l][0], (l + 0.5) / i.length);
    n.set(a, s);
  }
  return n;
}

const MIN_ELEGIVEIS = 8;

function elegiveis(e, t, r, n) {
  let a = [];
  for (let o = 0; o < e.ativos.length; o++) {
    let i = e.ativos[o].ind;
    i.liq20[t] >= r && i.C[t] >= n && a.push(o);
  }
  return a;
}

function escolhasDaEstrategia(e, t, r, n, a, o) {
  if (r.regime) {
    let s = {
      amplitude: e.amplitude[t],
      retMercado: e.retMercado[t],
    };
    if (!Number.isFinite(s.amplitude) || !r.regime(s)) return [];
  }
  let i = [];
  for (let s of a) {
    let l = e.ativos[s].ind;
    if (r.filtro) {
      let p = {};
      for (let g of Object.keys(SENTIDO_INDICADORES))
        p[g] = l[g] ? l[g][t] : NaN;
      let h = true;
      try {
        h = r.filtro(p);
      } catch {
        h = false;
      }
      if (!h) continue;
    }
    let c = 0,
      u = 0,
      f = false;
    for (let [p, h] of Object.entries(r.pesos)) {
      let g = n.get(p),
        m = g ? g.get(s) : undefined;
      if (m == null) {
        f = true;
        break;
      }
      ((c += h * m), (u += h));
    }
    f ||
      u === 0 ||
      i.push({
        k: s,
        ativo: e.ativos[s].ativo,
        placar: c / u,
        ind: l,
        i: t,
      });
  }
  return (i.sort((s, l) => l.placar - s.placar), i.slice(0, o));
}

export const TERMOMETRO_PADRAO = {
  queda: 5,
  normal: 3,
  limiar: 50,
};

function tamanhoDoMix(e, t, r) {
  let n = r || TERMOMETRO_PADRAO,
    a = e.amplitude[t];
  return Number.isFinite(a) && a > n.limiar / 100 ? n.queda : n.normal;
}

function montarMix(
  e,
  t,
  r,
  { mixMax: n, excluir: a = null, pulados: o = null },
) {
  let i = Array.from(e.entries()).map(([l, c]) => ({
    k: l,
    ativo: c.ativo,
    n: c.n,
    cruzado: c.familias.has("REV") && c.familias.has("PER"),
    melhorPlacar: c.melhorPlacar,
  }));
  i.sort(
    (l, c) =>
      c.cruzado - l.cruzado || c.n - l.n || c.melhorPlacar - l.melhorPlacar,
  );
  let s = [];
  for (let l of i) {
    if (s.length >= n) break;
    let c = r.ativos[l.k].ind,
      u = c.C[t],
      f = c.liq20[t];
    if (!(!(u > 0) || !(f > 0))) {
      if (a && a.has(l.ativo)) {
        o &&
          o.push({
            ...l,
            preco: u,
            volMed: f,
            pos: s.length + o.length + 1,
          });
        continue;
      }
      s.push({
        ...l,
        preco: u,
        volMed: f,
      });
    }
  }
  return s;
}

const CACHE_MIX = new WeakMap();

function chaveCacheMix(e, t) {
  let r = t.termometro;
  return [e.minVolMM, e.precoMin, e.topN, r.queda, r.normal, r.limiar].join(
    "|",
  );
}

function estadoMix(e, t, r) {
  let n = CACHE_MIX.get(e);
  n || ((n = new Map()), CACHE_MIX.set(e, n));
  let a = chaveCacheMix(t, r),
    o = n.get(a);
  return (
    o ||
      ((o = {
        ate: 119,
        escolhidos: new Map(),
      }),
      n.set(a, o)),
    o
  );
}

function votosDoDia(e, t, r, n, a) {
  let o = elegiveis(e, t, r, n);
  if (o.length < MIN_ELEGIVEIS) return null;
  let i = rankearIndicadores(e, t, o),
    s = new Map();
  for (let l of ESTRATEGIAS)
    for (let c of escolhasDaEstrategia(e, t, l, i, o, a)) {
      let u = s.get(c.k) ?? {
        n: 0,
        familias: new Set(),
        ativo: c.ativo,
        melhorPlacar: 0,
      };
      (u.n++,
        u.familias.add(l.familia),
        c.placar > u.melhorPlacar && (u.melhorPlacar = c.placar),
        s.set(c.k, u));
    }
  return s;
}

function configSerie(e, t = "principal") {
  let r = e.termometro || TERMOMETRO_PADRAO;
  return {
    serie: t,
    termometro:
      t === "fixo"
        ? {
            queda: r.normal,
            normal: r.normal,
            limiar: 100,
          }
        : r,
  };
}

function carteiraMixDoDia(e, t, r, n, a) {
  let o = n.escolhidos.get(t - 1) ?? [],
    i = [],
    s = tamanhoDoMix(e, t, a.termometro),
    l =
      r && r.size > 0
        ? montarMix(r, t, e, {
            mixMax: s,
            excluir: new Set(o),
            pulados: i,
          })
        : [];
  return (
    n.ate === t - 1 &&
      (n.escolhidos.set(
        t,
        l.map((c) => c.ativo),
      ),
      (n.ate = t)),
    {
      carteira: l,
      pulados: i,
      ontem: o,
      mixMax: s,
    }
  );
}

function avancarMix(e, t, r, n = "principal") {
  let a = configSerie(t, n),
    o = estadoMix(e, t, a),
    i = t.minVolMM * 1000000,
    s = Math.min(r, e.N - 1);
  for (let l = o.ate + 1; l <= s; l++)
    carteiraMixDoDia(e, l, votosDoDia(e, l, i, t.precoMin, t.topN), o, a);
  return o;
}

export function backtestEstrategias(e, t) {
  let { minVolMM: r, precoMin: n, topN: a, tsIni: o, tsFim: i } = t,
    s = t.termometro || {
      ...TERMOMETRO_PADRAO,
      ...(t.mixMax
        ? {
            normal: t.mixMax,
          }
        : {}),
    };
  t = {
    ...t,
    termometro: s,
  };
  let l = r * 1000000,
    c = e.N,
    u = e.dates.findIndex((w) => w >= (o ?? -1 / 0)),
    f = Math.max(120, u < 0 ? c : u),
    p = c - 2;
  if (i != null) {
    for (let w = c - 2; w >= 0; w--)
      if (e.dates[w] <= i) {
        p = w;
        break;
      }
  }
  let h = () => ({
      rets: [],
      ts: [],
      eq: 1,
      curva: [],
      vezes: new Map(),
      contrib: new Map(),
    }),
    g = new Map(ESTRATEGIAS.map((w) => [w.id, h()]));
  for (let w of ["consenso", "mix", "mix_nr", "mix_nr_fixo"]) g.set(w, h());
  let m = avancarMix(e, t, f - 1, "principal"),
    x = configSerie(t, "principal"),
    y = avancarMix(e, t, f - 1, "fixo"),
    b = configSerie(t, "fixo"),
    S = (w, _, E, P = {}) => {
      let O = [],
        R = g.get(w);
      for (let H of E) {
        let Y = e.ativos[H.k].ind.over[_ + 1];
        Number.isFinite(Y) &&
          (O.push({
            ativo: H.ativo,
            r: Y,
          }),
          R.vezes.set(H.ativo, (R.vezes.get(H.ativo) ?? 0) + 1));
      }
      if (O.length === 0) return;
      let M = O.reduce((H, Y) => H + Y.r, 0) / O.length;
      for (let H of O)
        R.contrib.set(H.ativo, (R.contrib.get(H.ativo) ?? 0) + H.r / O.length);
      ((R.eq = compor(MODO_OVER, R.eq, M)),
        R.rets.push(M),
        R.ts.push(e.dates[_ + 1]),
        R.curva.push({
          ts: e.dates[_ + 1],
          tsCompra: e.dates[_],
          ret: M,
          eq: R.eq,
          n: O.length,
          itens: O.map((H) => ({
            ativo: H.ativo,
            r: H.r,
          })),
          ...P,
        }));
    };
  for (let w = f; w <= p; w++) {
    let _ = elegiveis(e, w, l, n);
    if (_.length < MIN_ELEGIVEIS) {
      (carteiraMixDoDia(e, w, null, m, x), carteiraMixDoDia(e, w, null, y, b));
      continue;
    }
    let E = rankearIndicadores(e, w, _),
      P = new Map();
    for (let M of ESTRATEGIAS) {
      let H = escolhasDaEstrategia(e, w, M, E, _, a);
      for (let F of H) {
        let q = P.get(F.k) ?? {
          n: 0,
          familias: new Set(),
          ativo: F.ativo,
          melhorPlacar: 0,
        };
        (q.n++,
          q.familias.add(M.familia),
          F.placar > q.melhorPlacar && (q.melhorPlacar = F.placar),
          P.set(F.k, q));
      }
      if (H.length === 0) continue;
      let Y = [];
      for (let F of H) {
        let q = e.ativos[F.k].ind.over[w + 1];
        Number.isFinite(q) &&
          Y.push({
            ativo: F.ativo,
            r: q,
          });
      }
      if (Y.length === 0) continue;
      let G = Y.reduce((F, q) => F + q.r, 0) / Y.length,
        k = g.get(M.id);
      for (let F of Y)
        (k.vezes.set(F.ativo, (k.vezes.get(F.ativo) ?? 0) + 1),
          k.contrib.set(
            F.ativo,
            (k.contrib.get(F.ativo) ?? 0) + F.r / Y.length,
          ));
      ((k.eq = compor(MODO_OVER, k.eq, G)),
        k.rets.push(G),
        k.ts.push(e.dates[w + 1]),
        k.curva.push({
          ts: e.dates[w + 1],
          tsCompra: e.dates[w],
          ret: G,
          eq: k.eq,
          itens: Y.map((F) => ({
            ativo: F.ativo,
            r: F.r,
          })),
        }));
    }
    let O = tamanhoDoMix(e, w, s);
    P.size > 0 &&
      S(
        "mix",
        w,
        montarMix(P, w, e, {
          mixMax: O,
        }),
        {
          papeis: O,
        },
      );
    {
      let { carteira: M, pulados: H } = carteiraMixDoDia(e, w, P, m, x);
      S("mix_nr", w, M, {
        papeis: O,
        pulados: H.map((Y) => Y.ativo),
      });
    }
    {
      let { carteira: M } = carteiraMixDoDia(e, w, P, y, b);
      S("mix_nr_fixo", w, M);
    }
    let R = Array.from(P.entries())
      .filter(([, M]) => M.familias.has("REV") && M.familias.has("PER"))
      .sort((M, H) => H[1].n - M[1].n)
      .slice(0, a);
    if (R.length > 0) {
      let M = [];
      for (let [H, Y] of R) {
        let G = e.ativos[H].ind.over[w + 1];
        Number.isFinite(G) &&
          M.push({
            ativo: Y.ativo,
            r: G,
          });
      }
      if (M.length > 0) {
        let H = M.reduce((G, k) => G + k.r, 0) / M.length,
          Y = g.get("consenso");
        for (let G of M)
          (Y.vezes.set(G.ativo, (Y.vezes.get(G.ativo) ?? 0) + 1),
            Y.contrib.set(
              G.ativo,
              (Y.contrib.get(G.ativo) ?? 0) + G.r / M.length,
            ));
        ((Y.eq = compor(MODO_OVER, Y.eq, H)),
          Y.rets.push(H),
          Y.ts.push(e.dates[w + 1]),
          Y.curva.push({
            ts: e.dates[w + 1],
            tsCompra: e.dates[w],
            ret: H,
            eq: Y.eq,
            itens: M.map((G) => ({
              ativo: G.ativo,
              r: G.r,
            })),
          }));
      }
    }
  }
  let T = {},
    A = Math.max(1, p - f + 1);
  for (let w of [
    ...ESTRATEGIAS,
    {
      id: "consenso",
    },
    {
      id: "mix",
    },
    {
      id: "mix_nr",
    },
    {
      id: "mix_nr_fixo",
    },
  ]) {
    let _ = g.get(w.id),
      E = Math.max(1, t.minNoites ?? 20);
    if (_.rets.length < E) {
      T[w.id] = {
        erro:
          _.rets.length === 0
            ? "Nenhuma noite no período."
            : `Só ${_.rets.length} noite(s) no período.`,
      };
      continue;
    }
    let P = _.rets,
      O = P.reduce((k, F) => k + F, 0) / P.length,
      R = Math.sqrt(
        P.reduce((k, F) => k + (F - O) ** 2, 0) / (P.length - 1 || 1),
      ),
      M = 1,
      H = 0;
    for (let k of _.curva)
      (k.eq > M && (M = k.eq),
        (H = Math.min(H, descompor(MODO_OVER, k.eq, M))));
    let Y = _.eq - 1,
      G = Array.from(_.vezes.entries())
        .map(([k, F]) => {
          let q = _.contrib?.get(k) ?? null;
          return {
            ativo: k,
            vezes: F,
            contrib: q,
            share: q != null && Y > 0.0001 ? q / Y : null,
          };
        })
        .sort(
          (k, F) => (F.contrib ?? 0) - (k.contrib ?? 0) || F.vezes - k.vezes,
        );
    T[w.id] = {
      curva: _.curva,
      rets: P,
      ts: _.ts,
      possivelDe: e.dates[f] ?? null,
      possivelAte: e.dates[p] ?? null,
      media: O,
      dp: R,
      mdd: H,
      n: P.length,
      total: Y,
      acerto: P.filter((k) => k > 0).length / P.length,
      pior: Math.min(...P),
      melhor: Math.max(...P),
      sharpe: R > 0 ? (O / R) * Math.sqrt(252) : null,
      cobertura: P.length / A,
      nAtivos: _.vezes.size,
      porAtivo: G,
      stats: {
        total: Y,
        media: O,
        dp: R,
        mdd: H,
        n: P.length,
        noitesPossiveis: A,
        semOperar: A - P.length,
        posPct: P.filter((k) => k > 0).length / P.length,
        pior: Math.min(...P),
        melhor: Math.max(...P),
        nAtivos: _.vezes.size,
      },
    };
  }
  return ((T.__correl = correlacoes(T)), T);
}

function correlacoes(e) {
  let t = ESTRATEGIAS.map((a) => a.id).filter((a) => e[a] && !e[a].erro),
    r = new Map(
      t.map((a) => [a, new Map(e[a].ts.map((o, i) => [o, e[a].rets[i]]))]),
    ),
    n = {};
  for (let a of t) {
    n[a] = {};
    for (let o of t) {
      let i = [],
        s = [];
      for (let [h, g] of r.get(a)) {
        let m = r.get(o).get(h);
        m != null && (i.push(g), s.push(m));
      }
      if (i.length < 30) {
        n[a][o] = null;
        continue;
      }
      let l = i.reduce((h, g) => h + g, 0) / i.length,
        c = s.reduce((h, g) => h + g, 0) / s.length,
        u = 0,
        f = 0,
        p = 0;
      for (let h = 0; h < i.length; h++)
        ((u += (i[h] - l) * (s[h] - c)),
          (f += (i[h] - l) ** 2),
          (p += (s[h] - c) ** 2));
      n[a][o] = f > 0 && p > 0 ? u / Math.sqrt(f * p) : null;
    }
  }
  return n;
}

export function backtestPorJuiz(e, t) {
  let { minVolMM: r, precoMin: n, topN: a, tsIni: o, tsFim: i } = t,
    s = t.termometro || {
      ...TERMOMETRO_PADRAO,
      ...(t.mixMax
        ? {
            normal: t.mixMax,
          }
        : {}),
    };
  t = {
    ...t,
    termometro: s,
  };
  let l = r * 1000000,
    c = e.N,
    u = e.dates.findIndex((A) => A >= (o ?? -1 / 0)),
    f = Math.max(120, u < 0 ? c : u),
    p = c - 2;
  if (i != null) {
    for (let A = c - 2; A >= 0; A--)
      if (e.dates[A] <= i) {
        p = A;
        break;
      }
  }
  let h = new Map(),
    g = (A, w) => (
      h.has(A) ||
        h.set(A, {
          id: A,
          nome: w,
          linhas: [],
        }),
      h.get(A)
    ),
    m = (A, w, _, E) => {
      let P = e.ativos[A].ind,
        O = P.A[w + 1],
        R = P.C[w],
        M = P.over[w + 1];
      return {
        compraTs: e.dates[w],
        vendaTs: e.dates[w + 1],
        ativo: e.ativos[A].ativo,
        top: _,
        abertura: P.A[w],
        maxima: P.Hi[w],
        minima: P.Lo[w],
        fech: R,
        volFin: P.V[w],
        liq20: P.liq20[w],
        aberturaVenda: Number.isFinite(O) ? O : null,
        resultado: Number.isFinite(M) ? M : null,
        gapBruto: Number.isFinite(O) && R > 0 ? O / R - 1 : null,
        varDia: P.varDia[w],
        ibs: P.ibs[w],
        rsi14: P.rsi14[w],
        pos20: P.pos20[w],
        pos60: P.pos60[w],
        gapDoDia: P.ovLast[w],
        ovWin60: P.ovWin60[w],
        ...E,
      };
    },
    x = (A, w) => {
      let _ = w.filter((P) => P.resultado != null);
      if (_.length === 0) return;
      let E = _.reduce((P, O) => P + O.resultado, 0) / _.length;
      for (let P of w)
        ((P.nNoite = _.length), (P.retNoite = E), A.linhas.push(P));
    },
    y = avancarMix(e, t, f - 1, "principal"),
    b = configSerie(t, "principal"),
    S = avancarMix(e, t, f - 1, "fixo"),
    T = configSerie(t, "fixo");
  for (let A = f; A <= p; A++) {
    let w = elegiveis(e, A, l, n);
    if (w.length < MIN_ELEGIVEIS) {
      (carteiraMixDoDia(e, A, null, y, b), carteiraMixDoDia(e, A, null, S, T));
      continue;
    }
    let _ = rankearIndicadores(e, A, w),
      E = new Map();
    for (let R of ESTRATEGIAS) {
      let M = escolhasDaEstrategia(e, A, R, _, w, a);
      for (let H of M) {
        let Y = E.get(H.k) ?? {
          n: 0,
          familias: new Set(),
          ativo: H.ativo,
          melhorPlacar: 0,
        };
        (Y.n++,
          Y.familias.add(R.familia),
          H.placar > Y.melhorPlacar && (Y.melhorPlacar = H.placar),
          E.set(H.k, Y));
      }
      M.length !== 0 &&
        x(
          g(R.id, R.nome),
          M.map((H, Y) =>
            m(H.k, A, Y + 1, {
              placar: H.placar,
            }),
          ),
        );
    }
    let P = tamanhoDoMix(e, A, s);
    if (E.size > 0) {
      let R = montarMix(E, A, e, {
        mixMax: P,
      });
      R.length &&
        x(
          g("mix", "MIX · peso igual"),
          R.map((M, H) =>
            m(M.k, A, H + 1, {
              placar: M.melhorPlacar,
              votos: M.n,
              cruzado: M.cruzado ? "sim" : "não",
              papeisNoite: P,
            }),
          ),
        );
    }
    {
      let { carteira: R, pulados: M } = carteiraMixDoDia(e, A, E, y, b),
        H = M.map((Y) => Y.ativo).join(", ");
      R.length &&
        x(
          g("mix_nr", "MIX sem repetir"),
          R.map((Y, G) =>
            m(Y.k, A, G + 1, {
              placar: Y.melhorPlacar,
              votos: Y.n,
              cruzado: Y.cruzado ? "sim" : "não",
              pulados: H,
              papeisNoite: P,
            }),
          ),
        );
    }
    {
      let {
          carteira: R,
          pulados: M,
          mixMax: H,
        } = carteiraMixDoDia(e, A, E, S, T),
        Y = M.map((G) => G.ativo).join(", ");
      R.length &&
        x(
          g("mix_nr_fixo", "MIX sem repetir sem termometro"),
          R.map((G, k) =>
            m(G.k, A, k + 1, {
              placar: G.melhorPlacar,
              votos: G.n,
              cruzado: G.cruzado ? "sim" : "não",
              pulados: Y,
              papeisNoite: H,
            }),
          ),
        );
    }
    let O = Array.from(E.entries())
      .filter(([, R]) => R.familias.has("REV") && R.familias.has("PER"))
      .sort((R, M) => M[1].n - R[1].n)
      .slice(0, a);
    O.length &&
      x(
        g("consenso", "Consenso Cruzado"),
        O.map(([R, M], H) =>
          m(R, A, H + 1, {
            placar: M.melhorPlacar,
            votos: M.n,
            cruzado: "sim",
          }),
        ),
      );
  }
  return Array.from(h.values());
}

export function ultimasNoites(e, t, r = 30, n = ["mix"]) {
  let a = e.N - 1,
    o = Math.max(120, a - r + 1),
    i = new Map(
      n.map((c) => [
        c,
        {
          linhas: [],
          eq: 1,
        },
      ]),
    ),
    s = n.includes("mix_nr") ? avancarMix(e, t, a - 1) : null;
  for (let c = o; c <= a; c++) {
    let u = sinaisDoDia(
      e,
      e.dates[c],
      s
        ? {
            ...t,
            excluirOntem: s.escolhidos.get(c - 1) ?? [],
            origemExclusao: "teorica",
          }
        : t,
    );
    if (!u.erro)
      for (let f of n) {
        let p = u.carteiras[f];
        if (!p || p.itens.length === 0) continue;
        let h = i.get(f),
          g = {
            compraTs: e.dates[c],
            vendaTs: p.intraday ? e.dates[c] : u.vendaTs,
            ativos: p.itens.map((m) => m.ativo),
            nPapeis: p.itens.length,
            resultado: p.resultado,
            amplitude: u.mercado.amplitude,
          };
        (p.resultado &&
          ((h.eq = compor(MODO_OVER, h.eq, p.resultado.ret)), (g.eq = h.eq)),
          h.linhas.push(g));
      }
  }
  let l = {};
  for (let [c, u] of i) {
    let f = u.linhas.filter((p) => p.resultado).map((p) => p.resultado.ret);
    l[c] = {
      linhas: u.linhas.slice().reverse(),
      resumo: f.length
        ? {
            n: f.length,
            media: f.reduce((p, h) => p + h, 0) / f.length,
            acerto: f.filter((p) => p > 0).length / f.length,
            acumulado: u.eq - 1,
          }
        : null,
    };
  }
  return l;
}

export function sinaisDoDia(e, t, r) {
  let { minVolMM: n, precoMin: a, topN: o } = r,
    i = r.termometro || {
      ...TERMOMETRO_PADRAO,
      ...(r.mixMax
        ? {
            normal: r.mixMax,
          }
        : {}),
    },
    s = i.normal,
    l = e.dates.indexOf(t);
  if (l < 120)
    return {
      erro: "Data sem histórico suficiente (precisa de 120 pregões antes).",
    };
  let c = elegiveis(e, l, n * 1000000, a);
  if (c.length < MIN_ELEGIVEIS)
    return {
      erro: `Só ${c.length} ativo(s) passam no piso de liquidez nesse dia — baixe o volume mínimo em CONFIGURAÇÕES.`,
    };
  let u = rankearIndicadores(e, l, c),
    f = tamanhoDoMix(e, l, i),
    p = {
      amplitude: e.amplitude[l],
      retMercado: e.retMercado[l],
      nElegiveis: c.length,
      papeisMix: f,
      termometro: i,
    },
    h = l + 1 < e.dates.length ? e.dates[l + 1] : null,
    g = (k, F) => {
      let q = e.ativos[k].ind,
        N = h != null ? q.over[l + 1] : NaN,
        j = Number.isFinite(N) ? N : null,
        I = q.C[l],
        C = h != null ? q.A[l + 1] : NaN,
        L = j != null && Number.isFinite(C) && C > 0 ? C : null,
        B = L != null && Number.isFinite(I) && I > 0 ? L / I - 1 : null;
      return {
        k,
        ativo: e.ativos[k].ativo,
        preco: I,
        fech: I,
        volMed: q.liq20[l],
        ibs: q.ibs[l],
        varDia: q.varDia[l],
        rsi14: q.rsi14[l],
        pos60: q.pos60[l],
        pctB: q.pctB[l],
        ovWin120: q.ovWin120[l],
        ovMean120: q.ovMean120[l],
        ovLast: q.ovLast[l],
        gapHoje: q.ovLast[l],
        intraHoje:
          Number.isFinite(I) &&
          I > 0 &&
          Number.isFinite(q.varDia[l]) &&
          Number.isFinite(q.ovLast[l])
            ? (1 + q.varDia[l]) / (1 + q.ovLast[l]) - 1
            : NaN,
        realizado: j,
        precoVenda: L,
        gapBruto: B,
        ...F,
      };
    },
    m = (k) => {
      let F = k.filter((q) => q.realizado != null);
      return F.length === 0
        ? null
        : {
            ret: F.reduce((q, N) => q + N.realizado, 0) / F.length,
            acertos: F.filter((q) => q.realizado > 0).length,
            total: F.length,
            parcial: F.length < k.length,
          };
    },
    x = new Map(),
    y = ESTRATEGIAS.map((k) => {
      let F = escolhasDaEstrategia(e, l, k, u, c, o);
      for (let q of F) {
        let N = x.get(q.k) ?? {
          n: 0,
          familias: new Set(),
          ativo: q.ativo,
          melhorPlacar: 0,
        };
        (N.n++,
          N.familias.add(k.familia),
          q.placar > N.melhorPlacar && (N.melhorPlacar = q.placar),
          x.set(q.k, N));
      }
      return {
        est: k,
        dormindo: k.regime && F.length === 0,
        itens: F.map((q) =>
          g(q.k, {
            placar: q.placar,
          }),
        ),
      };
    }),
    b = y,
    S = new Map();
  for (let k of y)
    for (let F of k.itens) {
      let q = S.get(F.ativo) ?? [];
      (q.push(k.est), S.set(F.ativo, q));
    }
  for (let k of y) for (let F of k.itens) F.porques = S.get(F.ativo) ?? [];
  // papéis do Overnight padrão não entram no MIX do dia: o próximo da lista
  // entra no lugar, e quem saiu fica registrado para reforçar a entrada
  let cestaFora = new Set(r.excluirCesta ?? []),
    cestaPulados = [],
    T = montarMix(x, l, e, {
      mixMax: f,
      excluir: cestaFora.size ? cestaFora : null,
      pulados: cestaPulados,
    }).map((k) =>
      g(k.k, {
        n: k.n,
        cruzado: k.cruzado,
        melhorPlacar: k.melhorPlacar,
        porques: S.get(k.ativo) ?? [],
      }),
    ),
    A = r.excluirOntem,
    w = r.origemExclusao ?? "acompanhar";
  Array.isArray(A) ||
    ((A =
      avancarMix(
        e,
        {
          minVolMM: n,
          precoMin: a,
          topN: o,
          termometro: i,
        },
        l - 1,
        "principal",
      ).escolhidos.get(l - 1) ?? []),
    (w = "teorica"));
  let _ = [],
    E = montarMix(x, l, e, {
      mixMax: f,
      excluir: new Set([...A, ...cestaFora]),
      pulados: _,
    }).map((k) =>
      g(k.k, {
        n: k.n,
        cruzado: k.cruzado,
        melhorPlacar: k.melhorPlacar,
        porques: S.get(k.ativo) ?? [],
      }),
    ),
    P = new Map();
  for (let k of y)
    for (let F of k.itens) {
      let q = P.get(F.ativo) ?? {
        ativo: F.ativo,
        k: F.k,
        em: [],
        dados: F,
      };
      (q.em.push(k.est), P.set(F.ativo, q));
    }
  for (let k of P.values()) {
    let F = new Set(k.em.map((q) => q.familia));
    ((k.cruzado = F.has("REV") && F.has("PER")), (k.familias = F));
  }
  let O = Array.from(P.values()).filter((k) => k.em.length >= 2),
    R = {
      cruzado: O.filter((k) => k.cruzado).sort(
        (k, F) => F.em.length - k.em.length,
      ),
      intenso: O.filter((k) => !k.cruzado).sort(
        (k, F) => F.em.length - k.em.length,
      ),
    },
    M = R.cruzado.slice(0, s).map((k) =>
      g(k.k, {
        cruzado: true,
        n: k.em.length,
        porques: k.em,
      }),
    ),
    H = m(T),
    Y = {
      mix: {
        id: "mix",
        nome: "MIX (portfólio)",
        cor: "#06D6A0",
        guia: "n_mix",
        combinada: true,
        resumo:
          "Junta o que todas as estratégias apontaram, põe na frente quem foi apontado pelas duas famílias e depois quem tem mais votos; o termômetro decide quantos papéis.",
        itens: T,
        dormindo: false,
        resultado: H,
        papeisHoje: f,
        // papéis que o MIX apontaria, mas já estão no Overnight padrão
        naCesta: cestaPulados.map((k) => ({
          ativo: k.ativo,
          pos: k.pos,
          n: k.n,
          cruzado: k.cruzado,
        })),
      },
      mix_nr: {
        id: "mix_nr",
        nome: "MIX sem repetir",
        cor: COR_MIX_NR,
        guia: "n_mix_nr",
        combinada: true,
        resumo:
          "O MIX sem o papel da noite anterior: se um papel repetiu, entra o próximo da lista.",
        itens: E,
        dormindo: false,
        resultado: m(E),
        papeisHoje: f,
        semRepetir: {
          origem: w,
          ontemTs: l > 0 ? e.dates[l - 1] : null,
          ontem: Array.from(new Set(A)).sort(),
          pulados: _.filter((k) => !cestaFora.has(k.ativo)).map((k) => ({
            ativo: k.ativo,
            pos: k.pos,
          })),
        },
      },
      consenso: {
        id: "consenso",
        nome: "Consenso Cruzado",
        cor: "#FFD166",
        guia: "n_consenso",
        combinada: true,
        resumo:
          "Só o papel confirmado ao mesmo tempo pelas duas famílias de sinal.",
        itens: M,
        dormindo: false,
        resultado: m(M),
      },
    },
    G = avaliarAbertura(e, l, {
      minVolMM: n,
      precoMin: a,
      topN: TOP_ABERTURA,
    });
  Y.intraday = {
    ...ESTRATEGIA_ABERTURA,
    guia: "n_intraday",
    combinada: false,
    intraday: true,
    resumo: ESTRATEGIA_ABERTURA.resumo,
    itens: G.erro ? [] : G.itens,
    dormindo: !!G.erro,
    erro: G.erro || null,
    jaAndouMedio: G.jaAndouMedio ?? null,
    margemRestante: G.margemRestante ?? null,
    gapMediano: G.gapMediano ?? null,
    resultado: G.resultado || null,
  };
  for (let k of y)
    Y[k.est.id] = {
      id: k.est.id,
      nome: k.est.nome,
      cor: k.est.cor,
      guia: "n_" + k.est.id,
      combinada: false,
      resumo: k.est.resumo,
      itens: k.itens,
      dormindo: k.dormindo,
      resultado: m(k.itens),
    };
  return {
    mercado: p,
    listas: y,
    listas0: b,
    consenso: R,
    mix: T,
    carteiras: Y,
    i: l,
    vendaTs: h,
    resultado: H,
  };
}

function varBenchmarkNaJanela(e, t, r, n) {
  if (!t) return null;
  if (t.mode === "rf") return Math.pow(1 + t.annual / 100, n / 252) - 1;
  if (t.ticker && e.byTicker.has(t.ticker)) {
    let a = e.byTicker.get(t.ticker).filter((o) => r.has(o.ts));
    if (a.length >= 2) return a[a.length - 1].fech / a[0].fech - 1;
  }
  return null;
}

export function rankingOvernight(e, t, r, n, a, o, i) {
  let { byTicker: s, dates: l } = e,
    c = l.indexOf(t);
  if (c < 0)
    return {
      rows: [],
      windowDates: [],
    };
  let u = Math.max(0, c - r + 1),
    f = l.slice(u, c + 1),
    p = new Set(f),
    h = n * 1000000,
    g = [],
    m = i?.mode === "rv" ? i.ticker : null,
    x = varBenchmarkNaJanela(e, i, p, f.length);
  for (let [b, S] of s) {
    if (b === m || TICKERS_IGNORADOS.has(b)) continue;
    let T = S.filter((N) => p.has(N.ts)),
      A = T.filter((N) => N.over != null).map((N) => N.over),
      w = Math.max(5, Math.floor(0.7 * f.length));
    if (T.length < w || A.length < 5) continue;
    let _ = liquidezNoDia(e, b, t);
    if (!(_ >= h)) continue;
    let E = A.reduce((N, j) => N + j, 0) / A.length,
      P = A.filter((N) => N > 0).length / A.length,
      O = Math.max(...A),
      R = mediaAparada(A),
      M = 1,
      H = 1,
      Y = 0,
      G = A.map((N) => {
        ((M = compor(MODO_OVER, M, N)), M > H && (H = M));
        let j = descompor(MODO_OVER, M, H);
        return (j < Y && (Y = j), M);
      }),
      k = M - 1,
      F = T[T.length - 1].fech / T[0].fech - 1,
      q = T[T.length - 1];
    g.push({
      ativo: b,
      n: A.length,
      volMed: _,
      mean: E,
      win: P,
      curve: G,
      maxDia: O,
      aparada: R,
      comp: k,
      maxDD: Y,
      stockVar: F,
      lastClose: q.fech,
      lastTs: q.ts,
    });
  }
  let y =
    o === "win"
      ? (b) => b.win
      : o === "aparada"
        ? (b) => b.aparada ?? -1000000000
        : (b) => b.mean;
  return (
    g.sort((b, S) => y(S) - y(b)),
    {
      rows: g,
      windowDates: f,
      ibovVar: x,
    }
  );
}

export function sinaisDeQueda(e, t, r, n) {
  let a = [],
    o = r * 1000000;
  for (let [i, s] of e.byTicker) {
    if (i === n || TICKERS_IGNORADOS.has(i)) continue;
    let l = s.findIndex((p) => p.ts === t);
    if (l < 1) continue;
    let c = s[l],
      u = s.slice(Math.max(0, l - 19), l + 1),
      f = u.reduce((p, h) => p + h.vol, 0) / u.length;
    f < o ||
      (c.varDia != null &&
        c.varDia <= -0.02 &&
        c.posRange <= 0.15 &&
        a.push({
          ativo: i,
          varDia: c.varDia,
          posRange: c.posRange,
          volMed: f,
          fech: c.fech,
        }));
  }
  return (a.sort((i, s) => i.varDia - s.varDia), a);
}

export function datasDasCurvas(e, t = -1 / 0, r = 1 / 0) {
  return Array.from(
    new Set((e || []).flatMap((n) => (n?.curva || []).map((a) => a.ts))),
  )
    .filter((n) => n >= t && n <= r)
    .sort((n, a) => n - a);
}

function melhorChave(e) {
  let t = Object.entries(e).filter(([, r]) => r != null);
  return t.length === 0 ? null : (t.sort((r, n) => n[1] - r[1]), t[0][0]);
}

function seriesDaCarteira(e, t, r, n, a, o) {
  let i = t.filter(
    (c) =>
      c.valor > 0 &&
      (e.byTicker.has(c.ativo) || (a && TICKERS_ANTIGOS[c.ativo])),
  );
  if (i.length === 0) return [];
  let s = i.map((c) => ({
      ...c,
      s: serieEncadeada(e, c.ativo, a, o),
    })),
    l = [];
  for (let c of e.dates) {
    if (c < r || c > n) continue;
    let u = 0,
      f = 0,
      p = 0,
      h = 0;
    for (let g of s) {
      let m = g.s.over.get(c),
        x = g.s.varDia.get(c);
      (m != null && ((f += g.valor * m), (u += g.valor)),
        x != null && ((h += g.valor * x), (p += g.valor)));
    }
    (u > 0 || p > 0) &&
      l.push({
        ts: c,
        over: u > 0 ? f / u : null,
        pos: p > 0 ? h / p : null,
      });
  }
  return l;
}

function valorDoBenchmark(e, t, r) {
  if (!t) return null;
  if (t.type === "custom") return t.map.get(r) ?? null;
  if (t.type === "ticker" && e.byTicker.has(t.t)) {
    let n = t.map.get(r);
    return n
      ? t.modo === "over"
        ? (n.over ?? null)
        : (n.varDia ?? null)
      : null;
  }
  return null;
}

export function rotuloBenchmark(e) {
  return !e || e.type !== "ticker" || !e.t
    ? "BENCH"
    : e.modo === "over"
      ? `${e.t} ON`
      : e.t;
}

function prepararBenchmark(e, t) {
  return t
    ? t.type === "custom"
      ? {
          ...t,
          map: new Map(t.points),
        }
      : t.type === "ticker" && e.byTicker.has(t.t)
        ? {
            ...t,
            map: new Map(e.byTicker.get(t.t).map((r) => [r.ts, r])),
          }
        : t
    : null;
}

function pregoesNoMes(e, t) {
  let r = Math.floor(t / 100),
    n = t % 100,
    a = 0;
  for (let l of e.dates) anoMes(l) === t && a++;
  let o = e.dates.length ? anoMes(e.dates[e.dates.length - 1]) : null;
  if (o != null && t < o) return a;
  let i = 0,
    s = new Date(Date.UTC(r, n, 0)).getUTCDate();
  for (let l = 1; l <= s; l++) {
    let c = new Date(Date.UTC(r, n - 1, l)),
      u = c.getUTCDay();
    u !== 0 && u !== 6 && !FERIADOS_B3.has(c.toISOString().slice(0, 10)) && i++;
  }
  return Math.max(i, a);
}

export function mesAMesCarteira(e, t, r, n, a, o, i, s) {
  let l = seriesDaCarteira(e, t, a, o, i, s);
  return l.length === 0 ? null : mesAMes(e, l, r, n);
}

export function mesAMesCurva(e, t, r, n) {
  if (!Array.isArray(t) || t.length === 0) return null;
  let a = t
    .filter((o) => o && o.ts != null && Number.isFinite(o.ret))
    .map((o) => ({
      ts: o.ts,
      over: o.ret,
      pos: null,
    }));
  return a.length === 0 ? null : mesAMes(e, a, r, n);
}

function mesAMes(e, t, r, n) {
  let a = prepararBenchmark(e, r),
    o = n
      ? prepararBenchmark(e, {
          type: "ticker",
          t: n,
        })
      : null,
    i = {
      over: MODO_OVER,
      pos: MODO_POSICAO,
      bench: modoDoBenchmark(a),
      ibov: MODO_POSICAO,
    },
    s = new Map(),
    l = () => ({
      over: baseDoModo(i.over),
      pos: baseDoModo(i.pos),
      bench: baseDoModo(i.bench),
      ibov: baseDoModo(i.ibov),
      nOver: 0,
      nPos: 0,
      nBench: 0,
      nIbov: 0,
    }),
    c = (m, x, y) => {
      if (y == null) return;
      s.has(m) || s.set(m, l());
      let b = s.get(m);
      ((b[x] = acumularModo(i[x], b[x], y)),
        b["n" + x[0].toUpperCase() + x.slice(1)]++);
    };
  for (let m of t)
    (c(anoMes(m.ts), "over", m.over), c(anoMes(m.ts), "pos", m.pos));
  for (let m of t)
    (a &&
      a.type !== "rf" &&
      c(anoMes(m.ts), "bench", valorDoBenchmark(e, a, m.ts)),
      o && c(anoMes(m.ts), "ibov", valorDoBenchmark(e, o, m.ts)));
  if (a && a.type === "rf") {
    let m = Math.pow(1 + a.annual / 100, 0.08333333333333333) - 1,
      x = new Map();
    for (let y of t) {
      let b = anoMes(y.ts);
      x.set(b, (x.get(b) ?? 0) + 1);
    }
    for (let y of s.keys()) {
      let b = s.get(y),
        S = pregoesNoMes(e, y),
        T = S > 0 ? Math.min(1, (x.get(y) ?? 0) / S) : 1;
      ((b.bench = Math.pow(1 + m, T)), (b.nBench = 1));
    }
  }
  let u = Array.from(
      new Set(Array.from(s.keys()).map((m) => Math.floor(m / 100))),
    ).sort((m, x) => x - m),
    f = (m, x) => {
      let y = s.get(m);
      return y && y["n" + x[0].toUpperCase() + x.slice(1)] > 0
        ? retornoDoModo(i[x], y[x])
        : null;
    },
    p = ["over", "pos", "bench", "ibov"],
    h = u.map((m) => {
      let x = MESES.map((b, S) => {
          let T = m * 100 + S + 1;
          return {
            over: f(T, "over"),
            pos: f(T, "pos"),
            bench: f(T, "bench"),
            ibov: f(T, "ibov"),
          };
        }),
        y = {};
      for (let b of p) {
        let S = baseDoModo(i[b]),
          T = false;
        for (let A of x)
          A[b] != null && ((S = acumularModo(i[b], S, A[b])), (T = true));
        y[b] = T ? retornoDoModo(i[b], S) : null;
      }
      return {
        year: m,
        meses: x,
        anual: y,
        best: melhorChave(y),
      };
    }),
    g = {};
  for (let m of p) {
    let x = baseDoModo(i[m]),
      y = false;
    for (let b of h)
      b.anual[m] != null &&
        ((x = acumularModo(i[m], x, b.anual[m])), (y = true));
    g[m] = y ? retornoDoModo(i[m], x) : null;
  }
  return {
    grid: h,
    total: g,
    best: melhorChave(g),
    serie: t,
    regimes: i,
  };
}
