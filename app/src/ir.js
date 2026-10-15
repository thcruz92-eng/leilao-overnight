/* Apuração de imposto de renda (DARF) das operações acompanhadas. */
import * as XLSX from "xlsx";
import { FERIADOS_B3 } from "./dados.js";
import { LOTE_PADRAO, lotesPara, proximaData } from "./estrategias.js";
import { MESES_CURTOS, MESES_LONGOS, fmtData, fmtNum, numBR } from "./tema.js";

export const REGRAS_IR = {
    aliqComum: 0.15,
    aliqDT: 0.2,
    aliqFII: 0.2,
    isencaoVendasAcoes: 20000,
    irrfComum: 0.00005,
    irrfDT: 0.01,
    irrfDispensa: 1,
    darfMinimo: 10,
    darfCodigo: "6015",
  },
  TIPOS_FISCAIS = {
    acao: "Ação/unit",
    fii: "FII",
    etf: "ETF",
    bdr: "BDR",
  },
  UNITS_CONHECIDAS = new Set([
    "ALUP11",
    "BPAC11",
    "BRBI11",
    "CPLE11",
    "ENGI11",
    "IGTI11",
    "KLBN11",
    "SANB11",
    "SAPR11",
    "TAEE11",
    "BIDI11",
    "MODL11",
    "PPLA11",
    "RNEW11",
    "SULA11",
    "TIET11",
  ]);

export function tipoFiscal(e) {
  let t = String(e || "").toUpperCase(),
    r = t.match(/^[A-Z0-9]{4}(\d{1,2})([A-Z]?)$/),
    n = r ? +r[1] : NaN;
  return r && !r[2] && n >= 3 && n <= 8
    ? {
        tipo: "acao",
        presumido: false,
      }
    : r && !r[2] && n === 11
      ? UNITS_CONHECIDAS.has(t)
        ? {
            tipo: "acao",
            presumido: false,
          }
        : {
            tipo: "fii",
            presumido: true,
          }
      : r && !r[2] && [31, 32, 33, 34, 35, 39].includes(n)
        ? {
            tipo: "bdr",
            presumido: false,
          }
        : {
            tipo: "acao",
            presumido: true,
          };
}

const DIA_MS = 86400000,
  centavos = (e) => {
    let t = Math.round(e * 100) / 100;
    return Object.is(t, -0) ? 0 : t;
  },
  isoDia = (e) => new Date(e).toISOString().slice(0, 10);

function pascoa(e) {
  let t = e % 19,
    r = Math.floor(e / 100),
    n = e % 100,
    a = Math.floor(r / 4),
    o = r % 4,
    i = Math.floor((r + 8) / 25),
    s = Math.floor((r - i + 1) / 3),
    l = (19 * t + r - a - s + 15) % 30,
    c = Math.floor(n / 4),
    u = n % 4,
    f = (32 + 2 * o + 2 * c - l - u) % 7,
    p = Math.floor((t + 11 * l + 22 * f) / 451),
    h = Math.floor((l + f - 7 * p + 114) / 31),
    g = ((l + f - 7 * p + 114) % 31) + 1;
  return Date.UTC(e, h - 1, g);
}

function feriadosDoAno(e) {
  let t = new Set();
  for (let [n, a] of [
    [1, 1],
    [4, 21],
    [5, 1],
    [9, 7],
    [10, 12],
    [11, 2],
    [11, 15],
    [12, 25],
    [12, 31],
  ])
    t.add(isoDia(Date.UTC(e, n - 1, a)));
  e >= 2024 && t.add(isoDia(Date.UTC(e, 10, 20)));
  let r = pascoa(e);
  for (let n of [-48, -47, -2, 60]) t.add(isoDia(r + n * DIA_MS));
  return t;
}

function ultimoDiaUtil(e, t) {
  let r = feriadosDoAno(e),
    n = Date.UTC(e, t + 1, 0);
  for (let a = 0; a < 20; a++, n -= DIA_MS) {
    let o = new Date(n).getUTCDay();
    if (o !== 0 && o !== 6 && !r.has(isoDia(n))) return n;
  }
  return n;
}

export const proximoMes = (e) =>
    e % 100 === 12 ? (Math.floor(e / 100) + 1) * 100 + 1 : e + 1,
  inicioDoMes = (e) => Date.UTC(Math.floor(e / 100), (e % 100) - 1, 1),
  fimDoMes = (e) => Date.UTC(Math.floor(e / 100), e % 100, 0);

function vencimentoDarf(e) {
  let t = proximoMes(e);
  return ultimoDiaUtil(Math.floor(t / 100), (t % 100) - 1);
}

const mesDoTs = (e) => {
  let t = new Date(e);
  return t.getUTCFullYear() * 100 + (t.getUTCMonth() + 1);
};

export function proximoDiaUtil(e) {
  let t = e + DIA_MS;
  for (let r = 0; r < 15; r++, t += DIA_MS) {
    let n = new Date(t).getUTCDay();
    if (!(n === 0 || n === 6) && !FERIADOS_B3.has(isoDia(t))) return t;
  }
  return null;
}

