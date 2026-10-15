/* Componentes de interface reaproveitados pelas telas. */
import { useEffect, useMemo, useRef, useState } from "react";
import { jsxs } from "react/jsx-runtime";
import { GUIA_ESTRATEGIAS } from "./estrategias.js";
import { descreverChave } from "./nuvem.js";
import {
  INICIAIS_SEMANA,
  MESES,
  MESES_CURTOS,
  MESES_LONGOS,
  estiloBotao,
  estiloInput,
  fmtData,
  fmtDataHora,
  fmtNum,
  fmtPct,
  numBR,
  tema,
} from "./tema.js";

export function Secao({
  id: e,
  titulo: t,
  resumo: r,
  aberta: n,
  onToggle: a,
  children: o,
}) {
  return (
    <section
      id={"rm-" + e}
      style={{
        background: tema.panel,
        border: `1px solid ${n ? tema.amber : tema.line}`,
        borderRadius: 10,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => a(e)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: "14px 18px",
          cursor: "pointer",
          color: tema.text,
          fontFamily: tema.sans,
          display: "block",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <b
            style={{
              fontSize: 15,
              fontWeight: 650,
            }}
          >
            {t}
          </b>
          <span
            style={{
              flex: 1,
            }}
          />
          <span
            style={{
              fontFamily: tema.mono,
              fontSize: 16,
              color: n ? tema.amber : tema.faint,
              lineHeight: 1,
            }}
          >
            {n ? "−" : "+"}
          </span>
        </div>
        {r && (
          <div
            style={{
              fontSize: 12.5,
              color: tema.faint,
              lineHeight: 1.6,
              marginTop: 5,
              paddingRight: 22,
            }}
          >
            {r}
          </div>
        )}
      </button>
      {n && (
        <div
          style={{
            padding: "0 18px 18px",
          }}
        >
          {o}
        </div>
      )}
    </section>
  );
}

export function QuadroMesAMes({
  titulo: e,
  cor: t,
  labelPeriodo: r,
  colLabels: n,
  colColor: a,
  metricOpts: o,
  res: i,
  metric: s,
  onMetric: l,
  onExport: c,
  onRemove: u,
  seletor: f,
  aviso: p,
  rodape: h,
}) {
  let g = ["over", "pos", "bench", "ibov"];
  return (
    <section
      style={{
        background: tema.panel,
        border: `1px solid ${tema.line}`,
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          padding: "11px 18px",
          borderBottom: `1px solid ${tema.line}`,
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: t ?? tema.amber,
            display: "inline-block",
          }}
        />
        {f}
        {!f && (
          <span
            style={{
              fontFamily: tema.mono,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {e}
          </span>
        )}
        <span
          style={{
            flex: 1,
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: tema.mono,
              fontSize: 10.5,
              color: tema.faint,
            }}
          >
            matriz mostra
          </span>
          {o.map(([m, x]) => (
            <Chip key={m} active={s === m} onClick={() => l(m)}>
              {x}
            </Chip>
          ))}
        </div>
        {i && c && (
          <button
            onClick={c}
            style={{
              ...estiloBotao,
              color: tema.amber,
              borderColor: tema.amber,
            }}
          >
            ⬇ imagem
          </button>
        )}
        {u && (
          <button
            onClick={u}
            title="remover este quadro"
            style={{
              ...estiloBotao,
              color: tema.down,
              borderColor: tema.line,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {p && (
        <div
          style={{
            padding: "34px 18px",
            textAlign: "center",
            color: tema.faint,
            fontSize: 13.5,
          }}
        >
          {p}
        </div>
      )}
      {!p && i && (
        <>
          <div
            style={{
              padding: "10px 18px",
              borderBottom: `1px solid ${tema.line}`,
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              fontFamily: tema.mono,
              fontSize: 12.5,
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                color: tema.faint,
              }}
            >
              {r}
            </span>
            <span
              style={{
                color: tema.faint,
              }}
            >
              acumulado:
            </span>
            {g.map((m) => (
              <span
                key={m}
                style={{
                  color:
                    i.total[m] == null
                      ? tema.faint
                      : i.total[m] >= 0
                        ? tema.up
                        : tema.down,
                }}
              >
                <b
                  style={{
                    color: a[m],
                  }}
                >
                  {n[m]}
                </b>{" "}
                {i.total[m] == null ? "—" : fmtPct(i.total[m], 1)}
              </span>
            ))}
            {i.best && (
              <span
                style={{
                  color: a[i.best],
                  fontWeight: 700,
                }}
              >
                {"★ melhor no período: "}
                {n[i.best]}
              </span>
            )}
          </div>
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                borderCollapse: "collapse",
                fontFamily: tema.mono,
                fontSize: 11.5,
                width: "100%",
              }}
            >
              <thead>
                <tr
                  style={{
                    color: tema.faint,
                    fontSize: 10,
                    letterSpacing: 0.8,
                  }}
                >
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      borderBottom: `1px solid ${tema.line}`,
                    }}
                  >
                    ANO
                  </th>
                  {MESES.map((m) => (
                    <th
                      key={m}
                      style={{
                        padding: "8px 6px",
                        textAlign: "right",
                        borderBottom: `1px solid ${tema.line}`,
                      }}
                    >
                      {m.toUpperCase()}
                    </th>
                  ))}
                  {g.map((m) => (
                    <th
                      key={m}
                      style={{
                        padding: "8px 8px",
                        textAlign: "right",
                        borderBottom: `1px solid ${tema.line}`,
                        color: a[m],
                        borderLeft:
                          m === "over" ? `1px solid ${tema.line}` : "none",
                      }}
                    >
                      {n[m]}
                    </th>
                  ))}
                  <th
                    style={{
                      padding: "8px 8px",
                      textAlign: "center",
                      borderBottom: `1px solid ${tema.line}`,
                    }}
                  >
                    MELHOR
                  </th>
                </tr>
              </thead>
              <tbody>
                {i.grid.map((m) => (
                  <tr key={m.year} className="rowhover">
                    <td
                      style={{
                        padding: "6px 10px",
                        fontWeight: 700,
                      }}
                    >
                      {m.year}
                    </td>
                    {m.meses.map((x, y) => {
                      let b = x[s];
                      return (
                        <td
                          key={y}
                          style={{
                            padding: "6px 6px",
                            textAlign: "right",
                            background:
                              b == null
                                ? "transparent"
                                : b >= 0
                                  ? "rgba(63,191,143,0.14)"
                                  : "rgba(224,96,85,0.14)",
                            color:
                              b == null
                                ? tema.faint
                                : b >= 0
                                  ? tema.up
                                  : tema.down,
                          }}
                        >
                          {b == null ? "·" : fmtPct(b, 1)}
                        </td>
                      );
                    })}
                    {g.map((x, y) => (
                      <td
                        key={x}
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          fontWeight: 700,
                          borderLeft:
                            y === 0 ? `1px solid ${tema.line}` : "none",
                          color:
                            m.anual[x] == null
                              ? tema.faint
                              : m.anual[x] >= 0
                                ? tema.up
                                : tema.down,
                        }}
                      >
                        {m.anual[x] == null ? "—" : fmtPct(m.anual[x], 1)}
                      </td>
                    ))}
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "center",
                        fontWeight: 700,
                        color: m.best ? a[m.best] : tema.faint,
                      }}
                    >
                      {m.best ? n[m.best] : "—"}
                    </td>
                  </tr>
                ))}
                <tr
                  style={{
                    borderTop: `2px solid ${tema.line}`,
                  }}
                >
                  <td
                    style={{
                      padding: "8px 10px",
                      fontWeight: 700,
                      color: tema.amber,
                    }}
                  >
                    TOTAL
                  </td>
                  <td
                    colSpan={12}
                    style={{
                      padding: "8px 6px",
                      textAlign: "right",
                      color: tema.faint,
                      fontSize: 10.5,
                    }}
                  >
                    {"acumulado "}
                    {r}
                    {" →"}
                  </td>
                  {g.map((m, x) => (
                    <td
                      key={m}
                      style={{
                        padding: "8px 8px",
                        textAlign: "right",
                        fontWeight: 700,
                        borderLeft: x === 0 ? `1px solid ${tema.line}` : "none",
                        color:
                          i.total[m] == null
                            ? tema.faint
                            : i.total[m] >= 0
                              ? tema.up
                              : tema.down,
                      }}
                    >
                      {i.total[m] == null ? "—" : fmtPct(i.total[m], 1)}
                    </td>
                  ))}
                  <td
                    style={{
                      padding: "8px 8px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: i.best ? a[i.best] : tema.faint,
                    }}
                  >
                    {i.best ? "★ " + n[i.best] : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {h}
        </>
      )}
    </section>
  );
}

export function FichaEstrategia({
  id: e,
  nomeExibido: t,
  cor: r,
  aoAbrirManual: n,
}) {
  let a = GUIA_ESTRATEGIAS[e],
    [o, i] = useState(false),
    [s, l] = useState("centro"),
    c = useRef(null);
  if (
    (useEffect(() => {
      if (!o) return;
      let p = (g) => {
          c.current && !c.current.contains(g.target) && i(false);
        },
        h = (g) => {
          g.key === "Escape" && i(false);
        };
      return (
        document.addEventListener("mousedown", p),
        document.addEventListener("touchstart", p),
        document.addEventListener("keydown", h),
        () => {
          (document.removeEventListener("mousedown", p),
            document.removeEventListener("touchstart", p),
            document.removeEventListener("keydown", h));
        }
      );
    }, [o]),
    !a)
  )
    return null;
  let u = (p) => {
      if ((p.preventDefault(), p.stopPropagation(), !o)) {
        let g = c.current ? c.current.getBoundingClientRect() : null,
          m = g ? g.left + g.width / 2 : 0,
          x = typeof window < "u" ? window.innerWidth : 1200;
        m - 300 / 2 >= 12 && m + 300 / 2 <= x - 12
          ? l("centro")
          : x - m >= m
            ? l("esq")
            : l("dir");
      }
      i((h) => !h);
    },
    f =
      s === "esq"
        ? {
            left: -6,
          }
        : s === "dir"
          ? {
              right: -6,
            }
          : {
              left: "50%",
              transform: "translateX(-50%)",
            };
  return (
    <span
      ref={c}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <button
        type="button"
        onClick={u}
        aria-expanded={o}
        aria-label={`O que é ${t || a.nome}`}
        style={{
          width: 17,
          height: 17,
          borderRadius: "50%",
          padding: 0,
          border: `1px solid ${o ? tema.amber : tema.line}`,
          background: o ? tema.amberSoft : "transparent",
          color: o ? tema.amber : tema.faint,
          fontFamily: tema.mono,
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ?
      </button>
      {o && (
        <div
          role="dialog"
          onClick={(p) => p.stopPropagation()}
          style={{
            position: "absolute",
            top: 26,
            ...f,
            width: 300,
            maxWidth: "calc(100vw - 24px)",
            zIndex: 60,
            background: tema.panelSoft,
            border: `1px solid ${tema.line}`,
            borderLeft: `3px solid ${r || a.cor}`,
            borderRadius: 9,
            padding: "11px 13px 12px",
            boxShadow: "0 10px 30px rgba(0,0,0,.55)",
            textAlign: "left",
            cursor: "default",
          }}
        >
          <div
            style={{
              fontFamily: tema.mono,
              fontSize: 10,
              letterSpacing: 0.8,
              color: tema.faint,
              marginBottom: 6,
            }}
          >
            {a.grupo.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              marginBottom: 8,
            }}
          >
            {a.chaves.map((p) => (
              <span
                key={p}
                style={{
                  fontFamily: tema.mono,
                  fontSize: 10.5,
                  padding: "2px 7px",
                  borderRadius: 20,
                  border: `1px solid ${tema.line}`,
                  color: tema.text,
                  background: tema.panel,
                }}
              >
                {p}
              </span>
            ))}
          </div>
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.6,
              color: tema.dim,
              fontWeight: 400,
            }}
          >
            {a.linha}
          </div>
          {n && (
            <button
              type="button"
              onClick={(p) => {
                (p.stopPropagation(), i(false), n(e));
              }}
              style={{
                marginTop: 10,
                background: "transparent",
                border: "none",
                padding: 0,
                color: tema.amber,
                fontFamily: tema.mono,
                fontSize: 11.5,
                cursor: "pointer",
              }}
            >
              explicação completa no MANUAL →
            </button>
          )}
        </div>
      )}
    </span>
  );
}

