/* Cabeçalho, abas principais (topo no computador, barra inferior no celular)
   e seletor de sub-abas. */
import { tema } from "./tema.js";

export const ABAS = [
  { id: "operar", rotulo: "Operar", curto: "Operar", icone: "alvo" },
  {
    id: "estrategias",
    rotulo: "Estratégias",
    curto: "Estratégias",
    icone: "camadas",
  },
  { id: "swing", rotulo: "Swing", curto: "Swing", icone: "onda" },
  {
    id: "resultados",
    rotulo: "Resultados",
    curto: "Resultados",
    icone: "curva",
  },
  { id: "base", rotulo: "Base", curto: "Base", icone: "banco" },
  {
    id: "config",
    rotulo: "Configurações",
    curto: "Ajustes",
    icone: "controles",
  },
  { id: "readme", rotulo: "Read me", curto: "Guia", icone: "livro" },
];

const TRACOS = {
  alvo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
  camadas: (
    <>
      <path d="M12 3.5 3.5 8 12 12.5 20.5 8z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16 8.5 4.5 8.5-4.5" />
    </>
  ),
  curva: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="m4.5 16 4.5-5 3.5 3 7-8" />
      <path d="M15.5 6h4v4" />
    </>
  ),
  banco: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" />
      <path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13" />
      <path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
    </>
  ),
  controles: (
    <>
      <path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1" />
      <circle cx="15" cy="6.5" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17.5" r="2" />
    </>
  ),
  onda: (
    <>
      <path d="M3.5 17c2.2 0 2.6-7 5-7s2.8 5 5 5 2.8-8.5 6.5-8.5" />
      <path d="M16.5 6.5h3.5V10" />
    </>
  ),
  livro: (
    <>
      <path d="M12 6.5c-1.8-1.5-4.6-2-8-2v13c3.4 0 6.2.5 8 2 1.8-1.5 4.6-2 8-2v-13c-3.4 0-6.2.5-8 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
};

export function Icone({ nome, tamanho = 18 }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {TRACOS[nome]}
    </svg>
  );
}

function Marca() {
  return (
    <svg width="34" height="34" viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="120" fill={tema.panelSoft} />
      <path
        d="M370.35 322.78A158 158 0 1 1 191.22 143.65A128 128 0 0 0 370.35 322.78Z"
        fill={tema.amber}
      />
      <rect x="336" y="64" width="112" height="176" rx="20" fill={tema.up} />
    </svg>
  );
}

/* Cabeçalho fixo no topo. `extras` fica à direita (nuvem e relógio). */
export function Cabecalho({ aba, aoTrocar, publicadoEm, extras }) {
  return (
    <header className="cabecalho">
      <div className="cabecalho-linha">
        <div className="cabecalho-marca">
          <Marca />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: tema.mono,
                fontSize: 10,
                letterSpacing: 2.2,
                color: tema.amber,
                textTransform: "uppercase",
              }}
            >
              B3 · estratégia overnight
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 19,
                fontWeight: 650,
                letterSpacing: -0.3,
                lineHeight: 1.25,
                whiteSpace: "nowrap",
              }}
            >
              Leilão Overnight
            </h1>
          </div>
          <span
            className="so-largo"
            title="Data e hora em que este app foi publicado"
            style={{
              fontSize: 11,
              color: tema.faint,
              fontFamily: tema.mono,
              alignSelf: "flex-end",
              paddingBottom: 3,
            }}
          >
            versão de {publicadoEm}
          </span>
        </div>
        <div className="cabecalho-extras">{extras}</div>
      </div>
      <nav className="abas-topo" aria-label="Seções do app">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={"aba" + (aba === a.id ? " ativa" : "")}
            aria-current={aba === a.id ? "page" : undefined}
            onClick={() => aoTrocar(a.id)}
          >
            <Icone nome={a.icone} tamanho={16} />
            {a.rotulo}
          </button>
        ))}
      </nav>
    </header>
  );
}

/* Barra de abas no rodapé, só no celular. */
export function AbasCelular({ aba, aoTrocar }) {
  return (
    <nav className="abas-celular" aria-label="Seções do app">
      {ABAS.map((a) => (
        <button
          key={a.id}
          className={aba === a.id ? "ativa" : ""}
          aria-current={aba === a.id ? "page" : undefined}
          onClick={() => aoTrocar(a.id)}
        >
          <Icone nome={a.icone} tamanho={21} />
          <span>{a.curto}</span>
        </button>
      ))}
    </nav>
  );
}

