/* Exportações: planilhas, CSV, PNG do mês a mês e leitura de séries de benchmark. */
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { lerDataBR } from "./dados.js";
import { liquidezNoDia } from "./estrategias.js";
import { MESES, fmtData, numBR } from "./tema.js";

export function operacoesDaSerie(e, t, r, n) {
  if (!t || t.erro || !Array.isArray(t.diario)) return null;
  let a = [];
  for (let o of t.diario) {
    let i = e.posNoCalendario?.get(o.tsCompra);
    for (let s = 0; s < o.escolhidos.length; s++) {
      let l = o.escolhidos[s],
        c = e.byTicker.get(l);
      if (!c) continue;
      let u = c.find((p) => p.ts === o.tsCompra),
        f = c.find((p) => p.ts === o.ts);
      u &&
        a.push({
          compraTs: o.tsCompra,
          vendaTs: o.ts,
          ativo: l,
          top: s + 1,
          abertura: u.abertura,
          maxima: u.maxima,
          minima: u.minima,
          fech: u.fech,
          volFin: u.vol,
          liq20: liquidezNoDia(e, l, o.tsCompra),
          aberturaVenda: f?.abertura ?? null,
          resultado: f?.over ?? null,
          gapBruto:
            f?.abertura > 0 && u.fech > 0 ? f.abertura / u.fech - 1 : null,
          varDia: u.varDia ?? null,
          ibs: u.posRange ?? null,
          gapDoDia: u.over ?? null,
          nNoite: o.n,
          retNoite: o.ret,
          iCompra: i,
        });
    }
  }
  return a.length
    ? {
        id: n,
        nome: r,
        linhas: a,
      }
    : null;
}

const COLUNAS_OPERACOES = [
    ["DATA COMPRA", (e) => fmtData(e.compraTs), "txt"],
    ["DATA VENDA", (e) => (e.vendaTs != null ? fmtData(e.vendaTs) : ""), "txt"],
    ["ATIVO", (e) => e.ativo, "txt"],
    ["TOP", (e) => e.top, "int"],
    ["ABERTURA", (e) => e.abertura, "num"],
    ["MÁXIMA", (e) => e.maxima, "num"],
    ["MÍNIMA", (e) => e.minima, "num"],
    ["FECHAMENTO (compra)", (e) => e.fech, "num"],
    ["VOLUME FIN. DO DIA", (e) => e.volFin, "din"],
    ["LIQ. 20 PREGÕES (podada)", (e) => e.liq20, "din"],
    ["ABERTURA DA VENDA", (e) => e.aberturaVenda, "num"],
    ["RESULTADO (líquido)", (e) => e.resultado, "pct"],
    ["GAP BRUTO", (e) => e.gapBruto, "pct"],
    ["VAR. DO DIA", (e) => e.varDia, "pct"],
    ["GAP DA NOITE ANTERIOR", (e) => e.gapDoDia, "pct"],
    ["IBS", (e) => e.ibs, "num4"],
    ["RSI 14", (e) => e.rsi14, "num"],
    ["POS. FAIXA 20", (e) => e.pos20, "num4"],
    ["POS. FAIXA 60", (e) => e.pos60, "num4"],
    ["ACERTO OVER 60", (e) => e.ovWin60, "pct"],
    ["PLACAR", (e) => e.placar, "num4"],
    ["VOTOS", (e) => e.votos, "int"],
    ["CRUZADO", (e) => e.cruzado, "txt"],
    ["PAPÉIS DA NOITE (termômetro)", (e) => e.papeisNoite, "int"],
    ["PAPÉIS NA NOITE", (e) => e.nNoite, "int"],
    ["RESULTADO DA NOITE", (e) => e.retNoite, "pct"],
    ["FORA POR REPETIR (MIX sem repetir)", (e) => e.pulados, "txt"],
  ],
  FORMATOS_EXCEL = {
    pct: "0.00%",
    num: "0.00",
    num4: "0.0000",
    din: "#,##0",
    int: "0",
    txt: null,
  },
  CASAS_EXCEL = {
    pct: 6,
    num: 2,
    num4: 4,
    din: 0,
    int: 0,
  };

function nomeDeAba(e) {
  return (
    String(e)
      .replace(/[\[\]\*\?\/\\:]/g, " ")
      .slice(0, 28)
      .trim() || "ABA"
  );
}

