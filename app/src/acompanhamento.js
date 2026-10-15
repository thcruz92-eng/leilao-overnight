/* Cálculos do acompanhamento (itens enviados com ★ acompanhar). */
import {
  LOTE_PADRAO,
  lotesPara,
  proximaData,
  statsDaCurva,
} from "./estrategias.js";

export function resumoPorEnvio(e, t, r = () => LOTE_PADRAO) {
  let n = new Map();
  for (let a of e || [])
    (n.has(a.dataEnvio) || n.set(a.dataEnvio, []), n.get(a.dataEnvio).push(a));
  return Array.from(n.entries())
    .sort((a, o) => a[0] - o[0])
    .map(([a, o]) => {
      let i = 0,
        s = 0,
        l = 0,
        c = 0,
        u = 0,
        f = 0,
        p = 0,
        h = [];
      for (let g of o) {
        !(g.valorInvestido > 0) && !(g.qtd > 0) && p++;
        let m = resultadoDoItem(g, t, r(g.ticker));
        m &&
          ((l += m.sobra),
          m.resultado != null &&
            ((i += m.compra),
            (s += m.resultado),
            (c += m.custo),
            u++,
            m.resultado > 0 && f++,
            h.push({
              ativo: g.ticker,
              compra: m.compra,
              resultado: m.resultado,
            })));
      }
      return {
        ts: a,
        itens: o,
        compra: i,
        resultado: s,
        sobra: l,
        custo: c,
        comDado: u,
        positivos: f,
        semValor: p,
        porItem: h,
        retorno: i > 0 ? s / i : null,
      };
    });
}

export function curvaDoGrupo(e, t, r = -1 / 0, n = 1 / 0) {
  if (!t || !e) return null;
  let a = [];
  for (let c of e) {
    if (c.retorno == null || c.ts < r || c.ts > n) continue;
    let u = proximaData(t.dates, c.ts);
    u != null &&
      a.push({
        ts: u,
        tsCompra: c.ts,
        ret: c.retorno,
        compra: c.compra,
        itens: c.porItem,
      });
  }
  if (a.length === 0) return null;
  let o = statsDaCurva(a);
  if (!o) return null;
  let i = a[0].tsCompra,
    s = a[a.length - 1].tsCompra,
    l = 0;
  for (let c of t.dates) c >= i && c <= s && l++;
  return (
    (l = Math.max(l, a.length)),
    (o.stats.noitesPossiveis = l),
    (o.stats.semOperar = l - a.length),
    o
  );
}

export function resultadoDoItem(e, t, r) {
  let n = e?.precoEntrada;
  if (!(n > 0)) return null;
  let a = r > 0 ? r : LOTE_PADRAO,
    i =
      e.qtd != null && Number.isFinite(e.qtd)
        ? Math.max(0, e.qtd)
        : lotesPara(e.valorInvestido, n, a) * a,
    s = i / a,
    l = i * n,
    c = l * ((t || 0) / 100),
    u = (e.valorInvestido ?? 0) - l,
    f = e.abertura;
  if (!(f > 0) || !(i > 0))
    return {
      lotes: s,
      acoes: i,
      compra: l,
      custo: c,
      sobra: u,
      resultado: null,
      retorno: null,
    };
  let p = i * (f - n) - c;
  return {
    lotes: s,
    acoes: i,
    compra: l,
    custo: c,
    sobra: u,
    resultado: p,
    retorno: p / l,
  };
}

export function migrarItens(e) {
  return Array.isArray(e)
    ? e.map((t) => {
        if (t.precoEntrada !== undefined) return t;
        let r = t.fechAnt ?? null,
          n = t.qtd ?? null;
        return {
          id: t.id,
          ticker: t.ticker,
          estrategiaId: t.estrategiaId,
          estrategiaNome: t.estrategiaNome,
          dataEnvio: t.dataEnvio,
          grupoId: t.grupoId ?? null,
          precoEntrada: r,
          origemPreco: "provisorio",
          precoProvisorio: r,
          valorInvestido: n > 0 && r > 0 ? +(n * r).toFixed(2) : null,
          abertura: t.aberturaHoje ?? null,
          origemAbertura: t.aberturaHoje != null ? "manual" : null,
        };
      })
    : [];
}
