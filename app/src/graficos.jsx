/* Peças visuais compartilhadas pelos gráficos de linha (Recharts).
   O Recharts reconhece os filhos do gráfico pelo tipo, então estas peças
   são props para espalhar nos componentes dele, não componentes novos:
     <XAxis {...EIXO_X} dataKey="label" />
     <Tooltip content={<TooltipGrafico />} cursor={CURSOR} /> */
import { useEffect, useRef, useState } from "react";
import { estiloBotao, tema } from "./tema.js";

const TICK = { fill: tema.faint, fontSize: 10.5, fontFamily: tema.mono };

// "20/03/2023" -> "20/03/23"
const encurtarData = (t) =>
  typeof t === "string"
    ? t.replace(/^(\d{2}\/\d{2}\/)\d{2}(\d{2})$/, "$1$2")
    : t;

export const EIXO_X = {
  tick: TICK,
  axisLine: false,
  tickLine: false,
  tickMargin: 10,
  tickFormatter: encurtarData,
};

export const EIXO_Y = {
  tick: TICK,
  axisLine: false,
  tickLine: false,
  tickMargin: 6,
  width: 56,
};

export const GRADE = {
  stroke: tema.line,
  strokeOpacity: 0.55,
  strokeDasharray: "3 5",
  vertical: false,
};

export const CURSOR = { stroke: tema.dim, strokeOpacity: 0.35, strokeWidth: 1 };

export const PONTO_ATIVO = { r: 4, strokeWidth: 2, stroke: tema.panel };

export const MARGEM = { top: 10, right: 30, bottom: 4, left: 0 };

