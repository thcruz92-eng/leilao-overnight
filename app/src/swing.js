/* Swing: "demanda retraída em empresa lucrativa".
   Sinal de compra para segurar dias/semanas, com alvo, stop e prazo.

   Regra (todas no fechamento do mesmo pregão):
   1. divergência altista de IFR(14): nos últimos 10 pregões o preço fez
      fundo abaixo do fundo dos 20 pregões anteriores e o IFR não (fundo
      do IFR pelo menos 3 pontos acima);
   2. volume secando: média de 10 pregões ≤ 0,792 × média de 60 pregões;
   3. preço abaixo da média de 200 pregões;
   4. lucro dos últimos 12 meses positivo (balanço já entregue à CVM até
      o pregão anterior);
   5. liquidez média de 20 pregões ≥ R$ 20 mi e preço ≥ R$ 1.
   Depois de um sinal, o mesmo papel só volta a sinalizar 12 pregões depois.

   Compra no fechamento do sinal. Saída: stop ou alvo (pela abertura, se
   ela já passar do nível; senão pela mínima/máxima do dia, stop primeiro
   se os dois forem tocados no mesmo dia) ou no fechamento do último
   pregão do prazo. Resultado líquido de taxa.

   Estudo (2023-26, regra escolhida em 2023-24 e conferida em 2025-26):
   +2,1% e +4,2% por operação com alvo +12% / stop −10% / 30 pregões,
   contra −0,6% e +2,2% de um papel qualquer com as mesmas saídas. */
import { GITHUB_DONO, GITHUB_REPO, GITHUB_RAMO } from "./dados.js";

export const URLS_FUNDAMENTOS = [
  `https://raw.githubusercontent.com/${GITHUB_DONO}/${GITHUB_REPO}/${GITHUB_RAMO}/public/fundamentos.json`,
  "/fundamentos.json",
  "/public/fundamentos.json",
];

export const SAIDAS_SWING = {
  padrao: { id: "padrao", rotulo: "Padrão", alvo: 0.12, stop: 0.1, prazo: 30 },
  curto: { id: "curto", rotulo: "Curto", alvo: 0.1, stop: 0.1, prazo: 20 },
};

export const REGRA_SWING = {
  liqMin: 20e6,
  precoMin: 1,
  volSeco: 0.792,
  folgaIfr: 3,
  espera: 12,
  taxa: 0.046 / 100,
};

export async function buscarFundamentos() {
  let erro = null;
  for (let url of URLS_FUNDAMENTOS)
    try {
      let r = await fetch(url, { cache: "no-cache" });
      if (r.ok) return await r.json();
      erro = `HTTP ${r.status}`;
    } catch (e) {
      erro = e.message;
    }
  throw new Error(`${erro} ao buscar os fundamentos`);
}