export function PainelAbertura({ c: e, aoVivo: t, abrirManual: r }) {
  let n = !!t && t.estado === "REGULAR",
    a = (l, c = 2) =>
      Number.isFinite(l)
        ? `${l >= 0 ? "+" : "−"}${numBR(Math.abs(l) * 100, c)}%`
        : "—",
    o = e.margemRestante,
    i = Number.isFinite(o)
      ? o > 0.0015
        ? tema.up
        : o > 0
          ? tema.amber
          : tema.down
      : tema.dim,
    CS = ({ children: l, cor: c, forte: u }) => (
      <td
        style={{
          padding: "6px 10px",
          textAlign: "right",
          fontFamily: tema.mono,
          fontSize: 12.5,
          color: c || tema.text,
          fontWeight: u ? 650 : 400,
          whiteSpace: "nowrap",
        }}
      >
        {l}
      </td>
    );
  return (
    <section
      style={{
        background: tema.panel,
        borderRadius: 10,
        padding: "14px 16px",
        border: `1px solid ${tema.line}`,
        borderLeft: `3px solid ${e.cor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
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
              fontSize: 15,
              fontWeight: 650,
              color: e.cor,
            }}
          >
            {e.nome}
          </span>
          <FichaEstrategia
            id={e.guia}
            nomeExibido={e.nome}
            cor={e.cor}
            aoAbrirManual={r}
          />
          <span
            style={{
              fontSize: 11.5,
              color: tema.faint,
            }}
          >
            {n ? "pregão em andamento" : "último pregão da base"}
          </span>
        </div>
        <span
          style={{
            fontFamily: tema.mono,
            fontSize: 12,
            color: tema.faint,
          }}
        >
          {e.itens.length}
          {" papéis · entra na abertura, sai no fechamento"}
        </span>
      </div>
      {e.erro && (
        <div
          style={{
            fontSize: 12.5,
            color: tema.dim,
            marginTop: 10,
          }}
        >
          {e.erro}
        </div>
      )}
      {!e.erro && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 26,
              marginTop: 12,
              padding: "11px 13px",
              background: tema.panelSoft,
              borderRadius: 8,
              border: `1px solid ${tema.line}`,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: tema.faint,
                  letterSpacing: 0.5,
                }}
              >
                MARGEM HISTÓRICA
              </div>
              <div
                style={{
                  fontFamily: tema.mono,
                  fontSize: 19,
                  fontWeight: 700,
                }}
              >
                +0,27%
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: tema.faint,
                }}
              >
                por dia, no preço do leilão
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: tema.faint,
                  letterSpacing: 0.5,
                }}
              >
                JÁ ANDOU DESDE A ABERTURA
              </div>
              <div
                style={{
                  fontFamily: tema.mono,
                  fontSize: 19,
                  fontWeight: 700,
                  color: (e.jaAndouMedio ?? 0) > 0 ? tema.down : tema.up,
                }}
              >
                {a(e.jaAndouMedio)}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: tema.faint,
                }}
              >
                {"média dos "}
                {e.itens.length}
                {" papéis"}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: tema.faint,
                  letterSpacing: 0.5,
                }}
              >
                SOBRA PARA VOCÊ
              </div>
              <div
                style={{
                  fontFamily: tema.mono,
                  fontSize: 19,
                  fontWeight: 700,
                  color: i,
                }}
              >
                {a(o)}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: tema.faint,
                }}
              >
                margem menos o que já foi
              </div>
            </div>
            {e.resultado && (
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: tema.faint,
                    letterSpacing: 0.5,
                  }}
                >
                  {n ? "RESULTADO ATÉ AGORA" : "RESULTADO DO DIA"}
                </div>
                <div
                  style={{
                    fontFamily: tema.mono,
                    fontSize: 19,
                    fontWeight: 700,
                    color: e.resultado.ret >= 0 ? tema.up : tema.down,
                  }}
                >
                  {a(e.resultado.ret)}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: tema.faint,
                  }}
                >
                  {e.resultado.acertos}/{e.resultado.total}
                  {" no positivo"}
                </div>
              </div>
            )}
          </div>
          <div
            style={{
              marginTop: 11,
              fontSize: 12,
              lineHeight: 1.6,
              color: Number.isFinite(o) && o <= 0 ? tema.down : tema.dim,
            }}
          >
            {Number.isFinite(o)
              ? o <= 0
                ? "A margem já foi embora. Nos testes, entrar 0,3% acima da abertura leva a estratégia para o negativo — hoje não vale mais montar esta carteira."
                : o < 0.0015
                  ? "Sobrou pouco. A estratégia continua positiva, mas com menos da metade da margem que ela tem no leilão."
                  : "Margem preservada. Este é o momento em que a estratégia entrega o que o teste mostrou."
              : "Sem cotação ao vivo não dá para saber quanto o preço já andou. Atualize a cotação antes de decidir."}
          </div>
          <div
            style={{
              overflowX: "auto",
              marginTop: 12,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 640,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid ${tema.line}`,
                  }}
                >
                  {[
                    "ATIVO",
                    "FECH. ONTEM",
                    "ABERTURA",
                    "GAP",
                    "AGORA",
                    "JÁ ANDOU",
                    "ABRE EM ALTA",
                  ].map((l, c) => (
                    <th
                      key={l}
                      style={{
                        padding: "6px 10px",
                        fontSize: 10.5,
                        letterSpacing: 0.5,
                        color: tema.faint,
                        textAlign: c === 0 ? "left" : "right",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {e.itens.map((l) => (
                  <tr
                    key={l.ativo}
                    style={{
                      borderBottom: `1px solid ${tema.line}`,
                    }}
                  >
                    <td
                      style={{
                        padding: "6px 10px",
                        fontFamily: tema.mono,
                        fontSize: 12.5,
                        fontWeight: 650,
                      }}
                    >
                      {l.ativo}
                    </td>
                    <CS cor={tema.dim}>{fmtNum(l.fechAnt, 2)}</CS>
                    <CS forte={true}>{fmtNum(l.abertura, 2)}</CS>
                    <CS cor={l.gap >= 0 ? tema.up : tema.down} forte={true}>
                      {a(l.gap)}
                    </CS>
                    <CS cor={tema.dim}>
                      {l.precoAgora > 0 ? fmtNum(l.precoAgora, 2) : "—"}
                    </CS>
                    <CS
                      cor={
                        l.jaAndou == null
                          ? tema.faint
                          : l.jaAndou > 0
                            ? tema.down
                            : tema.up
                      }
                    >
                      {a(l.jaAndou)}
                    </CS>
                    <CS cor={tema.dim}>
                      {Number.isFinite(l.ovWin60)
                        ? `${Math.round(l.ovWin60 * 100)}%`
                        : "—"}
                    </CS>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: tema.faint,
              marginTop: 11,
              lineHeight: 1.6,
            }}
          >
            {"A coluna "}
            <b>JÁ ANDOU</b>
            {
              " é o inimigo: cada 0,1% que o papel subiu desde a abertura sai direto da sua margem. Por isso a ordem tem que ir no leilão de abertura, do mesmo jeito que você já faz no fechamento — perseguir preço às 10h20 não funciona."
            }
            <b>{" ABRE EM ALTA"}</b>
            {
              " é a frequência de gap positivo em 60 pregões: aqui, quanto MENOR, melhor — é o papel que não tem hábito de abrir em alta que paga a perna do dia. A saída é no leilão de fechamento, sem exceção."
            }
          </div>
        </>
      )}
    </section>
  );
}

export function Sparkline({ curve: e, w: t = 96, h: r = 26 }) {
  if (!e || e.length < 2) return null;
  let n = Math.min(...e, 1),
    o = Math.max(...e, 1) - n || 1,
    i = e.map((l, c) => {
      let u = (c / (e.length - 1)) * t,
        f = r - ((l - n) / o) * (r - 3) - 1.5;
      return `${u.toFixed(1)},${f.toFixed(1)}`;
    }),
    s = e[e.length - 1] >= 1;
  return (
    <svg
      width={t}
      height={r}
      style={{
        display: "block",
      }}
      aria-hidden="true"
    >
      <polyline
        points={i.join(" ")}
        fill="none"
        stroke={s ? tema.up : tema.down}
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function Chip({
  active: e,
  children: t,
  onClick: r,
  disabled: n = false,
}) {
  return (
    <button
      onClick={r}
      disabled={n}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        cursor: n ? "not-allowed" : "pointer",
        fontFamily: tema.mono,
        fontSize: 12.5,
        letterSpacing: 0.3,
        border: `1px solid ${e ? tema.amber : tema.line}`,
        background: e ? tema.amberSoft : "transparent",
        color: n ? tema.faint : e ? tema.amber : tema.dim,
        opacity: n ? 0.6 : 1,
        transition: "all .15s",
      }}
    >
      {t}
    </button>
  );
}

export function Campo({ label: e, children: t }) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: tema.faint,
          fontFamily: tema.mono,
        }}
      >
        {e}
      </span>
      {t}
    </label>
  );
}

