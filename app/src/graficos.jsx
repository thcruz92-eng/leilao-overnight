/* Peças visuais compartilhadas pelos gráficos de linha (Recharts).
   O Recharts reconhece os filhos do gráfico pelo tipo, então estas peças
   são props para espalhar nos componentes dele, não componentes novos:
     <XAxis {...EIXO_X} dataKey="label" />
     <Tooltip content={<TooltipGrafico />} cursor={CURSOR} /> */
import { tema } from "./tema.js";

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
   traço horizontal na ponta, verde se positivo e vermelho se negativo.
   Usada como `shape` de um <Bar>: o Recharts entrega a caixa da barra
   (x, y, width, height) e o valor. */
export function Haste({ x, y, width, height, value }) {
  let v = Array.isArray(value) ? value[1] - value[0] : value;
  if (v == null || !Number.isFinite(v) || !Number.isFinite(x)) return null;
  let cx = x + (width || 0) / 2,
    topo = Math.min(y, y + height),
    base = Math.max(y, y + height),
    ponta = v >= 0 ? topo : base,
    zero = v >= 0 ? base : topo,
    cor = v > 0 ? tema.up : v < 0 ? tema.down : tema.faint,
    meia = Math.max(2.5, Math.min((width || 0) / 2, 7));
  return (
    <g>
      <line
        x1={cx}
        x2={cx}
        y1={zero}
        y2={ponta}
        stroke={cor}
        strokeOpacity={0.6}
        strokeWidth={Math.max(1, Math.min(2, (width || 0) * 0.3))}
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
export const GRAFICO_HASTES = { barCategoryGap: "16%", barGap: 1 };
export const CURSOR_HASTES = { fill: tema.panelSoft, fillOpacity: 0.55 };

/* Legenda em pílulas, com amostra do traço (tracejado quando a série é).
   `numerada`: para hastes, que são verdes ou vermelhas, mostra a posição de
   cada série dentro do dia (1 = a mais à esquerda) e a cor dela. */
export function LegendaGrafico({ payload, numerada = false }) {
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
      {payload.map((p, i) => {
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
            {numerada ? (
              <span
                style={{
                  fontFamily: tema.mono,
                  fontSize: 10.5,
                  fontWeight: 600,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 99,
                  display: "inline-grid",
                  placeItems: "center",
                  background: p.color + "33",
                  color: p.color,
                }}
              >
                {i + 1}
              </span>
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