export function operacoesDoGrupo(e, t, r, n = () => LOTE_PADRAO) {
  let a = new Map(),
    o = (l, c) => {
      if (!t?.byTicker || c == null) return null;
      let u = a.get(l);
      return (
        u ||
          ((u = new Map((t.byTicker.get(l) || []).map((f) => [f.ts, f]))),
          a.set(l, u)),
        u.get(c) || null
      );
    },
    i = new Set((t?.eventos || []).map((l) => `${l.ativo}|${l.ts}`)),
    s = [];
  for (let l of e || []) {
    if (!l || !l.ticker || l.dataEnvio == null) continue;
    let c = n(l.ticker),
      u = c > 0 ? c : LOTE_PADRAO,
      f = o(l.ticker, l.dataEnvio),
      p = f && f.fech > 0 ? f.fech : l.precoEntrada > 0 ? l.precoEntrada : null,
      h =
        f && f.fech > 0
          ? "cotahist"
          : p != null
            ? l.origemPreco === "cotahist"
              ? "cotahist"
              : "provisorio"
            : null,
      m =
        l.qtd != null && Number.isFinite(l.qtd)
          ? Math.max(0, Math.round(l.qtd))
          : p > 0
            ? lotesPara(l.valorInvestido, p, u) * u
            : 0,
      x = t?.dates ? proximaData(t.dates, l.dataEnvio) : null,
      y = x ?? proximoDiaUtil(l.dataEnvio),
      b = x != null ? o(l.ticker, x) : null,
      S = b && b.abertura > 0 ? b.abertura : null,
      T = S ?? (l.abertura > 0 ? l.abertura : null),
      A =
        S != null
          ? "cotahist"
          : T != null
            ? l.origemAbertura === "cotahist"
              ? "cotahist"
              : l.origemAbertura || "manual"
            : null,
      w = "fechada";
    m > 0
      ? p > 0
        ? T > 0 || (w = "aberta")
        : (w = "sem_preco")
      : (w = "sem_qtd");
    let _ = p > 0 && m > 0 ? centavos(m * p) : null,
      E = _ != null ? centavos((_ * (r || 0)) / 100) : null,
      P = E != null ? centavos(E / 2) : null,
      O = E != null ? centavos(E - P) : null,
      R = w === "fechada" ? centavos(m * T) : null,
      M = w === "fechada" ? centavos(R - _ - E) : null;
    s.push({
      id: l.id,
      ativo: l.ticker,
      estrategia: l.estrategiaNome || l.estrategiaId || "",
      tsCompra: l.dataEnvio,
      tsVenda: y,
      vendaConfirmada: x != null,
      qtd: m,
      lote: u,
      pxCompra: p,
      pxVenda: T,
      fonteCompra: h,
      fonteVenda: A,
      valorCompra: _,
      valorVenda: R,
      custo: E,
      custoCompra: P,
      custoVenda: O,
      resultado: M,
      status: w,
      provisorio: w === "fechada" && (h !== "cotahist" || A !== "cotahist"),
      eventoSoc: y != null && i.has(`${l.ticker}|${y}`),
    });
  }
  return (
    s.sort(
      (l, c) =>
        (l.tsVenda ?? 1 / 0) - (c.tsVenda ?? 1 / 0) ||
        l.tsCompra - c.tsCompra ||
        l.ativo.localeCompare(c.ativo),
    ),
    s
  );
}