/* Sub-abas (EXECUTAR / RANKING…, SINAIS / COMPARAR / MÊS A MÊS). */
export function SubAbas({ opcoes, valor, aoTrocar }) {
  return (
    <div className="subabas" role="tablist">
      {opcoes.map(([id, rotulo]) => (
        <button
          key={id}
          role="tab"
          aria-selected={valor === id}
          className={valor === id ? "ativa" : ""}
          onClick={() => aoTrocar(id)}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

/* CSS da navegação e dos estilos globais. Mora aqui para ficar junto
   das classes que usa. */
export const CSS_GLOBAL = `
  html{color-scheme:dark;scroll-padding-top:120px}
  body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
  ::selection{background:rgba(244,183,64,.28)}
  *{scrollbar-width:thin;scrollbar-color:${tema.line} transparent}
  ::-webkit-scrollbar{width:10px;height:10px}
  ::-webkit-scrollbar-thumb{background:${tema.line};border-radius:10px;border:2px solid ${tema.bg}}
  ::-webkit-scrollbar-track{background:transparent}

  button{transition:background-color .15s,border-color .15s,color .15s,filter .15s,box-shadow .15s}
  button:not(:disabled):hover{filter:brightness(1.18)}
  button:disabled{cursor:not-allowed}
  input,select,textarea{transition:border-color .15s,box-shadow .15s}
  input:focus,select:focus,textarea:focus{outline:none;border-color:${tema.amber}!important;box-shadow:0 0 0 3px ${tema.amberSoft}}
  table{font-variant-numeric:tabular-nums}
  main section{box-shadow:${tema.sombra}}

  .cabecalho{position:sticky;top:0;z-index:40;background:rgba(11,14,19,.86);
    -webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px);
    border-bottom:1px solid ${tema.lineSoft}}
  .cabecalho-linha{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 28px 10px;flex-wrap:wrap}
  .cabecalho-marca{display:flex;align-items:center;gap:12px;min-width:0}
  .cabecalho-extras{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .abas-topo{display:flex;gap:4px;padding:0 22px 10px;overflow-x:auto}
  .aba{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px;border:1px solid transparent;
    background:transparent;color:${tema.dim};font:500 13.5px/1 ${tema.sans};cursor:pointer;white-space:nowrap}
  .aba:hover{background:${tema.panelSoft};color:${tema.text};filter:none!important}
  .aba.ativa{background:${tema.amberSoft};border-color:rgba(244,183,64,.35);color:${tema.amber}}

  .subabas{display:inline-flex;gap:3px;padding:3px;background:${tema.panel};border:1px solid ${tema.line};border-radius:12px;flex-wrap:wrap}
  .subabas button{border:none;background:transparent;color:${tema.dim};padding:7px 14px;border-radius:9px;
    font:500 12.5px/1.2 ${tema.sans};cursor:pointer;letter-spacing:.1px}
  .subabas button:hover{color:${tema.text};background:${tema.panelSoft};filter:none!important}
  .subabas button.ativa{background:${tema.amber};color:#1A1407;font-weight:600}

  .grade-papeis{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr));gap:12px;margin-top:14px}
  .pilulas{display:flex;flex-wrap:wrap;gap:6px}
  .pilula{display:inline-flex;align-items:baseline;gap:5px;padding:4px 10px;border-radius:999px;background:${tema.panelSoft};
    border:1px solid ${tema.lineSoft};font:400 12px/1.4 ${tema.sans};color:${tema.dim};white-space:nowrap}
  .pilula b{color:${tema.text};font-weight:600}
  .abas-celular{display:none}
  .conteudo{padding:24px 28px 64px;box-sizing:border-box;width:100%}

  @media (max-width:760px){
    .cabecalho{position:relative}
    .cabecalho-linha{padding:10px 14px;gap:8px}
    .cabecalho-extras{width:100%}
    .relogio{font-size:11.5px!important;padding:4px 10px!important}
    .abas-topo{display:none}
    .so-largo{display:none}
    .cabecalho-extras{gap:6px}
    .conteudo{padding:16px 12px calc(92px + env(safe-area-inset-bottom))}
    .abas-celular{display:grid;grid-template-columns:repeat(7,1fr);position:fixed;left:0;right:0;bottom:0;z-index:45;
      background:rgba(15,19,26,.94);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
      border-top:1px solid ${tema.line};padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
    .abas-celular button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0;border:none;background:none;
      color:${tema.faint};font:500 10px/1 ${tema.sans};cursor:pointer;border-radius:10px;min-width:0}
    .abas-celular button span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .abas-celular button.ativa{color:${tema.amber};background:${tema.amberSoft}}
  }
`;

/* Faixa de aviso: ok (verde), erro (vermelho) ou info (âmbar). */
export function Aviso({ tipo = "info", children, aoFechar }) {
  let cor = tipo === "ok" ? tema.up : tipo === "erro" ? tema.down : tema.amber,
    fundo =
      tipo === "ok"
        ? tema.upSoft
        : tipo === "erro"
          ? tema.downSoft
          : tema.amberSoft,
    simbolo = tipo === "ok" ? "✓" : tipo === "erro" ? "!" : "i";
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 11,
        background: fundo,
        border: `1px solid ${cor}40`,
        borderRadius: tema.raioP,
        padding: "10px 12px 10px 12px",
        marginBottom: 16,
        fontSize: 13,
        lineHeight: 1.5,
        color: tema.text,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          borderRadius: 99,
          background: cor,
          color: "#0B0E13",
          display: "grid",
          placeItems: "center",
          fontSize: 11.5,
          fontWeight: 700,
          marginTop: 0.5,
        }}
      >
        {simbolo}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {aoFechar && (
        <button
          onClick={aoFechar}
          aria-label="fechar aviso"
          style={{
            flexShrink: 0,
            border: "none",
            background: "none",
            color: tema.faint,
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: "0 2px",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