export function planilhaOperacoes(e, t) {
  let r = XLSX.utils.book_new(),
    n = [
      ["Leilão Overnight — operações por estratégia"],
      ["período", t.periodo],
      [
        "piso de liquidez",
        `R$ ${t.minVolMM} MM (média de 20 pregões, 10% de maior volume descartados)`,
      ],
      ["preço mínimo", `R$ ${t.precoMin}`],
      ["Top N", t.topN],
      ["papéis no MIX", t.mixMax],
      ["taxa por operação", `${t.feePct}%`],
      ["janela do motor de janela", `${t.lbDays} pregões`],
      ["gerado em", t.geradoEm],
      [],
      [
        "ESTRATÉGIA",
        "NOITES",
        "OPERAÇÕES",
        "RESULTADO (soma)",
        "MÉDIA/NOITE",
        "ACERTO",
        "PIOR NOITE",
        "MELHOR NOITE",
      ],
    ];
  for (let o of e) {
    let i = new Map();
    for (let c of o.linhas) c.retNoite != null && i.set(c.compraTs, c.retNoite);
    let s = Array.from(i.values()),
      l = s.reduce((c, u) => c + u, 0);
    n.push([
      o.nome,
      s.length,
      o.linhas.length,
      l,
      s.length ? l / s.length : null,
      s.length ? s.filter((c) => c > 0).length / s.length : null,
      s.length ? Math.min(...s) : null,
      s.length ? Math.max(...s) : null,
    ]);
  }
  let a = XLSX.utils.aoa_to_sheet(n);
  a["!cols"] = [
    {
      wch: 26,
    },
    {
      wch: 10,
    },
    {
      wch: 12,
    },
    {
      wch: 17,
    },
    {
      wch: 13,
    },
    {
      wch: 10,
    },
    {
      wch: 12,
    },
    {
      wch: 13,
    },
  ];
  for (let o = 11; o < n.length; o++)
    for (let i of [3, 4, 5, 6, 7]) {
      let s = XLSX.utils.encode_cell({
        r: o,
        c: i,
      });
      a[s] && typeof a[s].v == "number" && (a[s].z = "0.00%");
    }
  XLSX.utils.book_append_sheet(r, a, "RESUMO");
  for (let o of e) {
    let i = [COLUNAS_OPERACOES.map((l) => l[0])];
    for (let l of o.linhas)
      i.push(
        COLUNAS_OPERACOES.map(([, c, u]) => {
          let f = c(l);
          return f == null || (typeof f == "number" && !Number.isFinite(f))
            ? ""
            : typeof f == "number"
              ? +f.toFixed(CASAS_EXCEL[u] ?? 4)
              : f;
        }),
      );
    let s = XLSX.utils.aoa_to_sheet(i);
    s["!cols"] = COLUNAS_OPERACOES.map(([l]) => ({
      wch: Math.max(9, Math.min(26, l.length + 2)),
    }));
    for (let l = 0; l < COLUNAS_OPERACOES.length; l++) {
      let c = FORMATOS_EXCEL[COLUNAS_OPERACOES[l][2]];
      if (c)
        for (let u = 1; u < i.length; u++) {
          let f = XLSX.utils.encode_cell({
            r: u,
            c: l,
          });
          s[f] && typeof s[f].v == "number" && (s[f].z = c);
        }
    }
    XLSX.utils.book_append_sheet(r, s, nomeDeAba(o.nome));
  }
  return r;
}

export function baseEmCsv(e) {
  let t = Array.from(e.keys()).sort(),
    r = t.some((a) => {
      for (let o of e.get(a).values()) if (o.qtd != null) return true;
      return false;
    }),
    n = [];
  for (let a of t) {
    let o = Array.from(e.get(a).entries()).sort((i, s) => s[0] - i[0]);
    for (let [i, s] of o) {
      let l = [
        a,
        fmtData(i),
        numBR(s.abertura),
        numBR(s.maxima),
        numBR(s.minima),
        numBR(s.fech),
        numBR(s.vol, 2),
      ];
      (r && l.push(s.qtd != null ? String(Math.round(s.qtd)) : ""),
        n.push(l.join(";")));
    }
  }
  return n.join(`
`);
}

export function baixarCsv(e, t) {
  let r = new Blob(["﻿" + e], {
      type: "text/csv;charset=utf-8",
    }),
    n = URL.createObjectURL(r),
    a = document.createElement("a");
  ((a.href = n),
    (a.download = t),
    document.body.appendChild(a),
    a.click(),
    document.body.removeChild(a),
    URL.revokeObjectURL(n));
}

function serialExcelParaTs(e) {
  return Math.round((e - 25569) * 86400000);
}

export async function lerArquivoBenchmark(e) {
  let t = /\.(xlsx|xls)$/i.test(e.name),
    r = [];
  if (t) {
    let c = await e.arrayBuffer(),
      u = XLSX.read(c, {
        type: "array",
      }),
      f = u.Sheets[u.SheetNames[0]];
    r = XLSX.utils.sheet_to_json(f, {
      header: 1,
      raw: true,
    });
  } else {
    let c = await new Promise((u, f) => {
      let p = new FileReader();
      ((p.onload = () => u(p.result)),
        (p.onerror = () => f(new Error("leitura"))),
        p.readAsText(e, "ISO-8859-1"));
    });
    r = Papa.parse(c, {
      delimiter: "",
      skipEmptyLines: true,
    }).data;
  }
  let n = [],
    a = false;
  for (let c of r) {
    if (!c || c.length < 2) continue;
    let u = null,
      f = c[0];
    if (
      (typeof f == "number" && f > 20000 && f < 80000
        ? (u = serialExcelParaTs(f))
        : (u = lerDataBR(String(f))),
      u == null)
    )
      continue;
    let p = c[1];
    (typeof p == "string" &&
      (p.includes("%") && (a = true),
      (p = parseFloat(
        p.replace(/%/g, "").trim().replace(/\./g, "").replace(",", "."),
      )),
      isNaN(p) && (p = parseFloat(String(c[1]).replace(/%/g, "").trim()))),
      !(typeof p != "number" || isNaN(p)) && n.push([u, p]));
  }
  if (n.length === 0)
    return {
      points: [],
      asPercent: false,
    };
  let o = n.map((c) => Math.abs(c[1])).sort((c, u) => c - u)[
      Math.floor(n.length / 2)
    ],
    i = a || o > 0.5,
    s = new Map();
  for (let [c, u] of n) s.set(c, i ? u / 100 : u);
  return {
    points: Array.from(s.entries()).sort((c, u) => c[0] - u[0]),
    asPercent: i,
  };
}