function apurarIR(
  e,
  {
    tipoDe: t = (o) => tipoFiscal(o).tipo,
    ajusteDoMes: r = () => null,
    inicial: n = null,
    ateYm: a = null,
  } = {},
) {
  let o = [];
  for (let x of e || [])
    (x.status !== "fechada" && x.status !== "aberta") ||
      (o.push({
        ts: x.tsCompra,
        ativo: x.ativo,
        lado: "C",
        qtd: x.qtd,
        valor: x.valorCompra,
        custo: x.custoCompra,
        op: x,
      }),
      x.status === "fechada" &&
        o.push({
          ts: x.tsVenda,
          ativo: x.ativo,
          lado: "V",
          qtd: x.qtd,
          valor: x.valorVenda,
          custo: x.custoVenda,
          op: x,
        }));
  let i = new Map();
  for (let x of o) {
    let y = mesDoTs(x.ts);
    (i.has(y) || i.set(y, []), i.get(y).push(x));
  }
  let s = new Map();
  for (let [x, y] of i) {
    let b = r(x);
    if (!b || !Number.isFinite(b.custos) || b.custos < 0) continue;
    s.set(x, b.custos);
    let S = y.reduce((A, w) => A + (w.custo || 0), 0),
      T = y.reduce((A, w) => A + (w.valor || 0), 0);
    for (let A of y) {
      let w = S > 0 ? (A.custo || 0) / S : T > 0 ? (A.valor || 0) / T : 0;
      A.custo = b.custos * w;
    }
  }
  let l = new Map();
  for (let x of o)
    (l.has(x.ativo) || l.set(x.ativo, []), l.get(x.ativo).push(x));
  let c = [],
    u = new Map();
  for (let [x, y] of l) {
    let b = t(x),
      S = new Map();
    for (let _ of y) (S.has(_.ts) || S.set(_.ts, []), S.get(_.ts).push(_));
    let T = 0,
      A = 0,
      w = [];
    for (let _ of Array.from(S.keys()).sort((E, P) => E - P)) {
      let E = S.get(_),
        P = E.filter((j) => j.lado === "V"),
        O = E.filter((j) => j.lado === "C"),
        R = P.reduce((j, I) => j + I.qtd, 0),
        M = P.reduce((j, I) => j + I.valor, 0),
        H = P.reduce((j, I) => j + I.custo, 0),
        Y = O.reduce((j, I) => j + I.qtd, 0),
        G = O.reduce((j, I) => j + I.valor, 0),
        k = O.reduce((j, I) => j + I.custo, 0),
        F = Math.min(R, Y);
      if (F > 0) {
        let j = F / R,
          I = F / Y,
          C = centavos(M * j),
          L = centavos(H * j),
          B = centavos(G * I + k * I);
        c.push({
          ts: _,
          ativo: x,
          tipo: b,
          modalidade: b === "fii" ? "fii" : "dt",
          dt: true,
          qtd: F,
          valorVenda: C,
          custoVenda: L,
          custoAquisicao: B,
          resultado: centavos(C - L - B),
          ops: [...P.map((W) => W.op.id), ...O.map((W) => W.op.id)],
        });
      }
      let q = R - F;
      if (q > 0) {
        let j = q / R,
          I = centavos(M * j),
          C = centavos(H * j),
          L = Math.min(q, T),
          B = T > 0 ? A / T : 0,
          W = centavos(B * L);
        ((T -= L),
          (A -= B * L),
          c.push({
            ts: _,
            ativo: x,
            tipo: b,
            modalidade: b === "fii" ? "fii" : "comum",
            dt: false,
            qtd: q,
            valorVenda: I,
            custoVenda: C,
            custoAquisicao: W,
            custoMedio: B,
            resultado: centavos(I - C - W),
            semPosicao: L < q,
            ops: P.map((J) => J.op.id),
          }));
      }
      let N = Y - F;
      if (N > 0) {
        let j = N / Y;
        ((T += N), (A += (G + k) * j));
      }
      (T <= 0 && ((T = 0), (A = 0)),
        w.push({
          ts: _,
          qtd: T,
          custo: A,
        }));
    }
    u.set(x, w);
  }
  c.sort(
    (x, y) => x.ts - y.ts || x.ativo.localeCompare(y.ativo) || (x.dt ? -1 : 1),
  );
  let f = (x) => {
      let y = [];
      for (let [b, S] of u) {
        let T = null;
        for (let A of S)
          if (A.ts <= x) T = A;
          else break;
        T &&
          T.qtd > 0 &&
          y.push({
            ativo: b,
            tipo: t(b),
            qtd: T.qtd,
            custo: centavos(T.custo),
          });
      }
      return y.sort((b, S) => b.ativo.localeCompare(S.ativo));
    },
    p = new Map(),
    h = (x) => (
      p.has(x) ||
        p.set(x, {
          vendasAcoes: 0,
          vendasComuns: 0,
          vendasTotal: 0,
          resAcoes: 0,
          resOutros: 0,
          resDT: 0,
          resFII: 0,
          dtPorDia: new Map(),
          nEventos: 0,
        }),
      p.get(x)
    );
  for (let x of c) {
    let y = h(mesDoTs(x.ts));
    (y.nEventos++,
      (y.vendasTotal += x.valorVenda),
      x.dt
        ? y.dtPorDia.set(x.ts, (y.dtPorDia.get(x.ts) ?? 0) + x.resultado)
        : (y.vendasComuns += x.valorVenda),
      x.modalidade === "comum"
        ? x.tipo === "acao"
          ? ((y.vendasAcoes += x.valorVenda), (y.resAcoes += x.resultado))
          : (y.resOutros += x.resultado)
        : x.modalidade === "dt"
          ? (y.resDT += x.resultado)
          : (y.resFII += x.resultado));
  }
  for (let x of i.keys()) h(x);
  let g = Array.from(p.keys()).sort((x, y) => x - y),
    m = [];
  if (g.length) {
    let x = Math.max(g[g.length - 1], a ?? 0),
      y = Math.max(0, +n?.prejComum || 0),
      b = Math.max(0, +n?.prejDt || 0),
      S = Math.max(0, +n?.prejFii || 0),
      T = 0,
      A = 0,
      w = null;
    for (let _ = g[0]; _ <= x; _ = proximoMes(_)) {
      let E = p.get(_) || null,
        P = Math.floor(_ / 100),
        O = null;
      (w != null &&
        P !== w &&
        T > 0 &&
        ((O = {
          ano: w,
          valor: T,
        }),
        (T = 0)),
        (w = P));
      let R = centavos(E?.vendasAcoes || 0),
        M = centavos(E?.vendasComuns || 0),
        H = centavos(E?.resAcoes || 0),
        Y = centavos(E?.resOutros || 0),
        G = centavos(E?.resDT || 0),
        k = centavos(E?.resFII || 0),
        F = R <= REGRAS_IR.isencaoVendasAcoes,
        q = F && H > 0 ? H : 0,
        N = centavos((q > 0 ? 0 : H) + Y),
        j = (Qe, Ot) => {
          if (Qe > 0) {
            let Yt = Math.min(Ot, Qe);
            return {
              base: centavos(Qe - Yt),
              comp: centavos(Yt),
              prej: centavos(Ot - Yt),
            };
          }
          return {
            base: 0,
            comp: 0,
            prej: centavos(Ot - Qe),
          };
        },
        I = y,
        C = b,
        L = S,
        B = j(N, y);
      y = B.prej;
      let W = j(G, b);
      b = W.prej;
      let J = j(k, S);
      S = J.prej;
      let ie = centavos(B.base * REGRAS_IR.aliqComum),
        ce = centavos(W.base * REGRAS_IR.aliqDT),
        X = centavos(J.base * REGRAS_IR.aliqFII),
        se = centavos(ie + ce + X),
        ge = M * REGRAS_IR.irrfComum,
        z = ge > REGRAS_IR.irrfDispensa ? centavos(ge) : 0,
        Me = 0;
      if (E)
        for (let Qe of E.dtPorDia.values())
          Qe > 0 && (Me += Qe * REGRAS_IR.irrfDT);
      Me = centavos(Me);
      let te = r(_),
        Ae =
          te && Number.isFinite(te.irrf) && te.irrf >= 0
            ? centavos(te.irrf)
            : null,
        fe = Ae ?? centavos(z + Me),
        xe = T,
        Ge = centavos(fe + T),
        yt = centavos(Math.min(Ge, se));
      T = centavos(Ge - yt);
      let It = centavos(se - yt),
        Lt = A,
        pt = centavos(It + A),
        kt = null;
      (pt >= REGRAS_IR.darfMinimo
        ? ((kt = {
            codigo: REGRAS_IR.darfCodigo,
            periodo: fimDoMes(_),
            vencimento: vencimentoDarf(_),
            valor: pt,
          }),
          (A = 0))
        : (A = pt),
        m.push({
          ym: _,
          vazio: !E || E.nEventos === 0,
          vendasAcoes: R,
          vendasComuns: M,
          vendasTotal: centavos(E?.vendasTotal || 0),
          isento: F,
          ganhoIsento: q,
          resAcoes: H,
          resOutros: Y,
          resComum: N,
          resDT: G,
          resFII: k,
          prejComumAnt: I,
          compComum: B.comp,
          baseComum: B.base,
          irComum: ie,
          prejComumFim: y,
          prejDTAnt: C,
          compDT: W.comp,
          baseDT: W.base,
          irDT: ce,
          prejDTFim: b,
          prejFIIAnt: L,
          compFII: J.comp,
          baseFII: J.base,
          irFII: X,
          prejFIIFim: S,
          irDevido: se,
          irrfComumEst: z,
          irrfDTEst: Me,
          irrfInformado: Ae,
          irrfMes: fe,
          irrfSaldoAnt: xe,
          irrfUsado: yt,
          irrfSaldoFim: T,
          irrfSobraAno: O,
          aPagarMes: It,
          acumAnt: Lt,
          valorDarf: pt,
          darf: kt,
          acumFim: A,
          custosInformados: s.get(_) ?? null,
          custosEstimados: centavos(
            (i.get(_) || []).reduce(
              (Qe, Ot) =>
                Qe +
                (Ot.op[Ot.lado === "C" ? "custoCompra" : "custoVenda"] || 0),
              0,
            ),
          ),
        }));
    }
  }
  return {
    eventos: c,
    meses: m,
    posicaoEm: f,
  };
}

