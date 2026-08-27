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
 *
 * ------------------------------------------------------------
 * POR QUE MUDOU (ago/2026)
 * O endpoint v7/finance/quote passou a exigir cookie + crumb de
 * autenticação; sem isso ele responde 401 e TODOS os tickers caem
 * em "ausentes" de uma vez. Agora a função pega o crumb antes de
 * consultar e, se ainda assim o v7 falhar, cai para o v8/chart,
 * que não exige autenticação (mais lento, 1 requisição por papel,
 * por isso só entra como reserva).
 */

const YAHOO_QUOTE = "https://query1.finance.yahoo.com/v7/finance/quote";
const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_COOKIE = "https://fc.yahoo.com";
const YAHOO_CRUMB = "https://query1.finance.yahoo.com/v1/test/getcrumb";
const LOTE = 40; // tickers por requisição ao Yahoo
const RESERVA_MAX = 60; // teto de papéis no fallback, para não estourar o tempo da função

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const trocos = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
    arr.slice(i * n, i * n + n)
  );

/* Cookie + crumb: par obrigatório desde 2023. O cookie vem no
   header set-cookie de fc.yahoo.com; o crumb é um token curto
   que precisa viajar junto na query string. */
async function obterCredenciais() {
  const r1 = await fetch(YAHOO_COOKIE, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "manual",
  });
  const bruto = r1.headers.get("set-cookie");
  if (!bruto) throw new Error("Yahoo não devolveu cookie de sessão");
  const cookie = bruto.split(",").map((c) => c.split(";")[0].trim()).join("; ");

  const r2 = await fetch(YAHOO_CRUMB, {
    headers: { "User-Agent": UA, Accept: "text/plain", Cookie: cookie },
  });
  if (!r2.ok) throw new Error(`crumb HTTP ${r2.status}`);
  const crumb = (await r2.text()).trim();
  if (!crumb || crumb.includes("<")) throw new Error("crumb inválido");
  return { cookie, crumb };
}

function normalizar(q) {
  const ticker = String(q.symbol || "").replace(/\.SA$/, "");
  return [
    ticker,
    {
      ativo: ticker,
      fechamento: q.regularMarketPrice ?? null,
      abertura: q.regularMarketOpen ?? null,
      maxima: q.regularMarketDayHigh ?? null,
      minima: q.regularMarketDayLow ?? null,
      fechamentoAnterior: q.regularMarketPreviousClose ?? null,
      quantidade: q.regularMarketVolume ?? null,
      volume: estimarFinanceiro(q),
      atualizadoEm: q.regularMarketTime
        ? new Date(q.regularMarketTime * 1000).toISOString()
        : null,
      estadoMercado: q.marketState ?? null,
    },
  ];
}

/* Reserva: v8/chart não pede crumb, mas é um papel por requisição. */
async function viaChart(simbolo) {
  const r = await fetch(`${YAHOO_CHART}/${simbolo}?interval=1d&range=1d`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) return null;
  const json = await r.json();
  const res = json?.chart?.result?.[0];
  const m = res?.meta;
  if (!m || !(m.regularMarketPrice > 0)) return null;
  const q = res.indicators?.quote?.[0] || {};
  const ult = (arr) => {
    if (!Array.isArray(arr)) return null;
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
    return null;
  };
  return normalizar({
    symbol: m.symbol,
    regularMarketPrice: m.regularMarketPrice,
    regularMarketOpen: ult(q.open),
    regularMarketDayHigh: m.regularMarketDayHigh ?? ult(q.high),
    regularMarketDayLow: m.regularMarketDayLow ?? ult(q.low),
    regularMarketPreviousClose: m.chartPreviousClose ?? m.previousClose ?? null,
    regularMarketVolume: m.regularMarketVolume ?? ult(q.volume),
    regularMarketTime: m.regularMarketTime ?? null,
    marketState: null,
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const brutos = (url.searchParams.get("tickers") || "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (!brutos.length) {
    return Response.json({ erro: "Informe ?tickers=PETR4,VALE3" }, { status: 400 });
  }

  // B3 no Yahoo usa sufixo .SA
  const simbolos = brutos.map((t) => (t.endsWith(".SA") ? t : `${t}.SA`));
  const resultados = {};
  const falhas = [];

  let cred = null;
  try {
    cred = await obterCredenciais();
  } catch (e) {
    falhas.push(`autenticação Yahoo falhou (${e.message}) — usando reserva v8/chart`);
  }

  if (cred) {
    for (const lote of trocos(simbolos, LOTE)) {
      try {
        const alvo = `${YAHOO_QUOTE}?symbols=${lote.join(",")}&crumb=${encodeURIComponent(cred.crumb)}`;
        const r = await fetch(alvo, {
          headers: { "User-Agent": UA, Accept: "application/json", Cookie: cred.cookie },
        });
        if (!r.ok) {
          falhas.push(`HTTP ${r.status} no lote ${lote[0]}…`);
          continue;
        }
        const json = await r.json();
        for (const q of json?.quoteResponse?.result || []) {
          const [ticker, dado] = normalizar(q);
          resultados[ticker] = dado;
        }
      } catch (e) {
        falhas.push(`${lote[0]}…: ${e.message}`);
      }
    }
  }

  // Quem não veio pelo caminho principal tenta a reserva, com teto de tempo.
  let pendentes = simbolos.filter((s) => !resultados[s.replace(/\.SA$/, "")]);
  if (pendentes.length) {
    const tentar = pendentes.slice(0, RESERVA_MAX);
    const blocos = trocos(tentar, 10);
    for (const bloco of blocos) {
      const vindos = await Promise.all(
        bloco.map((s) => viaChart(s).catch(() => null))
      );
      for (const v of vindos) {
        if (!v) continue;
        const [ticker, dado] = v;
        resultados[ticker] = dado;
      }
    }
    if (pendentes.length > RESERVA_MAX) {
      falhas.push(
        `reserva limitada a ${RESERVA_MAX} papéis por chamada (${pendentes.length} pendentes)`
      );
    }
  }

  const ausentes = brutos.filter((t) => !resultados[t]);

  return Response.json(
    {
      consultadoEm: new Date().toISOString(),
      fonte: cred ? "Yahoo Finance (v7 autenticado)" : "Yahoo Finance (v8 reserva)",
      total: Object.keys(resultados).length,
      dados: resultados,
      ausentes,
      falhas,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
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
