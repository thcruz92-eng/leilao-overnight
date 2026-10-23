/* OPERAR: calendário de resultados dos próximos dias, com as noites em que
   o app não deixa entrar, e onde você corrige ou inclui uma data. */
import { useState } from "react";
import { QUANDO, proximosResultados, resultadoNaNoite } from "./resultados.js";
import { estiloBotao, estiloInput, tema } from "./tema.js";

const fmtDia = (ts) =>
  new Date(ts).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

export function CalendarioResultados({
  cal,
  compra,
  tickers,
  manuais,
  onManuais,
  geradoEm,
}) {
  let [aberto, setAberto] = useState(false),
    [novo, setNovo] = useState({ ticker: "", data: "", quando: "apos" }),
    [todos, setTodos] = useState(false),
    lista = compra == null ? [] : proximosResultados(cal, todos ? null : tickers, compra, 14),
    bloqueadosHoje = lista.filter((e) => resultadoNaNoite(cal, e.ticker, compra) === e);

  const incluir = () => {
    let t = novo.ticker.trim().toUpperCase();
    if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(novo.data)) return;
    onManuais([
      ...manuais.filter((m) => !(m.ticker === t && m.data === novo.data)),
      { ticker: t, data: novo.data, quando: novo.quando, fonte: "informado por você" },
    ]);
    setNovo({ ticker: "", data: "", quando: "apos" });
  };
  const remover = (e) =>
    onManuais(
      e.origem === "manual"
        ? manuais.filter((m) => !(m.ticker === e.ticker && m.data === e.data))
        : [...manuais, { ticker: e.ticker, data: e.data, remover: true }],
    );

  return (
    <section
      style={{
        background: tema.panel,
        border: `1px solid ${tema.line}`,
        borderRadius: 14,
        padding: "14px 16px",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: tema.faint, letterSpacing: 0.7 }}>
          RESULTADOS NOS PRÓXIMOS DIAS
        </div>
        {bloqueadosHoje.length > 0 && (
          <span style={{ fontSize: 12, color: tema.down }}>
            ⛔ não entrar hoje: {bloqueadosHoje.map((e) => e.ticker).join(", ")}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setAberto((v) => !v)}
          style={{ ...estiloBotao, padding: "5px 12px", fontSize: 12, color: tema.dim }}
        >
          {aberto ? "fechar" : `ver calendário · ${lista.length}`}
        </button>
      </div>
      <div style={{ fontSize: 12, color: tema.dim, marginTop: 6, lineHeight: 1.55 }}>
        Regra: não entrar no papel cujo balanço sai depois do fechamento da
        compra ou antes da abertura da venda — o resultado cairia inteiro na
        noite. Divulgação durante o pregão não bloqueia. Sem horário
        informado, o app bloqueia os dois lados por precaução.
      </div>
      {aberto && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0 8px" }}>
            <label style={{ fontSize: 12, color: tema.dim, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
              todos os papéis do calendário (não só os de hoje)
            </label>
            <span style={{ flex: 1 }} />
            {geradoEm && (
              <span style={{ fontSize: 11, color: tema.faint, fontFamily: tema.mono }}>
                calendário de {geradoEm.split("-").reverse().join("/")}
              </span>
            )}
          </div>
          {lista.length === 0 ? (
            <div style={{ fontSize: 13, color: tema.dim, padding: "6px 0" }}>
              Nenhum resultado nos próximos 14 dias para esses papéis.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                <tbody>
                  {lista.map((e) => {
                    let hoje = resultadoNaNoite(cal, e.ticker, compra) === e;
                    return (
                      <tr key={e.ticker + e.data}>
                        <td style={{ padding: "6px 10px 6px 0", fontFamily: tema.mono, whiteSpace: "nowrap", color: tema.dim }}>
                          {fmtDia(e.ts)}
                        </td>
                        <td style={{ padding: "6px 10px", fontFamily: tema.mono, fontWeight: 700 }}>{e.ticker}</td>
                        <td style={{ padding: "6px 10px", color: e.quando === "?" ? tema.amber : tema.text, whiteSpace: "nowrap" }}>
                          {QUANDO[e.quando] ?? QUANDO["?"]}
                        </td>
                        <td style={{ padding: "6px 10px", color: hoje ? tema.down : tema.faint, whiteSpace: "nowrap" }}>
                          {hoje ? "⛔ não entrar hoje" : ""}
                        </td>
                        <td style={{ padding: "6px 10px", color: tema.faint, fontSize: 11.5 }}>
                          {e.origem === "manual" ? "informado por você" : e.confianca || ""}
                          {e.obs ? ` · ${e.obs}` : ""}
                        </td>
                        <td style={{ padding: "6px 0", textAlign: "right" }}>
                          <button
                            onClick={() => remover(e)}
                            title={e.origem === "manual" ? "apagar a data que você incluiu" : "ignorar esta data (ela está errada)"}
                            style={{ ...estiloBotao, padding: "2px 8px", fontSize: 11, color: tema.faint }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10, fontSize: 12.5, color: tema.dim }}>
            Corrigir ou incluir:
            <input
              placeholder="papel"
              value={novo.ticker}
              onChange={(e) => setNovo({ ...novo, ticker: e.target.value })}
              style={{ ...estiloInput, width: 80, padding: "4px 8px", textTransform: "uppercase" }}
            />
            <input
              type="date"
              value={novo.data}
              onChange={(e) => setNovo({ ...novo, data: e.target.value })}
              style={{ ...estiloInput, padding: "4px 8px" }}
            />
            <select
              value={novo.quando}
              onChange={(e) => setNovo({ ...novo, quando: e.target.value })}
              style={{ ...estiloInput, padding: "4px 8px" }}
            >
              {Object.entries(QUANDO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button
              onClick={incluir}
              style={{ ...estiloBotao, padding: "5px 12px", fontSize: 12, color: tema.amber, borderColor: "rgba(244,183,64,.45)" }}
            >
              + incluir
            </button>
            <span style={{ flexBasis: "100%", fontSize: 11.5, color: tema.faint }}>
              Uma data que você inclui substitui a do calendário para o mesmo
              papel (até 20 dias de distância). O × de uma data do calendário
              faz o app ignorá-la.
            </span>
          </div>
        </>
      )}
    </section>
  );
}