export function exportarMesAMesPNG(e, t, r, n, a) {
  let o = e.grid,
    i = 60,
    s = 26,
    l = 50,
    c = 76,
    f = l + 12 * i + 10 + c * 4 + 66 + 24,
    p = 78 + (o.length + 1) * s + 40,
    h = document.createElement("canvas"),
    g = 2;
  ((h.width = f * g), (h.height = p * g));
  let m = h.getContext("2d");
  m.scale(g, g);
  let x = {
    bg: "#0E1116",
    panel: "#161B22",
    line: "#28313D",
    text: "#E8E4DA",
    dim: "#8B94A1",
    up: "#1F5C44",
    down: "#6B2B27",
    upT: "#7BE0B4",
    downT: "#F0A09A",
    amber: "#F0B347",
  };
  ((m.fillStyle = x.bg),
    m.fillRect(0, 0, f, p),
    (m.fillStyle = x.amber),
    (m.font = "700 14px monospace"),
    m.fillText(`${t} — MÊS A MÊS`, 12, 24),
    (m.fillStyle = x.dim),
    (m.font = "11px monospace"),
    m.fillText(
      `matriz: ${r} · período: ${n} · gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      12,
      42,
    ));
  let y = 12,
    b = 56;
  ((m.font = "10px monospace"),
    (m.fillStyle = x.dim),
    MESES.forEach((_, E) => m.fillText(_, y + l + E * i + 16, b + 14)));
  let S = y + l + 12 * i + 10;
  (a.forEach((_, E) =>
    m.fillText(String(_).slice(0, 9), S + E * c + 4, b + 14),
  ),
    m.fillText("MELHOR", S + 4 * c + 6, b + 14));
  let T = (_, E = 1) => (_ * 100).toFixed(E).replace(".", ",") + "%",
    A = e.metricKey;
  o.forEach((_, E) => {
    let P = b + 20 + E * s;
    ((m.fillStyle = x.text),
      (m.font = "700 11px monospace"),
      m.fillText(String(_.year), y, P + 17),
      _.meses.forEach((O, R) => {
        let M = O[A],
          H = y + l + R * i;
        M == null
          ? ((m.fillStyle = x.panel), m.fillRect(H, P, i - 3, s - 3))
          : ((m.fillStyle = M >= 0 ? x.up : x.down),
            m.fillRect(H, P, i - 3, s - 3),
            (m.fillStyle = M >= 0 ? x.upT : x.downT),
            (m.font = "10px monospace"),
            m.fillText(T(M), H + 4, P + 16));
      }),
      ["over", "pos", "bench", "ibov"].forEach((O, R) => {
        let M = _.anual[O],
          H = S + R * c;
        ((m.fillStyle = M == null ? x.panel : M >= 0 ? x.up : x.down),
          m.fillRect(H, P, c - 4, s - 3),
          M != null &&
            ((m.fillStyle = M >= 0 ? x.upT : x.downT),
            (m.font = "700 10px monospace"),
            m.fillText(T(M), H + 4, P + 16)));
      }),
      (m.fillStyle = x.amber),
      (m.font = "700 9px monospace"),
      _.best &&
        m.fillText(
          String(
            a[["over", "pos", "bench", "ibov"].indexOf(_.best)] ?? _.best,
          ).slice(0, 9),
          S + 4 * c + 6,
          P + 16,
        ));
  });
  let w = b + 20 + o.length * s + 8;
  ((m.strokeStyle = x.line),
    m.beginPath(),
    m.moveTo(y, w - 4),
    m.lineTo(f - 12, w - 4),
    m.stroke(),
    (m.fillStyle = x.text),
    (m.font = "700 11px monospace"),
    m.fillText("TOTAL", y, w + 14),
    ["over", "pos", "bench", "ibov"].forEach((_, E) => {
      let P = e.total[_];
      P != null &&
        ((m.fillStyle = P >= 0 ? x.upT : x.downT),
        m.fillText(T(P, 1), S + E * c + 4, w + 14));
    }),
    (m.fillStyle = x.amber),
    e.best && m.fillText("★", S + 4 * c + 6, w + 14),
    h.toBlob((_) => {
      let E = URL.createObjectURL(_),
        P = document.createElement("a");
      ((P.href = E),
        (P.download = "mes_a_mes.png"),
        document.body.appendChild(P),
        P.click(),
        document.body.removeChild(P),
        URL.revokeObjectURL(E));
    }, "image/png"));
}
