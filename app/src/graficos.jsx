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

/* Legenda em pílulas, com amostra do traço (tracejado quando a série é). */
export function LegendaGrafico({ payload }) {
  if (!payload || payload.length === 0) return null;
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