export function relatorioIR({
  ops: e,
  grupo: t,
  ds: r,
  feePct: n,
  tipoDe: a,
  ajusteDoMes: o,
  inicial: i,
  de: s,
  ate: l,
  nOrganizar: c = 0,
  tiposInformados: u = {},
  agora: f = Date.now(),
}) {
  let p = a || ((k) => tipoFiscal(k).tipo),
    h = apurarIR(e, {
      tipoDe: p,
      ajusteDoMes: o || (() => null),
      inicial: i,
      ateYm: mesDoTs(l),
    }),
    g = (k) => k != null && k >= s && k <= l,
    m = e.filter((k) => k.status === "fechada" && g(k.tsVenda)),
    x = e.filter(
      (k) =>
        g(k.tsCompra) &&
        (k.status === "aberta" || (k.status === "fechada" && k.tsVenda > l)),
    ),
    y = e.filter(
      (k) =>
        (k.status === "sem_qtd" || k.status === "sem_preco") && g(k.tsCompra),
    ),
    b = h.eventos.filter((k) => g(k.ts)),
    S = new Set(h.eventos.filter((k) => k.dt).map((k) => `${k.ativo}|${k.ts}`)),
    T = [];
  for (let k = mesDoTs(s); k <= mesDoTs(l); k = proximoMes(k)) T.push(k);
  let A = new Map(h.meses.map((k) => [k.ym, k])),
    w = T.map(
      (k) =>
        A.get(k) || {
          ym: k,
          vazio: true,
          semHistorico: true,
        },
    ),
    _ = Array.from(new Set([...m, ...x].map((k) => k.ativo))).sort(),
    E = r?.dates?.length ? r.dates[r.dates.length - 1] : null,
    P = [];
  t?.tipo !== "reais" &&
    P.push({
      nivel: "info",
      txt: "Grupo de simulação: os números servem para conferência. O DARF é das operações que você fez de verdade (grupo Entradas reais).",
    });
  let O = m.filter((k) => k.provisorio).length;
  O &&
    P.push({
      nivel: "alerta",
      txt: `${O} ${O === 1 ? "operação está" : "operações estão"} com preço ainda não oficial (o COTAHIST do dia não chegou). O relatório se corrige sozinho quando a base for atualizada — emita o DARF depois disso.`,
    });
  let R = m.filter((k) => k.eventoSoc).length;
  R &&
    P.push({
      nivel: "alerta",
      txt: `${R} ${R === 1 ? "noite teve" : "noites tiveram"} salto de preço típico de evento societário (grupamento, desdobramento, provento). Confira quantidade e preço na nota de corretagem antes de usar o número.`,
    });
  let M = b.filter((k) => k.dt).length;
  (M &&
    P.push({
      nivel: "alerta",
      txt: `Day trade: ${M} ${M === 1 ? "caso" : "casos"} de papel vendido na abertura e comprado de novo no leilão do mesmo dia. A Receita trata isso como day trade (20%, prejuízo separado), mesmo sendo duas noites de overnight.`,
    }),
    b.some((k) => k.tipo === "fii") &&
      P.push({
        nivel: "info",
        txt: "Há FII no período: 20%, sem a isenção dos R$ 20 mil, e prejuízo de FII só compensa ganho de FII.",
      }));
  let H = _.filter((k) => !(k in (u || {})) && tipoFiscal(k).presumido);
  (H.length &&
    P.push({
      nivel: "alerta",
      txt: `Tipo presumido para ${H.join(", ")} — confirme em “ajustes para o DARF” (unit de empresa tributa como ação; cota de fundo, como FII).`,
      presumidos: H,
    }),
    y.length &&
      P.push({
        nivel: "alerta",
        txt: `${y.length} ${y.length === 1 ? "compra ficou" : "compras ficaram"} de fora por falta de quantidade ou preço — acerte no grupo, na aba RESULTADOS.`,
      }),
    c > 0 &&
      P.push({
        nivel: "info",
        txt: `${c} ${c === 1 ? "compra está" : "compras estão"} em “A organizar”, sem grupo — não ${c === 1 ? "entra" : "entram"} em relatório nenhum.`,
      }));
  let Y = w.find(
    (k) => E != null && fimDoMes(k.ym) > E && inicioDoMes(k.ym) <= E,
  );
  return (
    Y &&
      P.push({
        nivel: "info",
        txt: `${nomeMes(Y.ym)} ainda não fechou na base (último pregão: ${fmtData(E)}). O DARF desse mês só é definitivo depois do último pregão do mês.`,
      }),
    (s === inicioDoMes(mesDoTs(s)) && l === fimDoMes(mesDoTs(l))) ||
      P.push({
        nivel: "info",
        txt: "A lista mostra só as vendas entre De e Até; o quadro de cada mês é sempre o do mês inteiro, porque o DARF é mensal.",
      }),
    w.filter((k) => !k.vazio && k.custosInformados == null).length &&
      P.push({
        nivel: "info",
        txt: `Custos estimados pela taxa do app (${numBR(n || 0, 3)}% por operação, compra + venda). Para o DARF, vale o total das notas de corretagem — informe em “ajustes para o DARF”.`,
      }),
    {
      grupo: t,
      de: s,
      ate: l,
      meses: w,
      opsPeriodo: m,
      vendeDepois: x,
      semDado: y,
      eventosPeriodo: b,
      dtNoDia: S,
      tickers: _,
      avisos: P,
      posicaoFim: h.posicaoEm(l),
      posicaoEm: h.posicaoEm,
      feePct: n,
      tipoDe: p,
      ultimaBase: E,
      geradoEm: f,
    }
  );
}