export function Estatistica({ label: e, children: t, color: r }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{
          fontFamily: tema.mono,
          fontSize: 9.5,
          letterSpacing: 1.3,
          textTransform: "uppercase",
          color: tema.faint,
        }}
      >
        {e}
      </span>
      <span
        style={{
          fontFamily: tema.mono,
          fontSize: 12.5,
          color: r || tema.text,
        }}
      >
        {t}
      </span>
    </div>
  );
}

export function CampoNumero({
  valor: e,
  onCommit: t,
  largura: r = 110,
  sufixo: n,
}) {
  let [a, o] = useState(String(e).replace(".", ","));
  return (
    useEffect(() => {
      o(String(e).replace(".", ","));
    }, [e]),
    (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={a}
          onChange={(s) => o(s.target.value)}
          onBlur={() => {
            let s = parseFloat(String(a).trim().replace(",", "."));
            Number.isFinite(s) ? t(s) : o(String(e).replace(".", ","));
          }}
          onKeyDown={(s) => {
            s.key === "Enter" && s.currentTarget.blur();
          }}
          style={{
            ...estiloInput,
            width: r,
            boxSizing: "border-box",
          }}
        />
        {n && (
          <span
            style={{
              fontSize: 12,
              color: tema.faint,
            }}
          >
            {n}
          </span>
        )}
      </span>
    )
  );
}

