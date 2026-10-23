/* Calendário de resultados (balanços trimestrais) e a regra de não entrar
   na véspera: o overnight compra no fechamento e vende na abertura
   seguinte, então um balanço divulgado depois do fechamento de hoje ou
   antes da abertura de amanhã cai inteiro dentro da noite. */
import {
  GITHUB_DONO,
  GITHUB_RAMO,
  GITHUB_REPO,
  proximoDiaUtil,
} from "./dados.js";

export const URLS_RESULTADOS = [
  `https://raw.githubusercontent.com/${GITHUB_DONO}/${GITHUB_REPO}/${GITHUB_RAMO}/public/resultados.json`,
  "/resultados.json",
  "/public/resultados.json",
];

export const QUANDO = {
  antes: "antes da abertura",
  apos: "após o fechamento",
  durante: "durante o pregão",
  "?": "horário não informado",
};

export async function buscarResultados() {
  for (let url of URLS_RESULTADOS)
    try {
      let r = await fetch(url, { cache: "no-cache" });
      if (r.ok) return await r.json();
    } catch {}
  return null;
}

const tsIso = (s) => {
  let [y, m, d] = String(s).split("-").map(Number);
  return y && m && d ? Date.UTC(y, m - 1, d) : null;
};

/* junta o arquivo publicado com as datas que você corrigiu ou incluiu no
   app (essas valem por cima das do arquivo para o mesmo papel e data) */
export function montarCalendario(arquivo, manuais = []) {
  let mapa = new Map();
  for (let e of arquivo?.eventos ?? [])
    e?.ticker && e.data && mapa.set(`${e.ticker}|${e.data}`, { ...e, origem: "arquivo" });
  for (let e of manuais ?? []) {
    if (!e?.ticker) continue;
    // remoção manual: some com a data do arquivo
    if (e.remover) {
      mapa.delete(`${e.ticker}|${e.data}`);
      continue;
    }
    // data manual troca qualquer data do arquivo para o mesmo papel que
    // esteja a menos de 20 dias (é correção, não um segundo balanço)
    let ts = tsIso(e.data);
    for (let [k, x] of mapa)
      x.ticker === e.ticker &&
        x.origem === "arquivo" &&
        Math.abs(tsIso(x.data) - ts) < 20 * 86400000 &&
        mapa.delete(k);
    mapa.set(`${e.ticker}|${e.data}`, { ...e, origem: "manual" });
  }
  let eventos = Array.from(mapa.values())
    .map((e) => ({ ...e, ts: tsIso(e.data) }))
    .filter((e) => e.ts != null)
    .sort((a, b) => a.ts - b.ts || a.ticker.localeCompare(b.ticker));
  let porTicker = new Map();
  for (let e of eventos) porTicker.set(e.ticker, [...(porTicker.get(e.ticker) ?? []), e]);
  return { eventos, porTicker };
}

/* O balanço cai dentro da noite comprada em `compra`?
   - divulga no dia da compra após o fechamento (ou sem horário), ou
   - divulga no pregão seguinte antes da abertura (ou sem horário), ou
   - divulga num dia sem pregão entre os dois (fim de semana, feriado).
   Divulgação durante o pregão não pega a noite. */
export function resultadoNaNoite(cal, ticker, compra) {
  let lista = cal?.porTicker?.get(ticker);
  if (!lista || compra == null) return null;
  let venda = proximoDiaUtil(compra);
  for (let e of lista) {
    if (e.quando === "durante") continue;
    if (e.ts === compra && (e.quando === "apos" || e.quando === "?" || !e.quando)) return e;
    if (venda != null && e.ts === venda && (e.quando === "antes" || e.quando === "?" || !e.quando))
      return e;
    if (venda != null && e.ts > compra && e.ts < venda) return e;
  }
  return null;
}

/* texto curto: "divulga hoje após o fechamento (qui., 23/10)" */
export function textoResultado(e, compra) {
  if (!e) return "";
  let d = new Date(e.ts).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    }),
    dia = e.ts === compra ? "neste pregão" : "no pregão seguinte";
  return `resultado ${dia}, ${QUANDO[e.quando] ?? QUANDO["?"]} (${d})`;
}

/* próximos resultados de uma lista de papéis, a partir de `desde` */
export function proximosResultados(cal, tickers, desde, dias = 10) {
  let ate = desde + dias * 86400000,
    alvo = tickers ? new Set(tickers) : null;
  return (cal?.eventos ?? []).filter(
    (e) => e.ts >= desde && e.ts <= ate && (!alvo || alvo.has(e.ticker)),
  );
}
