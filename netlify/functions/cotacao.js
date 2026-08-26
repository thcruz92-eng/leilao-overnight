/**
 * PONTE DE COTAÇÃO AO VIVO
 * ============================================================
 * O navegador não pode chamar a API do Yahoo diretamente (CORS).
 * Esta função roda no servidor do Netlify (plano gratuito, sob
 * demanda), busca lá e devolve pro app já limpo.
 *
 * Uso a partir do app:
 *   fetch('/.netlify/functions/cotacao?tickers=PETR4,VALE3,ITUB4')
 *
 * Devolve, para cada ticker, o retrato do pregão NO INSTANTE da
 * chamada — mesmo comportamento do Profit às 16:45:
 *   fechamento = último negócio até agora
 *   maxima / minima / volume = acumulado do dia até agora
 */

const YAHOO = "https://query1.finance.yahoo.com/v7/finance/quote";
const LOTE = 40;               // tickers por requisição ao Yahoo

const trocos = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
    arr.slice(i * n, i * n + n)
  );

export default async (req) => {
  const url = new URL(req.url);
  const brutos = (url.searchParams.get("tickers") || "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (!brutos.length) {
    return Response.json(
      { erro: "Informe ?tickers=PETR4,VALE3" },
      { status: 400 }
    );
  }

  // B3 no Yahoo usa sufixo .SA
  const simbolos = brutos.map((t) => (t.endsWith(".SA") ? t : `${t}.SA`));
  const resultados = {};
  const falhas = [];

  for (const lote of trocos(simbolos, LOTE)) {
    try {
      const r = await fetch(`${YAHOO}?symbols=${lote.join(",")}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
      });

      if (!r.ok) {
        falhas.push(`HTTP ${r.status} no lote ${lote[0]}...`);
        continue;
      }

      const json = await r.json();
      for (const q of json?.quoteResponse?.result || []) {
        const ticker = String(q.symbol || "").replace(/\.SA$/, "");
        resultados[ticker] = {
          ativo: ticker,
          // "fechamento" no instante da consulta
          fechamento: q.regularMarketPrice ?? null,
          abertura: q.regularMarketOpen ?? null,
          maxima: q.regularMarketDayHigh ?? null,
          minima: q.regularMarketDayLow ?? null,
          fechamentoAnterior: q.regularMarketPreviousClose ?? null,
          // Yahoo devolve volume em QUANTIDADE de papéis.
          // Volume financeiro aproximado por preço médio do dia,
          // mesma convenção já usada na base.
          quantidade: q.regularMarketVolume ?? null,
          volume: estimarFinanceiro(q),
          atualizadoEm: q.regularMarketTime
            ? new Date(q.regularMarketTime * 1000).toISOString()
            : null,
          estadoMercado: q.marketState ?? null, // REGULAR | POST | CLOSED
        };
      }
    } catch (e) {
      falhas.push(`${lote[0]}...: ${e.message}`);
    }
  }

  const ausentes = brutos.filter((t) => !resultados[t]);

  return Response.json(
    {
      consultadoEm: new Date().toISOString(),
      fonte: "Yahoo Finance (tempo real)",
      total: Object.keys(resultados).length,
      dados: resultados,
      ausentes,
      falhas,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        // 30s de cache: protege contra cliques repetidos sem
        // deixar o dado velho na hora do leilão
        "Cache-Control": "public, max-age=30",
      },
    }
  );
};

function estimarFinanceiro(q) {
  const qtd = q.regularMarketVolume;
  if (!qtd) return null;
  const partes = [
    q.regularMarketDayHigh,
    q.regularMarketDayLow,
    q.regularMarketPrice,
  ].filter((v) => typeof v === "number" && v > 0);
  if (!partes.length) return null;
  const medio = partes.reduce((a, b) => a + b, 0) / partes.length;
  return Math.round(qtd * medio * 100) / 100;
}
