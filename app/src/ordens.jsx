/* OPERAR: as ordens do leilão de fechamento, uma linha por papel, prontas
   para digitar na corretora — quantidade em lotes e preço da ordem limitada
   um pouco acima do fechamento, para garantir a execução no leilão. */
import { useState } from "react";
import { estiloBotao, fmtNum, numBR, tema } from "./tema.js";

export const FOLGA_ORDEM = 0.05;

/* preço da ordem: fechamento + folga, arredondado para cima no centavo */
export const precoDaOrdem = (preco, folga = FOLGA_ORDEM) =>
  Math.ceil(preco * (1 + folga) * 100 - 1e-6) / 100;

/* Desenha as ordens num PNG (canvas) e baixa. */
export function baixarOrdensPNG(rows, { titulo, subtitulo, arquivo }) {
  let cols = [
      { t: "PAPEL", w: 110, a: "left", v: (r) => r.ativo, f: "700 17px" },
      { t: "FECHAMENTO", w: 130, a: "right", v: (r) => (r.preco > 0 ? "R$ " + numBR(r.preco) : "—") },
      { t: "QUANTIDADE", w: 130, a: "right", v: (r) => (r.qtd > 0 ? fmtNum(r.qtd) : "—"), f: "700 17px" },
      { t: "PREÇO DA ORDEM", w: 160, a: "right", v: (r) => (r.ordem ? "R$ " + numBR(r.ordem) : "—"), f: "700 17px", c: tema.up },
      { t: "VALOR", w: 140, a: "right", v: (r) => "R$ " + fmtNum(r.valor) },
      { t: "DE ONDE VEM", w: 300, a: "left", v: (r) => r.origens.map((o) => o.nome).join(" + ") + (r.reforco ? " · ★ MIX também apontou" : ""), f: "400 13px", c: tema.dim },
    ],
    pad = 28,
    lh = 44,
    W = pad * 2 + cols.reduce((s, c) => s + c.w, 0) + 20 * (cols.length - 1),
    H = pad + 64 + 34 + lh * rows.length + 56,
    esc = 2,
    cv = document.createElement("canvas");
  cv.width = W * esc;
  cv.height = H * esc;
  let g = cv.getContext("2d"),
    sans = "Inter, 'Segoe UI', system-ui, sans-serif",
    mono = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
  g.scale(esc, esc);
  g.fillStyle = tema.bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = tema.up;
  g.font = `600 12px ${sans}`;
  g.fillText(titulo.toUpperCase(), pad, pad + 10);
  g.fillStyle = tema.dim;
  g.font = `400 13px ${sans}`;
  g.fillText(subtitulo, pad, pad + 32);
  let y = pad + 78,
    xs = [],
    x = pad;
  for (let c of cols) (xs.push(x), (x += c.w + 20));
  g.font = `600 11px ${sans}`;
  g.fillStyle = tema.faint;
  cols.forEach((c, i) => {
    g.textAlign = c.a;
    g.fillText(c.t, c.a === "right" ? xs[i] + c.w : xs[i], y);
  });
  y += 14;
  for (let r of rows) {
    g.strokeStyle = tema.line;
    g.beginPath();
    g.moveTo(pad, y);
    g.lineTo(W - pad, y);
    g.stroke();
    let base = y + lh / 2 + 6;
    cols.forEach((c, i) => {
      g.textAlign = c.a;
      g.fillStyle = c.c || tema.text;
      g.font = `${c.f || "400 15px"} ${c.f && c.f.endsWith("13px") ? sans : i === 0 ? mono : mono}`;
      g.fillText(c.v(r), c.a === "right" ? xs[i] + c.w : xs[i], base);
    });
    y += lh;
  }
  g.strokeStyle = tema.line;
  g.beginPath();
  g.moveTo(pad, y);
  g.lineTo(W - pad, y);
  g.stroke();
  g.textAlign = "left";
  g.fillStyle = tema.faint;
  g.font = `400 12px ${sans}`;
  g.fillText(
    `Preço da ordem = fechamento + ${fmtNum(FOLGA_ORDEM * 100)}% (ordem limitada de compra no leilão de fechamento) · Leilão Overnight`,
    pad,
    y + 30,
  );
  let a = document.createElement("a");
  a.download = `${arquivo}.png`;
  a.href = cv.toDataURL("image/png");
  a.click();
}

/* linhas: [{ ativo, preco, lote, provisorio, origens: [{ id, nome, cor, valor }] }]
   onImagem(rows): chamado depois de baixar a imagem (lança em Entradas reais) */
export function OrdensLeilao({ linhas, dataTxt, dataIso, provisorio, onImagem }) {
  let [copiado, setCopiado] = useState(false),
    [aviso, setAviso] = useState(null),
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

  const imagem = () => {
    let validas = rows.filter((r) => r.qtd > 0);
    if (!validas.length) return;
    baixarOrdensPNG(validas, {
      titulo: `Ordens do leilão de fechamento · ${dataTxt}`,
      subtitulo: `${validas.length} ${validas.length === 1 ? "papel" : "papéis"} · total R$ ${fmtNum(validas.reduce((s, r) => s + r.total, 0), 2)} no fechamento${provisorio ? " (provisório)" : ""}`,
      arquivo: `ordens_leilao_${dataIso}`,
    });
    let n = onImagem ? onImagem(validas) : 0;
    setAviso(
      n > 0
        ? `✓ imagem baixada · ${n} ${n === 1 ? "papel lançado" : "papéis lançados"} em RESULTADOS → Entradas reais`
        : "✓ imagem baixada",
    );
    setTimeout(() => setAviso(null), 6000);
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={imagem}
            style={{
              ...estiloBotao,
              padding: "5px 12px",
              fontSize: 12,
              color: tema.amber,
              borderColor: "rgba(244,183,64,.45)",
              background: tema.amberSoft,
            }}
            title="baixa as ordens em PNG e lança todos os papéis como ★ acompanhar em RESULTADOS, no grupo Entradas reais"
          >
            ⬇ imagem
          </button>
          <button
            onClick={copiar}
            style={{ ...estiloBotao, padding: "5px 12px", fontSize: 12, color: copiado ? tema.up : tema.dim }}
            title="copia papel, quantidade e preço da ordem (separados por tabulação)"
          >
            {copiado ? "✓ copiado" : "copiar ordens"}
          </button>
          </div>
        )}
      </div>
      {aviso && (
        <div style={{ fontSize: 12, color: tema.up, margin: "6px 0 2px" }}>{aviso}</div>
      )}
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
                    {r.reforco && (
                      <div style={{ color: tema.up, fontSize: 11.5, marginBottom: 3 }}>★ {r.reforco}</div>
                    )}
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
