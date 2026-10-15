/* Tela RESULTADOS: acompanhamento das operações e relatório de IR. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import * as XLSX from "xlsx";
import { Campo, Chip, SeletorPeriodo } from "./componentes.jsx";
import { LOTE_PADRAO } from "./estrategias.js";
import {
  PREMISSAS_IR,
  TIPOS_FISCAIS,
  explicarMes,
  fimDoMes,
  inicioDoMes,
  nomeArquivoIR,
  nomeMes,
  nomeMesCurto,
  operacoesDoGrupo,
  planilhaIR,
  relatorioIR,
  tipoFiscal,
} from "./ir.js";
import {
  anoMes,
  corDoGrupo,
  corDoValor,
  estiloBotao,
  estiloInput,
  fmtData,
  fmtNum,
  fmtReais,
  numBR,
  tema,
} from "./tema.js";

function CampoReais({
  valor: e,
  onCommit: t,
  placeholder: r,
  largura: n = 118,
  rotulo: a,
}) {
  let [o, i] = useState(e != null ? String(e).replace(".", ",") : "");
  return (
    useEffect(() => {
      i(e != null ? String(e).replace(".", ",") : "");
    }, [e]),
    (
      <input
        type="text"
        inputMode="decimal"
        value={o}
        placeholder={r}
        aria-label={a}
        onChange={(l) => i(l.target.value)}
        onBlur={() => {
          let l = o.trim().replace(/\s|R\$/g, "");
          if (l === "") {
            e != null && t(null);
            return;
          }
          let c = parseFloat(
            l.includes(",") ? l.replace(/\./g, "").replace(",", ".") : l,
          );
          if (Number.isFinite(c) && c >= 0) {
            let u = Math.round(c * 100) / 100;
            u !== e && t(u);
          } else i(e != null ? String(e).replace(".", ",") : "");
        }}
        onKeyDown={(l) => {
          l.key === "Enter" && l.currentTarget.blur();
        }}
        style={{
          ...estiloInput,
          width: n,
          minWidth: 0,
          textAlign: "right",
          padding: "5px 8px",
          fontSize: 12.5,
        }}
      />
    )
  );
}

function LinhaRelatorio({ rot: e, val: t, cor: r, nota: n, forte: a }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "5px 0",
        borderBottom: `1px dashed ${tema.line}`,
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: tema.dim,
        }}
      >
        {e}
        {n && (
          <span
            style={{
              display: "block",
              fontSize: 10.5,
              color: tema.faint,
              marginTop: 1,
            }}
          >
            {n}
          </span>
        )}
      </span>
      <span
        style={{
          fontFamily: tema.mono,
          fontSize: a ? 13.5 : 12.5,
          color: r || tema.text,
          fontWeight: a ? 650 : 400,
          whiteSpace: "nowrap",
        }}
      >
        {t}
      </span>
    </div>
  );
}

function MesIR({ m: e }) {
  let [t, r] = useState(false);
  if (e.semHistorico)
    return (
      <div
        style={{
          border: `1px solid ${tema.line}`,
          borderRadius: 8,
          padding: "12px 14px",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 13.5,
          }}
        >
          {nomeMes(e.ym)}
        </div>
        <div
          style={{
            fontSize: 12,
            color: tema.faint,
            marginTop: 4,
          }}
        >
          Nenhuma operação deste grupo até aqui.
        </div>
      </div>
    );
  let n = async () => {
      try {
        (await navigator.clipboard.writeText(fmtNum(e.darf.valor, 2)),
          r(true),
          setTimeout(() => r(false), 1600));
      } catch {}
    },
    a = e.resDT !== 0 || e.prejDTAnt > 0,
    o = e.resFII !== 0 || e.prejFIIAnt > 0,
    i = e.prejComumFim + e.prejDTFim + e.prejFIIFim;
  return (
    <div
      style={{
        border: `1px solid ${e.darf ? tema.amber : tema.line}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "11px 14px",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          background: e.darf ? tema.amberSoft : "transparent",
        }}
      >
        <span
          style={{
            fontWeight: 650,
            fontSize: 14,
          }}
        >
          {nomeMes(e.ym)}
        </span>
        {e.darf ? (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: tema.mono,
                fontSize: 11,
                color: tema.dim,
              }}
            >
              {"DARF 6015 · apuração "}
              {fmtData(e.darf.periodo)}
              {" · vence "}
              {fmtData(e.darf.vencimento)}
            </span>
            <b
              style={{
                fontFamily: tema.mono,
                fontSize: 16,
                color: tema.amber,
              }}
            >
              {fmtReais(e.darf.valor)}
            </b>
            <button
              onClick={n}
              style={{
                ...estiloBotao,
                padding: "3px 9px",
                fontSize: 11,
                color: tema.dim,
              }}
              title="copia o valor para colar no Sicalc"
            >
              {t ? "copiado ✓" : "copiar valor"}
            </button>
          </span>
        ) : (
          <span
            style={{
              fontSize: 12,
              color: tema.faint,
            }}
          >
            {"Sem DARF — "}
            {explicarMes(e)}
          </span>
        )}
      </div>
      {!e.vazio && (
        <div
          style={{
            padding: "4px 14px 10px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            columnGap: 28,
          }}
        >
          <div>
            <LinhaRelatorio
              rot="Vendas de ações (operações comuns)"
              val={fmtReais(e.vendasAcoes)}
              nota={
                e.isento
                  ? "até R$ 20 mil no mês: ganho em ações é isento"
                  : "acima de R$ 20 mil no mês: sem isenção"
              }
            />
            <LinhaRelatorio
              rot="Resultado das operações comuns"
              val={fmtReais(e.resAcoes + e.resOutros)}
              cor={corDoValor(e.resAcoes + e.resOutros)}
              nota={
                e.ganhoIsento > 0
                  ? `${fmtReais(e.ganhoIsento)} isento — vai para Rendimentos Isentos`
                  : null
              }
            />
            {(e.prejComumAnt > 0 || e.compComum > 0) && (
              <LinhaRelatorio
                rot="Prejuízo de meses anteriores"
                val={fmtReais(e.prejComumAnt)}
                nota={`compensado neste mês: ${fmtReais(e.compComum)}`}
              />
            )}
            <LinhaRelatorio
              rot="Base de cálculo × 15%"
              val={`${fmtReais(e.baseComum)} → ${fmtReais(e.irComum)}`}
            />
            {a && (
              <LinhaRelatorio
                rot="Day trade: resultado · base × 20%"
                val={`${fmtReais(e.resDT)} · ${fmtReais(e.baseDT)} → ${fmtReais(e.irDT)}`}
                cor={corDoValor(e.resDT)}
              />
            )}
            {o && (
              <LinhaRelatorio
                rot="FII: resultado · base × 20%"
                val={`${fmtReais(e.resFII)} · ${fmtReais(e.baseFII)} → ${fmtReais(e.irFII)}`}
                cor={corDoValor(e.resFII)}
              />
            )}
          </div>
          <div>
            <LinhaRelatorio rot="IR devido no mês" val={fmtReais(e.irDevido)} />
            <LinhaRelatorio
              rot="IRRF abatido"
              val={fmtReais(e.irrfUsado)}
              nota={`${e.irrfInformado != null ? "informado das notas" : "estimado: 0,005% das vendas comuns"}${e.irrfSaldoFim > 0 ? ` · sobra ${fmtReais(e.irrfSaldoFim)} para os meses seguintes` : ""}`}
            />
            {e.acumAnt > 0 && (
              <LinhaRelatorio
                rot="Vindo de meses anteriores (abaixo de R$ 10)"
                val={fmtReais(e.acumAnt)}
              />
            )}
            <LinhaRelatorio
              rot="Imposto a pagar"
              val={fmtReais(e.valorDarf)}
              forte={true}
              cor={e.darf ? tema.amber : tema.text}
              nota={
                !e.darf && e.acumFim > 0
                  ? "abaixo de R$ 10: passa para o mês seguinte"
                  : null
              }
            />
            {i > 0 && (
              <LinhaRelatorio
                rot="Prejuízo que fica para compensar"
                val={fmtReais(i)}
                nota={[
                  e.prejComumFim > 0 && `comum ${fmtReais(e.prejComumFim)}`,
                  e.prejDTFim > 0 && `day trade ${fmtReais(e.prejDTFim)}`,
                  e.prejFIIFim > 0 && `FII ${fmtReais(e.prejFIIFim)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
            {e.irrfSobraAno && (
              <LinhaRelatorio
                rot={`IRRF de ${e.irrfSobraAno.ano} que sobrou`}
                val={fmtReais(e.irrfSobraAno.valor)}
                nota="não passa de ano: compense na declaração anual"
              />
            )}
          </div>
        </div>
      )}
      {e.vazio && (
        <div
          style={{
            padding: "8px 14px 12px",
            fontSize: 12,
            color: tema.faint,
          }}
        >
          Sem vendas neste mês.
          {e.acumFim > 0
            ? ` ${fmtReais(e.acumFim)} abaixo do mínimo seguem para o próximo DARF.`
            : ""}
          {i > 0 ? ` Prejuízo a compensar: ${fmtReais(i)}.` : ""}
        </div>
      )}
    </div>
  );
}

function ImpressaoIR({ rel: e }) {
  let t = e.meses.filter((s) => !s.semHistorico),
    r = {
      border: "1px solid #999",
      padding: "3px 5px",
      background: "#eee",
      textAlign: "left",
      fontWeight: 600,
    },
    n = {
      border: "1px solid #bbb",
      padding: "3px 5px",
    },
    a = {
      ...n,
      textAlign: "right",
      whiteSpace: "nowrap",
    },
    o = [
      ["Vendas de ações — operações comuns", (s) => fmtReais(s.vendasAcoes)],
      [
        "Isenção de R$ 20 mil",
        (s) => (s.vazio ? "—" : s.isento ? "sim" : "não"),
      ],
      [
        "Resultado — operações comuns",
        (s) => fmtReais(s.resAcoes + s.resOutros),
      ],
      ["Ganho isento", (s) => fmtReais(s.ganhoIsento)],
      [
        "Prejuízo comum anterior / compensado",
        (s) => `${fmtReais(s.prejComumAnt)} / ${fmtReais(s.compComum)}`,
      ],
      [
        "Base comum → IR 15%",
        (s) => `${fmtReais(s.baseComum)} → ${fmtReais(s.irComum)}`,
      ],
      [
        "Day trade: resultado → IR 20%",
        (s) => `${fmtReais(s.resDT)} → ${fmtReais(s.irDT)}`,
      ],
      [
        "FII: resultado → IR 20%",
        (s) => `${fmtReais(s.resFII)} → ${fmtReais(s.irFII)}`,
      ],
      ["IR devido", (s) => fmtReais(s.irDevido)],
      [
        "IRRF abatido",
        (s) =>
          `${fmtReais(s.irrfUsado)}${s.irrfInformado != null ? " (notas)" : " (estimado)"}`,
      ],
      ["Vindo de meses anteriores (< R$ 10)", (s) => fmtReais(s.acumAnt)],
      ["Imposto a pagar", (s) => fmtReais(s.valorDarf)],
      [
        "Prejuízo a compensar no fim (comum / DT / FII)",
        (s) =>
          `${fmtReais(s.prejComumFim)} / ${fmtReais(s.prejDTFim)} / ${fmtReais(s.prejFIIFim)}`,
      ],
      [
        "Custos usados",
        (s) =>
          s.vazio
            ? "—"
            : s.custosInformados != null
              ? `notas ${fmtReais(s.custosInformados)}`
              : `estimados ${fmtReais(s.custosEstimados)}`,
      ],
    ],
    i = (s) => e.opsPeriodo.reduce((l, c) => l + (c[s] || 0), 0);
  return (
    <div
      className="so-impressao"
      style={{
        color: "#000",
        background: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "9.5pt",
        lineHeight: 1.35,
      }}
    >
      <div
        style={{
          fontSize: "14pt",
          fontWeight: 700,
        }}
      >
        Relatório de operações para IR (DARF)
      </div>
      <div
        style={{
          margin: "2px 0 8px",
        }}
      >
        {"Leilão Overnight · grupo "}
        <b>{e.grupo?.nome}</b>
        {" · vendas de "}
        {fmtData(e.de)}
        {" a "}
        {fmtData(e.ate)}
        {" · gerado em"}{" "}
        {new Date(e.geradoEm).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })}
      </div>
      <div
        style={{
          marginBottom: 8,
          color: "#333",
        }}
      >
        {
          "Preços do COTAHIST (B3): compra no fechamento do pregão da compra, venda na abertura do pregão seguinte. A operação conta no mês da venda. Custos: "
        }
        {t.some((s) => s.custosInformados != null)
          ? "total das notas quando informado; nos demais meses, "
          : ""}
        {"taxa de "}
        {numBR(e.feePct || 0, 3)}% por operação (compra + venda).
      </div>
      <div
        style={{
          fontWeight: 700,
          margin: "6px 0 3px",
        }}
      >
        DARF — código 6015
      </div>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          marginBottom: 8,
        }}
      >
        <thead>
          <tr>
            <th style={r}>Mês</th>
            <th style={r}>Período de apuração</th>
            <th style={r}>Vencimento</th>
            <th style={r}>Valor</th>
            <th style={r}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {t.map((s) => (
            <tr key={s.ym}>
              <td style={n}>{nomeMes(s.ym)}</td>
              <td style={n}>{fmtData(fimDoMes(s.ym))}</td>
              <td style={n}>{s.darf ? fmtData(s.darf.vencimento) : "—"}</td>
              <td style={a}>{s.darf ? fmtReais(s.darf.valor) : "—"}</td>
              <td style={n}>{s.darf ? "emitir DARF" : explicarMes(s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {t.length > 0 && (
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            marginBottom: 8,
          }}
        >
          <thead>
            <tr>
              <th style={r}>Apuração</th>
              {t.map((s) => (
                <th
                  key={s.ym}
                  style={{
                    ...r,
                    textAlign: "right",
                  }}
                >
                  {nomeMesCurto(s.ym)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {o.map(([s, l]) => (
              <tr key={s}>
                <td style={n}>{s}</td>
                {t.map((c) => (
                  <td key={c.ym} style={a}>
                    {l(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div
        style={{
          fontWeight: 700,
          margin: "6px 0 3px",
        }}
      >
        Operações vendidas no período ({e.opsPeriodo.length})
      </div>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          fontSize: "8.5pt",
        }}
      >
        <thead>
          <tr>
            {[
              "Compra",
              "Venda",
              "Ativo",
              "Tipo",
              "Qtd",
              "Preço compra",
              "Valor compra",
              "Preço venda",
              "Valor venda",
              "Custos",
              "Resultado",
              "Obs.",
            ].map((s) => (
              <th key={s} style={r}>
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {e.opsPeriodo.map((s) => (
            <tr key={s.id}>
              <td style={n}>{fmtData(s.tsCompra)}</td>
              <td style={n}>{fmtData(s.tsVenda)}</td>
              <td style={n}>{s.ativo}</td>
              <td style={n}>{TIPOS_FISCAIS[e.tipoDe(s.ativo)]}</td>
              <td style={a}>{fmtNum(s.qtd)}</td>
              <td style={a}>{numBR(s.pxCompra, 2)}</td>
              <td style={a}>{fmtNum(s.valorCompra, 2)}</td>
              <td style={a}>{numBR(s.pxVenda, 2)}</td>
              <td style={a}>{fmtNum(s.valorVenda, 2)}</td>
              <td style={a}>{fmtNum(s.custo, 2)}</td>
              <td style={a}>{fmtNum(s.resultado, 2)}</td>
              <td
                style={{
                  ...n,
                  whiteSpace: "nowrap",
                }}
              >
                {[
                  e.dtNoDia.has(`${s.ativo}|${s.tsVenda}`) ||
                  e.dtNoDia.has(`${s.ativo}|${s.tsCompra}`)
                    ? "day trade"
                    : null,
                  s.provisorio ? "provisório" : null,
                  s.eventoSoc ? "evento?" : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </td>
            </tr>
          ))}
          <tr>
            <td
              style={{
                ...n,
                fontWeight: 700,
              }}
              colSpan={4}
            >
              Total
            </td>
            <td style={a}>{fmtNum(i("qtd"))}</td>
            <td style={n} />
            <td style={a}>{fmtNum(i("valorCompra"), 2)}</td>
            <td style={n} />
            <td style={a}>{fmtNum(i("valorVenda"), 2)}</td>
            <td style={a}>{fmtNum(i("custo"), 2)}</td>
            <td
              style={{
                ...a,
                fontWeight: 700,
              }}
            >
              {fmtNum(i("resultado"), 2)}
            </td>
            <td style={n} />
          </tr>
        </tbody>
      </table>
      {e.vendeDepois.length > 0 && (
        <div
          style={{
            marginTop: 6,
          }}
        >
          Comprado no período e vendido depois (entra no mês da venda):{" "}
          {e.vendeDepois
            .map(
              (s) =>
                `${s.ativo} ${fmtData(s.tsCompra)} (${fmtNum(s.qtd)} ações)`,
            )
            .join("; ")}
          .
        </div>
      )}
      {e.eventosPeriodo.some((s) => s.dt) && (
        <div
          style={{
            marginTop: 6,
          }}
        >
          Day trade no período:{" "}
          {e.eventosPeriodo
            .filter((s) => s.dt)
            .map(
              (s) => `${s.ativo} ${fmtData(s.ts)} (${fmtReais(s.resultado)})`,
            )
            .join("; ")}
          .
        </div>
      )}
      <div
        style={{
          fontWeight: 700,
          margin: "10px 0 3px",
        }}
      >
        Premissas
      </div>
      <ol
        style={{
          margin: 0,
          paddingLeft: 16,
        }}
      >
        {PREMISSAS_IR.map((s) => (
          <li
            key={s}
            style={{
              marginBottom: 2,
            }}
          >
            {s.replace(/^\d+\.\s*/, "")}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Resultados({
  ds: e,
  itens: t,
  grupos: r,
  feePct: n,
  lotes: a,
  tiposIR: o,
  onTipo: i,
  ajustes: s,
  onAjuste: l,
  nOrganizar: c,
  pedido: u,
}) {
  let f = useCallback((te) => (a && a[te] > 0 ? a[te] : LOTE_PADRAO), [a]),
    p = useCallback((te) => (o && o[te]) || tipoFiscal(te).tipo, [o]),
    [h, g] = useState(null),
    [m, x] = useState(null),
    [y, b] = useState(null),
    [S, T] = useState(false),
    [A, w] = useState(false),
    [_, E] = useState(0),
    [P, O] = useState(null),
    R = useRef(null),
    M = useMemo(() => {
      let te = new Map();
      for (let Ae of r)
        te.set(
          Ae.id,
          operacoesDoGrupo(
            t.filter((fe) => fe.grupoId === Ae.id),
            e,
            n,
            f,
          ),
        );
      return te;
    }, [r, t, e, n, f]),
    H = (te) => (M.get(te.id) || []).length,
    Y =
      r.find((te) => te.tipo === "reais" && H(te) > 0) ||
      r.find((te) => H(te) > 0) ||
      r[0] ||
      null,
    G = r.find((te) => te.id === h) || Y,
    k = (G && M.get(G.id)) || [],
    F = useMemo(() => {
      let te = new Set();
      for (let Ae of k)
        (Ae.status === "fechada" || Ae.status === "aberta") &&
          te.add(anoMes(Ae.tsVenda ?? Ae.tsCompra));
      return Array.from(te).sort((Ae, fe) => fe - Ae);
    }, [k]),
    q = Array.from(new Set(F.map((te) => Math.floor(te / 100)))).sort(
      (te, Ae) => Ae - te,
    ),
    N =
      F[0] ??
      anoMes(e?.dates?.length ? e.dates[e.dates.length - 1] : Date.now()),
    j = m ?? inicioDoMes(N),
    I = y ?? fimDoMes(N);
  useEffect(() => {
    if (!u) return;
    (g(u.gid), x(null), b(null), O(null));
    let te = setTimeout(() => {
      let Ae = R.current;
      Ae &&
        Ae.scrollIntoView &&
        Ae.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 40);
    return () => clearTimeout(te);
  }, [u]);
  let C = useMemo(
    () =>
      G
        ? relatorioIR({
            ops: k,
            grupo: G,
            ds: e,
            feePct: n,
            tipoDe: p,
            ajusteDoMes: (te) => (s && s[`${G.id}|${te}`]) || null,
            inicial: (s && s[`${G.id}|inicio`]) || null,
            de: j,
            ate: I,
            nOrganizar: c,
            tiposInformados: o || {},
          })
        : null,
    [k, G, e, n, p, s, j, I, c, o],
  );
  useEffect(() => {
    if (!_ || typeof document > "u") return;
    let te = document.body;
    te.classList.add("imprimindo-ir");
    let Ae = () => te.classList.remove("imprimindo-ir");
    window.addEventListener("afterprint", Ae, {
      once: true,
    });
    let fe = setTimeout(() => {
      try {
        window.print();
      } catch {
        (Ae(), O("Este navegador não abriu a impressão."));
      }
    }, 80);
    return () => clearTimeout(fe);
  }, [_]);
  let L = () => {
      if (C)
        try {
          (XLSX.writeFile(planilhaIR(C), nomeArquivoIR(C) + ".xlsx"),
            O(
              `Planilha gerada: ${C.opsPeriodo.length} ${C.opsPeriodo.length === 1 ? "operação" : "operações"}, ${C.meses.length} ${C.meses.length === 1 ? "mês" : "meses"}.`,
            ));
        } catch (te) {
          O("Falha ao gerar a planilha: " + (te?.message ?? "erro"));
        }
    },
    B = (te) => {
      (x(inicioDoMes(te)), b(fimDoMes(te)), O(null));
    },
    W = (te) => {
      (x(Date.UTC(te, 0, 1)), b(Date.UTC(te, 11, 31)), O(null));
    },
    J = (te) => j === inicioDoMes(te) && I === fimDoMes(te),
    ie = (te) => j === Date.UTC(te, 0, 1) && I === Date.UTC(te, 11, 31),
    ce = {
      padding: "7px 9px",
      textAlign: "right",
      borderBottom: `1px solid ${tema.line}`,
      whiteSpace: "nowrap",
    },
    X = {
      padding: "6px 9px",
      textAlign: "right",
      whiteSpace: "nowrap",
    },
    se = (te) => {
      let Ae = [];
      return (
        C &&
          (C.dtNoDia.has(`${te.ativo}|${te.tsVenda}`) ||
            C.dtNoDia.has(`${te.ativo}|${te.tsCompra}`)) &&
          Ae.push(
            <span
              key={"dt"}
              style={{
                color: tema.amber,
              }}
            >
              day trade
            </span>,
          ),
        te.eventoSoc &&
          Ae.push(
            <span
              key={"ev"}
              style={{
                color: tema.down,
              }}
            >
              evento?
            </span>,
          ),
        Ae.push(
          te.provisorio ? (
            <span
              key={"f"}
              style={{
                color: tema.amber,
              }}
            >
              ⏳ provisório
            </span>
          ) : (
            <span
              key={"f"}
              style={{
                color: tema.up,
              }}
            >
              ✓ COTAHIST
            </span>
          ),
        ),
        Ae.reduce(
          (fe, xe, Ge) =>
            Ge
              ? [
                  ...fe,
                  <span
                    key={"s" + Ge}
                    style={{
                      color: tema.faint,
                    }}
                  >
                    {" · "}
                  </span>,
                  xe,
                ]
              : [xe],
          [],
        )
      );
    },
    ge = (te) =>
      C ? C.opsPeriodo.reduce((Ae, fe) => Ae + (fe[te] || 0), 0) : 0,
    z = C ? C.meses.filter((te) => !te.semHistorico && !te.vazio) : [],
    Me = (G && s && s[`${G.id}|inicio`]) || {};
  return (
    <section
      id="relatorio-ir"
      ref={R}
      style={{
        background: tema.panel,
        border: `1px solid ${tema.line}`,
        borderRadius: 10,
        overflow: "hidden",
        scrollMarginTop: 12,
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: `1px solid ${tema.line}`,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            maxWidth: 720,
          }}
        >
          <div
            style={{
              fontWeight: 650,
              fontSize: 15,
            }}
          >
            Relatório de operações — IR e DARF
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: tema.dim,
              lineHeight: 1.65,
              marginTop: 4,
            }}
          >
            {
              "As compras marcadas em ★ acompanhar, grupo por grupo, com o preço oficial do COTAHIST: compra no fechamento do pregão da compra, venda na abertura do pregão seguinte. Cada operação conta no mês da "
            }
            <b
              style={{
                color: tema.text,
              }}
            >
              venda
            </b>
            {" — é o mês do DARF."}
          </div>
        </div>
        <button
          onClick={() => T((te) => !te)}
          aria-expanded={S}
          style={{
            ...estiloBotao,
            padding: "5px 11px",
            fontSize: 11.5,
            color: tema.dim,
          }}
        >
          {S ? "▾" : "▸"}
          {" como o app calcula"}
        </button>
      </div>
      {S && (
        <div
          style={{
            padding: "12px 18px",
            borderBottom: `1px solid ${tema.line}`,
            background: tema.panelSoft,
          }}
        >
          <ol
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12.2,
              color: tema.dim,
              lineHeight: 1.65,
            }}
          >
            {PREMISSAS_IR.map((te) => (
              <li
                key={te}
                style={{
                  marginBottom: 4,
                }}
              >
                {te.replace(/^\d+\.\s*/, "")}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div
        style={{
          padding: "12px 18px",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "flex-end",
          borderBottom: `1px solid ${tema.line}`,
        }}
      >
        <Campo label="Grupo">
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {r.map((te, Ae) => (
              <Chip
                key={te.id}
                active={G && te.id === G.id}
                onClick={() => {
                  (g(te.id), x(null), b(null), O(null));
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 8,
                    background: corDoGrupo(te, Ae),
                    marginRight: 6,
                  }}
                />
                {te.nome}{" "}
                <span
                  style={{
                    color: tema.faint,
                  }}
                >
                  {H(te)}
                </span>
              </Chip>
            ))}
          </div>
        </Campo>
        {F.length > 0 && (
          <Campo label="Mês da venda">
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {F.map((te) => (
                <Chip key={te} active={J(te)} onClick={() => B(te)}>
                  {nomeMesCurto(te)}
                </Chip>
              ))}
              {q.map((te) => (
                <Chip key={"a" + te} active={ie(te)} onClick={() => W(te)}>
                  {te}
                  {" inteiro"}
                </Chip>
              ))}
            </div>
          </Campo>
        )}
        {e?.dates?.length > 0 && (
          <SeletorPeriodo
            de={j}
            ate={I}
            onDe={(te) => {
              (x(te), O(null));
            }}
            onAte={(te) => {
              (b(te), O(null));
            }}
            dates={e.dates}
          />
        )}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginLeft: "auto",
          }}
        >
          <button
            onClick={L}
            disabled={!C}
            style={{
              ...estiloBotao,
              color: tema.amber,
              borderColor: tema.amber,
            }}
          >
            ⬇ Baixar Excel
          </button>
          <button
            onClick={() => {
              (O(null), E((te) => te + 1));
            }}
            disabled={!C}
            style={{
              ...estiloBotao,
              color: tema.dim,
            }}
          >
            🖨 Imprimir / PDF
          </button>
        </div>
      </div>
      {P && (
        <div
          style={{
            padding: "8px 18px 0",
            fontFamily: tema.mono,
            fontSize: 12,
            color: tema.dim,
          }}
        >
          {P}
        </div>
      )}
      {!C || k.length === 0 ? (
        <div
          style={{
            padding: "16px 18px",
            fontSize: 12.5,
            color: tema.faint,
          }}
        >
          Nenhuma compra neste grupo ainda. As compras entram aqui quando você
          marca ★ acompanhar e coloca o papel no grupo.
        </div>
      ) : (
        <div
          style={{
            padding: "12px 18px 16px",
            display: "grid",
            gap: 12,
            gridTemplateColumns: "minmax(0, 1fr)",
          }}
        >
          {C.avisos.length > 0 && (
            <div
              style={{
                display: "grid",
                gap: 5,
              }}
            >
              {C.avisos.map((te) => (
                <div
                  key={te.txt}
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: te.nivel === "alerta" ? tema.text : tema.dim,
                    borderLeft: `3px solid ${te.nivel === "alerta" ? tema.amber : tema.line}`,
                    padding: "3px 0 3px 10px",
                  }}
                >
                  {te.txt}
                </div>
              ))}
            </div>
          )}
          {C.meses.map((te) => (
            <MesIR key={te.ym} m={te} />
          ))}
          <div>
            <div
              style={{
                fontSize: 12.5,
                color: tema.dim,
                margin: "4px 0 6px",
              }}
            >
              <b
                style={{
                  color: tema.text,
                }}
              >
                {"Operações vendidas de "}
                {fmtData(C.de)}
                {" a "}
                {fmtData(C.ate)}
              </b>
              <span
                style={{
                  fontFamily: tema.mono,
                  color: tema.faint,
                }}
              >
                {" · "}
                {C.opsPeriodo.length}
              </span>
            </div>
            {C.opsPeriodo.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: tema.faint,
                }}
              >
                Nenhuma venda neste período.
              </div>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  border: `1px solid ${tema.line}`,
                  borderRadius: 8,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontFamily: tema.mono,
                    fontSize: 11.8,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        color: tema.faint,
                        fontSize: 10,
                        letterSpacing: 0.6,
                      }}
                    >
                      <th
                        style={{
                          ...ce,
                          textAlign: "left",
                        }}
                      >
                        COMPRA
                      </th>
                      <th
                        style={{
                          ...ce,
                          textAlign: "left",
                        }}
                      >
                        VENDA
                      </th>
                      <th
                        style={{
                          ...ce,
                          textAlign: "left",
                        }}
                      >
                        ATIVO
                      </th>
                      <th
                        style={{
                          ...ce,
                          textAlign: "left",
                        }}
                      >
                        TIPO
                      </th>
                      <th style={ce}>AÇÕES</th>
                      <th style={ce}>PREÇO COMPRA</th>
                      <th style={ce}>VALOR COMPRA</th>
                      <th style={ce}>PREÇO VENDA</th>
                      <th style={ce}>VALOR VENDA</th>
                      <th style={ce}>CUSTOS</th>
                      <th style={ce}>RESULTADO</th>
                      <th
                        style={{
                          ...ce,
                          textAlign: "left",
                        }}
                      >
                        FONTE
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {C.opsPeriodo.map((te) => (
                      <tr
                        key={te.id}
                        className="rowhover"
                        style={{
                          borderTop: `1px solid ${tema.line}`,
                        }}
                      >
                        <td
                          style={{
                            ...X,
                            textAlign: "left",
                          }}
                        >
                          {fmtData(te.tsCompra)}
                        </td>
                        <td
                          style={{
                            ...X,
                            textAlign: "left",
                          }}
                        >
                          {fmtData(te.tsVenda)}
                        </td>
                        <td
                          style={{
                            ...X,
                            textAlign: "left",
                            color: tema.text,
                          }}
                        >
                          {te.ativo}
                        </td>
                        <td
                          style={{
                            ...X,
                            textAlign: "left",
                            color: tema.faint,
                          }}
                        >
                          {TIPOS_FISCAIS[C.tipoDe(te.ativo)]}
                        </td>
                        <td style={X}>{fmtNum(te.qtd)}</td>
                        <td style={X}>{numBR(te.pxCompra, 2)}</td>
                        <td style={X}>{fmtNum(te.valorCompra, 2)}</td>
                        <td style={X}>{numBR(te.pxVenda, 2)}</td>
                        <td style={X}>{fmtNum(te.valorVenda, 2)}</td>
                        <td
                          style={{
                            ...X,
                            color: tema.faint,
                          }}
                        >
                          {fmtNum(te.custo, 2)}
                        </td>
                        <td
                          style={{
                            ...X,
                            color: corDoValor(te.resultado),
                          }}
                        >
                          {fmtNum(te.resultado, 2)}
                        </td>
                        <td
                          style={{
                            ...X,
                            textAlign: "left",
                            fontSize: 10.5,
                          }}
                        >
                          {se(te)}
                        </td>
                      </tr>
                    ))}
                    <tr
                      style={{
                        borderTop: `1px solid ${tema.line}`,
                        background: tema.panelSoft,
                      }}
                    >
                      <td
                        style={{
                          ...X,
                          textAlign: "left",
                          color: tema.text,
                        }}
                        colSpan={4}
                      >
                        Total
                      </td>
                      <td style={X}>{fmtNum(ge("qtd"))}</td>
                      <td style={X} />
                      <td style={X}>{fmtNum(ge("valorCompra"), 2)}</td>
                      <td style={X} />
                      <td style={X}>{fmtNum(ge("valorVenda"), 2)}</td>
                      <td
                        style={{
                          ...X,
                          color: tema.faint,
                        }}
                      >
                        {fmtNum(ge("custo"), 2)}
                      </td>
                      <td
                        style={{
                          ...X,
                          color: corDoValor(ge("resultado")),
                        }}
                      >
                        {fmtNum(ge("resultado"), 2)}
                      </td>
                      <td style={X} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {C.vendeDepois.length > 0 && (
              <div
                style={{
                  fontSize: 11.5,
                  color: tema.faint,
                  marginTop: 7,
                  lineHeight: 1.6,
                }}
              >
                Comprado no período e vendido depois — entra no mês da venda:{" "}
                <span
                  style={{
                    fontFamily: tema.mono,
                  }}
                >
                  {C.vendeDepois
                    .map((te) => `${te.ativo} ${fmtData(te.tsCompra)}`)
                    .join(" · ")}
                </span>
              </div>
            )}
          </div>
          <div
            style={{
              borderTop: `1px solid ${tema.line}`,
              paddingTop: 10,
            }}
          >
            <button
              onClick={() => w((te) => !te)}
              aria-expanded={A}
              style={{
                ...estiloBotao,
                padding: "5px 11px",
                fontSize: 11.5,
                color: tema.dim,
              }}
            >
              {A ? "▾" : "▸"}
              {" ajustes para o DARF"}
            </button>
            {A && (
              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gap: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: tema.text,
                      marginBottom: 4,
                    }}
                  >
                    Valores das notas de corretagem
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: tema.faint,
                      marginBottom: 8,
                      lineHeight: 1.55,
                    }}
                  >
                    Em branco, o app usa a estimativa (a taxa de CONFIGURAÇÕES e
                    0,005% das vendas). Preenchido, vale o número da nota:
                    custos = corretagem + emolumentos + liquidação de todas as
                    notas do mês.
                  </div>
                  {z.length === 0 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: tema.faint,
                      }}
                    >
                      Nenhum mês com operação no período.
                    </div>
                  )}
                  {z.map((te) => {
                    let Ae = `${G.id}|${te.ym}`,
                      fe = (s && s[Ae]) || {};
                    return (
                      <div
                        key={te.ym}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 12,
                          alignItems: "center",
                          padding: "4px 0",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: tema.mono,
                            fontSize: 12,
                            color: tema.dim,
                            width: 118,
                          }}
                        >
                          {nomeMes(te.ym)}
                        </span>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 11.5,
                            color: tema.faint,
                          }}
                        >
                          custos R$
                          <CampoReais
                            valor={fe.custos ?? null}
                            rotulo={`custos das notas em ${nomeMes(te.ym)}`}
                            placeholder={`≈ ${fmtNum(te.custosEstimados, 2)}`}
                            onCommit={(xe) =>
                              l(Ae, {
                                custos: xe,
                              })
                            }
                          />
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 11.5,
                            color: tema.faint,
                          }}
                        >
                          IRRF R$
                          <CampoReais
                            valor={fe.irrf ?? null}
                            rotulo={`IRRF das notas em ${nomeMes(te.ym)}`}
                            placeholder={`≈ ${fmtNum(te.irrfComumEst + te.irrfDTEst, 2)}`}
                            onCommit={(xe) =>
                              l(Ae, {
                                irrf: xe,
                              })
                            }
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: tema.text,
                      marginBottom: 4,
                    }}
                  >
                    Prejuízo a compensar de antes do app
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: tema.faint,
                      marginBottom: 8,
                      lineHeight: 1.55,
                    }}
                  >
                    Saldo que você já tinha declarado antes da primeira operação
                    deste grupo. Vale para o grupo inteiro, desde a primeira
                    venda.
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                    }}
                  >
                    {[
                      ["prejComum", "operações comuns"],
                      ["prejDt", "day trade"],
                      ["prejFii", "FII"],
                    ].map(([te, Ae]) => (
                      <label
                        key={te}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11.5,
                          color: tema.faint,
                        }}
                      >
                        {Ae}
                        {" R$"}
                        <CampoReais
                          valor={Me[te] ?? null}
                          rotulo={`prejuízo anterior — ${Ae}`}
                          placeholder="0,00"
                          onCommit={(fe) =>
                            l(`${G.id}|inicio`, {
                              [te]: fe,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
                {C.tickers.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: tema.text,
                        marginBottom: 4,
                      }}
                    >
                      Tipo de cada papel do período
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: tema.faint,
                        marginBottom: 8,
                        lineHeight: 1.55,
                      }}
                    >
                      Muda a alíquota e a isenção. O COTAHIST não separa unit de
                      empresa e cota de fundo terminadas em 11; o que o app
                      presumiu aparece marcado.
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px 18px",
                      }}
                    >
                      {C.tickers.map((te) => {
                        let Ae = tipoFiscal(te),
                          fe = o && o[te];
                        return (
                          <label
                            key={te}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontFamily: tema.mono,
                              fontSize: 12,
                              color: tema.dim,
                            }}
                          >
                            {te}
                            <select
                              value={fe || (Ae.presumido ? "" : Ae.tipo)}
                              onChange={(xe) =>
                                i(
                                  te,
                                  !Ae.presumido && xe.target.value === Ae.tipo
                                    ? null
                                    : xe.target.value,
                                )
                              }
                              style={{
                                ...estiloInput,
                                padding: "4px 6px",
                                fontSize: 12,
                                minWidth: 0,
                                borderColor:
                                  Ae.presumido && !fe ? tema.amber : tema.line,
                              }}
                            >
                              {Ae.presumido && !fe && (
                                <option value="" disabled={true}>
                                  {TIPOS_FISCAIS[Ae.tipo]}
                                  {" — presumido"}
                                </option>
                              )}
                              {Object.entries(TIPOS_FISCAIS).map(([xe, Ge]) => (
                                <option key={xe} value={xe}>
                                  {Ge}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {_ > 0 &&
        C &&
        typeof document < "u" &&
        ReactDOM.createPortal(<ImpressaoIR rel={C} />, document.body)}
    </section>
  );
}