export const nomeMes = (e) =>
    `${MESES_LONGOS[(e % 100) - 1]}/${Math.floor(e / 100)}`,
  nomeMesCurto = (e) => `${MESES_CURTOS[(e % 100) - 1]}/${Math.floor(e / 100)}`;

export function explicarMes(e) {
  if (e.vazio) return "sem vendas no mês";
  if (e.valorDarf > 0 && e.valorDarf < REGRAS_IR.darfMinimo)
    return `R$ ${fmtNum(e.valorDarf, 2)} a pagar, abaixo do mínimo de R$ 10 — soma ao DARF do mês seguinte`;
  if (e.irDevido > 0 && e.aPagarMes === 0)
    return "o IRRF retido cobriu o imposto do mês";
  if (e.ganhoIsento > 0 && e.irDevido === 0)
    return "ganho isento: vendas de ações no mês até R$ 20 mil";
  let t = (e.prejComumFim || 0) + (e.prejDTFim || 0) + (e.prejFIIFim || 0);
  return e.resComum <= 0 && e.resDT <= 0 && e.resFII <= 0
    ? t > 0
      ? `resultado negativo — R$ ${fmtNum(t, 2)} de prejuízo fica para compensar`
      : "resultado zero"
    : e.irDevido === 0 && t >= 0
      ? "o ganho foi todo compensado com prejuízo de meses anteriores"
      : "nada a pagar";
}

const tsParaSerialExcel = (e) => e / DIA_MS + 25569;

function formatarCelulas(e, t, r, n) {
  for (let [a, o] of Object.entries(t))
    for (let i = r; i <= n; i++) {
      let s = XLSX.utils.encode_cell({
        r: i,
        c: +a,
      });
      e[s] && typeof e[s].v == "number" && (e[s].z = o);
    }
}

const FMT_REAIS = "#,##0.00",
  FMT_DATA = "dd/mm/yyyy",
  FMT_REAIS2 = "#,##0.00";