const tsIso = (s) => {
  let [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/* média da janela [fim-n+1, fim] com pelo menos `minimo` valores válidos
   (somas acumuladas: s = soma, k = quantidade de válidos até cada índice) */
function mediaJanela(s, k, fim, n, minimo) {
  let ini = fim - n,
    soma = s[fim + 1] - (ini >= 0 ? s[ini + 1] : 0),
    qtd = k[fim + 1] - (ini >= 0 ? k[ini + 1] : 0);
  return qtd >= minimo ? soma / qtd : NaN;
}
function acumulados(arr) {
  let n = arr.length,
    s = new Float64Array(n + 1),
    k = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    let v = arr[i],
      ok = Number.isFinite(v);
    s[i + 1] = s[i] + (ok ? v : 0);
    k[i + 1] = k[i] + (ok ? 1 : 0);
  }
  return [s, k];
}
/* mínimo da janela [fim-n+1, fim]; NaN se faltar algum valor */
function minJanela(arr, fim, n) {
  if (fim - n + 1 < 0) return NaN;
  let m = Infinity;
  for (let i = fim - n + 1; i <= fim; i++) {
    let v = arr[i];
    if (!Number.isFinite(v)) return NaN;
    if (v < m) m = v;
  }
  return m;
}

/* fundamentos vigentes em cada pregão (só o que foi entregue ANTES do dia) */
function fundamentosPorDia(eventos, campos, dates) {
  let ix = Object.fromEntries(campos.map((c, i) => [c, i])),
    ev = (eventos || [])
      .map((l) => ({ ts: tsIso(l[ix.entrega]), l }))
      .sort((a, b) => a.ts - b.ts),
    out = new Array(dates.length).fill(null),
    p = -1;
  for (let w = 0; w < dates.length; w++) {
    while (p + 1 < ev.length && ev[p + 1].ts < dates[w]) p++;
    if (p >= 0) {
      let l = ev[p].l;
      out[w] = {
        entrega: l[ix.entrega],
        lucro12m: l[ix.lucro12m],
        patrimonio: l[ix.patrimonio],
        acoes: l[ix.acoes],
        lucroTriAA: l[ix.lucroTriAA],
      };
    }
  }
  return out;
}

/* indicadores do swing de um papel, dia a dia */
function indicadoresSwing(I, n) {
  let [sv, kv] = acumulados(I.V),
    [sc, kc] = acumulados(I.C),
    volSeca = new Float64Array(n).fill(NaN),
    mm200 = new Float64Array(n).fill(NaN),
    div = new Uint8Array(n);
  for (let w = 0; w < n; w++) {
    let v10 = mediaJanela(sv, kv, w, 10, 8),
      v60 = mediaJanela(sv, kv, w, 60, 40);
    volSeca[w] = v60 > 0 ? v10 / v60 : NaN;
    let m = mediaJanela(sc, kc, w, 200, 150);
    mm200[w] = m > 0 ? I.C[w] / m - 1 : NaN;
    let cR = minJanela(I.C, w, 10),
      cP = minJanela(I.C, w - 10, 20),
      rR = minJanela(I.rsi14, w, 10),
      rP = minJanela(I.rsi14, w - 10, 20);
    div[w] = cR < cP && rR > rP + REGRA_SWING.folgaIfr ? 1 : 0;
  }
  return { volSeca, mm200, div };
}

/* acompanha a operação aberta no fechamento de `i` até sair */
function simularSaida(I, i, n, saida) {
  let { alvo, stop, prazo } = saida,
    e = I.C[i];
  for (let k = 1; k <= prazo; k++) {
    let d = i + k;
    if (d >= n) break;
    let o = I.A[d],
      h = I.Hi[d],
      l = I.Lo[d],
      c = I.C[d];
    // noite com desdobramento/grupamento: o preço deixa de ser comparável
    if (!Number.isFinite(I.over[d]) && d < n - 1)
      return { status: "evento", saida: d, dias: k, ret: null };
    if (!Number.isFinite(c)) continue;
    if (o > 0 && o / e - 1 <= -stop)
      return { status: "stop", saida: d, dias: k, ret: o / e - 1, preco: o };
    if (o > 0 && o / e - 1 >= alvo)
      return { status: "alvo", saida: d, dias: k, ret: o / e - 1, preco: o };
    if (l > 0 && l / e - 1 <= -stop)
      return { status: "stop", saida: d, dias: k, ret: -stop, preco: e * (1 - stop) };
    if (h > 0 && h / e - 1 >= alvo)
      return { status: "alvo", saida: d, dias: k, ret: alvo, preco: e * (1 + alvo) };
    if (k === prazo)
      return { status: "prazo", saida: d, dias: k, ret: c / e - 1, preco: c };
  }
  // ainda aberta: resultado pelo último fechamento
  let u = n - 1;
  while (u > i && !Number.isFinite(I.C[u])) u--;
  return {
    status: "aberta",
    saida: null,
    dias: n - 1 - i,
    ret: I.C[u] / e - 1,
    preco: I.C[u],
  };
}

/* Calcula sinais, operações e radar sobre os indicadores do app.
   ind: saída de prepararIndicadores; fund: public/fundamentos.json */
export function calcularSwing(ind, fund, saida = SAIDAS_SWING.padrao) {
  let dates = ind.dates,
    n = dates.length,
    campos = fund?.campos || [
      "entrega",
      "lucro12m",
      "receita12m",
      "patrimonio",
      "acoes",
      "lucroTriAA",
    ],
    R = REGRA_SWING,
    operacoes = [],
    radar = [],
    hoje = { elegiveis: 0, lucrativas: 0, volSeco: 0, abaixoMM200: 0, div: 0 },
    semFundamentos = 0;
  for (let { ativo, ind: I } of ind.ativos) {
    let eventos = fund?.tickers?.[ativo];
    if (!eventos) {
      semFundamentos++;
      continue;
    }
    let F = fundamentosPorDia(eventos, campos, dates),
      X = indicadoresSwing(I, n),
      ult = -1e9;
    const nos = (w) => {
      let f = F[w],
        eleg = I.liq20[w] >= R.liqMin && I.C[w] >= R.precoMin,
        lucrativa = f != null && f.lucro12m != null && f.lucro12m > 0,
        c = {
          div: X.div[w] === 1,
          volSeco: X.volSeca[w] <= R.volSeco,
          abaixoMM200: X.mm200[w] < 0,
        };
      return { f, eleg, lucrativa, c };
    };
    for (let w = 0; w < n; w++) {
      let { f, eleg, lucrativa, c } = nos(w);
      if (!(eleg && lucrativa && c.div && c.volSeco && c.abaixoMM200)) continue;
      if (w - ult < R.espera) continue;
      ult = w;
      let e = I.C[w],
        mcap = f.acoes > 0 ? e * f.acoes : NaN;
      operacoes.push({
        ativo,
        w,
        data: dates[w],
        entrada: e,
        alvoPreco: e * (1 + saida.alvo),
        stopPreco: e * (1 - saida.stop),
        pl: mcap > 0 && f.lucro12m > 0 ? mcap / f.lucro12m : null,
        roe: f.patrimonio > 0 ? f.lucro12m / f.patrimonio : null,
        lucroTriAA: f.lucroTriAA,
        ifr: I.rsi14[w],
        volSeca: X.volSeca[w],
        mm200: X.mm200[w],
        ...simularSaida(I, w, n, saida),
      });
    }
    // radar: como o papel está no último pregão
    let u = n - 1,
      { f, eleg, lucrativa, c } = nos(u);
    if (eleg) {
      hoje.elegiveis++;
      if (lucrativa) hoje.lucrativas++;
      if (c.volSeco) hoje.volSeco++;
      if (c.abaixoMM200) hoje.abaixoMM200++;
      if (c.div) hoje.div++;
      let qtd = c.div + c.volSeco + c.abaixoMM200;
      if (lucrativa && qtd === 2)
        radar.push({
          ativo,
          preco: I.C[u],
          ...c,
          ifr: I.rsi14[u],
          volSeca: X.volSeca[u],
          mm200: X.mm200[u],
          lucro12m: f.lucro12m,
        });
    }
  }
  operacoes.sort((a, b) => a.w - b.w || a.ativo.localeCompare(b.ativo));
  radar.sort(
    (a, b) =>
      (a.volSeca || 9) - (b.volSeca || 9) || a.ativo.localeCompare(b.ativo),
  );
  for (let o of operacoes) if (o.ret != null) o.liq = o.ret - R.taxa;
  return {
    operacoes,
    radar,
    hoje,
    ultimoDia: dates[n - 1],
    semFundamentos,
    resumo: resumirSwing(operacoes),
  };
}

/* números do histórico: só operações encerradas */
export function resumirSwing(operacoes) {
  let fechadas = operacoes.filter(
      (o) => o.status === "alvo" || o.status === "stop" || o.status === "prazo",
    ),
    porAno = new Map();
  const bloco = (lista) => {
    let k = lista.length;
    if (!k) return null;
    let soma = 0,
      ganho = 0,
      alvo = 0,
      stop = 0,
      dias = 0;
    for (let o of lista) {
      soma += o.liq;
      if (o.liq > 0) ganho++;
      if (o.status === "alvo") alvo++;
      if (o.status === "stop") stop++;
      dias += o.dias;
    }
    return {
      n: k,
      media: soma / k,
      acerto: ganho / k,
      alvo: alvo / k,
      stop: stop / k,
      prazo: (k - alvo - stop) / k,
      dias: dias / k,
    };
  };
  for (let o of fechadas) {
    let ano = new Date(o.data).getUTCFullYear();
    porAno.set(ano, [...(porAno.get(ano) || []), o]);
  }
  return {
    geral: bloco(fechadas),
    anos: [...porAno.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ano, l]) => ({ ano, ...bloco(l) })),
    fechadas,
  };
}