const fmtPctSinal = (v, casas) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      })}%`;

/* Caixa do tooltip: data no topo, séries da maior para a menor. */
export function TooltipGrafico({ active, payload, label, casas = 2 }) {
  if (!active || !payload || payload.length === 0) return null;
  let linhas = payload
    .filter((p) => p && p.value != null && Number.isFinite(p.value))
    .sort((a, b) => b.value - a.value);
  if (linhas.length === 0) return null;
  return (
    <div
      style={{
        background: "rgba(25,32,42,.96)",
        border: `1px solid ${tema.line}`,
        borderRadius: tema.raioP,
        padding: "10px 12px",
        boxShadow: "0 14px 34px -12px rgba(0,0,0,.75)",
        fontFamily: tema.sans,
        fontSize: 12.5,
        minWidth: 180,
        maxWidth: 320,
      }}
    >
      <div
        style={{
          fontFamily: tema.mono,
          fontSize: 11,
          color: tema.faint,
          marginBottom: 7,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </div>
      {linhas.map((p) => (
        <div
          key={p.dataKey}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "2.5px 0",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: p.color || p.stroke,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              color: tema.dim,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {p.name}
          </span>
          <span
            style={{
              fontFamily: tema.mono,
              fontWeight: 600,
              color: p.value > 0 ? tema.up : p.value < 0 ? tema.down : tema.dim,
            }}
          >
            {fmtPctSinal(p.value, casas)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Haste do resultado diário: linha vertical do zero até o resultado e um
   traço horizontal na ponta, na cor da série (o `fill` do <Bar>).
   Usada como `shape` de um <Bar>: o Recharts entrega a caixa da barra
   (x, y, width, height), o valor e a cor. */
export function Haste({ x, y, width, height, value, fill }) {
  let v = Array.isArray(value) ? value[1] - value[0] : value;
  if (v == null || !Number.isFinite(v) || !Number.isFinite(x)) return null;
  let cx = x + (width || 0) / 2,
    topo = Math.min(y, y + height),
    base = Math.max(y, y + height),
    ponta = v >= 0 ? topo : base,
    zero = v >= 0 ? base : topo,
    cor = fill || tema.dim,
    meia = Math.max(2, Math.min((width || 0) / 2 - 0.5, 6));
  return (
    <g>
      <line
        x1={cx}
        x2={cx}
        y1={zero}
        y2={ponta}
        stroke={cor}
        strokeOpacity={0.75}
        strokeWidth={Math.max(1.2, Math.min(2, (width || 0) * 0.3))}
      />
      <line
        x1={cx - meia}
        x2={cx + meia}
        y1={ponta}
        y2={ponta}
        stroke={cor}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </g>
  );
}

/* Props do gráfico e do cursor quando as séries são hastes. */
// séries coladas dentro do dia (barGap 0) e dias bem separados
export const GRAFICO_HASTES = { barCategoryGap: "28%", barGap: 0 };

/* Largura de cada haste para que as séries de um dia fiquem coladas no
   centro do dia. O Recharts só agrupa as barras no centro quando recebe
   uma largura fixa (barSize); sem ela, espalha as séries pelo dia todo. */
export function larguraHaste(larguraGrafico, nDias, nSeries) {
  if (!larguraGrafico || !nDias || !nSeries) return undefined;
  let area = larguraGrafico - EIXO_Y.width - MARGEM.right - MARGEM.left,
    banda = area / nDias;
  return Math.max(1, Math.min(10, Math.floor((banda * 0.7) / nSeries)));
}

/* Mede a largura de um elemento (e acompanha mudanças de tamanho). */
export function useLargura() {
  let ref = useRef(null),
    [largura, setLargura] = useState(0);
  useEffect(() => {
    let el = ref.current;
    if (!el || typeof ResizeObserver > "u") return;
    let ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  });
  return [ref, largura];
}
export const CURSOR_HASTES = { fill: tema.panelSoft, fillOpacity: 0.55 };

/* Legenda em pílulas, com amostra do traço (tracejado quando a série é).
   `hastes`: a amostra vira uma haste com o traço na ponta. */
export function LegendaGrafico({ payload, hastes = false }) {
  payload = (payload || []).filter((p) => p.type !== "none");
  if (payload.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "6px 8px",
        paddingTop: 12,
      }}
    >
      {payload.map((p) => {
        let tracejado = p.payload?.strokeDasharray;
        return (
          <span
            key={p.dataKey ?? p.value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "4px 10px",
              borderRadius: 999,
              background: tema.panelSoft,
              border: `1px solid ${tema.lineSoft}`,
              fontFamily: tema.sans,
              fontSize: 11.5,
              color: tema.dim,
              opacity: p.inactive ? 0.4 : 1,
            }}
          >
            {hastes ? (
              <svg width="12" height="12" aria-hidden="true">
                <line
                  x1="6"
                  y1="11"
                  x2="6"
                  y2="2"
                  stroke={p.color}
                  strokeWidth="1.6"
                />
                <line
                  x1="2"
                  y1="2"
                  x2="10"
                  y2="2"
                  stroke={p.color}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="16" height="6" aria-hidden="true">
                <line
                  x1="1"
                  y1="3"
                  x2="15"
                  y2="3"
                  stroke={p.color}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeDasharray={tracejado ? "3 3" : undefined}
                />
              </svg>
            )}
            {p.value}
          </span>
        );
      })}
    </div>
  );
}

/* Degradê vertical para preencher a área sob uma linha. */
export function Degrade({ id, cor, opacidade = 0.22 }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={cor} stopOpacity={opacidade} />
      <stop offset="100%" stopColor={cor} stopOpacity={0} />
    </linearGradient>
  );
}

/* Botão "⬇ imagem", igual ao do MÊS A MÊS. */
export function BotaoImagem({
  onClick,
  titulo = "baixar o gráfico como imagem",
}) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      style={{
        ...estiloBotao,
        padding: "5px 12px",
        fontSize: 12,
        color: tema.amber,
        borderColor: "rgba(244,183,64,.45)",
        background: tema.amberSoft,
      }}
    >
      ⬇ imagem
    </button>
  );
}

/* Baixa o gráfico (o <svg> do Recharts dentro de `container`) como PNG,
   com título, subtítulo e legenda desenhados em volta.
   series: [{ nome, cor, tracejado?, haste? }] */
export function baixarGraficoPNG(
  container,
  { titulo, subtitulo = "", series = [], arquivo = "grafico" },
) {
  let svg = container?.querySelector("svg.recharts-surface");
  if (!svg) return;
  let caixa = svg.getBoundingClientRect(),
    w = Math.round(caixa.width),
    hSvg = Math.round(caixa.height),
    // o Recharts reserva embaixo do <svg> o espaço da legenda da tela;
    // a imagem desenha a própria legenda, então esse trecho sai
    legTela =
      container.querySelector(".recharts-legend-wrapper")?.offsetHeight || 0,
    h = Math.max(40, hSvg - legTela),
    copia = svg.cloneNode(true);
  copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copia.setAttribute("width", w);
  copia.setAttribute("height", hSvg);
  // sem cursor nem tooltip na imagem
  copia
    .querySelectorAll(".recharts-tooltip-cursor, .recharts-active-dot")
    .forEach((n) => n.remove());
  let dados = new XMLSerializer().serializeToString(copia),
    url = URL.createObjectURL(
      new Blob([dados], { type: "image/svg+xml;charset=utf-8" }),
    ),
    img = new Image();
  img.onload = () => {
    let esc = 2,
      pad = 20,
      topo = 62,
      // legenda em linhas que cabem na largura
      ctxMedida = document.createElement("canvas").getContext("2d");
    ctxMedida.font = "12px Inter, sans-serif";
    let linhas = [[]],
      larg = 0;
    for (let s of series) {
      let lw = 26 + ctxMedida.measureText(s.nome).width + 18;
      if (larg + lw > w && linhas[linhas.length - 1].length) {
        linhas.push([]);
        larg = 0;
      }
      linhas[linhas.length - 1].push({ ...s, lw });
      larg += lw;
    }
    let altLeg = series.length ? linhas.length * 22 + 10 : 0,
      W = w + pad * 2,
      H = topo + h + altLeg + pad,
      cv = document.createElement("canvas");
    cv.width = W * esc;
    cv.height = H * esc;
    let c = cv.getContext("2d");
    c.scale(esc, esc);
    c.fillStyle = tema.panel;
    c.fillRect(0, 0, W, H);
    c.fillStyle = tema.text;
    c.font = "600 16px Inter, sans-serif";
    c.fillText(titulo, pad, 28);
    c.fillStyle = tema.faint;
    c.font = "12px Inter, sans-serif";
    c.fillText(
      [subtitulo, `gerado em ${new Date().toLocaleDateString("pt-BR")}`]
        .filter(Boolean)
        .join(" · "),
      pad,
      48,
    );
    c.drawImage(img, 0, 0, w, h, pad, topo, w, h);
    let y = topo + h + 18;
    for (let linha of linhas) {
      let tot = linha.reduce((a, s) => a + s.lw, 0),
        x = pad + Math.max(0, (w - tot) / 2);
      for (let s of linha) {
        c.strokeStyle = s.cor;
        c.lineCap = "round";
        if (s.haste) {
          c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(x + 9, y + 5);
          c.lineTo(x + 9, y - 5);
          c.stroke();
          c.lineWidth = 2.2;
          c.beginPath();
          c.moveTo(x + 4, y - 5);
          c.lineTo(x + 14, y - 5);
          c.stroke();
        } else {
          c.lineWidth = 2.4;
          c.setLineDash(s.tracejado ? [3, 3] : []);
          c.beginPath();
          c.moveTo(x + 2, y);
          c.lineTo(x + 18, y);
          c.stroke();
          c.setLineDash([]);
        }
        c.fillStyle = tema.dim;
        c.font = "12px Inter, sans-serif";
        c.fillText(s.nome, x + 26, y + 4);
        x += s.lw;
      }
      y += 22;
    }
    URL.revokeObjectURL(url);
    cv.toBlob((b) => {
      let u = URL.createObjectURL(b),
        a = document.createElement("a");
      a.href = u;
      a.download = arquivo + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
    }, "image/png");
  };
  img.src = url;
}