export function planilhaIR(e) {
  let t = XLSX.utils.book_new(),
    r = e.grupo?.nome ?? "—",
    n = `${fmtData(e.de)} a ${fmtData(e.ate)}`,
    a = new Date(e.geradoEm).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }),
    o = e.meses.filter((O) => !O.semHistorico),
    i = [
      ["Leilão Overnight — relatório de operações para IR (DARF)"],
      ["Grupo", r],
      ["Operações vendidas entre", n],
      ["Gerado em", a],
      [
        "Preços",
        "COTAHIST da B3: compra = fechamento do pregão da compra; venda = abertura do pregão seguinte",
      ],
      [
        "Custos",
        `taxa do app (${numBR(e.feePct || 0, 3)}% por operação, compra + venda) — ou o total das notas, quando informado`,
      ],
      [],
      ["DARF — código 6015 (IRPF — ganhos líquidos em operações em bolsa)"],
      ["Mês", "Período de apuração", "Vencimento", "Valor (R$)", "Situação"],
    ],
    s = i.length;
  for (let O of o)
    O.darf
      ? i.push([
          nomeMes(O.ym),
          tsParaSerialExcel(O.darf.periodo),
          tsParaSerialExcel(O.darf.vencimento),
          O.darf.valor,
          "emitir DARF",
        ])
      : i.push([
          nomeMes(O.ym),
          tsParaSerialExcel(fimDoMes(O.ym)),
          "",
          "",
          explicarMes(O),
        ]);
  let l = i.length - 1;
  (i.push([]),
    i.push(["Apuração do mês (R$)", ...o.map((O) => nomeMesCurto(O.ym))]));
  let c = i.length,
    u = (O, R) => i.push([O, ...o.map((M) => R(M) ?? 0)]);
  (u("Vendas de ações — operações comuns", (O) => O.vendasAcoes),
    i.push([
      "Isenção de R$ 20 mil (ações)",
      ...o.map((O) =>
        O.vazio
          ? "—"
          : O.isento
            ? O.ganhoIsento > 0
              ? "sim — ganho isento"
              : "vendas até R$ 20 mil"
            : "não — vendas acima de R$ 20 mil",
      ),
    ]),
    u("Resultado — ações (comum)", (O) => O.resAcoes),
    u("Resultado — ETF/BDR (comum)", (O) => O.resOutros),
    u("Ganho isento (vai para Rendimentos Isentos)", (O) => O.ganhoIsento),
    u("Resultado tributável — operações comuns", (O) => O.resComum),
    u("Prejuízo comum de meses anteriores", (O) => O.prejComumAnt),
    u("Prejuízo comum compensado no mês", (O) => O.compComum),
    u("Base de cálculo — comum", (O) => O.baseComum),
    u("IR operações comuns (15%)", (O) => O.irComum),
    u("Resultado — day trade", (O) => O.resDT),
    u("Prejuízo de day trade anterior", (O) => O.prejDTAnt),
    u("Base de cálculo — day trade", (O) => O.baseDT),
    u("IR day trade (20%)", (O) => O.irDT),
    u("Resultado — FII", (O) => O.resFII),
    u("Prejuízo de FII anterior", (O) => O.prejFIIAnt),
    u("Base de cálculo — FII", (O) => O.baseFII),
    u("IR FII (20%)", (O) => O.irFII),
    u("IR devido no mês", (O) => O.irDevido),
    u("IRRF do mês", (O) => O.irrfMes),
    i.push([
      "Origem do IRRF",
      ...o.map((O) =>
        O.vazio
          ? "—"
          : O.irrfInformado != null
            ? "notas (informado)"
            : "estimado pelo app",
      ),
    ]),
    u("Saldo de IRRF de meses anteriores", (O) => O.irrfSaldoAnt),
    u("IRRF abatido", (O) => O.irrfUsado),
    u("Imposto a pagar do mês", (O) => O.aPagarMes),
    u("Valores abaixo de R$ 10 vindos de meses anteriores", (O) => O.acumAnt),
    u("Valor do DARF", (O) => (O.darf ? O.darf.valor : 0)),
    u("Fica para o mês seguinte (abaixo de R$ 10)", (O) => O.acumFim),
    u("Saldo de IRRF para os meses seguintes", (O) => O.irrfSaldoFim),
    u("Prejuízo a compensar no fim do mês — comum", (O) => O.prejComumFim),
    u("Prejuízo a compensar no fim do mês — day trade", (O) => O.prejDTFim),
    u("Prejuízo a compensar no fim do mês — FII", (O) => O.prejFIIFim),
    i.push([
      "Custos usados",
      ...o.map((O) =>
        O.vazio
          ? "—"
          : O.custosInformados != null
            ? `notas: R$ ${fmtNum(O.custosInformados, 2)}`
            : `estimados: R$ ${fmtNum(O.custosEstimados, 2)}`,
      ),
    ]));
  let f = i.length - 1,
    p = XLSX.utils.aoa_to_sheet(i);
  ((p["!cols"] = [
    {
      wch: 50,
    },
    ...o.map(() => ({
      wch: 20,
    })),
  ]),
    formatarCelulas(
      p,
      {
        1: FMT_DATA,
        2: FMT_DATA,
        3: FMT_REAIS,
      },
      s,
      l,
    ));
  let h = {};
  for (let O = 1; O <= o.length; O++) h[O] = FMT_REAIS;
  (formatarCelulas(p, h, c, f), XLSX.utils.book_append_sheet(t, p, "RESUMO"));
  let m = [
    [
      "Compra (pregão)",
      "Venda (pregão)",
      "Ativo",
      "Tipo",
      "Estratégia",
      "Quantidade",
      "Preço compra (fech.)",
      "Valor compra",
      "Preço venda (abert.)",
      "Valor venda",
      "Custos",
      "Resultado líquido",
      "Mês do IR",
      "Modalidade",
      "Fonte dos preços",
      "Observação",
    ],
  ];
  for (let O of e.opsPeriodo) {
    let R = [];
    (e.dtNoDia.has(`${O.ativo}|${O.tsVenda}`) &&
      R.push("venda casada com compra do mesmo dia (day trade)"),
      e.dtNoDia.has(`${O.ativo}|${O.tsCompra}`) &&
        R.push("compra casada com venda do mesmo dia (day trade)"),
      O.eventoSoc && R.push("possível evento societário — conferir nota"),
      m.push([
        tsParaSerialExcel(O.tsCompra),
        tsParaSerialExcel(O.tsVenda),
        O.ativo,
        TIPOS_FISCAIS[e.tipoDe(O.ativo)] || "—",
        O.estrategia,
        O.qtd,
        O.pxCompra,
        O.valorCompra,
        O.pxVenda,
        O.valorVenda,
        O.custo,
        O.resultado,
        nomeMesCurto(mesDoTs(O.tsVenda)),
        R.some((M) => M.includes("day trade"))
          ? "comum + day trade"
          : e.tipoDe(O.ativo) === "fii"
            ? "FII"
            : "comum",
        O.provisorio ? "provisório (sem COTAHIST)" : "COTAHIST",
        R.join("; "),
      ]));
  }
  let x = e.opsPeriodo.length;
  if (
    (m.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      e.opsPeriodo.reduce((O, R) => O + R.qtd, 0),
      "",
      centavos(e.opsPeriodo.reduce((O, R) => O + R.valorCompra, 0)),
      "",
      centavos(e.opsPeriodo.reduce((O, R) => O + R.valorVenda, 0)),
      centavos(e.opsPeriodo.reduce((O, R) => O + R.custo, 0)),
      centavos(e.opsPeriodo.reduce((O, R) => O + R.resultado, 0)),
      "",
      "",
      "",
      "",
    ]),
    e.vendeDepois.length)
  ) {
    (m.push([]),
      m.push(["Comprado no período e vendido depois — entra no mês da venda"]),
      m.push([
        "Compra (pregão)",
        "Venda (pregão)",
        "Ativo",
        "Tipo",
        "Estratégia",
        "Quantidade",
        "Preço compra (fech.)",
        "Valor compra",
        "Situação",
      ]));
    for (let O of e.vendeDepois)
      m.push([
        tsParaSerialExcel(O.tsCompra),
        O.tsVenda != null ? tsParaSerialExcel(O.tsVenda) : "",
        O.ativo,
        TIPOS_FISCAIS[e.tipoDe(O.ativo)] || "—",
        O.estrategia,
        O.qtd,
        O.pxCompra,
        O.valorCompra,
        O.status === "aberta"
          ? "venda ainda sem preço"
          : "vendida depois do período",
      ]);
  }
  let y = XLSX.utils.aoa_to_sheet(m);
  ((y["!cols"] = [
    11, 11, 9, 10, 22, 10, 12, 14, 12, 14, 10, 14, 10, 17, 22, 40,
  ].map((O) => ({
    wch: O,
  }))),
    formatarCelulas(
      y,
      {
        0: FMT_DATA,
        1: FMT_DATA,
        6: FMT_REAIS2,
        7: FMT_REAIS,
        8: FMT_REAIS2,
        9: FMT_REAIS,
        10: FMT_REAIS,
        11: FMT_REAIS,
      },
      1,
      x + 1,
    ),
    e.vendeDepois.length &&
      formatarCelulas(
        y,
        {
          0: FMT_DATA,
          1: FMT_DATA,
          6: FMT_REAIS2,
          7: FMT_REAIS,
        },
        x + 5,
        m.length - 1,
      ),
    XLSX.utils.book_append_sheet(t, y, "OPERAÇÕES"));
  let b = [
    [
      "Pregão",
      "Ativo",
      "Tipo",
      "Modalidade",
      "Quantidade",
      "Valor de venda",
      "Custos da venda",
      "Custo de aquisição (com custos)",
      "Resultado",
      "Mês do IR",
    ],
  ];
  for (let O of e.eventosPeriodo)
    b.push([
      tsParaSerialExcel(O.ts),
      O.ativo,
      TIPOS_FISCAIS[O.tipo] || O.tipo,
      O.dt
        ? O.tipo === "fii"
          ? "FII — day trade"
          : "day trade"
        : O.tipo === "fii"
          ? "FII — comum"
          : "comum",
      O.qtd,
      O.valorVenda,
      O.custoVenda,
      O.custoAquisicao,
      O.resultado,
      nomeMesCurto(mesDoTs(O.ts)),
    ]);
  let S = XLSX.utils.aoa_to_sheet(b);
  ((S["!cols"] = [11, 9, 10, 17, 10, 14, 13, 18, 13, 10].map((O) => ({
    wch: O,
  }))),
    formatarCelulas(
      S,
      {
        0: FMT_DATA,
        5: FMT_REAIS,
        6: FMT_REAIS,
        7: FMT_REAIS,
        8: FMT_REAIS,
      },
      1,
      b.length - 1,
    ),
    XLSX.utils.book_append_sheet(t, S, "APURAÇÃO FISCAL"));
  let T = [
    ["Para a declaração anual (IRPF) — ficha Renda Variável, mês a mês"],
    [
      "Mês",
      "Operações comuns — mercado à vista (resultado)",
      "Day trade — mercado à vista (resultado)",
      "IRRF operações comuns (0,005%)",
      "IRRF day trade (1%)",
      "FII — resultado",
      "Ganho isento (Rendimentos Isentos)",
      "Imposto pago (DARF 6015)",
    ],
  ];
  for (let O of o)
    O.vazio ||
      T.push([
        nomeMes(O.ym),
        O.resComum,
        O.resDT,
        O.irrfInformado != null ? "" : O.irrfComumEst,
        O.irrfInformado != null ? "" : O.irrfDTEst,
        O.resFII,
        O.ganhoIsento,
        O.darf ? O.darf.valor : 0,
      ]);
  let A = T.length - 1,
    w = [];
  for (
    let O = new Date(e.de).getUTCFullYear();
    O <= new Date(e.ate).getUTCFullYear();
    O++
  ) {
    let R = Date.UTC(O, 11, 31);
    R >= e.de && R <= e.ate && w.push(O);
  }
  for (let O of w) {
    let R = e.posicaoEm(Date.UTC(O, 11, 31));
    if (
      (T.push([]),
      T.push([
        `Bens e Direitos em 31/12/${O} — posição comprada no último pregão e vendida no ano seguinte (pelo custo)`,
      ]),
      !R.length)
    )
      T.push(["nenhuma posição aberta em 31/12 neste grupo"]);
    else {
      T.push([
        "Ativo",
        "Tipo",
        "Quantidade",
        "Custo de aquisição (R$)",
        "Grupo/código",
      ]);
      for (let M of R)
        T.push([
          M.ativo,
          TIPOS_FISCAIS[M.tipo] || M.tipo,
          M.qtd,
          M.custo,
          M.tipo === "fii" ? "07 — 03 (FII)" : "03 — 01 (ações)",
        ]);
    }
  }
  (T.push([]),
    T.push([
      "Mês com IRRF informado das notas: use o valor das notas nas colunas de IRRF.",
    ]),
    T.push([
      "Mês com vendas de ações até R$ 20 mil e lucro: o ganho vai em Rendimentos Isentos e Não Tributáveis (código 20), não na ficha de Renda Variável.",
    ]));
  let _ = XLSX.utils.aoa_to_sheet(T);
  ((_["!cols"] = [
    {
      wch: 26,
    },
    ...Array(7).fill({
      wch: 22,
    }),
  ]),
    formatarCelulas(
      _,
      {
        1: FMT_REAIS,
        2: FMT_REAIS,
        3: FMT_REAIS,
        4: FMT_REAIS,
        5: FMT_REAIS,
        6: FMT_REAIS,
        7: FMT_REAIS,
      },
      2,
      A,
    ),
    XLSX.utils.book_append_sheet(t, _, "DECLARAÇÃO ANUAL"));
  let E = [
      ["Como o app chega nos números — e o que conferir"],
      ...PREMISSAS_IR.map((O) => [O]),
    ],
    P = XLSX.utils.aoa_to_sheet(E);
  return (
    (P["!cols"] = [
      {
        wch: 130,
      },
    ]),
    XLSX.utils.book_append_sheet(t, P, "PREMISSAS"),
    t
  );
}

