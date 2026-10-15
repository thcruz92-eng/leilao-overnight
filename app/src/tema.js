/* Cores, formatação de números e datas e estilos compartilhados. */

export const tema = {
    bg: "#0E1116",
    panel: "#161B22",
    panelSoft: "#1C232C",
    line: "#28313D",
    text: "#E8E4DA",
    dim: "#8B94A1",
    faint: "#5C6672",
    up: "#3FBF8F",
    down: "#E06055",
    amber: "#F0B347",
    amberSoft: "rgba(240,179,71,0.12)",
    mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
    sans: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  DIAS_SEMANA = [
    "domingo",
    "segunda",
    "terça",
    "quarta",
    "quinta",
    "sexta",
    "sábado",
  ],
  fmtNum = (e, t = 0) =>
    e.toLocaleString("pt-BR", {
      minimumFractionDigits: t,
      maximumFractionDigits: t,
    }),
  fmtPct = (e, t = 2) =>
    (e * 100).toLocaleString("pt-BR", {
      minimumFractionDigits: t,
      maximumFractionDigits: t,
    }) + "%",
  fmtData = (e) =>
    new Date(e).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
    }),
  numBR = (e, t = 2) => e.toFixed(t).replace(".", ",");

const CORES_GRUPOS = [
  "#06D6A0",
  "#C77DFF",
  "#4CC9F0",
  "#F72585",
  "#FF9E00",
  "#B5E48C",
];

export function corDoGrupo(e, t) {
  return e?.tipo === "reais"
    ? tema.amber
    : CORES_GRUPOS[(t < 0 ? 0 : t) % CORES_GRUPOS.length];
}

export const COR_MIX_NR = "#E9FF70",
  COR_MIX_FIXO = "#8E9AAF";

export const MESES = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ],
  anoMes = (e) => {
    let t = new Date(e);
    return t.getUTCFullYear() * 100 + (t.getUTCMonth() + 1);
  };

export const estiloInput = {
    background: tema.panelSoft,
    border: `1px solid ${tema.line}`,
    borderRadius: 6,
    color: tema.text,
    padding: "7px 10px",
    fontFamily: tema.mono,
    fontSize: 13,
    minWidth: 90,
  },
  estiloBotao = {
    ...estiloInput,
    cursor: "pointer",
    minWidth: 0,
  };

export const MESES_LONGOS = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ],
  MESES_CURTOS = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ],
  INICIAIS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export function fmtDataHora(e) {
  if (!e) return "—";
  let t = new Date(e);
  return isNaN(t)
    ? "—"
    : t.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export const fmtReais = (e) =>
    e == null || !Number.isFinite(e) ? "—" : `R$ ${fmtNum(e, 2)}`,
  corDoValor = (e) =>
    e == null || !Number.isFinite(e) || Math.abs(e) < 0.005
      ? tema.dim
      : e > 0
        ? tema.up
        : tema.down;
