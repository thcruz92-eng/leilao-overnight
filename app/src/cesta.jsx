/* Vigências da cesta do Overnight padrão: cada versão vale para as compras
   a partir de uma data, então trocar os papéis não reescreve as noites
   passadas. */
import { useState } from "react";
import { Chip } from "./componentes.jsx";
import { estiloBotao, estiloInput, fmtData, tema } from "./tema.js";

const isoDe = (ts) => new Date(ts).toISOString().slice(0, 10);
const tsDe = (iso) => {
  let [y, m, d] = String(iso).split("-").map(Number);
  return y && m && d ? Date.UTC(y, m - 1, d) : null;
};
const DIA = 86400000;

/* versoes: [{ desde, itens }] em ordem; sel: índice editado;
   padraoNova: data sugerida para uma vigência nova (próximo pregão) */
export function VigenciasCesta({
  versoes,
  sel,
  onSel,
  onCriar,
  onData,
  onApagar,
  padraoNova,
}) {
  let [criando, setCriando] = useState(false),
    [dataNova, setDataNova] = useState(""),
    [erro, setErro] = useState(null),
    v = versoes[sel],
    anterior = versoes[sel - 1],
    proxima = versoes[sel + 1],
    ultima = sel === versoes.length - 1,
    fim = (i) =>
      versoes[i + 1] ? fmtData(versoes[i + 1].desde - DIA) : "hoje",
    inicio = (i) =>
      versoes[i].desde == null ? "início" : fmtData(versoes[i].desde),
    nAtivos = (x) => x.itens.filter((it) => it.valor > 0).length;

  const criar = () => {
    let ts = tsDe(dataNova || isoDe(padraoNova));
    if (ts == null) return setErro("Escolha a data.");
    if (versoes.some((x) => x.desde === ts))
      return setErro("Já existe uma vigência começando nessa data.");
    setErro(null);
    setCriando(false);
    setDataNova("");
    onCriar(ts);
  };
  const mudarData = (iso) => {
    let ts = tsDe(iso);
    if (ts == null) return;
    if (anterior && (anterior.desde ?? -1 / 0) >= ts)
      return setErro(
        `A data precisa ser depois do início da vigência anterior (${inicio(sel - 1)}).`,
      );
    if (proxima && ts >= proxima.desde)
      return setErro(
        `A data precisa ser antes do início da vigência seguinte (${fmtData(proxima.desde)}).`,
      );
    setErro(null);
    onData(sel, ts);
  };

  return (
    <div
      style={{
        background: tema.panelSoft,
        border: `1px solid ${tema.lineSoft}`,
        borderRadius: tema.raioP,
        padding: "12px 14px",
        marginBottom: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            color: tema.faint,
            marginRight: 4,
          }}
        >
          Vigências
        </span>
        {versoes.map((x, i) => (
          <Chip key={i} active={i === sel} onClick={() => (setErro(null), onSel(i))}>
            {inicio(i)} → {fim(i)} · {nAtivos(x)} {nAtivos(x) === 1 ? "ativo" : "ativos"}
          </Chip>
        ))}
        {!criando && (
          <button
            onClick={() => (setErro(null), setCriando(true))}
            style={{
              ...estiloBotao,
              padding: "5px 12px",
              fontSize: 12,
              color: tema.amber,
              borderColor: "rgba(244,183,64,.45)",
              background: tema.amberSoft,
            }}
            title="a cesta nova vale só para as compras a partir da data escolhida"
          >
            + nova vigência
          </button>
        )}
      </div>

      {criando && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 12.5,
            color: tema.dim,
          }}
        >
          Nova cesta valendo para as compras a partir de
          <input
            type="date"
            value={dataNova || isoDe(padraoNova)}
            onChange={(e) => setDataNova(e.target.value)}
            style={{ ...estiloInput, padding: "4px 8px" }}
          />
          <button
            onClick={criar}
            style={{
              ...estiloBotao,
              padding: "5px 12px",
              fontSize: 12,
              color: tema.up,
              borderColor: tema.up,
            }}
          >
            criar
          </button>
          <button
            onClick={() => (setCriando(false), setErro(null))}
            style={{ ...estiloBotao, padding: "5px 12px", fontSize: 12, color: tema.faint }}
          >
            cancelar
          </button>
          <span style={{ flexBasis: "100%", fontSize: 11.5, color: tema.faint }}>
            Ela começa com os mesmos papéis e valores da cesta que vale nessa
            data; depois é só trocar abaixo. As noites compradas antes ficam
            como estão.
          </span>
        </div>
      )}

      {v && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            fontSize: 12.5,
            color: tema.dim,
          }}
        >
          <span>
            Editando a cesta das compras de <b style={{ color: tema.text }}>{inicio(sel)}</b>{" "}
            até <b style={{ color: tema.text }}>{fim(sel)}</b>.
          </span>
          {sel > 0 && (
            <>
              <span style={{ color: tema.faint }}>começa em</span>
              <input
                type="date"
                value={isoDe(v.desde)}
                onChange={(e) => mudarData(e.target.value)}
                style={{ ...estiloInput, padding: "3px 8px" }}
              />
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Apagar a vigência que começa em ${fmtData(v.desde)}? As noites dela passam a usar a cesta anterior.`,
                    )
                  )
                    (setErro(null), onApagar(sel));
                }}
                style={{ ...estiloBotao, padding: "4px 10px", fontSize: 11.5, color: tema.down }}
              >
                apagar vigência
              </button>
            </>
          )}
        </div>
      )}
      {!ultima && (
        <div style={{ fontSize: 11.5, color: tema.amber }}>
          Esta é uma vigência passada: mexer nela muda o histórico dessas noites.
        </div>
      )}
      {erro && <div style={{ fontSize: 11.5, color: tema.down }}>{erro}</div>}
    </div>
  );
}