export const PREMISSAS_IR = [
  "1. Cada compra marcada em ★ acompanhar é uma operação: compra no leilão de fechamento do pregão da compra e venda no leilão de abertura do pregão seguinte.",
  "2. Preços oficiais do COTAHIST (B3): fechamento do dia da compra e abertura do dia da venda. Sem o COTAHIST do dia, o relatório usa o preço do item e marca como provisório.",
  "3. A operação conta no mês da VENDA (data do pregão). Comprou no último pregão do mês e vendeu no mês seguinte: entra no mês seguinte.",
  "4. Alíquotas: 15% operação comum, 20% day trade, 20% FII. Isenção só para ganho em ações (units incluídas) em operação comum, com vendas de ações no mês até R$ 20 mil.",
  "5. Day trade é compra e venda do mesmo papel no mesmo pregão, na mesma corretora, em qualquer ordem. O mesmo papel em duas noites seguidas gera day trade no dia do meio.",
  "6. Custos somam ao custo da compra e saem do valor da venda. Sem os custos das notas, o app usa a taxa informada em CONFIGURAÇÕES (compra + venda), metade em cada perna.",
  "7. Prejuízo compensa ganho futuro só na mesma modalidade (comum, day trade, FII) e não prescreve. Prejuízo de antes do app entra em “ajustes para o DARF”.",
  "8. IRRF estimado: 0,005% das vendas comuns do mês (dispensado até R$ 1,00) e 1% do resultado positivo de day trade do dia. Vale o que está nas notas.",
  "9. DARF: código 6015, período de apuração = último dia do mês, vencimento no último dia útil do mês seguinte (31/12 não conta). Abaixo de R$ 10, soma ao mês seguinte.",
  "10. O relatório só enxerga o grupo escolhido. Se houver outras vendas no mesmo CPF (outra corretora, outro grupo, posição de longo prazo no mesmo papel), o DARF é da soma de tudo e o custo médio considera a posição inteira.",
  "11. Operações feitas por um clube de investimento (CNPJ do clube) não geram DARF para o cotista: o IR é retido pelo administrador no resgate das cotas.",
  "12. A nota de corretagem é o documento legal: guarde as notas e o comprovante do DARF por pelo menos 5 anos. Pagamento em atraso: gere o DARF com multa e juros no Sicalc.",
];

export function nomeArquivoIR(e) {
  let t =
      String(e.grupo?.nome || "grupo")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "grupo",
    r = (o) => new Date(o).toISOString().slice(0, 10),
    n = mesDoTs(e.de),
    a =
      mesDoTs(e.ate) === n && e.de === inicioDoMes(n) && e.ate === fimDoMes(n);
  return `ir-overnight_${t}_${a ? r(e.de).slice(0, 7) : `${r(e.de)}_a_${r(e.ate)}`}`;
}