export function GrupoConfig({ titulo: e, children: t }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 9,
        padding: "0 20px 0 14px",
        borderLeft: `2px solid ${tema.line}`,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          letterSpacing: 1.8,
          textTransform: "uppercase",
          color: tema.amber,
          fontFamily: tema.mono,
        }}
      >
        {e}
      </span>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "flex-end",
        }}
      >
        {t}
      </div>
    </div>
  );
}

function Calendario({
  modo: e = "dia",
  valorTs: t,
  onEscolher: r,
  minTs: n,
  maxTs: a,
  diasValidos: o,
  textoBotao: i,
}) {
  let [s, l] = useState(false),
    [c, u] = useState(e === "mes" ? "mes" : "dia"),
    f = t != null ? new Date(t) : new Date(),
    [p, h] = useState(f.getUTCFullYear()),
    [g, m] = useState(f.getUTCMonth()),
    x = () => {
      let R = t != null ? new Date(t) : new Date();
      (h(R.getUTCFullYear()),
        m(R.getUTCMonth()),
        u(e === "mes" ? "mes" : "dia"),
        l(true));
    },
    y = n != null ? new Date(n).getUTCFullYear() : p - 5,
    b = a != null ? new Date(a).getUTCFullYear() : p + 5,
    S = (R) => (n == null || R >= n) && (a == null || R <= a),
    T = (R) => (S(R) ? (o ? o.has(R) : true) : false),
    A = (R, M) => {
      let H = new Date(Date.UTC(R, M + 1, 0)).getUTCDate();
      for (let Y = 1; Y <= H; Y++) if (T(Date.UTC(R, M, Y))) return true;
      return false;
    },
    w = (R) => {
      for (let M = 0; M < 12; M++) if (A(R, M)) return true;
      return false;
    },
    _ = (R) => {
      (r(R), l(false));
    },
    E = {
      border: "none",
      background: "transparent",
      color: tema.text,
      fontFamily: tema.mono,
      fontSize: 13,
      borderRadius: 6,
      cursor: "pointer",
      padding: 0,
      lineHeight: 1,
    },
    P = {
      ...E,
      color: tema.line,
      cursor: "default",
    },
    O =
      i ??
      (t == null
        ? "—"
        : e === "mes"
          ? `${String(new Date(t).getUTCMonth() + 1).padStart(2, "0")}/${new Date(t).getUTCFullYear()}`
          : fmtData(t));
  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
      }}
      onClick={(R) => R.preventDefault()}
    >
      <button
        onClick={x}
        style={{
          ...estiloInput,
          cursor: "pointer",
          textAlign: "left",
          minWidth: e === "mes" ? 108 : 128,
        }}
      >
        {O}
      </button>
      {s && (
        <>
          <div
            onClick={() => l(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 41,
              background: tema.panelSoft,
              border: `1px solid ${tema.line}`,
              borderRadius: 10,
              padding: 12,
              width: 268,
              boxShadow: "0 12px 32px rgba(0,0,0,.55)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 10,
              }}
            >
              {c !== "ano" && (
                <button
                  onClick={() => {
                    c === "dia" ? e === "dia" && u("mes") : u("ano");
                  }}
                  style={{
                    ...estiloBotao,
                    flex: 1,
                    padding: "8px 10px",
                    fontSize: 13,
                    color: tema.amber,
                    borderColor: tema.amber,
                    textAlign: "center",
                    fontWeight: 700,
                  }}
                >
                  {c === "dia" ? `${MESES_LONGOS[g]} ${p}` : `${p}`}
                </button>
              )}
              {c === "ano" && (
                <div
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontFamily: tema.mono,
                    fontSize: 12,
                    letterSpacing: 1.4,
                    color: tema.faint,
                    padding: "9px 0",
                  }}
                >
                  ESCOLHA O ANO
                </div>
              )}
              {c === "dia" && (
                <>
                  <button
                    onClick={() => {
                      let R = new Date(Date.UTC(p, g - 1, 1));
                      (h(R.getUTCFullYear()), m(R.getUTCMonth()));
                    }}
                    style={{
                      ...estiloBotao,
                      minWidth: 34,
                      padding: "8px 0",
                      color: tema.dim,
                    }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => {
                      let R = new Date(Date.UTC(p, g + 1, 1));
                      (h(R.getUTCFullYear()), m(R.getUTCMonth()));
                    }}
                    style={{
                      ...estiloBotao,
                      minWidth: 34,
                      padding: "8px 0",
                      color: tema.dim,
                    }}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {c === "dia" &&
              (() => {
                let R = new Date(Date.UTC(p, g, 1)).getUTCDay(),
                  M = new Date(Date.UTC(p, g + 1, 0)).getUTCDate(),
                  H = [];
                for (let Y = 0; Y < R; Y++) H.push(null);
                for (let Y = 1; Y <= M; Y++) H.push(Y);
                return (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7,1fr)",
                        gap: 2,
                        marginBottom: 4,
                      }}
                    >
                      {INICIAIS_SEMANA.map((Y, G) => (
                        <div
                          key={G}
                          style={{
                            textAlign: "center",
                            fontSize: 10,
                            color: tema.faint,
                            fontFamily: tema.mono,
                            padding: "2px 0",
                          }}
                        >
                          {Y}
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7,1fr)",
                        gap: 2,
                      }}
                    >
                      {H.map((Y, G) => {
                        if (Y == null) return <div key={"v" + G} />;
                        let k = Date.UTC(p, g, Y),
                          F = T(k),
                          q = t != null && k === t;
                        return (
                          <button
                            key={Y}
                            disabled={!F}
                            onClick={() => _(k)}
                            style={{
                              ...(F ? E : P),
                              height: 34,
                              background: q ? tema.amber : "transparent",
                              color: q ? "#12100C" : F ? tema.text : tema.line,
                              fontWeight: q ? 700 : 400,
                            }}
                          >
                            {Y}
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            {c === "mes" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 6,
                }}
              >
                {MESES_CURTOS.map((R, M) => {
                  let H = A(p, M),
                    Y =
                      t != null &&
                      new Date(t).getUTCFullYear() === p &&
                      new Date(t).getUTCMonth() === M;
                  return (
                    <button
                      key={R}
                      disabled={!H}
                      onClick={() => {
                        (m(M), e === "mes" ? _(Date.UTC(p, M, 1)) : u("dia"));
                      }}
                      style={{
                        ...(H ? E : P),
                        height: 42,
                        background: Y ? tema.amber : "transparent",
                        color: Y ? "#12100C" : H ? tema.text : tema.line,
                        fontWeight: Y ? 700 : 400,
                      }}
                    >
                      {R}
                    </button>
                  );
                })}
              </div>
            )}
            {c === "ano" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 6,
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {Array.from(
                  {
                    length: b - y + 1,
                  },
                  (R, M) => y + M,
                ).map((R) => {
                  let M = w(R),
                    H = R === p;
                  return (
                    <button
                      key={R}
                      disabled={!M}
                      onClick={() => {
                        (h(R), u("mes"));
                      }}
                      style={{
                        ...(M ? E : P),
                        height: 42,
                        background: H ? tema.amber : "transparent",
                        color: H ? "#12100C" : M ? tema.text : tema.line,
                        fontWeight: H ? 700 : 400,
                      }}
                    >
                      {R}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SeletorDia({ value: e, onChange: t, dates: r }) {
  let n = useMemo(() => new Set(r || []), [r]);
  return !r || r.length === 0 ? null : (
    <Calendario
      modo="dia"
      valorTs={e}
      minTs={r[0]}
      maxTs={r[r.length - 1]}
      diasValidos={n}
      onEscolher={t}
    />
  );
}

export function SeletorPeriodo({ de: e, ate: t, onDe: r, onAte: n, dates: a }) {
  return (
    <>
      <Campo label="De">
        <SeletorDia
          value={e}
          dates={a}
          onChange={(o) => {
            (r(o), t != null && o > t && n(o));
          }}
        />
      </Campo>
      <Campo label="Até">
        <SeletorDia
          value={t}
          dates={a}
          onChange={(o) => {
            (n(o), e != null && o < e && r(o));
          }}
        />
      </Campo>
    </>
  );
}

export function NavegadorPregao({ dates: e, value: t, onChange: r }) {
  let n = useMemo(() => new Set(e || []), [e]);
  if (!e || e.length === 0) return null;
  let a = e.indexOf(t),
    o = (s) => {
      let l = e.indexOf(t);
      if (l < 0) return;
      let c = Math.min(e.length - 1, Math.max(0, l + s));
      r(e[c]);
    },
    i = {
      ...estiloBotao,
      minWidth: 34,
      padding: "7px 0",
      textAlign: "center",
      color: tema.dim,
      fontSize: 15,
      lineHeight: 1,
    };
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "stretch",
      }}
    >
      <button
        onClick={() => o(-1)}
        disabled={a <= 0}
        style={{
          ...i,
          opacity: a <= 0 ? 0.35 : 1,
        }}
        title="pregão anterior"
      >
        ‹
      </button>
      <Calendario
        modo="dia"
        valorTs={t}
        minTs={e[0]}
        maxTs={e[e.length - 1]}
        diasValidos={n}
        onEscolher={r}
      />
      <button
        onClick={() => o(1)}
        disabled={a < 0 || a >= e.length - 1}
        style={{
          ...i,
          opacity: a < 0 || a >= e.length - 1 ? 0.35 : 1,
        }}
        title="pregão seguinte"
      >
        ›
      </button>
    </div>
  );
}

function useNuvem() {
  let [e, t] = useState(() =>
    typeof window < "u" && window.__nuvem ? window.__nuvem.estado() : null,
  );
  return (
    useEffect(() => {
      if (!(typeof window > "u" || !window.__nuvem))
        return window.__nuvem.assinar(t);
    }, []),
    e
  );
}

export function StatusNuvem() {
  let e = useNuvem(),
    [t, r] = useState(false),
    [n, a] = useState(null),
    [o, i] = useState(false),
    s = useRef(null);
  if (!e) return null;
  let l = window.__nuvem,
    c =
      e.fase === "ok" ? tema.up : e.fase === "offline" ? tema.down : tema.amber,
    u =
      e.fase === "iniciando"
        ? "☁ conectando…"
        : e.fase === "enviando"
          ? "☁ enviando…"
          : e.fase === "offline"
            ? `⚠ sem nuvem${e.pendentes ? ` · ${e.pendentes} pendente(s)` : ""}`
            : `☁ nuvem ok${e.conflitos.length ? " · ver aviso" : ""}`,
    f = () => {
      let m = l.montarBackup(),
        x = new Blob([JSON.stringify(m, null, 1)], {
          type: "application/json",
        }),
        y = document.createElement("a"),
        b = new Date()
          .toLocaleDateString("en-CA", {
            timeZone: "America/Sao_Paulo",
          })
          .replace(/-/g, "");
      ((y.href = URL.createObjectURL(x)),
        (y.download = `leilao-overnight-backup-${b}.json`),
        document.body.appendChild(y),
        y.click(),
        y.remove(),
        setTimeout(() => URL.revokeObjectURL(y.href), 2000),
        a("Backup baixado."));
    },
    p = (m) => {
      if (!m) return;
      let x = new FileReader();
      ((x.onload = async () => {
        i(true);
        try {
          (await l.restaurar(JSON.parse(x.result)))
            ? window.location.reload()
            : a(
                "Restaurado neste aparelho; sobe para a nuvem quando a conexão voltar.",
              );
        } catch (y) {
          a("Arquivo inválido: " + (y.message || y));
        } finally {
          i(false);
        }
      }),
        x.readAsText(m));
    },
    h = async () => {
      i(true);
      let m = await l.usarDesteAparelho();
      (i(false),
        m
          ? window.location.reload()
          : a("Sem conexão agora — tente de novo em instantes."));
    },
    g = e.alteradoFora || e.recarregar;
  return (
    <>
      {g && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            background: tema.amber,
            color: "#1a1204",
            padding: "8px 14px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            fontFamily: tema.sans,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span>
            {e.recarregar
              ? "Sua alteração foi combinada com a de outro aparelho. Recarregue para ver a versão completa."
              : "Outro aparelho alterou os dados. Recarregue para ver a versão atual."}
          </span>
          <button
            onClick={() => window.location.reload()}
            style={{
              ...estiloBotao,
              background: "#1a1204",
              color: tema.amber,
              borderColor: "#1a1204",
              fontWeight: 700,
            }}
          >
            Recarregar
          </button>
        </div>
      )}
      <span
        style={{
          position: "relative",
          display: "inline-block",
        }}
      >
        <button
          onClick={() => {
            (r((m) => !m), a(null));
          }}
          style={{
            ...estiloBotao,
            padding: "3px 9px",
            fontSize: 11,
            color: c,
            borderColor: c,
          }}
        >
          {u}
        </button>
        {t && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 50,
              width: 340,
              maxWidth: "88vw",
              background: tema.panel,
              border: `1px solid ${tema.line}`,
              borderRadius: 8,
              padding: 14,
              boxShadow: "0 10px 30px rgba(0,0,0,.45)",
              fontFamily: tema.sans,
              fontSize: 13,
              color: tema.text,
              lineHeight: 1.45,
              fontWeight: 400,
              letterSpacing: 0,
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <b
                style={{
                  color: tema.amber,
                  fontFamily: tema.mono,
                  fontSize: 12,
                  letterSpacing: 1,
                }}
              >
                DADOS NA NUVEM
              </b>
              <button
                onClick={() => r(false)}
                style={{
                  ...estiloBotao,
                  padding: "1px 8px",
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                color: tema.dim,
                marginBottom: 10,
              }}
            >
              Grupos, itens, cesta padrão, carteira, benchmarks e ajustes ficam
              guardados num lugar só e aparecem em qualquer aparelho que abrir o
              app. O acesso é compartilhado: quem abre o link vê e altera os
              mesmos dados.
            </div>
            <div
              style={{
                fontFamily: tema.mono,
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              <div>
                {"situação: "}
                <span
                  style={{
                    color: c,
                  }}
                >
                  {e.fase === "ok"
                    ? "sincronizado"
                    : e.fase === "offline"
                      ? "sem conexão"
                      : e.fase}
                </span>
              </div>
              <div>
                {"última conexão: "}
                {fmtDataHora(e.ultima)}
              </div>
              {e.pendentes > 0 && (
                <div
                  style={{
                    color: tema.amber,
                  }}
                >
                  {e.pendentes}
                  {
                    " alteração(ões) guardada(s) neste aparelho, aguardando envio"
                  }
                </div>
              )}
              {e.erro && e.fase === "offline" && (
                <div
                  style={{
                    color: tema.down,
                  }}
                >
                  {e.erro}
                </div>
              )}
            </div>
            {e.conflitos.length > 0 && (
              <div
                style={{
                  border: `1px solid ${tema.amber}`,
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 10,
                  background: tema.amberSoft,
                }}
              >
                <div
                  style={{
                    marginBottom: 6,
                  }}
                >
                  Na primeira conexão deste aparelho, estes itens já existiam na
                  nuvem com valor diferente. Ficou o da nuvem:
                </div>
                <ul
                  style={{
                    margin: "0 0 8px 18px",
                    padding: 0,
                  }}
                >
                  {e.conflitos.map((m) => (
                    <li key={m}>{descreverChave(m)}</li>
                  ))}
                </ul>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    disabled={o}
                    onClick={h}
                    style={{
                      ...estiloBotao,
                      color: tema.amber,
                      borderColor: tema.amber,
                    }}
                  >
                    Usar a versão deste aparelho
                  </button>
                  <button
                    disabled={o}
                    onClick={() => l.descartarConflitos()}
                    style={estiloBotao}
                  >
                    Manter a da nuvem
                  </button>
                </div>
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <button onClick={f} style={estiloBotao}>
                Baixar backup
              </button>
              <button
                disabled={o}
                onClick={() => s.current && s.current.click()}
                style={estiloBotao}
              >
                Restaurar backup…
              </button>
              <button onClick={() => l.verificar()} style={estiloBotao}>
                Verificar agora
              </button>
              <input
                ref={s}
                type="file"
                accept=".json,application/json"
                style={{
                  display: "none",
                }}
                onChange={(m) => {
                  (p(m.target.files?.[0]), (m.target.value = ""));
                }}
              />
            </div>
            {n && (
              <div
                style={{
                  marginTop: 8,
                  color: tema.dim,
                }}
              >
                {n}
              </div>
            )}
          </div>
        )}
      </span>
    </>
  );
}

export function RelogioLeilao() {
  let [e, t] = useState(new Date());
  useEffect(() => {
    let c = setInterval(() => t(new Date()), 1000);
    return () => clearInterval(c);
  }, []);
  let r = new Date(
      e.toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
      }),
    ),
    n = new Date(r);
  n.setHours(17, 55, 0, 0);
  let a = n - r,
    o = r.getDay(),
    i = o === 0 || o === 6,
    s,
    l = false;
  if (i) s = "mercado fechado";
  else if (a > 0 && a < 8 * 3600000) {
    let c = Math.floor(a / 3600000),
      u = Math.floor((a % 3600000) / 60000),
      f = Math.floor((a % 60000) / 1000);
    ((s = `${String(c).padStart(2, "0")}:${String(u).padStart(2, "0")}:${String(f).padStart(2, "0")} para o leilão`),
      (l = a < 45 * 60000));
  } else s = "fora da janela do leilão";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: tema.mono,
        fontSize: 13,
        color: l ? tema.amber : tema.dim,
        padding: "6px 14px",
        borderRadius: 999,
        border: `1px solid ${l ? tema.amber : tema.line}`,
        background: l ? tema.amberSoft : "transparent",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 99,
          background: l ? tema.amber : tema.faint,
          boxShadow: l ? `0 0 8px ${tema.amber}` : "none",
        }}
      />
      {s}
    </div>
  );
}

export function EditorCarteira({
  carteira: e,
  onChange: t,
  tickers: r,
  marked: n,
  sizing: a,
  rank: o,
  titulo: i = "Carteira analisada",
  nu: s = false,
  abaixoDoPiso: l = null,
  piso: c = null,
}) {
  let [u, f] = useState(""),
    [p, h] = useState(""),
    g = e.reduce((b, S) => b + S.valor, 0),
    m = () => {
      let b = parseFloat(String(p).replace(",", "."));
      !u ||
        !(b > 0) ||
        e.some((S) => S.ativo === u) ||
        (t([
          ...e,
          {
            ativo: u,
            valor: b,
          },
        ]),
        f(""),
        h(""));
    },
    x = () => {
      if (!n || n.size === 0) return;
      let b = Array.from(n).map((S) => ({
        ativo: S,
        valor: a?.alloc.get(S)?.valor ?? 100000,
      }));
      t(b);
    };
  return jsxs(s ? "div" : "section", {
    style: s
      ? {
          marginBottom: 4,
        }
      : {
          background: tema.panel,
          border: `1px solid ${tema.line}`,
          borderRadius: 10,
          padding: "16px 18px",
          marginBottom: 20,
        },
    children: [
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontWeight: 650,
            fontSize: s ? 13.5 : 15,
          }}
        >
          {i}
        </span>
        <span
          style={{
            fontFamily: tema.mono,
            fontSize: 12,
            color: tema.faint,
          }}
        >
          {e.length}
          {" ativos · total R$ "}
          {fmtNum(g)}
        </span>
        {l && e.some((b) => l(b.ativo)) && (
          <span
            style={{
              fontFamily: tema.mono,
              fontSize: 11.5,
              color: tema.down,
            }}
          >
            {"▼ "}
            {e.filter((b) => l(b.ativo)).length}
            {" abaixo do piso de liquidez"}
          </span>
        )}
        <span
          style={{
            flex: 1,
          }}
        />
        {n && n.size > 0 && (
          <button
            onClick={x}
            style={{
              ...estiloBotao,
              fontSize: 11.5,
              color: tema.up,
              borderColor: tema.up,
            }}
          >
            {"★ importar "}
            {n.size}
            {" marcados da aba Hoje"}
          </button>
        )}
      </div>,
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: e.length ? 12 : 0,
        }}
      >
        <select
          value={u}
          onChange={(b) => f(b.target.value)}
          style={{
            ...estiloInput,
            minWidth: 110,
          }}
        >
          <option value="">ativo…</option>
          {(() => {
            let b = r.filter((A) => !e.some((w) => w.ativo === A));
            if (!l)
              return b.map((A) => (
                <option key={A} value={A}>
                  {A}
                </option>
              ));
            let S = b.filter((A) => !l(A)),
              T = b.filter((A) => l(A));
            return (
              <>
                <optgroup
                  label={`passam no piso${c != null ? ` (${fmtNum(c)} MM)` : ""}`}
                >
                  {S.map((A) => (
                    <option key={A} value={A}>
                      {A}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="abaixo do piso de liquidez">
                  {T.map((A) => (
                    <option key={A} value={A}>
                      {A}
                    </option>
                  ))}
                </optgroup>
              </>
            );
          })()}
        </select>
        <input
          type="number"
          placeholder="valor (R$)"
          min="0"
          step="1000"
          value={p}
          onChange={(b) => h(b.target.value)}
          onKeyDown={(b) => b.key === "Enter" && m()}
          style={{
            ...estiloInput,
            width: 130,
          }}
        />
        <button
          onClick={m}
          style={{
            ...estiloBotao,
            color: tema.amber,
            borderColor: tema.amber,
          }}
        >
          + adicionar
        </button>
        {e.length > 0 && (
          <button
            onClick={() => t([])}
            style={{
              ...estiloBotao,
              color: tema.faint,
              fontSize: 11.5,
            }}
          >
            limpar carteira
          </button>
        )}
      </div>,
      e.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {e.map((b) => (
            <span
              key={b.ativo}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 10px",
                border: `1px solid ${tema.line}`,
                borderRadius: 6,
                fontFamily: tema.mono,
                fontSize: 12,
                background: tema.panelSoft,
              }}
            >
              <b
                style={{
                  color: tema.amber,
                }}
              >
                {b.ativo}
              </b>
              {l && l(b.ativo) && (
                <span
                  title={`volume médio de 20 pregões abaixo do piso${c != null ? ` de R$ ${fmtNum(c)} MM` : ""}`}
                  style={{
                    color: tema.down,
                    fontSize: 10.5,
                    letterSpacing: 0.4,
                  }}
                >
                  ▼ liq
                </span>
              )}
              <input
                type="number"
                value={b.valor}
                min="0"
                step="1000"
                onChange={(S) => {
                  let T = Math.max(0, +S.target.value || 0);
                  t(
                    e.map((A) =>
                      A.ativo === b.ativo
                        ? {
                            ...A,
                            valor: T,
                          }
                        : A,
                    ),
                  );
                }}
                style={{
                  ...estiloInput,
                  width: 100,
                  padding: "3px 6px",
                  fontSize: 11.5,
                }}
              />
              <span
                style={{
                  color: tema.faint,
                  fontSize: 11,
                }}
              >
                {g > 0 ? Math.round((b.valor / g) * 100) + "%" : ""}
              </span>
              <button
                onClick={() => t(e.filter((S) => S.ativo !== b.ativo))}
                title="remover"
                style={{
                  background: "none",
                  border: "none",
                  color: tema.down,
                  cursor: "pointer",
                  fontSize: 13,
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ),
    ],
  });
}

export function EnviarBenchmark({ onAdd: e }) {
  let [t, r] = useState(""),
    n = useRef(null);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <input
        type="text"
        placeholder="nome do benchmark"
        value={t}
        maxLength={30}
        onChange={(a) => r(a.target.value)}
        style={{
          ...estiloInput,
          width: 190,
        }}
      />
      <button
        onClick={() => n.current?.click()}
        style={{
          ...estiloBotao,
          color: tema.amber,
          borderColor: tema.amber,
        }}
      >
        + carregar planilha
      </button>
      <input
        ref={n}
        type="file"
        accept=".csv,.txt,.xlsx,.xls"
        style={{
          display: "none",
        }}
        onChange={(a) => {
          let o = a.target.files?.[0];
          (o && e(o, t.trim()), (a.target.value = ""), r(""));
        }}
      />
    </div>
  );
}

export function LinhaBenchmark({ bm: e, onRename: t, onRemove: r }) {
  let [n, a] = useState(false),
    [o, i] = useState(e.name),
    [s, l] = useState(false),
    c = e.points[0]?.[0],
    u = e.points[e.points.length - 1]?.[0];
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        padding: "7px 10px",
        border: `1px solid ${tema.line}`,
        borderRadius: 6,
        fontFamily: tema.mono,
        fontSize: 12,
      }}
    >
      {n ? (
        <>
          <input
            value={o}
            maxLength={30}
            onChange={(f) => i(f.target.value)}
            onKeyDown={(f) => {
              f.key === "Enter" && (t(e.id, o.trim() || e.name), a(false));
            }}
            style={{
              ...estiloInput,
              width: 180,
              padding: "4px 8px",
            }}
            autoFocus={true}
          />
          <button
            onClick={() => {
              (t(e.id, o.trim() || e.name), a(false));
            }}
            style={{
              ...estiloBotao,
              padding: "3px 10px",
              fontSize: 11,
              color: tema.up,
              borderColor: tema.up,
            }}
          >
            salvar
          </button>
        </>
      ) : (
        <b
          style={{
            color: tema.text,
          }}
        >
          {e.name}
        </b>
      )}
      <span
        style={{
          color: tema.faint,
        }}
      >
        {e.points.length}
        {" pregões"}
      </span>
      {c != null && (
        <span
          style={{
            color: tema.faint,
          }}
        >
          {fmtData(c)}
          {" → "}
          {fmtData(u)}
        </span>
      )}
      <span
        style={{
          flex: 1,
        }}
      />
      {!n && (
        <button
          onClick={() => {
            (i(e.name), a(true));
          }}
          style={{
            ...estiloBotao,
            padding: "3px 10px",
            fontSize: 11,
            color: tema.dim,
          }}
        >
          renomear
        </button>
      )}
      <button
        onClick={() => {
          s ? r(e.id) : (l(true), setTimeout(() => l(false), 4000));
        }}
        style={{
          ...estiloBotao,
          padding: "3px 10px",
          fontSize: 11,
          color: s ? tema.down : tema.faint,
          borderColor: s ? tema.down : tema.line,
        }}
      >
        {s ? "confirmar exclusão?" : "excluir"}
      </button>
    </div>
  );
}
