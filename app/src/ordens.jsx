/* OPERAR: as ordens do leilão de fechamento, uma linha por papel, prontas
   para digitar na corretora — quantidade em lotes e preço da ordem limitada
   um pouco acima do fechamento, para garantir a execução no leilão. */
import { useState } from "react";
import { estiloBotao, fmtNum, numBR, tema } from "./tema.js";

export const FOLGA_ORDEM = 0.05;

/* preço da ordem: fechamento + folga, arredondado para cima no centavo */
export const precoDaOrdem = (preco, folga = FOLGA_ORDEM) =>
  Math.ceil(preco * (1 + folga) * 100 - 1e-6) / 100;

/* linhas: [{ ativo, preco, lote, provisorio, origens: [{ nome, cor, valor }] }] */
export function OrdensLeilao({ linhas, dataTxt, provisorio }) {
  let [copiado, setCopiado] = useState(false),
    rows = linhas.map((l) => {
      let valor = l.origens.reduce((s, o) => s + o.valor, 0),
        lote = l.lote > 0 ? l.lote : 100,
        qtd = l.preco > 0 ? Math.floor(valor / l.preco / lote) * lote : 0,
        ordem = l.preco > 0 ? precoDaOrdem(l.preco) : null;
      return {
        ...l,
        valor,
        lote,
        qtd,
        ordem,
        total: qtd * (l.preco || 0),
        reserva: qtd * (ordem || 0),
      };
    }),
    soma = (k) => rows.reduce((s, r) => s + r[k], 0);

  const copiar = () => {
    let txt = [
      "Papel\tQuantidade\tPreço da ordem",
      ...rows.filter((r) => r.qtd > 0).map((r) => `${r.ativo}\t${r.qtd}\t${numBR(r.ordem)}`),
    ].join("\n");
    navigator.clipboard?.writeText(txt).then(
      () => (setCopiado(true), setTimeout(() => setCopiado(false), 1800)),
      () => {},
    );
  };

  let th = {
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: 0.7,
      color: tema.faint,
      textAlign: "right",
      padding: "0 10px 8px",
      whiteSpace: "nowrap",
    },
    td = {
      padding: "9px 10px",
      borderTop: `1px solid ${tema.lineSoft}`,
      textAlign: "right",
      fontFamily: tema.mono,
      fontSize: 13.5,
      whiteSpace: "nowrap",
    };

  return (
    <section
      style={{
        background: tema.panel,
        border: `1px solid ${tema.line}`,
        borderLeft: `3px solid ${tema.up}`,
        borderRadius: 14,
        padding: "14px 16px",
        // item de grade: sem isso a tabela larga estica a página no celular
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: tema.up, letterSpacing: 0.7 }}>
            ORDENS DO LEILÃO DE FECHAMENTO · {dataTxt}
          </div>
          <div style={{ fontSize: 12.5, color: tema.dim, marginTop: 4, lineHeight: 1.55, maxWidth: 760 }}>
            Uma linha por papel: Overnight padrão (cesta da aba RESULTADOS) e as
            estratégias que você segue. Ordem limitada de compra no{" "}
            <b style={{ color: tema.text }}>preço da ordem</b> (fechamento +{" "}
            {fmtNum(FOLGA_ORDEM * 100)}%): no leilão ela executa no preço do
            leilão, e a folga só garante que não fica de fora.
          </div>
        </div>
        {rows.length > 0 && (
          <button
            onClick={copiar}
            style={{ ...estiloBotao, padding: "5px 12px", fontSize: 12, color: copiado ? tema.up : tema.dim }}
            title="copia papel, quantidade e preço da ordem (separados por tabulação)"
          >
            {copiado ? "✓ copiado" : "copiar ordens"}
          </button>
        )}
      </div>
      {provisorio && (
        <div style={{ fontSize: 11.5, color: tema.amber, margin: "6px 0 2px" }}>
          ⏳ Fechamento provisório (cotação de agora): atualize perto do leilão,
          porque a quantidade e o preço da ordem saem dele.
        </div>
      )}
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: tema.dim, padding: "10px 0 2px" }}>
          Nenhum papel para hoje: monte a cesta do Overnight padrão na aba
          RESULTADOS ou escolha uma estratégia abaixo.
        </div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", paddingLeft: 0 }}>PAPEL</th>
                <th style={th}>FECHAMENTO</th>
                <th style={th}>QUANTIDADE</th>
                <th style={{ ...th, color: tema.up }}>PREÇO DA ORDEM (+{fmtNum(FOLGA_ORDEM * 100)}%)</th>
                <th style={th}>VALOR</th>
                <th style={th}>TOTAL NO FECHAMENTO</th>
                <th style={th}>RESERVA NA CORRETORA</th>
                <th style={{ ...th, textAlign: "left" }}>DE ONDE VEM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ativo}>
                  <td style={{ ...td, textAlign: "left", paddingLeft: 0, fontWeight: 700, fontSize: 15 }}>{r.ativo}</td>
                  <td style={{ ...td, color: r.provisorio ? tema.amber : tema.text }}>
                    {r.preco > 0 ? `R$ ${numBR(r.preco)}` : "—"}
                  </td>
                  <td style={{ ...td, fontWeight: 700, fontSize: 15 }}>
                    {r.qtd > 0 ? (
                      fmtNum(r.qtd)
                    ) : (
                      <span style={{ color: tema.down, fontSize: 12 }}>
                        {r.preco > 0 ? `não dá 1 lote (${r.lote})` : "sem preço"}
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, color: tema.up, fontWeight: 700, fontSize: 15 }}>
                    {r.ordem ? `R$ ${numBR(r.ordem)}` : "—"}
                  </td>
                  <td style={td}>R$ {fmtNum(r.valor)}</td>
                  <td style={{ ...td, color: tema.dim }}>{r.qtd > 0 ? `R$ ${fmtNum(r.total, 2)}` : "—"}</td>
                  <td style={{ ...td, color: tema.dim }}>{r.qtd > 0 ? `R$ ${fmtNum(r.reserva, 2)}` : "—"}</td>
                  <td style={{ ...td, textAlign: "left", fontFamily: tema.sans, fontSize: 12 }}>
                    {r.origens.map((o, i) => (
                      <span key={i} style={{ color: o.cor, marginRight: 8 }}>
                        ● {o.nome}
                        {r.origens.length > 1 && (
                          <span style={{ color: tema.faint }}> R$ {fmtNum(o.valor)}</span>
                        )}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, textAlign: "left", paddingLeft: 0, fontFamily: tema.sans, fontSize: 12, color: tema.faint }} colSpan={4}>
                  {rows.length} {rows.length === 1 ? "papel" : "papéis"}
                </td>
                <td style={{ ...td, fontWeight: 600 }}>R$ {fmtNum(soma("valor"))}</td>
                <td style={{ ...td, fontWeight: 600 }}>R$ {fmtNum(soma("total"), 2)}</td>
                <td style={{ ...td, fontWeight: 600 }}>R$ {fmtNum(soma("reserva"), 2)}</td>
                <td style={td} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 11.5, color: tema.faint, marginTop: 10, lineHeight: 1.55 }}>
        Quantidade = valor ÷ fechamento, arredondada para baixo no lote. A
        corretora costuma reservar quantidade × preço da ordem até o leilão; o
        que sobra volta depois da execução.
      </div>
    </section>
  );
}
