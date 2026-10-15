/* Componente principal: estado global, abas e telas. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  curvaDoGrupo,
  migrarItens,
  resultadoDoItem,
  resumoPorEnvio,
} from "./acompanhamento.js";
import {
  Campo,
  CampoNumero,
  Chip,
  EditorCarteira,
  EnviarBenchmark,
  Estatistica,
  FichaEstrategia,
  GrupoConfig,
  LinhaBenchmark,
  NavegadorPregao,
  PainelAbertura,
  QuadroMesAMes,
  RelogioLeilao,
  Secao,
  SeletorPeriodo,
  Sparkline,
  StatusNuvem,
} from "./componentes.jsx";
import {
  FERIADOS_B3,
  GITHUB_DONO,
  GITHUB_REPO,
  LIMITE_SALTO,
  LIMITE_SALTO_ABERTURA,
  TICKERS_ANTIGOS,
  TICKERS_EXEMPLO,
  acharIbov,
  apagarBaseLocal,
  buscarBaseOficial,
  buscarCotacoesAoVivo,
  carregarBaseLocal,
  dentroDoPregao,
  encadearDataset,
  estadoDoPregao,
  linhasParaBase,
  mesclarNaBase,
  montarDataset,
  salvarBaseLocal,
  tsPregao,
  ultimoPregaoEsperado,
} from "./dados.js";
import {
  CORES_SERIES,
  ESTRATEGIAS,
  GUIA_DA_SERIE,
  GUIA_ESTRATEGIAS,
  JUIZES,
  LOTE_PADRAO,
  MODO_OVER,
  NOMES_SERIES,
  ORDEM_ESTRATEGIAS,
  TERMOMETRO_PADRAO,
  VALOR_PADRAO,
  arredondarLote,
  backtestEstrategias,
  backtestPorJuiz,
  backtestRanking,
  compor,
  curvaCarteira,
  datasDasCurvas,
  liquidezNoDia,
  mesAMesCarteira,
  mesAMesCurva,
  pregaoAnterior,
  prepararIndicadores,
  qtdPara,
  rankingOvernight,
  recortarResultado,
  recortarResultados,
  rotuloBenchmark,
  sinaisDeQueda,
  sinaisDoDia,
  statsDaCurva,
  ultimasNoites,
} from "./estrategias.js";
import { proximoDiaUtil } from "./ir.js";
import {
  baixarCsv,
  baseEmCsv,
  exportarMesAMesPNG,
  lerArquivoBenchmark,
  operacoesDaSerie,
  planilhaOperacoes,
} from "./relatorios.js";
import { Resultados } from "./resultados.jsx";
import {
  CURSOR,
  Degrade,
  EIXO_X,
  EIXO_Y,
  GRADE,
  LegendaGrafico,
  MARGEM,
  PONTO_ATIVO,
  TooltipGrafico,
} from "./graficos.jsx";
import {
  AbasCelular,
  Aviso,
  CSS_GLOBAL,
  Cabecalho,
  SubAbas,
} from "./navegacao.jsx";

/* Data e hora do build, injetada pelo build.mjs. */
const PUBLICADO_EM =
  typeof __PUBLICADO_EM__ === "string" ? __PUBLICADO_EM__ : "dev";
import {
  COR_MIX_FIXO,
  COR_MIX_NR,
  DIAS_SEMANA,
  MESES_LONGOS,
  anoMes,
  corDoGrupo,
  estiloBotao,
  estiloInput,
  fmtData,
  fmtNum,
  fmtPct,
  numBR,
  tema,
} from "./tema.js";

const CONFIG_PADRAO = {
    taxa: 0.046,
    impacto: 0.1,
    precoMin: 1,
    topN: 6,
    queda: TERMOMETRO_PADRAO.queda,
    normal: TERMOMETRO_PADRAO.normal,
    limiar: TERMOMETRO_PADRAO.limiar,
    janela: 10,
  },
  LIMITES_CONFIG = {
    taxa: [0, 2],
    impacto: [0.01, 5],
    precoMin: [0, 100],
    topN: [1, 30],
    queda: [1, 20],
    normal: [1, 20],
    limiar: [30, 90],
    janela: [5, 600],
  };

function sanearConfig(e) {
  let t = {
    ...CONFIG_PADRAO,
  };
  for (let [r, [n, a]] of Object.entries(LIMITES_CONFIG)) {
    let o = Number(e?.[r]);
    Number.isFinite(o) && (t[r] = Math.min(a, Math.max(n, o)));
  }
  for (let r of ["topN", "queda", "normal", "janela"]) t[r] = Math.round(t[r]);
  return t;
}

export function App() {
  let e = useRef(new Map()),
    [t, r] = useState(0),
    [n, a] = useState(true),
    [o, i] = useState(false),
    [s, l] = useState(null),
    [c, u] = useState(null),
    [f, p] = useState(null),
    [h, g] = useState(null),
    [m, x] = useState(false),
    [y, b] = useState(null),
    [S, T] = useState(false),
    [A, w] = useState("operar"),
    [_, E] = useState("executar"),
    [P, O] = useState("estrategias"),
    R =
      A === "operar"
        ? _
        : A === "estrategias"
          ? P
          : A === "resultados"
            ? "acompanhar"
            : A === "config"
              ? "config"
              : A === "readme"
                ? "readme"
                : "base",
    M = useCallback((D) => {
      D === "executar" || D === "hoje"
        ? (w("operar"), E(D))
        : D === "estrategias" || D === "comparar" || D === "mesames"
          ? (w("estrategias"), O(D))
          : w(
              D === "acompanhar" || D === "resultados"
                ? "resultados"
                : D === "readme" || D === "manual"
                  ? "readme"
                  : D === "config"
                    ? "config"
                    : "base",
            );
    }, []),
    [H, Y] = useState(CONFIG_PADRAO),
    G = useCallback((D) => {
      Y((V) => {
        let ne = {
          ...V,
          ...D,
        };
        return (
          window.storage.set("ovr3:config", JSON.stringify(ne)).catch(() => {}),
          ne
        );
      });
    }, []),
    k = H.taxa,
    F = H.janela,
    q = H.janela,
    N = H.impacto,
    j = H.precoMin,
    I = H.topN,
    C = H.topN,
    L = useMemo(
      () => ({
        queda: H.queda,
        normal: H.normal,
        limiar: H.limiar,
      }),
      [H.queda, H.normal, H.limiar],
    ),
    [B, W] = useState(null),
    [J, ie] = useState(() => new Set()),
    ce = useCallback((D) => {
      ie((V) => {
        let ne = new Set(V);
        return (
          ne.has(D) ? ne.delete(D) : ne.add(D),
          window.storage
            .set("ovr3:ocultos", JSON.stringify(Array.from(ne)))
            .catch(() => {}),
          ne
        );
      });
    }, []),
    [X, se] = useState(40),
    ge = useCallback((D) => {
      let V = Math.max(0, +D || 0);
      (se(V), window.storage.set("ovr3:vol_min", String(V)).catch(() => {}));
    }, []),
    [z, Me] = useState(30),
    [te, Ae] = useState("media"),
    [fe, xe] = useState(null),
    [Ge, yt] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        let D = await window.storage.get("ovr3:carteira");
        D?.value && yt(JSON.parse(D.value));
      } catch {}
    })();
  }, []);
  let It = (D) => {
      (_k(D),
        window.storage
          .set("ovr3:cesta_padrao", JSON.stringify(D))
          .catch(() => {}));
    },
    Lt = (D) => {
      (yt(D),
        window.storage.set("ovr3:carteira", JSON.stringify(D)).catch(() => {}));
    },
    [pt, kt] = useState([]),
    [Qe, Ot] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        let D = await window.storage.get("ovr3:bmidx");
        if (!D?.value) return;
        let V = JSON.parse(D.value),
          ne = [];
        for (let le of V)
          try {
            let ye = await window.storage.get("ovr3:bm:" + le.id);
            ye?.value &&
              ne.push({
                id: le.id,
                name: le.name,
                points: JSON.parse(ye.value),
              });
          } catch {}
        kt(ne);
      } catch {}
    })();
  }, []);
  let Yt = (D) =>
      window.storage
        .set(
          "ovr3:bmidx",
          JSON.stringify(
            D.map(({ id: V, name: ne }) => ({
              id: V,
              name: ne,
            })),
          ),
        )
        .catch(() => {}),
    ga = async (D, V) => {
      try {
        let { points: ne, asPercent: le } = await lerArquivoBenchmark(D);
        if (ne.length < 5) {
          Ot(
            "Arquivo sem dados válidos (esperado: coluna de data + coluna de resultado diário).",
          );
          return;
        }
        let ye = String(Date.now()),
          Ke = {
            id: ye,
            name: (V || D.name.replace(/\.[^.]+$/, "")).slice(0, 30),
            points: ne,
          },
          Xe = [...pt, Ke];
        (kt(Xe),
          Yt(Xe),
          window.storage
            .set("ovr3:bm:" + ye, JSON.stringify(ne))
            .catch(() => {}),
          Ot(
            `"${Ke.name}": ${ne.length} pregões carregados (valores lidos como ${le ? "porcentagem" : "fração decimal"}).`,
          ));
      } catch {
        Ot("Falha ao ler o arquivo do benchmark.");
      }
    },
    Kr = (D, V) => {
      let ne = pt.map((le) =>
        le.id === D
          ? {
              ...le,
              name: V.slice(0, 30),
            }
          : le,
      );
      (kt(ne), Yt(ne));
    },
    an = async (D) => {
      let V = pt.filter((ne) => ne.id !== D);
      (kt(V), Yt(V));
      try {
        await window.storage.delete("ovr3:bm:" + D);
      } catch {}
      (ky((ne) => {
        let le = new Set(ne);
        return (le.delete(D), le);
      }),
        Xi((ne) =>
          ne.type === "custom" && ne.id === D
            ? {
                type: "rf",
                annual: 12,
              }
            : ne,
        ));
    },
    [Ze, Ht] = useState(null),
    [Bt, wr] = useState(null),
    [Cs, Ty] = useState("acum"),
    [dk, ky] = useState(() => new Set()),
    [Ml, wh] = useState("over"),
    [Ut, Xi] = useState({
      type: "rf",
      annual: 12,
    }),
    [Do, Rl] = useState([]),
    Bd = useCallback((D) => {
      (Rl(D),
        window.storage
          .set("ovr3:mm_quadros", JSON.stringify(D))
          .catch(() => {}));
    }, []),
    [Sh, Oy] = useState(false),
    [jd, Cy] = useState(false),
    [Ps, ui] = useState(null),
    [Is, zd] = useState(null),
    qd = [
      "mark",
      "idx",
      "ativo",
      "media",
      "aparada",
      "maxDia",
      "win",
      "comp",
      "maxDD",
      "stockVar",
      "volMed",
      "cap",
      "sugestao",
      "acoes",
      "curva",
    ],
    [on, tu] = useState(null),
    [U, Z] = useState(null),
    [K, Q] = useState(false),
    [ee, re] = useState("periodo"),
    [ue, be] = useState(null),
    [me, pe] = useState(null),
    [he, Re] = useState("acum"),
    [Ue, Je] = useState(
      () =>
        new Set([
          "cesta_padrao",
          "media",
          "reversao",
          "n_mix",
          "n_mix_nr",
          "n_mix_nr_fixo",
          "n_placar",
          "n_panico",
          "n_elastico",
        ]),
    ),
    [je, Ve] = useState(null),
    [mt, nr] = useState(false),
    [Ln, Pr] = useState(null),
    [En, Dl] = useState(false),
    [Fs, fi] = useState({}),
    [Ki, ro] = useState(["mix"]),
    [di, Yi] = useState([]),
    [Qi, _h] = useState([
      {
        id: "reais",
        nome: "Entradas reais",
        tipo: "reais",
      },
    ]),
    [Nl, pk] = useState({}),
    [xa, mk] = useState(true),
    [hk, vk] = useState(false),
    [gk, Ah] = useState(null),
    [xk, yk] = useState(""),
    [ru, bk] = useState(""),
    [Ms, wk] = useState("acum"),
    [Py, Sk] = useState({}),
    [Ll, _k] = useState(() =>
      TICKERS_EXEMPLO.map((D) => ({
        ativo: D,
        valor: 10000,
      })),
    ),
    [Eh, Ak] = useState("periodo"),
    [Iy, Ek] = useState(null),
    [Fy, My] = useState(null),
    [dW, Tk] = useState({}),
    [pW, kk] = useState({}),
    [mW, hW] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        let D = await window.storage.get("ovr3:acomp_itens");
        D?.value && Yi(migrarItens(JSON.parse(D.value)));
      } catch {}
      try {
        let D = await window.storage.get("ovr3:acomp_grupos");
        D?.value && _h(JSON.parse(D.value));
      } catch {}
      try {
        let D = await window.storage.get("ovr3:lotes");
        D?.value && pk(JSON.parse(D.value));
      } catch {}
      try {
        let D = await window.storage.get("ovr3:tipos_ir");
        D?.value && Tk(JSON.parse(D.value) || {});
      } catch {}
      try {
        let D = await window.storage.get("ovr3:ir_ajustes");
        D?.value && kk(JSON.parse(D.value) || {});
      } catch {}
      try {
        let D = await window.storage.get("ovr3:acomp_abertos");
        D?.value && Sk(JSON.parse(D.value) || {});
      } catch {}
      try {
        let D = await window.storage.get("ovr3:encadear");
        D?.value != null && mk(D.value !== "0");
      } catch {}
      try {
        let D = await window.storage.get("ovr3:mm_quadros");
        if (D?.value) {
          let V = JSON.parse(D.value);
          Array.isArray(V) &&
            Rl(
              V.map((ne) =>
                ne && ne.fonte === "mix_nr_v34"
                  ? {
                      ...ne,
                      fonte: "mix_nr_fixo",
                    }
                  : ne,
              ),
            );
        }
      } catch {}
      try {
        let D = await window.storage.get("ovr3:vol_min");
        D?.value != null && +D.value >= 0 && se(+D.value);
      } catch {}
      try {
        let D = await window.storage.get("ovr3:config"),
          V = D?.value ? JSON.parse(D.value) : null;
        V && typeof V == "object" && Y(sanearConfig(V));
      } catch {}
      try {
        let D = await window.storage.get("ovr3:ocultos"),
          V = D?.value ? JSON.parse(D.value) : null;
        Array.isArray(V) &&
          ie(
            new Set(
              V.map((ne) => (ne === "n_mix_nr_v34" ? "n_mix_nr_fixo" : ne)),
            ),
          );
      } catch {}
      try {
        let D = await window.storage.get("ovr3:cesta_padrao"),
          V = D?.value ? JSON.parse(D.value) : null;
        Array.isArray(V) && V.length && _k(V);
      } catch {}
      try {
        let D = await window.storage.get("ovr3:estr_operar"),
          V = D?.value ? JSON.parse(D.value) : null;
        Array.isArray(V) && V.length && ro(V);
      } catch {}
    })();
  }, []);
  let vW = useCallback((D) => {
      ro((V) => {
        let ne = V.includes(D) ? V.filter((ye) => ye !== D) : [...V, D],
          le = ne.length ? ne : ["mix"];
        return (
          window.storage
            .set("ovr3:estr_operar", JSON.stringify(le))
            .catch(() => {}),
          le
        );
      });
    }, []),
    Ok = useRef(new Set());
  useEffect(() => {
    let D = Qi.filter((V) => !Ok.current.has(V.id));
    D.length !== 0 &&
      (D.forEach((V) => Ok.current.add(V.id)),
      Je((V) => {
        let ne = new Set(V);
        return (D.forEach((le) => ne.add("g_" + le.id)), ne);
      }));
  }, [Qi]);
  let YEe = useCallback((D) => {
      (Yi(D),
        window.storage
          .set("ovr3:acomp_itens", JSON.stringify(D))
          .catch(() => {}));
    }, []),
    QEe = useCallback((D) => {
      (_h(D),
        window.storage
          .set("ovr3:acomp_grupos", JSON.stringify(D))
          .catch(() => {}));
    }, []),
    Ck = useCallback((D, V, ne, le, ye, Ke, Xe) => {
      Yi((De) => {
        if (
          De.some(
            (Ee) =>
              Ee.ticker === D && Ee.estrategiaId === V && Ee.dataEnvio === ye,
          )
        )
          return De;
        let Pe = Ke === undefined ? VALOR_PADRAO : Ke,
          it = Xe === undefined ? qtdPara(Pe, le) : Xe,
          ve = [
            ...De,
            {
              id: `${D}_${V}_${ye}_${Date.now()}`,
              ticker: D,
              estrategiaId: V,
              estrategiaNome: ne,
              dataEnvio: ye,
              grupoId: null,
              precoEntrada: le,
              origemPreco: "provisorio",
              precoProvisorio: le,
              valorInvestido: Pe > 0 ? Pe : null,
              qtd: Pe > 0 ? (it ?? 0) : null,
              abertura: null,
              origemAbertura: null,
            },
          ];
        return (
          window.storage
            .set("ovr3:acomp_itens", JSON.stringify(ve))
            .catch(() => {}),
          ve
        );
      });
    }, []),
    Ry = useCallback((D) => {
      Sk((V) => {
        let ne = {
          ...V,
          ...D,
        };
        return (
          window.storage
            .set("ovr3:acomp_abertos", JSON.stringify(ne))
            .catch(() => {}),
          ne
        );
      });
    }, []),
    gW = useCallback((D, V) => {
      pk((ne) => {
        let le = {
          ...ne,
          [D]: V,
        };
        return (
          window.storage.set("ovr3:lotes", JSON.stringify(le)).catch(() => {}),
          le
        );
      });
    }, []),
    xW = useCallback((D, V) => {
      Tk((ne) => {
        let le = {
          ...ne,
        };
        return (
          V ? (le[D] = V) : delete le[D],
          window.storage
            .set("ovr3:tipos_ir", JSON.stringify(le))
            .catch(() => {}),
          le
        );
      });
    }, []),
    yW = useCallback((D, V) => {
      kk((ne) => {
        let le = {
          ...(ne[D] || {}),
          ...V,
        };
        for (let Ke of Object.keys(le))
          (le[Ke] == null || !Number.isFinite(le[Ke])) && delete le[Ke];
        let ye = {
          ...ne,
        };
        return (
          Object.keys(le).length ? (ye[D] = le) : delete ye[D],
          window.storage
            .set("ovr3:ir_ajustes", JSON.stringify(ye))
            .catch(() => {}),
          ye
        );
      });
    }, []),
    Pk = useCallback((D) => {
      (hW({
        gid: D,
        n: Date.now(),
      }),
        w("resultados"));
    }, []),
    nu = useCallback((D, V) => {
      Yi((ne) => {
        let le = ne.map((ye) =>
          ye.id === D
            ? {
                ...ye,
                ...V,
              }
            : ye,
        );
        return (
          window.storage
            .set("ovr3:acomp_itens", JSON.stringify(le))
            .catch(() => {}),
          le
        );
      });
    }, []),
    Ik = useCallback((D) => {
      Yi((V) => {
        let ne = V.filter((le) => le.id !== D);
        return (
          window.storage
            .set("ovr3:acomp_itens", JSON.stringify(ne))
            .catch(() => {}),
          ne
        );
      });
    }, []),
    bW = useCallback((D) => {
      let V = (D || "").trim();
      if (!V) return null;
      let ne = "sim_" + Date.now();
      return (
        _h((le) => {
          let ye = [
            ...le,
            {
              id: ne,
              nome: V,
              tipo: "sim",
            },
          ];
          return (
            window.storage
              .set("ovr3:acomp_grupos", JSON.stringify(ye))
              .catch(() => {}),
            ye
          );
        }),
        ne
      );
    }, []),
    wW = useCallback((D) => {
      (_h((V) => {
        let ne = V.filter((le) => le.id !== D);
        return (
          window.storage
            .set("ovr3:acomp_grupos", JSON.stringify(ne))
            .catch(() => {}),
          ne
        );
      }),
        Yi((V) => {
          let ne = V.map((le) =>
            le.grupoId === D
              ? {
                  ...le,
                  grupoId: null,
                }
              : le,
          );
          return (
            window.storage
              .set("ovr3:acomp_itens", JSON.stringify(ne))
              .catch(() => {}),
            ne
          );
        }));
    }, []),
    SW = useCallback(async () => {
      let ovHoje = tsPregao(new Date()),
        ovAlvo = (ovI) => proximoDiaUtil(ovI.dataEnvio),
        ovPend = di.filter(
          (ovI) =>
            ovI.grupoId &&
            ovI.origemAbertura !== "cotahist" &&
            ovI.origemAbertura !== "manual",
        );
      if (ovPend.length === 0) {
        Ah(
          "Nenhum item pendente de abertura (organize os itens em um grupo primeiro).",
        );
        return;
      }
      (vk(true), Ah(null));
      try {
        let V = Array.from(
            new Set(
              ovPend
                .filter((ovI) => {
                  let ovA = ovAlvo(ovI);
                  return (
                    ovA != null &&
                    ovA <= ovHoje &&
                    !(
                      ovI.origemAbertura === "yahoo" && ovI.dataAbertura === ovA
                    )
                  );
                })
                .map((ovI) => ovI.ticker),
            ),
          ),
          ne = new Map(),
          le = [];
        if (V.length) {
          let ovR = await buscarCotacoesAoVivo(V);
          ((ne = ovR.incoming), (le = ovR.ausentes || []));
        }
        let ovPatch = new Map(),
          ovOk = 0,
          ovLimpos = 0,
          ovFuturo = 0,
          ovHojeSem = 0,
          ovPassado = 0;
        for (let ovI of ovPend) {
          let ovA = ovAlvo(ovI),
            ovQ = ovA != null && ovA <= ovHoje ? ne.get(ovI.ticker) : null,
            ovP = ovQ ? ovQ.get(ovA) : null;
          if (
            ovI.origemAbertura === "yahoo" &&
            ovI.dataAbertura === ovA &&
            !ovP
          )
            continue;
          if (ovP && ovP.abertura > 0) {
            (ovOk++,
              ovPatch.set(ovI.id, {
                abertura: ovP.abertura,
                origemAbertura: "yahoo",
                dataAbertura: ovA,
              }));
            continue;
          }
          ovI.origemAbertura === "yahoo" &&
            (ovLimpos++,
            ovPatch.set(ovI.id, {
              abertura: null,
              origemAbertura: null,
              dataAbertura: null,
            }));
          ovA == null || ovA > ovHoje
            ? ovFuturo++
            : ovA === ovHoje
              ? ovHojeSem++
              : ovPassado++;
        }
        (ovPatch.size &&
          Yi((ye) => {
            let Ke = ye.map((Xe) => {
              let ovX = ovPatch.get(Xe.id);
              return ovX &&
                Xe.origemAbertura !== "cotahist" &&
                Xe.origemAbertura !== "manual"
                ? {
                    ...Xe,
                    ...ovX,
                  }
                : Xe;
            });
            return (
              window.storage
                .set("ovr3:acomp_itens", JSON.stringify(Ke))
                .catch(() => {}),
              Ke
            );
          }),
          Ah(
            `Abertura pelo Yahoo: ${ovOk} item(ns) preenchido(s) com a abertura do pregão certo` +
              (ovFuturo
                ? ` · ${ovFuturo} aguardando a abertura do próximo pregão`
                : "") +
              (ovHojeSem
                ? ` · ${ovHojeSem} com venda hoje, mas o pregão de hoje ainda não abriu`
                : "") +
              (ovPassado
                ? ` · ${ovPassado} com venda em pregão passado — a abertura vem pelo COTAHIST ou digitada`
                : "") +
              (ovLimpos
                ? ` · ${ovLimpos} abertura(s) apagada(s) por serem de outro dia`
                : "") +
              (le?.length ? ` · ${le.length} sem retorno` : "") +
              ".",
          ));
      } catch (V) {
        Ah(V.message || "falha ao buscar cotação de agora");
      } finally {
        vk(false);
      }
    }, [di]),
    [au, _W] = useState(false),
    [Ud, AW] = useState(20),
    [Fk, Mk] = useState(null),
    [EW, Rk] = useState(() => ["visao"]),
    Ia = useCallback((D) => {
      Rk((V) => (V.includes(D) ? V.filter((ne) => ne !== D) : [...V, D]));
    }, []),
    ou = useCallback((D) => {
      (Mk(D),
        w("readme"),
        Rk((V) => (V.includes("fichas") ? V : [...V, "fichas"])),
        setTimeout(() => {
          let V =
            typeof document < "u" ? document.getElementById("guia-" + D) : null;
          V &&
            V.scrollIntoView &&
            V.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
        }, 60));
    }, []),
    [Dy, Dk] = useState(qd),
    Ny = useRef(null);
  useEffect(() => {
    (async () => {
      try {
        let D = await window.storage.get("ovr3:colOrder");
        if (D?.value) {
          let V = JSON.parse(D.value).filter((le) => qd.includes(le)),
            ne = qd.filter((le) => !V.includes(le));
          V.length && Dk([...V, ...ne]);
        }
      } catch {}
    })();
  }, []);
  let TW = (D, V) => {
      !D ||
        D === V ||
        Dk((ne) => {
          let le = ne.filter((ye) => ye !== D);
          return (
            le.splice(le.indexOf(V), 0, D),
            window.storage
              .set("ovr3:colOrder", JSON.stringify(le))
              .catch(() => {}),
            le
          );
        });
    },
    kW = (D) => {
      zd((V) =>
        V && V.key === D
          ? V.dir === "desc"
            ? {
                key: D,
                dir: "asc",
              }
            : null
          : {
              key: D,
              dir: "desc",
            },
      );
    },
    [Ly, By] = useState(false),
    [Nk, jy] = useState(false),
    [Bl, zy] = useState(() => new Set()),
    Th = useRef(null);
  useEffect(() => {
    (async () => {
      try {
        let D = await window.storage.get("ovr3:marcados");
        D?.value && zy(new Set(JSON.parse(D.value)));
      } catch {}
    })();
  }, []);
  let OW = useCallback((D) => {
      zy((V) => {
        let ne = new Set(V);
        return (
          ne.has(D) ? ne.delete(D) : ne.add(D),
          window.storage
            .set("ovr3:marcados", JSON.stringify(Array.from(ne)))
            .catch(() => {}),
          ne
        );
      });
    }, []),
    [Lk, CW] = useState(() => dentroDoPregao());
  useEffect(() => {
    let D = setInterval(() => CW(dentroDoPregao()), 30000);
    return () => clearInterval(D);
  }, []);
  let [qy, Uy] = useState(() => new Set());
  useEffect(() => {
    (async () => {
      try {
        let D = await window.storage.get("ovr3:excluidos");
        D?.value && Uy(new Set(JSON.parse(D.value)));
      } catch {}
    })();
  }, []);
  let PW = useCallback((D) => {
      Uy((V) => {
        let ne = new Set(V);
        return (
          ne.has(D) ? ne.delete(D) : ne.add(D),
          window.storage
            .set("ovr3:excluidos", JSON.stringify(Array.from(ne)))
            .catch(() => {}),
          ne
        );
      });
    }, []),
    Wd = useCallback(() => {
      (Uy(new Set()),
        window.storage.set("ovr3:excluidos", "[]").catch(() => {}));
    }, []),
    $d = useCallback(
      async ({ limparExclusoes: D = true } = {}) => {
        (x(true), g(null));
        try {
          let { incoming: V, meta: ne } = await buscarBaseOficial(),
            { added: le, revised: ye } = mesclarNaBase(e.current, V);
          return (
            p(ne),
            D && Wd(),
            r((Ke) => Ke + 1),
            l(
              `Base oficial sincronizada: ${fmtNum(le)} pregões novos, ${fmtNum(ye)} revisados.`,
            ),
            ne || true
          );
        } catch (V) {
          return (g(V.message || "falha ao sincronizar a base"), false);
        } finally {
          x(false);
        }
      },
      [Wd],
    );
  useEffect(() => {
    (async () => (
      (e.current = await carregarBaseLocal()),
      r((D) => D + 1),
      await $d({
        limparExclusoes: false,
      }),
      a(false)
    ))();
  }, []);
  let _e = useMemo(
      () => (e.current.size === 0 ? null : montarDataset(e.current, k)),
      [t, k],
    ),
    Yr = useMemo(() => (_e && xa ? encadearDataset(_e, k) : _e), [_e, xa, k]);
  useEffect(() => {
    (_e &&
      (fe == null || !_e.dates.includes(fe)) &&
      xe(_e.dates[_e.dates.length - 1] ?? null),
      _e && Ps == null && ui(Array.from(_e.byTicker.keys()).sort()[0] ?? null));
  }, [_e]);
  let Bk = useCallback((D) => {
      let V = Array.from(D || []).filter(
        (le) => le && /\.(csv|txt)$/i.test(le.name),
      );
      if (V.length === 0) return;
      (i(true), l(null), u(null));
      let ne = (le) =>
        new Promise((ye) => {
          let Ke = new FileReader();
          ((Ke.onload = () => {
            Papa.parse(Ke.result, {
              delimiter: ";",
              skipEmptyLines: true,
              complete: (Xe) => ye(Xe.data),
              error: () => ye([]),
            });
          }),
            (Ke.onerror = () => ye([])),
            Ke.readAsText(le, "ISO-8859-1"));
        });
      Promise.all(V.map(ne)).then(async (le) => {
        let { incoming: ye } = linhasParaBase(le.flat()),
          {
            added: Ke,
            revised: Xe,
            kept: De,
            changed: Pe,
          } = mesclarNaBase(e.current, ye);
        (r((Ee) => Ee + 1),
          l(
            `${V.length} arquivo(s): ${fmtNum(Ke)} pregões novos, ${fmtNum(Xe)} revisados, ${fmtNum(De)} já existiam (mantidos). Atenção: o que o COTAHIST cobrir será sobrescrito na próxima sincronização.`,
          ),
          i(false));
        let it = new Set(Array.from(Pe).map((Ee) => Ee[0])),
          ve = await salvarBaseLocal(e.current, it);
        ve.length &&
          u(
            `Falha ao salvar grupos: ${ve.join(", ")} — os dados seguem na sessão, tente carregar de novo para regravar.`,
          );
      });
    }, []),
    kh = useMemo(() => (_e ? acharIbov(_e.byTicker) : null), [_e]),
    pi = _e && _e.dates.length ? _e.dates[_e.dates.length - 1] : null;
  (useEffect(() => {
    if (!_e || _e.dates.length === 0 || on != null) return;
    let D = _e.dates[_e.dates.length - 1],
      V = new Date(D),
      ne = Date.UTC(V.getUTCFullYear() - 1, V.getUTCMonth(), 1);
    (tu(_e.dates.find((le) => le >= ne) ?? _e.dates[0]), Z(D));
  }, [_e, on]),
    useEffect(() => {
      !_e ||
        _e.dates.length === 0 ||
        (Iy == null && Ek(_e.dates[0]),
        Fy == null && My(_e.dates[_e.dates.length - 1]));
    }, [_e]));
  let jk = useRef(null);
  useEffect(() => {
    let D = jk.current;
    ((jk.current = pi),
      !(D == null || pi == null || pi === D) &&
        (Z((V) => (V === D ? pi : V)),
        My((V) => (V === D ? pi : V)),
        wr((V) => (V === D ? pi : V))));
  }, [pi]);
  let Hd = useMemo(
      () =>
        kh
          ? {
              mode: "rv",
              ticker: kh,
              label: kh,
            }
          : null,
      [kh],
    ),
    Rs = Hd?.label ?? "IBOV",
    Bn = Hd?.ticker ?? null,
    Vt = useMemo(
      () => (!Yr || Yr.dates.length < 150 ? null : prepararIndicadores(Yr)),
      [Yr],
    ),
    jl = useMemo(
      () =>
        je && _e ? recortarResultados(je, _e, on ?? -1 / 0, U ?? 1 / 0) : je,
      [je, _e, on, U],
    ),
    Wy = useMemo(
      () =>
        JSON.stringify({
          lb: q,
          topN: C,
          minVolMM: X,
          termometro: L,
          precoMin: j,
          fee: k,
          encadear: xa,
          bench: Bn,
          cesta: Ll,
          lotes: Nl,
          ultimo: pi,
        }),
      [q, C, X, L, j, k, xa, Bn, Ll, Nl, pi],
    ),
    IW = useCallback(() => {
      !_e ||
        _e.dates.length < 2 ||
        (Q(true),
        be(null),
        setTimeout(() => {
          try {
            let D = _e.dates[0],
              V = _e.dates[_e.dates.length - 1],
              ne = Math.min(
                V,
                _e.dates.length > 1 ? _e.dates[_e.dates.length - 2] : -1 / 0,
              ),
              le = {
                tsIni: D,
                tsFim: V,
                lbDays: q,
                minVolMM: X,
                topN: C,
                benchTicker: Bn,
              },
              ye = backtestRanking(Yr, {
                ...le,
                criterio: "media",
              }),
              Ke = backtestRanking(Yr, {
                ...le,
                criterio: "aparada",
              }),
              Xe = backtestRanking(Yr, {
                ...le,
                criterio: "reversao",
              }),
              De = {};
            Vt &&
              (De = backtestEstrategias(Vt, {
                minVolMM: X,
                precoMin: j,
                topN: C,
                tsIni: D,
                tsFim: V,
                termometro: L,
                minNoites: 1,
              }));
            let Pe = (() => {
              let ve = curvaCarteira(
                _e,
                Ll,
                xa,
                k,
                (Ee) => Nl[Ee] ?? LOTE_PADRAO,
              )
                .map((Ee) => ({
                  ...Ee,
                  tsCompra: pregaoAnterior(_e, Ee.ts),
                }))
                .filter(
                  (Ee) =>
                    Ee.tsCompra != null && Ee.tsCompra >= D && Ee.tsCompra <= V,
                );
              return ve.length === 0 ? null : statsDaCurva(ve);
            })();
            be({
              media: ye,
              aparada: Ke,
              reversao: Xe,
              novas: De,
              padrao: Pe,
              nCesta: Ll.filter((it) => it.valor > 0).length,
              params: {
                ...le,
                compraMax: ne,
                assin: Wy,
              },
            });
          } catch (D) {
            be({
              erro: D.message,
            });
          } finally {
            Q(false);
          }
        }, 40));
    }, [_e, Yr, q, C, X, Bn, Wy, Vt, j, L, Ll, xa, k, Nl]),
    [zk, qk] = useState(false),
    [Uk, Oh] = useState(null),
    FW = useCallback(() => {
      !Vt ||
        !Yr ||
        on == null ||
        U == null ||
        (qk(true),
        Oh(null),
        setTimeout(() => {
          try {
            let D = backtestPorJuiz(Vt, {
                minVolMM: X,
                precoMin: j,
                topN: C,
                tsIni: on,
                tsFim: U,
                termometro: L,
              }),
              V = {
                tsIni: on,
                tsFim: U,
                lbDays: q,
                minVolMM: X,
                topN: C,
                benchTicker: Bn,
              },
              ne = [
                ["media", "Escolha pela MEDIA"],
                ["aparada", "Escolha pela MEDIA APARADA"],
                ["reversao", "Queda Forte no Fundo"],
              ]
                .map(([Xe, De]) =>
                  operacoesDaSerie(
                    Yr,
                    backtestRanking(Yr, {
                      ...V,
                      criterio: Xe,
                    }),
                    De,
                    "j_" + Xe,
                  ),
                )
                .filter(Boolean),
              le = [...D, ...ne];
            if (le.length === 0) {
              Oh("Nenhuma operação no período — amplie De/Até.");
              return;
            }
            let ye = planilhaOperacoes(le, {
                periodo: `${fmtData(on)} a ${fmtData(U)}`,
                minVolMM: fmtNum(X),
                precoMin: numBR(j, 2),
                topN: C,
                mixMax: `${L.queda} em dia de queda (>${L.limiar}% dos líquidos), ${L.normal} nos demais`,
                feePct: numBR(k, 3),
                lbDays: q,
                geradoEm: new Date().toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                }),
              }),
              Ke = (Xe) => new Date(Xe).toISOString().slice(0, 10);
            (XLSX.writeFile(ye, `operacoes-overnight_${Ke(on)}_${Ke(U)}.xlsx`),
              Oh(
                `${le.length} estratégias · ${le.reduce((Xe, De) => Xe + De.linhas.length, 0)} operações exportadas.`,
              ));
          } catch (D) {
            Oh("Falha ao gerar a planilha: " + (D?.message ?? "erro"));
          } finally {
            qk(false);
          }
        }, 40));
    }, [Vt, Yr, on, U, q, C, X, j, L, k, Bn]),
    $y = useMemo(() => {
      if (!_e || Ge.length === 0) return [];
      let D = new Set();
      for (let V of Ge) {
        let ne = [V.ativo, ...(xa ? TICKERS_ANTIGOS[V.ativo] || [] : [])];
        for (let le of ne)
          if (_e.byTicker.has(le))
            for (let ye of _e.byTicker.get(le)) D.add(ye.ts);
      }
      return Array.from(D).sort((V, ne) => V - ne);
    }, [_e, Ge, xa]),
    iu = useMemo(() => ($y.length > 0 ? $y : (_e?.dates ?? [])), [$y, _e]);
  useEffect(() => {
    if (iu.length > 0) {
      let D = iu[0],
        V = iu[iu.length - 1];
      ((Ze == null || Ze < D || Ze > V) && Ht(D),
        (Bt == null || Bt < D || Bt > V) && wr(V));
    }
  }, [iu]);
  let Vd = useMemo(() => {
      if (Ut.type !== "custom") return Ut;
      let D = pt.find((V) => V.id === Ut.id);
      return D
        ? {
            type: "custom",
            id: D.id,
            points: D.points,
          }
        : {
            type: "rf",
            annual: 12,
          };
    }, [Ut, pt]),
    Ch = useMemo(() => {
      if (!_e || R !== "mesames" || Ge.length === 0 || Ze == null || Bt == null)
        return null;
      let D = mesAMesCarteira(_e, Ge, Vd, Bn, Ze, Bt, xa, k);
      return (D && (D.metricKey = Ml), D);
    }, [_e, R, Ge, Ze, Bt, Vd, Ml, Bn, xa, k]),
    Wk = useMemo(() => {
      if (
        !_e ||
        R !== "mesames" ||
        Ze == null ||
        Bt == null ||
        !Do.some((ne) => ne.fonte && ne.fonte !== "carteira")
      )
        return null;
      let D = {},
        V = new Set(Do.map((ne) => ne.fonte));
      if (Vt && Array.from(V).some((ne) => !JUIZES[ne] && ne !== "carteira")) {
        let ne = backtestEstrategias(Vt, {
          minVolMM: X,
          precoMin: j,
          topN: C,
          tsIni: Ze,
          tsFim: Bt,
          termometro: L,
          minNoites: 1,
        });
        for (let [le, ye] of Object.entries(ne))
          ye && !ye.erro && Array.isArray(ye.curva) && (D[le] = ye.curva);
      }
      for (let ne of V) {
        let le = JUIZES[ne];
        if (!le) continue;
        let ye = backtestRanking(Yr, {
          tsIni: Ze,
          tsFim: Bt,
          lbDays: q,
          minVolMM: X,
          topN: C,
          criterio: le,
          benchTicker: Bn,
        });
        ye && !ye.erro && (D[ne] = ye.curva);
      }
      return D;
    }, [_e, Yr, Vt, R, Ze, Bt, Do, X, j, C, q, L, Bn]),
    MW = useMemo(
      () =>
        !_e || R !== "mesames"
          ? []
          : Do.map((D) => {
              if (D.fonte === "carteira") {
                let ne =
                  Ge.length && Ze != null && Bt != null
                    ? mesAMesCarteira(_e, Ge, Vd, Bn, Ze, Bt, xa, k)
                    : null;
                return {
                  ...D,
                  nome: NOMES_SERIES.carteira,
                  res: ne,
                };
              }
              let V = Wk?.[D.fonte] ?? null;
              return {
                ...D,
                nome: NOMES_SERIES[D.fonte] ?? D.fonte,
                res: V ? mesAMesCurva(_e, V, Vd, Bn) : null,
              };
            }),
      [_e, R, Do, Wk, Vd, Bn, Ge, Ze, Bt, xa, k],
    ),
    su = useMemo(() => {
      let D = new Map();
      if (!_e || fe == null) return D;
      for (let V of _e.byTicker.keys()) D.set(V, liquidezNoDia(_e, V, fe));
      return D;
    }, [_e, fe]),
    Ds = useMemo(() => {
      let D = X * 1000000,
        V = 0;
      for (let ne of su.values()) ne != null && ne >= D && V++;
      return {
        n: V,
        ts: fe,
        piso: D,
      };
    }, [su, X, fe]),
    Hy = useCallback(
      (D) => {
        let V = su.get(D);
        return V == null || V < X * 1000000;
      },
      [su, X],
    ),
    Tn = useMemo(
      () =>
        !Yr || fe == null ? null : rankingOvernight(Yr, fe, F, X, z, te, Hd),
      [Yr, fe, F, X, z, te, Hd],
    ),
    JEe = useMemo(
      () => (!Yr || fe == null ? [] : sinaisDeQueda(Yr, fe, X, Bn)),
      [Yr, fe, X, Bn],
    ),
    Vy = useMemo(() => {
      if (!Vt || fe == null) return "";
      let D = Vt.dates.indexOf(fe),
        V = D > 0 ? Vt.dates[D - 1] : null;
      return V == null
        ? ""
        : Array.from(
            new Set(
              di.filter((ne) => ne.dataEnvio === V).map((ne) => ne.ticker),
            ),
          )
            .sort()
            .join(",");
    }, [Vt, fe, di]),
    St = useMemo(
      () =>
        !Vt || fe == null
          ? null
          : sinaisDoDia(Vt, fe, {
              minVolMM: X,
              precoMin: j,
              topN: I,
              termometro: L,
              excluirOntem: Vy ? Vy.split(",") : [],
              origemExclusao: "acompanhar",
            }),
      [Vt, fe, X, j, I, L, Vy],
    ),
    Ji = useMemo(
      () =>
        !St || St.erro
          ? []
          : ORDEM_ESTRATEGIAS.filter((D) => Ki.includes(D))
              .map((D) => St.carteiras[D])
              .filter(Boolean),
      [St, Ki],
    ),
    zl = useMemo(() => {
      if (!Tn || Tn.rows.length === 0) return null;
      let D = new Map(),
        V = 0;
      for (let ne of Tn.rows.slice(0, z)) {
        let le = (ne.volMed * N) / 100,
          ye = Math.floor(le / 100) * 100;
        ye <= 0 ||
          ((V += ye),
          D.set(ne.ativo, {
            valor: ye,
            cap: le,
          }));
      }
      return {
        alloc: D,
        total: V,
        nUsados: D.size,
      };
    }, [Tn, z, N]),
    Gy = useMemo(
      () =>
        !Vt || !au
          ? null
          : ultimasNoites(
              Vt,
              {
                minVolMM: X,
                precoMin: j,
                topN: I,
                termometro: L,
              },
              Ud,
              Ki,
            ),
      [Vt, au, Ud, X, j, I, L, Ki],
    ),
    lu = fe != null ? new Date(fe) : null,
    Xy = lu ? lu.getUTCDay() : null,
    Ky = useMemo(() => ultimoPregaoEsperado(new Date()), [t]),
    No = useMemo(() => {
      if (f?.ultimoPregao) {
        let [D, V, ne] = f.ultimoPregao.split("-").map(Number);
        return Date.UTC(D, V - 1, ne);
      }
      return _e && _e.dates.length ? _e.dates[_e.dates.length - 1] : null;
    }, [f, _e]),
    Yy = useMemo(() => {
      if (!_e || No == null) return 0;
      let D = 0,
        V = Ky;
      for (; V > No && D < 30; ) {
        let ne = new Date(V),
          le = ne.getUTCDay();
        (le !== 0 &&
          le !== 6 &&
          !FERIADOS_B3.has(ne.toISOString().slice(0, 10)) &&
          D++,
          (V -= 86400000));
      }
      return D;
    }, [_e, No, Ky]),
    RW = Yy > 0,
    Ph = useCallback((D) => D != null && No != null && D > No, [No]);
  useEffect(() => {
    !_e ||
      No == null ||
      Yi((D) => {
        let V = false,
          ne = D.map((le) => {
            let ye = _e.byTicker.get(le.ticker);
            if (!ye) return le;
            let Ke = le;
            if (le.origemPreco !== "cotahist" && le.dataEnvio <= No) {
              let Pe = ye.find((it) => it.ts === le.dataEnvio);
              Pe &&
                Pe.fech > 0 &&
                ((Ke = {
                  ...Ke,
                  precoEntrada: Pe.fech,
                  origemPreco: "cotahist",
                }),
                (V = true));
            }
            let Xe = _e.dates.findIndex((Pe) => Pe > le.dataEnvio),
              De = Xe >= 0 ? _e.dates[Xe] : null;
            if (De != null && Ke.origemAbertura !== "cotahist" && De <= No) {
              let Pe = ye.find((it) => it.ts === De);
              Pe &&
                Pe.abertura > 0 &&
                ((Ke = {
                  ...Ke,
                  abertura: Pe.abertura,
                  origemAbertura: "cotahist",
                }),
                (V = true));
            }
            return Ke;
          });
        return V
          ? (window.storage
              .set("ovr3:acomp_itens", JSON.stringify(ne))
              .catch(() => {}),
            ne)
          : D;
      });
  }, [_e, No]);
  let $k = useMemo(() => {
      if (!_e || fe == null) return 0;
      let D = 0;
      for (let [, V] of _e.byTicker) V[V.length - 1].ts < fe && D++;
      return D;
    }, [_e, fe]),
    Gd = (() => {
      if (Xy == null) return null;
      switch (Xy) {
        case 1:
          return {
            warn: false,
            text: "Montagem de segunda → venda terça na abertura. Overnight normal.",
          };
        case 2:
          return {
            warn: false,
            text: "Montagem de terça → venda quarta na abertura. Historicamente uma das boas montagens.",
          };
        case 3:
          return {
            warn: false,
            text: "Montagem de quarta → venda quinta na abertura. Se houver sinais de reversão, priorize-os.",
          };
        case 4:
          return F <= 21
            ? {
                warn: false,
                text: "Quinta com janela curta e re-ranqueamento frequente: no backtest fora da amostra a montagem ficou ~neutra (-0,02%). Pode operar normalmente — mas é o dia mais fraco da semana junto com quarta.",
              }
            : {
                warn: true,
                text: "QUINTA com janela longa: o gap quinta→sexta foi negativo no backtest (-0,13% na carteira de 12 meses). Sugestão validada: monte normalmente, mas não venda na abertura de sexta — segure e venda na abertura de segunda. Com janela curta re-ranqueada diariamente, esse ajuste não é necessário.",
              };
        case 5:
          return {
            warn: false,
            text: "Montagem de sexta → venda segunda na abertura. Melhor overnight da semana no backtest (+0,26% na carteira, fora da amostra).",
          };
        default:
          return {
            warn: false,
            text: "Data de referência cai em fim de semana — verifique os dados.",
          };
      }
    })(),
    ql = useMemo(() => (_e ? Array.from(_e.byTicker.keys()).sort() : []), [_e]),
    Zi = useMemo(
      () =>
        !_e || !Ps || !_e.byTicker.has(Ps)
          ? []
          : _e.byTicker.get(Ps).slice().reverse(),
      [_e, Ps],
    ),
    DW = useMemo(() => {
      let D = 0;
      for (let [, V] of e.current) D += V.size;
      return D;
    }, [t]),
    NW = async () => {
      if (!Ly) {
        (By(true), setTimeout(() => By(false), 4000));
        return;
      }
      (await apagarBaseLocal(),
        (e.current = new Map()),
        r((D) => D + 1),
        xe(null),
        ui(null),
        l(null),
        By(false));
    },
    LW = useCallback(async () => {
      let D = Array.from(e.current.keys());
      if (D.length !== 0) {
        let ovDentro = dentroDoPregao(),
          ovOficial = No;
        if (!ovDentro) {
          Wd();
          let ovMeta = await $d();
          if (ovMeta && ovMeta.ultimoPregao) {
            let [ovA, ovM, ovD] = ovMeta.ultimoPregao.split("-").map(Number);
            ovOficial = Date.UTC(ovA, ovM - 1, ovD);
          }
        }
        (T(true), ovDentro && g(null));
        try {
          let {
              incoming: V,
              estado: ne,
              consultadoEm: le,
              ausentes: ye,
              falhas: Ke,
            } = await buscarCotacoesAoVivo(D),
            Xe = tsPregao(new Date());
          if (!ovDentro && V.size > 0) {
            let ovCont = new Map();
            for (let ovP of V.values())
              for (let ovT of ovP.keys())
                ovCont.set(ovT, (ovCont.get(ovT) || 0) + 1);
            let ovMelhor = null,
              ovN = 0;
            for (let [ovT, ovQ] of ovCont)
              (ovQ > ovN || (ovQ === ovN && ovT > ovMelhor)) &&
                ((ovMelhor = ovT), (ovN = ovQ));
            Xe = ovMelhor;
            if (ovOficial != null && Xe <= ovOficial) {
              l(
                (ovX) =>
                  (ovX ? ovX + " " : "") +
                  `Fora do pregão: o último pregão (${fmtData(Xe)}) já está no COTAHIST oficial — nada a completar pelo Yahoo.`,
              );
              return;
            }
          }
          let {
            added: De,
            revised: Pe,
            recusados: it,
            recusadosPor: ve,
          } = mesclarNaBase(e.current, V, {
            somenteTs: Xe,
          });
          if ((Wd(), r((Ee) => Ee + 1), e.current && Xe != null)) {
            let Ee = false;
            for (let Ne of e.current.values())
              if (Ne.has(Xe)) {
                Ee = true;
                break;
              }
            Ee && xe(Xe);
          }
          (b({
            estado: ne,
            consultadoEm: le,
            n: V.size,
            recusados: it,
          }),
            l(
              (ovDentro
                ? "Cotação ao vivo"
                : `Fora do pregão — fechamento de ${fmtData(Xe)} pelo Yahoo`) +
                `: ${V.size} ativos (${fmtNum(De)} pregões novos, ${fmtNum(Pe)} atualizados)` +
                (ye.length ? ` · ${ye.length} sem retorno` : "") +
                (it > 0
                  ? ` · ${it} recusados por virem com data antiga (${Array.from(ve.keys()).slice(0, 4).join(", ")}${ve.size > 4 ? "…" : ""}) — histórico preservado`
                  : "") +
                ". Valores provisórios até o COTAHIST da noite.",
            ),
            V.size === 0 &&
              Ke?.length &&
              g(`Cotação não retornou nada. Motivo do servidor: ${Ke[0]}`));
        } catch (V) {
          g(V.message || "falha ao buscar cotação ao vivo");
        } finally {
          T(false);
        }
      }
    }, [$d, Wd, No]);
  // seletor de estratégias do OPERAR: fechado mostra só as seguidas
  let [seletorAberto, abrirSeletor] = useState(false);
  // navegação pelo endereço: #operar, #comparar, #acompanhar… (o botão
  // voltar do navegador volta para a aba anterior)
  useEffect(() => {
    let ir = () => {
      let h = decodeURIComponent(window.location.hash.slice(1));
      h && M(h);
    };
    ir();
    window.addEventListener("hashchange", ir);
    return () => window.removeEventListener("hashchange", ir);
  }, [M]);
  let rotaInicial = useRef(true);
  useEffect(() => {
    let alvo = "#" + R;
    if (rotaInicial.current) {
      rotaInicial.current = false;
      window.location.hash || window.history.replaceState(null, "", alvo);
      return;
    }
    window.location.hash !== alvo && window.history.pushState(null, "", alvo);
  }, [R]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [A]);
  return (
    <div
      style={{
        minHeight: "100vh",
        background: tema.bg,
        color: tema.text,
        fontFamily: tema.sans,
      }}
    >
      <style>{CSS_GLOBAL}</style>
      <style>{`
        input[type=number]::-webkit-inner-spin-button{opacity:.4}
        select option{background:${tema.panel}}
        tr.rowhover:hover td:not([data-fixa]){background:${tema.panelSoft}}
        @media (prefers-reduced-motion: reduce){*{transition:none!important}}
        button:focus-visible, input:focus-visible, select:focus-visible{outline:2px solid ${tema.amber}; outline-offset:1px}

        /* impressão / PDF do relatório de IR: a versão clara mora fora do
           #root e só aparece quando o relatório pede a impressão */
        .so-impressao{display:none}
        @media print{
          body.imprimindo-ir{background:#fff!important}
          body.imprimindo-ir #root{display:none!important}
          body.imprimindo-ir .so-impressao{display:block!important}
          @page{margin:12mm}
        }

        /* barra de botões da cesta: grade de 12 colunas */
        .bbar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px 28px}
        .bstats{display:flex;flex-wrap:wrap;gap:12px 30px;align-items:flex-end}
        .bacts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
        @media (max-width:720px){
          .bacts{width:100%}
          .bacts > button{flex:1 1 auto}
        }
      `}</style>
      <Cabecalho
        aba={A}
        aoTrocar={w}
        publicadoEm={PUBLICADO_EM}
        extras={
          <>
            <StatusNuvem />
            <RelogioLeilao />
          </>
        }
      />
      <main className="conteudo">
        {n && (
          <div
            style={{
              fontFamily: tema.mono,
              color: tema.faint,
              padding: 40,
              textAlign: "center",
            }}
          >
            Sincronizando com a base oficial da B3…
          </div>
        )}
        {!n && _e && RW && (
          <div
            style={{
              border: `1px solid ${tema.down}`,
              background: "rgba(239,68,68,.08)",
              borderRadius: 14,
              padding: "12px 16px",
              marginBottom: 16,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <b
              style={{
                color: tema.down,
                fontFamily: tema.mono,
                fontSize: 12,
                letterSpacing: 0.6,
              }}
            >
              ⚠ BASE ATRASADA
            </b>
            <div
              style={{
                marginTop: 5,
                color: tema.text,
              }}
            >
              {"O COTAHIST vai até "}
              <b>{fmtData(No)}</b>, mas o último pregão fechado é{" "}
              <b>{fmtData(Ky)}</b>
              {Yy > 1 ? ` — faltam ${Yy} pregões.` : " — falta 1 pregão."}
            </div>
            <div
              style={{
                marginTop: 5,
                color: tema.dim,
                fontSize: 12.5,
              }}
            >
              O overnight dos ativos sem o pregão anterior não é calculado, para
              não virar movimento de dois dias disfarçado de gap. Para tapar o
              buraco: GitHub → Actions → Coleta diária COTAHIST → Run workflow →
              campo “Pregão específico”.
            </div>
          </div>
        )}
        {!n && _e && (A === "operar" || A === "estrategias") && (
          <section
            style={{
              background: tema.panel,
              border: `1px solid ${tema.line}`,
              borderRadius: 14,
              padding: "12px 18px",
              marginBottom: 16,
              display: "flex",
              flexWrap: "wrap",
              gap: "12px 26px",
              alignItems: "flex-end",
            }}
          >
            <div>
              <Campo label="Data de referência">
                <NavegadorPregao dates={_e.dates} value={fe} onChange={xe} />
              </Campo>
            </div>
            <div
              style={{
                flex: "1 1 360px",
                display: "flex",
                flexDirection: "column",
                gap: 7,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: tema.faint,
                }}
              >
                valendo agora
              </span>
              <div className="pilulas">
                <span className="pilula">
                  piso <b>R$ {fmtNum(X)} MM</b>
                  <span
                    style={{
                      color: Ds.n < 20 ? tema.amber : tema.faint,
                    }}
                  >
                    {Ds.n} {Ds.n === 1 ? "ativo passa" : "ativos passam"}
                  </span>
                </span>
                <span className="pilula">
                  taxa <b>{numBR(k, 3)}%</b>
                </span>
                <span className="pilula">
                  preço mín. <b>R$ {numBR(j, 2)}</b>
                </span>
                <span className="pilula">
                  <b>{I}</b> papéis por estratégia
                </span>
                <span
                  className="pilula"
                  title={`MIX com ${H.queda} papéis em dia de queda (mais de ${H.limiar}% dos líquidos) e ${H.normal} nos demais`}
                >
                  MIX <b>{H.queda}</b> em dia de queda · <b>{H.normal}</b> nos
                  demais
                </span>
              </div>
            </div>
            <button
              onClick={() => w("config")}
              style={{
                ...estiloBotao,
                padding: "7px 13px",
                fontSize: 12,
              }}
            >
              ⚙ ajustar
            </button>
          </section>
        )}
        {!n && _e && (A === "operar" || A === "estrategias") && (
          <div
            style={{
              marginBottom: 18,
            }}
          >
            {A === "operar" && (
              <SubAbas
                valor={_}
                aoTrocar={E}
                opcoes={[
                  ["executar", "Executar"],
                  ["hoje", "Ranking e alocação"],
                ]}
              />
            )}
            {A === "estrategias" && (
              <SubAbas
                valor={P}
                aoTrocar={O}
                opcoes={[
                  ["estrategias", "Sinais do dia"],
                  ["comparar", "Comparar"],
                  ["mesames", "Mês a mês"],
                ]}
              />
            )}
          </div>
        )}
        {!n && A !== "config" && A !== "readme" && (
          <div
            className="bbar"
            style={{
              fontFamily: tema.mono,
              fontSize: 12,
              color: tema.dim,
              marginBottom: 14,
              background: tema.panel,
              border: `1px solid ${tema.line}`,
              borderRadius: tema.raio,
              padding: "14px 18px",
            }}
          >
            <div className="bstats">
              {_e ? (
                <>
                  <Estatistica label="Ativos">{ql.length}</Estatistica>
                  <Estatistica label="Registros" color={tema.dim}>
                    {fmtNum(DW)}
                  </Estatistica>
                  <Estatistica label="Período" color={tema.dim}>
                    {fmtData(_e.dates[0])}
                    {" → "}
                    {fmtData(_e.dates[_e.dates.length - 1])}
                  </Estatistica>
                  {f?.ultimoPregao && (
                    <Estatistica label="COTAHIST até" color={tema.dim}>
                      {f.ultimoPregao.split("-").reverse().join("/")}
                    </Estatistica>
                  )}
                  {y && (
                    <Estatistica label="Ao vivo" color={tema.up}>
                      {"● "}
                      {y.n}
                      {" ativos"}
                      {y.consultadoEm
                        ? ` · ${new Date(y.consultadoEm).toLocaleTimeString(
                            "pt-BR",
                            {
                              timeZone: "America/Sao_Paulo",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}`
                        : ""}
                      {y.estado && y.estado !== "REGULAR"
                        ? ` · mercado ${y.estado}`
                        : ""}
                    </Estatistica>
                  )}
                  {$k > 0 && R === "hoje" && (
                    <Estatistica label="Sem dados na data" color={tema.amber}>
                      {"⚠ "}
                      {$k}
                      {" ativos"}
                    </Estatistica>
                  )}
                </>
              ) : (
                <span>
                  Base vazia — sincronize com a B3 ou carregue um CSV.
                </span>
              )}
            </div>
            <div className="bacts">
              <button
                style={{
                  ...estiloBotao,
                  color: tema.up,
                  borderColor: "rgba(61,199,150,.45)",
                  background: tema.upSoft,
                }}
                onClick={() => LW()}
                disabled={S || m || !_e}
                title={
                  Lk
                    ? "busca o intraday do Yahoo para hoje, por cima do histórico da B3"
                    : "fora do pregão: sincroniza o COTAHIST e, se o último pregão ainda não saiu nele, completa com o fechamento do Yahoo"
                }
              >
                {S || m
                  ? "buscando…"
                  : Lk
                    ? "● cotação de agora"
                    : "● atualizar (fora do pregão)"}
              </button>
              <button
                style={{
                  ...estiloBotao,
                  color: tema.amber,
                  borderColor: "rgba(244,183,64,.45)",
                  background: tema.amberSoft,
                }}
                onClick={() => $d()}
                disabled={m}
              >
                {m ? "sincronizando…" : "↻ sincronizar base"}
              </button>
              <div
                style={{
                  position: "relative",
                }}
              >
                <button
                  style={{
                    ...estiloBotao,
                    color: Nk ? tema.text : tema.faint,
                  }}
                  onClick={() => jy((D) => !D)}
                  title="mais ações da base"
                >
                  ⋯ mais
                </button>
                {Nk && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 6px)",
                      zIndex: 20,
                      background: tema.panelSoft,
                      border: `1px solid ${tema.line}`,
                      borderRadius: 10,
                      padding: 6,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      minWidth: 200,
                      boxShadow: "0 8px 24px rgba(0,0,0,.45)",
                    }}
                  >
                    <button
                      style={{
                        ...estiloBotao,
                        border: "none",
                        textAlign: "left",
                      }}
                      onClick={() => {
                        (jy(false), Th.current?.click());
                      }}
                      disabled={o}
                    >
                      {o ? "processando…" : "+ CSV manual"}
                    </button>
                    {_e && (
                      <button
                        style={{
                          ...estiloBotao,
                          border: "none",
                          textAlign: "left",
                        }}
                        onClick={() => {
                          (jy(false),
                            baixarCsv(
                              baseEmCsv(e.current),
                              `consolidado_overnight_${new Date().toISOString().slice(0, 10)}.csv`,
                            ));
                        }}
                      >
                        ⬇ baixar consolidado
                      </button>
                    )}
                    {_e && (
                      <button
                        style={{
                          ...estiloBotao,
                          border: "none",
                          textAlign: "left",
                          color: Ly ? tema.down : tema.faint,
                        }}
                        onClick={NW}
                      >
                        {Ly ? "confirmar limpeza?" : "limpar base"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <input
          ref={Th}
          type="file"
          accept=".csv,.txt"
          multiple={true}
          style={{
            display: "none",
          }}
          onChange={(D) => {
            (Bk(D.target.files), (D.target.value = ""));
          }}
        />
        {s && A !== "config" && A !== "readme" && (
          <Aviso tipo="ok" aoFechar={() => l(null)}>
            {s}
          </Aviso>
        )}
        {h && (
          <Aviso tipo="erro">
            {h}
            {" — os dados já carregados seguem disponíveis."}
          </Aviso>
        )}
        {c && <Aviso tipo="erro">{c}</Aviso>}
        {!n && !_e && (
          <div
            onClick={() => Th.current?.click()}
            onDragOver={(D) => D.preventDefault()}
            onDrop={(D) => {
              (D.preventDefault(), Bk(D.dataTransfer.files));
            }}
            style={{
              border: `1.5px dashed ${tema.line}`,
              borderRadius: 12,
              padding: "70px 30px",
              textAlign: "center",
              cursor: "pointer",
              background: tema.panel,
            }}
          >
            <div
              style={{
                fontFamily: tema.mono,
                fontSize: 13,
                color: tema.amber,
                letterSpacing: 1.5,
                marginBottom: 10,
              }}
            >
              {o ? "PROCESSANDO..." : "BASE VAZIA"}
            </div>
            <div
              style={{
                color: tema.dim,
                fontSize: 14,
                maxWidth: 640,
                margin: "0 auto",
                lineHeight: 1.6,
              }}
            >
              A base oficial não pôde ser lida. Ela é publicada em
              <code
                style={{
                  fontFamily: tema.mono,
                  color: tema.faint,
                  fontSize: 12,
                }}
              >
                {" "}
                {GITHUB_DONO}/{GITHUB_REPO}
                {" · public/base_b3.json"}
              </code>
              {
                " pela rotina de coleta do COTAHIST. Verifique se o repositório está público e se a carga inicial já rodou no GitHub Actions."
              }
              <div
                style={{
                  marginTop: 14,
                }}
              >
                <button
                  style={{
                    ...estiloBotao,
                    color: tema.amber,
                    borderColor: tema.amber,
                    marginRight: 8,
                  }}
                  onClick={(D) => {
                    (D.stopPropagation(), $d());
                  }}
                  disabled={m}
                >
                  {m ? "sincronizando…" : "↻ tentar de novo"}
                </button>
                <button
                  style={estiloBotao}
                  onClick={(D) => {
                    (D.stopPropagation(), Th.current?.click());
                  }}
                >
                  + carregar CSV manualmente
                </button>
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 12.5,
                  color: tema.faint,
                }}
              >
                Formato aceito no CSV manual:
                Ativo;Data;Abertura;Máxima;Mínima;Fechamento;Volume
                R$[;Quantidade]. Overnight = abertura(D) ÷ fechamento(D−1) − 1 −
                taxa.
              </div>
            </div>
          </div>
        )}
        {_e && R === "hoje" && (
          <>
            <section
              style={{
                background: tema.panel,
                border: `1px solid ${tema.line}`,
                borderRadius: 14,
                padding: "16px 18px",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 26,
                  alignItems: "flex-start",
                }}
              >
                <GrupoConfig titulo="Quem entra na lista">
                  <Campo label="Volume mín. (R$ MM)">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: tema.mono,
                          fontSize: 13.5,
                          color: tema.amber,
                        }}
                      >
                        {fmtNum(X)}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: tema.faint,
                        }}
                      >
                        em CONFIGURAÇÕES
                      </span>
                    </div>
                  </Campo>
                  <Campo label="Janela">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: tema.mono,
                          fontSize: 13.5,
                          color: tema.amber,
                        }}
                      >
                        {F}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: tema.faint,
                        }}
                      >
                        pregões · em CONFIGURAÇÕES
                      </span>
                    </div>
                  </Campo>
                  <Campo label="Top N">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={z}
                      onChange={(D) => Me(Math.max(1, +D.target.value || 30))}
                      style={{
                        ...estiloInput,
                        width: 70,
                      }}
                    />
                  </Campo>
                  <Campo label="Ordenar por">
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      <Chip active={te === "media"} onClick={() => Ae("media")}>
                        Média/dia
                      </Chip>
                      <Chip
                        active={te === "aparada"}
                        onClick={() => Ae("aparada")}
                      >
                        Média aparada
                      </Chip>
                      <Chip active={te === "win"} onClick={() => Ae("win")}>
                        Win
                      </Chip>
                    </div>
                  </Campo>
                </GrupoConfig>
              </div>
            </section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) 330px",
                gap: 20,
                alignItems: "start",
              }}
              className="grid-main"
            >
              <style>
                {
                  "@media(max-width:960px){.grid-main{grid-template-columns:1fr!important}}"
                }
              </style>
              <section
                style={{
                  background: tema.panel,
                  border: `1px solid ${tema.line}`,
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "14px 18px",
                    borderBottom: `1px solid ${tema.line}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontWeight: 650,
                        fontSize: 15,
                      }}
                    >
                      Ranking e alocação da noite
                    </span>
                    <span
                      style={{
                        fontFamily: tema.mono,
                        fontSize: 11.5,
                        color: tema.faint,
                        marginLeft: 10,
                      }}
                    >
                      {"últimos "}
                      {Tn?.windowDates?.length ?? F}
                      {" pregões até "}
                      {lu ? fmtData(fe) : "—"}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: tema.mono,
                      fontSize: 11.5,
                      color: tema.faint,
                    }}
                  >
                    {Tn?.rows.length ?? 0}
                    {" ativos elegíveis"}
                  </span>
                </div>
                {zl && (
                  <div
                    style={{
                      padding: "10px 18px",
                      borderBottom: `1px solid ${tema.line}`,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 16,
                      fontFamily: tema.mono,
                      fontSize: 12,
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        color: tema.text,
                      }}
                    >
                      {"Sugestão: "}
                      <span
                        style={{
                          color: tema.amber,
                          fontWeight: 700,
                        }}
                      >
                        {"R$ "}
                        {fmtNum(zl.total)}
                      </span>
                      {" em "}
                      {zl.nUsados}
                      {" ativos"}
                    </span>
                    <span
                      style={{
                        color: tema.faint,
                      }}
                    >
                      {"impacto máx "}
                      {N.toLocaleString("pt-BR")}% do vol. médio por papel
                    </span>
                    {Tn?.ibovVar != null && (
                      <span
                        style={{
                          color: Tn.ibovVar >= 0 ? tema.up : tema.down,
                        }}
                      >
                        {Rs}
                        {" no período: "}
                        {fmtPct(Tn.ibovVar, 2)}
                      </span>
                    )}
                    {!Hd && (
                      <span
                        style={{
                          color: tema.faint,
                        }}
                      >
                        (carregue IBOV/BOVA11 ou configure um benchmark para
                        habilitar os comparativos)
                      </span>
                    )}
                    {Bl.size > 0 &&
                      (() => {
                        let D = Tn.rows
                          .filter((V) => Bl.has(V.ativo))
                          .reduce(
                            (V, ne) => V + (zl.alloc.get(ne.ativo)?.valor ?? 0),
                            0,
                          );
                        return (
                          <>
                            <span
                              style={{
                                color: tema.up,
                              }}
                            >
                              {"★ "}
                              {Bl.size}
                              {" marcados = R$ "}
                              {fmtNum(D)}
                            </span>
                            <button
                              onClick={() => {
                                (zy(new Set()),
                                  window.storage
                                    .set("ovr3:marcados", "[]")
                                    .catch(() => {}));
                              }}
                              style={{
                                ...estiloBotao,
                                padding: "3px 10px",
                                fontSize: 11,
                                color: tema.faint,
                              }}
                            >
                              desmarcar tudo
                            </button>
                          </>
                        );
                      })()}
                  </div>
                )}
                {(() => {
                  let D = {
                      mark: {
                        label: "★",
                        al: "left",
                        sort: null,
                      },
                      idx: {
                        label: "#",
                        al: "left",
                        sort: null,
                      },
                      ativo: {
                        label: "ATIVO",
                        al: "left",
                        sort: null,
                      },
                      media: {
                        label: "MÉDIA/DIA",
                        al: "right",
                        sort: (ve) => ve.mean,
                      },
                      aparada: {
                        label: "MÉDIA APARADA",
                        al: "right",
                        sort: (ve) => ve.aparada ?? -1000000000,
                      },
                      maxDia: {
                        label: "MELHOR DIA",
                        al: "right",
                        sort: (ve) => ve.maxDia,
                      },
                      win: {
                        label: "WIN",
                        al: "right",
                        sort: (ve) => ve.win,
                      },
                      comp: {
                        label: "COMPOSTO",
                        al: "right",
                        sort: (ve) => ve.comp,
                      },
                      maxDD: {
                        label: "MAX DD",
                        al: "right",
                        sort: (ve) => ve.maxDD,
                      },
                      stockVar: {
                        label: "AÇÃO PERÍODO",
                        al: "right",
                        sort: (ve) => ve.stockVar,
                      },
                      volMed: {
                        label: "VOL MÉD 20d (MM)",
                        al: "right",
                        sort: (ve) => ve.volMed,
                      },
                      cap: {
                        label: `CAP ${N.toLocaleString("pt-BR")}%`,
                        al: "right",
                        sort: null,
                      },
                      sugestao: {
                        label: "SUGESTÃO (R$)",
                        al: "right",
                        sort: (ve) => zl?.alloc.get(ve.ativo)?.valor ?? -1,
                      },
                      acoes: {
                        label: "AÇÕES",
                        al: "right",
                        sort: null,
                      },
                      curva: {
                        label: "CURVA",
                        al: "right",
                        sort: null,
                      },
                    },
                    V = Tn?.rows ?? [],
                    le = (Sh ? V : V.slice(0, z)).map((ve, Ee) => ({
                      r: ve,
                      rankIdx: Ee,
                    }));
                  if (Is && D[Is.key]?.sort) {
                    let ve = D[Is.key].sort;
                    le = le
                      .slice()
                      .sort((Ee, Ne) =>
                        Is.dir === "desc"
                          ? ve(Ne.r) - ve(Ee.r)
                          : ve(Ee.r) - ve(Ne.r),
                      );
                  }
                  let ye = (ve) => (qy.has(ve) ? 2 : Bl.has(ve) ? 0 : 1);
                  (Bl.size > 0 || qy.size > 0) &&
                    (le = le
                      .slice()
                      .sort((ve, Ee) => ye(ve.r.ativo) - ye(Ee.r.ativo)));
                  let Ke = {
                      mark: 66,
                      idx: 44,
                      ativo: 92,
                    },
                    Xe = {},
                    De = 0;
                  for (let ve of Dy) {
                    if (Ke[ve] == null) break;
                    ((Xe[ve] = De), (De += Ke[ve]));
                  }
                  let Pe = (ve, Ee) =>
                      Xe[ve] == null
                        ? {}
                        : {
                            position: "sticky",
                            left: Xe[ve],
                            zIndex: 2,
                            width: Ke[ve],
                            minWidth: Ke[ve],
                            background: Ee,
                            boxShadow:
                              Xe[ve] + Ke[ve] === De
                                ? `1px 0 0 ${tema.line}`
                                : "none",
                          },
                    it = (ve, Ee, Ne, wt) => {
                      let {
                          al: ht,
                          isMarked: Ft,
                          isExcluido: Sr,
                          acoes: Oe,
                          fundoLinha: ke,
                        } = wt,
                        He = {
                          padding: "8px 12px",
                          textAlign: D[ve].al,
                          whiteSpace: "nowrap",
                          ...Pe(ve, ke),
                        };
                      switch (ve) {
                        case "mark":
                          return (
                            <td
                              key={ve}
                              style={{
                                padding: "8px 6px 8px 12px",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                ...Pe(ve, ke),
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={Ft}
                                onChange={() => OW(Ee.ativo)}
                                style={{
                                  accentColor: tema.up,
                                  width: 15,
                                  height: 15,
                                  cursor: "pointer",
                                }}
                                title="marcar para operar hoje"
                              />
                              <button
                                onClick={(Mt) => {
                                  (Mt.stopPropagation(), PW(Ee.ativo));
                                }}
                                title={
                                  Sr
                                    ? "voltar a mostrar este ativo normalmente"
                                    : "excluir da visualização (não sai dos cálculos)"
                                }
                                style={{
                                  border: "none",
                                  background: "none",
                                  cursor: "pointer",
                                  color: Sr ? tema.down : tema.faint,
                                  fontSize: 13,
                                  lineHeight: 1,
                                  padding: 2,
                                }}
                              >
                                {Sr ? "↺" : "✕"}
                              </button>
                            </td>
                          );
                        case "idx":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: tema.faint,
                              }}
                            >
                              {Ne + 1}
                            </td>
                          );
                        case "ativo":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                fontWeight: 700,
                                color: Ft
                                  ? tema.up
                                  : ht
                                    ? tema.amber
                                    : tema.text,
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                (ui(Ee.ativo), M("base"));
                              }}
                              title="ver histórico do ativo"
                            >
                              {Ee.ativo}
                            </td>
                          );
                        case "media":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: Ee.mean >= 0 ? tema.up : tema.down,
                              }}
                            >
                              {fmtPct(Ee.mean, 3)}
                            </td>
                          );
                        case "win":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: tema.dim,
                              }}
                            >
                              {fmtPct(Ee.win, 0)}
                            </td>
                          );
                        case "aparada": {
                          let Mt =
                            Ee.aparada != null &&
                            Ee.mean !== 0 &&
                            Ee.aparada < Ee.mean * 0.5;
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color:
                                  Ee.aparada == null
                                    ? tema.faint
                                    : Ee.aparada >= 0
                                      ? tema.up
                                      : tema.down,
                              }}
                              title={
                                Mt
                                  ? "bem abaixo da média simples: o resultado do período depende dos pregões extremos"
                                  : "média dos 10% centrais, descartando melhores e piores pregões da janela"
                              }
                            >
                              {Ee.aparada == null ? "—" : fmtPct(Ee.aparada, 3)}
                              {Mt ? " ⚠" : ""}
                            </td>
                          );
                        }
                        case "maxDia": {
                          let Mt = Ee.comp > 0 && Ee.maxDia / Ee.comp >= 0.6;
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: Mt ? tema.amber : tema.dim,
                              }}
                              title={
                                Mt
                                  ? `Atenção: o melhor pregão sozinho responde por ${Math.round((Ee.maxDia / Ee.comp) * 100)}% do resultado composto do período.`
                                  : "maior resultado overnight em um único pregão da janela"
                              }
                            >
                              {fmtPct(Ee.maxDia, 2)}
                              {Mt ? " ⚠" : ""}
                            </td>
                          );
                        }
                        case "comp":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: Ee.comp >= 0 ? tema.up : tema.down,
                                fontWeight: 600,
                              }}
                            >
                              {fmtPct(Ee.comp, 1)}
                            </td>
                          );
                        case "maxDD":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: tema.down,
                              }}
                            >
                              {fmtPct(Ee.maxDD, 1)}
                            </td>
                          );
                        case "stockVar":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: Ee.stockVar >= 0 ? tema.up : tema.down,
                              }}
                              title="variação da ação (fechamento a fechamento) no período"
                            >
                              {fmtPct(Ee.stockVar, 1)}
                            </td>
                          );
                        case "volMed":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: tema.dim,
                              }}
                            >
                              {fmtNum(Ee.volMed / 1000000)}
                            </td>
                          );
                        case "cap":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: tema.faint,
                              }}
                            >
                              {fmtNum((Ee.volMed * N) / 100 / 1000)}k
                            </td>
                          );
                        case "sugestao":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: ht ? tema.text : tema.faint,
                                fontWeight: ht ? 700 : 400,
                              }}
                            >
                              {ht ? fmtNum(ht.valor) : "—"}
                            </td>
                          );
                        case "acoes":
                          return (
                            <td
                              key={ve}
                              style={{
                                ...He,
                                color: ht ? tema.text : tema.faint,
                              }}
                              title={
                                ht && Ee.lastClose
                                  ? `fechamento R$ ${numBR(Ee.lastClose)} em ${fmtData(Ee.lastTs)}`
                                  : undefined
                              }
                            >
                              {Oe != null ? fmtNum(Oe) : "—"}
                            </td>
                          );
                        case "curva":
                          return (
                            <td
                              key={ve}
                              style={{
                                padding: "6px 12px",
                              }}
                            >
                              <Sparkline curve={Ee.curve} />
                            </td>
                          );
                        default:
                          return null;
                      }
                    };
                  return (
                    <div
                      style={{
                        overflowX: "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontFamily: tema.mono,
                          fontSize: 12.5,
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              color: tema.faint,
                              fontSize: 10.5,
                              letterSpacing: 1,
                            }}
                          >
                            {Dy.map((ve) => {
                              let Ee = D[ve],
                                Ne = !!Ee.sort,
                                wt = Is?.key === ve;
                              return (
                                <th
                                  key={ve}
                                  draggable={true}
                                  onDragStart={(ht) => {
                                    ((Ny.current = ve),
                                      (ht.dataTransfer.effectAllowed = "move"));
                                  }}
                                  onDragOver={(ht) => ht.preventDefault()}
                                  onDrop={(ht) => {
                                    (ht.preventDefault(),
                                      TW(Ny.current, ve),
                                      (Ny.current = null));
                                  }}
                                  onClick={Ne ? () => kW(ve) : undefined}
                                  title={
                                    Ne
                                      ? "clique: ordena ▼ / ▲ · arraste para mover a coluna"
                                      : "arraste para mover a coluna"
                                  }
                                  style={{
                                    textAlign: Ee.al,
                                    padding: "9px 12px",
                                    borderBottom: `1px solid ${tema.line}`,
                                    whiteSpace: "nowrap",
                                    cursor: Ne ? "pointer" : "grab",
                                    userSelect: "none",
                                    color: wt ? tema.amber : tema.faint,
                                    ...Pe(ve, tema.panel),
                                    zIndex: Xe[ve] != null ? 3 : 1,
                                  }}
                                >
                                  {Ee.label}
                                  {wt ? (Is.dir === "desc" ? " ▼" : " ▲") : ""}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {le.map(({ r: ve, rankIdx: Ee }) => {
                            let Ne = Ee < z,
                              wt = zl?.alloc.get(ve.ativo),
                              ht = Bl.has(ve.ativo),
                              Ft = qy.has(ve.ativo),
                              Sr = null;
                            if (wt && ve.lastClose > 0) {
                              let He = wt.valor / ve.lastClose,
                                Mt = Math.floor(He / 100) * 100;
                              Sr = Mt >= 100 ? Mt : Math.floor(He);
                            }
                            let Oe = ht ? "#16241F" : tema.panel,
                              ke = {
                                al: wt,
                                isMarked: ht,
                                isExcluido: Ft,
                                acoes: Sr,
                                fundoLinha: Oe,
                              };
                            return (
                              <tr
                                key={ve.ativo}
                                className="rowhover"
                                style={{
                                  borderLeft: ht
                                    ? `3px solid ${tema.up}`
                                    : wt
                                      ? `3px solid ${tema.amber}`
                                      : "3px solid transparent",
                                  background: Oe,
                                  opacity: Ft || Ne || ht ? 1 : 0.5,
                                  filter: Ft
                                    ? "grayscale(1) opacity(0.45)"
                                    : "none",
                                  textDecoration: Ft ? "line-through" : "none",
                                }}
                              >
                                {Dy.map((He) => it(He, ve, Ee, ke))}
                              </tr>
                            );
                          })}
                          {Tn && Tn.rows.length === 0 && (
                            <tr>
                              <td
                                colSpan={16}
                                style={{
                                  padding: "26px 18px",
                                  color: tema.faint,
                                  textAlign: "center",
                                  fontFamily: tema.sans,
                                  fontSize: 13.5,
                                }}
                              >
                                Nenhum ativo elegível nessa janela. Reduza o
                                volume mínimo ou aumente a janela — janelas
                                curtas exigem que o ativo tenha negociado em
                                pelo menos 70% dos pregões.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
                {Tn && Tn.rows.length > z && (
                  <button
                    onClick={() => Oy((D) => !D)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      background: "transparent",
                      border: "none",
                      borderTop: `1px solid ${tema.line}`,
                      color: tema.faint,
                      cursor: "pointer",
                      fontFamily: tema.mono,
                      fontSize: 11.5,
                      letterSpacing: 1,
                    }}
                  >
                    {Sh
                      ? `MOSTRAR SÓ O TOP ${z}`
                      : `MOSTRAR TODOS OS ${Tn.rows.length}`}
                  </button>
                )}
                {Gd && (
                  <div
                    style={{
                      borderTop: `1px solid ${tema.line}`,
                      background: Gd.warn ? tema.amberSoft : "transparent",
                      padding: "12px 18px",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      color: Gd.warn ? tema.amber : tema.dim,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: tema.mono,
                        fontSize: 11,
                        letterSpacing: 1.5,
                        marginRight: 10,
                        color: Gd.warn ? tema.amber : tema.faint,
                      }}
                    >
                      {"MONTAGEM DE "}
                      {DIAS_SEMANA[Xy]?.toUpperCase()}
                    </span>
                    {Gd.text}
                  </div>
                )}
              </section>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 650,
                      fontSize: 14,
                      marginBottom: 8,
                    }}
                  >
                    Estratégias de hoje
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: tema.dim,
                      lineHeight: 1.6,
                      marginBottom: 12,
                    }}
                  >
                    {"O que cada estratégia apontou no pregão de "}
                    {lu ? fmtData(fe) : "—"}. Mesma mecânica do ranking ao lado
                    — compra no leilão de fechamento, venda na abertura seguinte
                    — só que escolhendo o papel por outros critérios.
                  </div>
                  {!Vt && (
                    <div
                      style={{
                        fontSize: 12,
                        color: tema.faint,
                      }}
                    >
                      Base sem histórico suficiente.
                    </div>
                  )}
                  {Vt && St?.erro && (
                    <div
                      style={{
                        fontSize: 12,
                        color: tema.faint,
                      }}
                    >
                      {St.erro}
                    </div>
                  )}
                  {Vt && St && !St.erro && (
                    <>
                      {St.listas.map((D) => (
                        <div
                          key={D.est.id}
                          style={{
                            padding: "9px 0",
                            borderTop: `1px solid ${tema.line}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 10,
                                background: D.est.cor,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                              }}
                            >
                              {D.est.nome}
                            </span>
                          </div>
                          <div
                            style={{
                              fontFamily: tema.mono,
                              fontSize: 12.5,
                              color: D.dormindo ? tema.faint : tema.text,
                              marginTop: 4,
                              lineHeight: 1.5,
                            }}
                          >
                            {D.dormindo
                              ? "dormindo — regime não ocorreu"
                              : D.itens.length === 0
                                ? "nenhum papel passou"
                                : D.itens
                                    .slice(0, 4)
                                    .map((V) => V.ativo)
                                    .join("  ")}
                          </div>
                        </div>
                      ))}
                      <div
                        style={{
                          paddingTop: 12,
                          marginTop: 4,
                          borderTop: `1px solid ${tema.line}`,
                        }}
                      >
                        <button
                          onClick={() => M("estrategias")}
                          style={{
                            ...estiloBotao,
                            marginRight: 8,
                          }}
                        >
                          ver o porquê →
                        </button>
                        <button
                          onClick={() => M("executar")}
                          style={{
                            ...estiloBotao,
                            borderColor: tema.amber,
                            color: tema.amber,
                          }}
                        >
                          ordens da noite →
                        </button>
                      </div>
                    </>
                  )}
                </section>
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    onClick={() => Cy((D) => !D)}
                    style={{
                      fontWeight: 650,
                      fontSize: 14,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>O que o backtest mostrou por janela</span>
                    <span
                      style={{
                        color: tema.faint,
                        fontFamily: tema.mono,
                        fontSize: 12,
                      }}
                    >
                      {jd ? "▾" : "▸"}
                    </span>
                  </div>
                  {!jd && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: tema.faint,
                        marginTop: 6,
                      }}
                    >
                      janelas extremas funcionam · 2 sem e 12 meses são as boas
                    </div>
                  )}
                  {jd && (
                    <>
                      <div
                        style={{
                          fontSize: 12,
                          color: tema.dim,
                          lineHeight: 1.6,
                          marginTop: 10,
                        }}
                      >
                        Walk-forward sem look-ahead (jul/25 → fev/26):
                      </div>
                      <table
                        style={{
                          width: "100%",
                          fontFamily: tema.mono,
                          fontSize: 11.5,
                          marginTop: 10,
                          borderCollapse: "collapse",
                        }}
                      >
                        <tbody>
                          {[
                            [
                              "2 sem · re-rank diário",
                              "+0,115%/d",
                              "melhor janela",
                              tema.up,
                            ],
                            [
                              "12 meses · re-rank diário",
                              "+0,090%/d",
                              "boa alternativa",
                              tema.up,
                            ],
                            ["3–6 meses", "fraco", "evitar", tema.faint],
                          ].map(([D, V, ne, le]) => (
                            <tr
                              key={D}
                              style={{
                                borderTop: `1px solid ${tema.line}`,
                              }}
                            >
                              <td
                                style={{
                                  padding: "6px 0",
                                  color: tema.dim,
                                }}
                              >
                                {D}
                              </td>
                              <td
                                style={{
                                  padding: "6px 0",
                                  textAlign: "right",
                                  color: le,
                                }}
                              >
                                {V}
                              </td>
                              <td
                                style={{
                                  padding: "6px 0 6px 10px",
                                  textAlign: "right",
                                  color: tema.faint,
                                }}
                              >
                                {ne}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: tema.faint,
                          lineHeight: 1.55,
                          marginTop: 10,
                        }}
                      >
                        Extremos funcionam; janelas intermediárias, não. Como a
                        posição é zerada toda manhã, trocar a cesta diariamente
                        não custa nada.
                      </div>
                    </>
                  )}
                </section>
                <div
                  style={{
                    fontSize: 11,
                    color: tema.faint,
                    lineHeight: 1.6,
                    padding: "0 4px",
                  }}
                >
                  Estatísticas descritivas do seu próprio histórico — não é
                  recomendação de investimento. Resultado passado não garante
                  regime futuro.
                </div>
              </div>
            </div>
          </>
        )}
        {_e && R === "executar" && (
          <div
            style={{
              display: "grid",
              gap: 14,
            }}
          >
            {!Vt && (
              <section
                style={{
                  background: tema.panel,
                  border: `1px solid ${tema.line}`,
                  borderRadius: 14,
                  padding: 16,
                  fontSize: 13,
                  color: tema.dim,
                }}
              >
                Base pequena demais. São necessários 150 pregões para os
                indicadores.
              </section>
            )}
            {Vt && St?.erro && (
              <section
                style={{
                  background: tema.panel,
                  border: `1px solid ${tema.line}`,
                  borderRadius: 14,
                  padding: 16,
                  fontSize: 13,
                  color: tema.dim,
                }}
              >
                {St.erro}
              </section>
            )}
            {Vt &&
              St &&
              !St.erro &&
              (() => {
                let D = (Oe, ke) => {
                    if (!(Oe > 0) || !(ke > 0)) return null;
                    let He = Math.floor(Oe / ke / 100) * 100;
                    return He >= 100 ? He : 0;
                  },
                  V = (Oe, ke) => `${Oe}::${ke}`,
                  ne = (Oe) => (Oe in Fs ? Fs[Oe] : VALOR_PADRAO),
                  le = (Oe) =>
                    Oe.itens.reduce((ke, He) => {
                      let Mt = D(ne(V(Oe.id, He.ativo)), He.preco);
                      return ke + (Mt ? Mt * He.preco : 0);
                    }, 0),
                  ye = Ji.reduce((Oe, ke) => Oe + le(ke), 0),
                  Ke = St.mercado.amplitude > 0.6,
                  Xe = tsPregao(new Date()),
                  De = fe === Xe,
                  it = Ji.some((Oe) => Oe.resultado)
                    ? "resolvida"
                    : De
                      ? "aovivo"
                      : "passou",
                  ve = (Oe) =>
                    Oe == null
                      ? "—"
                      : new Date(Oe).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                        }),
                  Ee = {
                    aovivo: tema.up,
                    passou: tema.amber,
                    resolvida: tema.dim,
                  }[it],
                  Ne = {
                    aovivo: "ORDEM PARA HOJE",
                    passou: "ORDEM QUE ERA PARA TER SIDO FEITA",
                    resolvida: "OPERAÇÃO ENCERRADA",
                  }[it],
                  wt = new Map();
                for (let Oe of Ji)
                  for (let ke of Oe.itens) {
                    let He = wt.get(ke.ativo) ?? [];
                    (He.push(Oe), wt.set(ke.ativo, He));
                  }
                let ht = Array.from(wt.entries()).filter(
                    ([, Oe]) => Oe.length > 1,
                  ),
                  Ft = Ji.reduce((Oe, ke) => Oe + ke.itens.length, 0),
                  Sr = (Oe, ke, He) => {
                    let Mt = (wt.get(ke.ativo) ?? []).filter(
                        (Ye) => Ye.id !== Oe.id,
                      ),
                      aa = (ke.porques ?? []).filter((Ye) => Ye.id !== Oe.id),
                      mi = V(Oe.id, ke.ativo),
                      Lo = ne(mi),
                      Fa = D(Lo, ke.preco),
                      uu =
                        Fa && ke.volMed > 0
                          ? ((Fa * ke.preco) / ke.volMed) * 100
                          : 0,
                      hi = di.find(
                        (Ye) =>
                          Ye.ticker === ke.ativo &&
                          Ye.estrategiaId === Oe.id &&
                          Ye.dataEnvio === fe,
                      ),
                      Ce = !!hi;
                    return (
                      <div
                        key={ke.ativo}
                        className="cartao-papel"
                        style={{
                          background: tema.panelSoft,
                          border: `1px solid ${tema.lineSoft}`,
                          borderRadius: 12,
                          padding: "14px 16px 12px",
                          display: "flex",
                          flexDirection: "column",
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
                              alignItems: "baseline",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 99,
                                display: "inline-grid",
                                placeItems: "center",
                                alignSelf: "center",
                                background: Oe.cor + "22",
                                color: Oe.cor,
                                fontFamily: tema.mono,
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {He + 1}
                            </span>
                            <span
                              title="ver o histórico deste papel na BASE"
                              style={{
                                fontFamily: tema.mono,
                                fontSize: 20,
                                fontWeight: 700,
                                letterSpacing: 0.3,
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                (ui(ke.ativo), M("base"));
                              }}
                            >
                              {ke.ativo}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <div
                              style={{
                                textAlign: "right",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  color: tema.faint,
                                  letterSpacing: 0.7,
                                }}
                              >
                                FECHAMENTO
                              </div>
                              <div
                                style={{
                                  fontFamily: tema.mono,
                                  fontSize: 17,
                                  fontWeight: 700,
                                }}
                              >
                                {"R$ "}
                                {numBR(ke.preco)}
                              </div>
                              <div
                                style={{
                                  fontSize: 9.5,
                                  fontFamily: tema.mono,
                                  color: Ph(fe) ? tema.amber : tema.up,
                                }}
                              >
                                {Ph(fe)
                                  ? "⏳ provisório — muda no leilão"
                                  : "✓ COTAHIST"}
                              </div>
                            </div>
                          </div>
                        </div>
                        {(ke.cruzado || Mt.length > 0) && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                              marginTop: 8,
                            }}
                          >
                            {ke.cruzado && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: tema.mono,
                                  padding: "2px 7px",
                                  borderRadius: 20,
                                  border: `1px solid ${tema.amber}`,
                                  color: tema.amber,
                                }}
                              >
                                CONFIRMADO POR 2 FAMÍLIAS
                              </span>
                            )}
                            {Mt.length > 0 && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: tema.mono,
                                  padding: "2px 7px",
                                  borderRadius: 20,
                                  border: `1px solid ${tema.down}88`,
                                  color: tema.down,
                                }}
                              >
                                {"TAMBÉM EM "}
                                {Mt.map((Ye) => Ye.nome.toUpperCase()).join(
                                  " · ",
                                )}
                              </span>
                            )}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 12.5,
                            color: tema.dim,
                            marginTop: 10,
                            lineHeight: 1.6,
                          }}
                        >
                          {[
                            Number.isFinite(ke.varDia)
                              ? ke.gapHoje > 0.002 &&
                                ke.intraHoje < -0.002 &&
                                ke.varDia > 0
                                ? `abriu ${fmtPct(ke.gapHoje, 1)} e devolveu, fechando ${fmtPct(ke.varDia, 1)}`
                                : `${ke.varDia >= 0 ? "subiu" : "caiu"} ${fmtPct(Math.abs(ke.varDia), 1)} hoje`
                              : null,
                            ke.ibs != null && ke.ibs <= 0.25
                              ? `fechou a ${Math.round(ke.ibs * 100)}% do fundo do dia`
                              : null,
                            ke.ibs != null && ke.ibs >= 0.6
                              ? `fechou a ${Math.round(ke.ibs * 100)}% do topo do dia`
                              : null,
                            ke.rsi14 != null && ke.rsi14 < 40
                              ? `RSI em ${Math.round(ke.rsi14)}`
                              : null,
                            ke.pos60 != null && ke.pos60 < 0.3
                              ? "no piso dos últimos 3 meses"
                              : null,
                            ke.pctB != null && ke.pctB < 0.2
                              ? "furou a banda de Bollinger"
                              : null,
                            ke.ovWin120 != null && ke.ovWin120 > 0.55
                              ? `abre em alta em ${Math.round(ke.ovWin120 * 100)}% das noites`
                              : null,
                            ke.placar != null
                              ? `placar ${Math.round(ke.placar * 100)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "entrou pelo placar combinado"}
                        </div>
                        {aa.length > 0 && (
                          <div
                            style={{
                              fontSize: 11.5,
                              color: tema.faint,
                              marginTop: 5,
                            }}
                          >
                            {Oe.combinada
                              ? "apontado por: "
                              : "também apontado por: "}
                            {aa.map((Ye) => Ye.nome).join(" · ")}
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: "auto",
                            paddingTop: 12,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px 12px",
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              borderTop: `1px solid ${tema.lineSoft}`,
                              marginBottom: 4,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              color: tema.faint,
                            }}
                          >
                            vou pôr R$
                          </span>
                          <input
                            type="number"
                            step="1000"
                            min="0"
                            inputMode="numeric"
                            value={Lo ?? ""}
                            placeholder="—"
                            onChange={(Ye) => {
                              let fr = Ye.target.value,
                                de = fr === "" ? null : +fr;
                              (fi((Fe) => ({
                                ...Fe,
                                [mi]: de,
                              })),
                                hi &&
                                  nu(hi.id, {
                                    valorInvestido: de > 0 ? de : null,
                                    qtd:
                                      de > 0
                                        ? (D(de, hi.precoEntrada ?? ke.preco) ??
                                          0)
                                        : null,
                                  }));
                            }}
                            style={{
                              ...estiloInput,
                              width: 120,
                              fontSize: 14,
                            }}
                          />
                          {Fa === null ? null : Fa === 0 ? (
                            <span
                              style={{
                                fontSize: 12.5,
                                color: tema.down,
                              }}
                            >
                              {"não dá 1 lote — mínimo R$ "}
                              {fmtNum(Math.ceil(ke.preco * 100))}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 13.5,
                                color: tema.up,
                                fontFamily: tema.mono,
                                fontWeight: 700,
                              }}
                            >
                              {"comprar "}
                              {fmtNum(Fa)}
                              {" ações"}
                              <span
                                style={{
                                  color: tema.dim,
                                  fontWeight: 400,
                                  fontFamily: "inherit",
                                }}
                              >
                                {" "}
                                {"= R$ "}
                                {fmtNum(Fa * ke.preco)}
                                {uu > 0.5 && (
                                  <span
                                    style={{
                                      color: tema.amber,
                                    }}
                                  >
                                    {" · "}
                                    {numBR(uu, 2)}% do volume médio
                                  </span>
                                )}
                              </span>
                            </span>
                          )}
                          <button
                            onClick={() =>
                              Ck(
                                ke.ativo,
                                Oe.id,
                                Oe.nome,
                                ke.preco,
                                fe,
                                Lo ?? null,
                                Lo > 0 ? (Fa ?? 0) : null,
                              )
                            }
                            title={
                              Ph(fe)
                                ? "Vai para RESULTADOS com o preço de agora, marcado como provisório. O COTAHIST corrige sozinho à noite."
                                : "Vai para RESULTADOS com o fechamento oficial da B3."
                            }
                            style={{
                              ...estiloBotao,
                              marginLeft: "auto",
                              padding: "6px 12px",
                              fontSize: 12,
                              fontFamily: tema.sans,
                              color: Ce ? tema.up : tema.dim,
                              borderColor: Ce
                                ? "rgba(61,199,150,.5)"
                                : tema.line,
                              background: Ce ? tema.upSoft : tema.panel,
                            }}
                          >
                            {Ce ? "✓ acompanhando" : "★ acompanhar"}
                          </button>
                        </div>
                        {ke.realizado != null && (
                          <div
                            style={{
                              marginTop: 9,
                              paddingTop: 9,
                              borderTop: `1px solid ${tema.line}`,
                              fontSize: 12.5,
                              display: "flex",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                color: tema.dim,
                              }}
                            >
                              {"vendido a R$ "}
                              {ke.precoVenda != null
                                ? numBR(ke.precoVenda)
                                : "—"}
                              {" na abertura"}
                              {ke.gapBruto != null && (
                                <span
                                  style={{
                                    color: tema.faint,
                                  }}
                                >
                                  {" "}
                                  {"· gap "}
                                  {fmtPct(ke.gapBruto, 2)}
                                  {" − taxa "}
                                  {numBR(k, 3)}%
                                </span>
                              )}
                            </span>
                            <span
                              style={{
                                fontFamily: tema.mono,
                                fontWeight: 700,
                                color: ke.realizado >= 0 ? tema.up : tema.down,
                              }}
                              title="resultado já líquido da taxa por operação"
                            >
                              {fmtPct(ke.realizado, 2)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  };
                return (
                  <>
                    <section
                      style={{
                        background: tema.panel,
                        border: `1px solid ${Ee}55`,
                        borderRadius: 14,
                        padding: "16px 18px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: Ee,
                          letterSpacing: 0.6,
                          fontWeight: 650,
                        }}
                      >
                        {Ne}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          alignItems: "center",
                          margin: "12px 0 4px",
                        }}
                      >
                        <div
                          style={{
                            flex: "1 1 220px",
                            background: tema.panelSoft,
                            border: `1px solid ${tema.lineSoft}`,
                            borderRadius: 12,
                            padding: "10px 14px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: tema.faint,
                              letterSpacing: 0.7,
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 99,
                                display: "inline-grid",
                                placeItems: "center",
                                background: Ee + "26",
                                color: Ee,
                                fontSize: 10.5,
                              }}
                            >
                              1
                            </span>
                            COMPRAR
                          </div>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 650,
                              marginTop: 2,
                            }}
                          >
                            {"no fechamento de "}
                            {ve(fe)}
                          </div>
                        </div>
                        <div
                          className="so-largo"
                          style={{
                            color: tema.faint,
                            fontSize: 18,
                            fontFamily: tema.mono,
                          }}
                        >
                          →
                        </div>
                        <div
                          style={{
                            flex: "1 1 220px",
                            background: tema.panelSoft,
                            border: `1px solid ${tema.lineSoft}`,
                            borderRadius: 12,
                            padding: "10px 14px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: tema.faint,
                              letterSpacing: 0.7,
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 99,
                                display: "inline-grid",
                                placeItems: "center",
                                background: Ee + "26",
                                color: Ee,
                                fontSize: 10.5,
                              }}
                            >
                              2
                            </span>
                            VENDER
                          </div>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 650,
                              marginTop: 2,
                            }}
                          >
                            {"na abertura de "}
                            {St.vendaTs != null
                              ? ve(St.vendaTs)
                              : "o próximo pregão"}
                          </div>
                        </div>
                        <div
                          style={{
                            textAlign: "right",
                            flex: "0 0 auto",
                            marginLeft: "auto",
                            paddingLeft: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              color: tema.faint,
                              letterSpacing: 0.4,
                            }}
                          >
                            {ye > 0 ? "SEU TOTAL" : "ORDENS"}
                          </div>
                          <div
                            style={{
                              fontFamily: tema.mono,
                              fontSize: 20,
                              fontWeight: 700,
                              color: ye > 0 ? tema.amber : tema.text,
                            }}
                          >
                            {ye > 0 ? `R$ ${fmtNum(ye)}` : Ft}
                          </div>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: tema.faint,
                              fontFamily: tema.mono,
                            }}
                          >
                            {Ji.length === 1
                              ? "1 estratégia"
                              : `${Ji.length} estratégias`}
                            {ye > 0 ? ` · ${Ft} ordens` : ""}
                          </div>
                        </div>
                      </div>
                      {it === "passou" && (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: tema.dim,
                            marginTop: 12,
                            lineHeight: 1.6,
                            paddingTop: 12,
                            borderTop: `1px solid ${tema.line}`,
                          }}
                        >
                          Este é o pregão mais recente da base. O fechamento já
                          aconteceu, então a ordem não é mais executável — está
                          aqui para você acompanhar o que a estratégia teria
                          feito. Para operar hoje de verdade, puxe a cotação ao
                          vivo antes das 17h e a data vira a de hoje.
                        </div>
                      )}
                      {it === "resolvida" && (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: `1px solid ${tema.line}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 22,
                            }}
                          >
                            {Ji.filter((Oe) => Oe.resultado).map((Oe) => (
                              <div key={Oe.id}>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: Oe.cor,
                                    letterSpacing: 0.4,
                                  }}
                                >
                                  {Oe.nome.toUpperCase()}
                                </div>
                                <div
                                  style={{
                                    fontFamily: tema.mono,
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color:
                                      Oe.resultado.ret >= 0
                                        ? tema.up
                                        : tema.down,
                                  }}
                                >
                                  {fmtPct(Oe.resultado.ret, 3)}
                                </div>
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    color: tema.faint,
                                    fontFamily: tema.mono,
                                  }}
                                >
                                  {Oe.resultado.acertos}
                                  {" de "}
                                  {Oe.resultado.total}
                                  {" acertaram"}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: tema.faint,
                              marginTop: 10,
                              lineHeight: 1.55,
                            }}
                          >
                            {"Operação já encerrada — a abertura de "}
                            {ve(St.vendaTs)}
                            {" está na base. Resultado já líquido do custo de "}
                            {numBR(k, 3)}%, supondo o mesmo valor em cada papel
                            da lista de cada estratégia.
                          </div>
                        </div>
                      )}
                      {it === "aovivo" &&
                        (() => {
                          let Oe = estadoDoPregao();
                          if (!Oe.aberto)
                            return (
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: tema.up,
                                  marginTop: 12,
                                  lineHeight: 1.6,
                                  paddingTop: 12,
                                  borderTop: `1px solid ${tema.line}`,
                                }}
                              >
                                Pregão encerrado. A faixa do dia está fechada e
                                esta lista é a definitiva para o leilão de hoje.
                              </div>
                            );
                          let ke = Oe.minutosParaLeilao,
                            He = ke <= 25,
                            Mt = ke <= 90,
                            aa = He ? tema.up : Mt ? tema.amber : tema.down,
                            mi = He
                              ? "Faixa do dia praticamente formada. A lista abaixo é confiável — é a hora de decidir."
                              : Mt
                                ? "Faixa do dia quase completa, mas ainda pode mexer. Vale reconferir mais perto do leilão."
                                : "Cedo demais. A máxima e a mínima de hoje ainda vão se formar, e são elas que definem o IBS e o range. Esta lista vai mudar.";
                          return (
                            <div
                              style={{
                                marginTop: 12,
                                paddingTop: 12,
                                borderTop: `1px solid ${tema.line}`,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: 11,
                                  color: tema.faint,
                                  letterSpacing: 0.4,
                                  marginBottom: 6,
                                }}
                              >
                                <span>PREGÃO PERCORRIDO</span>
                                <span
                                  style={{
                                    fontFamily: tema.mono,
                                  }}
                                >
                                  {Math.round(Oe.pct * 100)}
                                  {"% · faltam "}
                                  {Math.floor(ke / 60)}h
                                  {String(ke % 60).padStart(2, "0")}
                                  {" para o leilão"}
                                </span>
                              </div>
                              <div
                                style={{
                                  height: 6,
                                  background: tema.panelSoft,
                                  borderRadius: 4,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.round(Oe.pct * 100)}%`,
                                    height: "100%",
                                    background: aa,
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: aa,
                                  marginTop: 9,
                                  lineHeight: 1.6,
                                }}
                              >
                                {mi}
                              </div>
                            </div>
                          );
                        })()}
                      {(() => {
                        let Oe = St.mercado.amplitude,
                          ke = St.mercado.papeisMix,
                          He = Number.isFinite(Oe) && Oe > H.limiar / 100;
                        return (
                          <div
                            style={{
                              fontSize: 12.5,
                              marginTop: 10,
                              lineHeight: 1.55,
                              color: He ? tema.up : tema.dim,
                            }}
                          >
                            <b>Termômetro:</b>{" "}
                            {Number.isFinite(Oe)
                              ? `${Math.round(Oe * 100)}% dos papéis líquidos em queda`
                              : "sem leitura do mercado"}
                            {" → "}
                            {"MIX com "}
                            <b>{ke}</b> {ke === 1 ? "papel" : "papéis"}
                            {" hoje"}
                            {He
                              ? ` (mais de ${H.limiar}%: dia de queda)`
                              : ` (até ${H.limiar}%: dia normal)`}
                            .
                          </div>
                        );
                      })()}
                      {Ke && (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: tema.down,
                            marginTop: 10,
                            lineHeight: 1.5,
                          }}
                        >
                          <b>Pânico de mercado</b>
                          {" — "}
                          {Math.round(St.mercado.amplitude * 100)}% dos papéis
                          em queda. Historicamente a melhor noite do conjunto.
                        </div>
                      )}
                    </section>
                    <section
                      style={{
                        background: tema.panel,
                        border: `1px solid ${tema.line}`,
                        borderRadius: 14,
                        padding: "14px 16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: tema.faint,
                            letterSpacing: 0.7,
                          }}
                        >
                          {seletorAberto
                            ? "QUAIS ESTRATÉGIAS VOCÊ VAI SEGUIR"
                            : "ESTRATÉGIAS QUE VOCÊ SEGUE"}
                        </div>
                        <button
                          onClick={() => abrirSeletor((Oe) => !Oe)}
                          aria-expanded={seletorAberto}
                          style={{
                            ...estiloBotao,
                            padding: "5px 12px",
                            fontSize: 12,
                            fontFamily: tema.sans,
                            color: seletorAberto ? tema.amber : tema.dim,
                          }}
                        >
                          {seletorAberto
                            ? "pronto"
                            : `trocar · ${ORDEM_ESTRATEGIAS.filter((Oe) => St.carteiras[Oe]).length} disponíveis`}
                        </button>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        {ORDEM_ESTRATEGIAS.map((Oe) => {
                          let ke = St.carteiras[Oe];
                          if (!ke) return null;
                          if (!seletorAberto && !Ki.includes(Oe)) return null;
                          let He = Ki.includes(Oe);
                          return (
                            <span
                              key={Oe}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 7,
                                border: `1px solid ${He ? ke.cor : tema.line}`,
                                borderRadius: 22,
                                background: He ? ke.cor + "1E" : "transparent",
                                padding: "5px 11px 5px 10px",
                              }}
                            >
                              <button
                                onClick={() => vW(Oe)}
                                aria-pressed={He}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 7,
                                  background: "transparent",
                                  border: "none",
                                  padding: 0,
                                  cursor: "pointer",
                                  color: He ? tema.text : tema.faint,
                                  fontFamily: tema.sans,
                                  fontSize: 12.5,
                                }}
                              >
                                <span
                                  style={{
                                    width: 9,
                                    height: 9,
                                    borderRadius: "50%",
                                    background: He ? ke.cor : "transparent",
                                    border: `1px solid ${ke.cor}`,
                                  }}
                                />
                                {ke.nome}
                                <span
                                  style={{
                                    fontFamily: tema.mono,
                                    fontSize: 11,
                                    color: ke.dormindo
                                      ? tema.faint
                                      : He
                                        ? ke.cor
                                        : tema.faint,
                                  }}
                                >
                                  {ke.dormindo
                                    ? "dormindo"
                                    : `${ke.itens.length}`}
                                </span>
                              </button>
                              <FichaEstrategia
                                id={ke.guia}
                                nomeExibido={ke.nome}
                                cor={ke.cor}
                                aoAbrirManual={ou}
                              />
                            </span>
                          );
                        })}
                      </div>
                      {seletorAberto && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: tema.faint,
                            marginTop: 11,
                            lineHeight: 1.6,
                          }}
                        >
                          O número ao lado do nome é quantos papéis aquela
                          estratégia aponta hoje. Marque quantas quiser — cada
                          uma vira um bloco separado abaixo, com o valor por
                          papel decidido de forma independente. A escolha fica
                          salva para as próximas vezes.
                        </div>
                      )}
                      {ht.length > 0 && (
                        <div
                          style={{
                            marginTop: 11,
                            paddingTop: 11,
                            borderTop: `1px solid ${tema.line}`,
                            fontSize: 12,
                            color: tema.amber,
                            lineHeight: 1.6,
                          }}
                        >
                          <b>Atenção à exposição dobrada:</b>{" "}
                          {ht
                            .map(
                              ([Oe, ke]) =>
                                `${Oe} (${ke.map((He) => He.nome).join(" + ")})`,
                            )
                            .join(" · ")}
                          . Digitar valor nos dois blocos significa comprar o
                          mesmo papel duas vezes.
                        </div>
                      )}
                    </section>
                    {Ji.map((Oe) => {
                      if (Oe.intraday)
                        return (
                          <PainelAbertura
                            key={Oe.id}
                            c={Oe}
                            aoVivo={y}
                            abrirManual={ou}
                          />
                        );
                      let ke = le(Oe);
                      return (
                        <section
                          key={Oe.id}
                          style={{
                            background: tema.panel,
                            borderRadius: 14,
                            padding: "14px 16px",
                            border: `1px solid ${tema.line}`,
                            borderLeft: `3px solid ${Oe.cor}`,
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
                                  color: Oe.cor,
                                }}
                              >
                                {Oe.nome}
                              </span>
                              <FichaEstrategia
                                id={Oe.guia}
                                nomeExibido={Oe.nome}
                                cor={Oe.cor}
                                aoAbrirManual={ou}
                              />
                              <span
                                style={{
                                  fontFamily: tema.mono,
                                  fontSize: 11.5,
                                  color: tema.faint,
                                }}
                              >
                                {Oe.itens.length}{" "}
                                {Oe.itens.length === 1 ? "papel" : "papéis"}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 16,
                              }}
                            >
                              {Oe.resultado && (
                                <span
                                  style={{
                                    fontFamily: tema.mono,
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color:
                                      Oe.resultado.ret >= 0
                                        ? tema.up
                                        : tema.down,
                                  }}
                                >
                                  {fmtPct(Oe.resultado.ret, 2)}
                                </span>
                              )}
                              {ke > 0 && (
                                <span
                                  style={{
                                    fontFamily: tema.mono,
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: tema.amber,
                                  }}
                                >
                                  {"R$ "}
                                  {fmtNum(ke)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: tema.dim,
                              marginTop: 5,
                              lineHeight: 1.55,
                            }}
                          >
                            {Oe.resumo}
                          </div>
                          {Oe.semRepetir &&
                            (() => {
                              let He = Oe.semRepetir,
                                Mt =
                                  He.ontemTs != null
                                    ? ve(He.ontemTs)
                                    : "o pregão anterior";
                              return (
                                <div
                                  style={{
                                    fontSize: 12,
                                    marginTop: 10,
                                    padding: "9px 11px",
                                    borderRadius: 10,
                                    background: tema.panelSoft,
                                    border: `1px solid ${Oe.cor}44`,
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {He.ontem.length === 0 ? (
                                    <span
                                      style={{
                                        color: tema.faint,
                                      }}
                                    >
                                      {"Nada marcado em “acompanhar” em "}
                                      {Mt}
                                      {" — nenhum papel bloqueado hoje."}
                                    </span>
                                  ) : (
                                    <>
                                      <span
                                        style={{
                                          color: tema.dim,
                                        }}
                                      >
                                        {"Bloqueados por "}
                                        {Mt}
                                        {" (acompanhar): "}
                                      </span>
                                      <b
                                        style={{
                                          fontFamily: tema.mono,
                                          color: tema.text,
                                        }}
                                      >
                                        {He.ontem.join(" · ")}
                                      </b>
                                      <div
                                        style={{
                                          marginTop: 4,
                                          color: He.pulados.length
                                            ? Oe.cor
                                            : tema.faint,
                                        }}
                                      >
                                        {He.pulados.length === 0 ? (
                                          "Nenhum deles estava na lista de hoje — a lista é a mesma do MIX."
                                        ) : (
                                          <>
                                            {"Saíram da lista: "}
                                            {He.pulados
                                              .map(
                                                (aa) =>
                                                  `${aa.ativo} (${aa.pos}º)`,
                                              )
                                              .join(" · ")}{" "}
                                            {"→ "}
                                            {He.pulados.length === 1
                                              ? "entrou o próximo da lista"
                                              : "entraram os próximos da lista"}
                                            .
                                          </>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          {Oe.dormindo && (
                            <div
                              style={{
                                fontSize: 12.5,
                                color: tema.faint,
                                marginTop: 12,
                                paddingTop: 12,
                                borderTop: `1px solid ${tema.line}`,
                                lineHeight: 1.6,
                              }}
                            >
                              Dormindo hoje: o regime de mercado que esta
                              estratégia exige não ocorreu. Não operar por aqui
                              é a recomendação dela — e faz parte do resultado.
                            </div>
                          )}
                          {!Oe.dormindo && Oe.itens.length === 0 && (
                            <div
                              style={{
                                fontSize: 12.5,
                                color: tema.dim,
                                marginTop: 12,
                                paddingTop: 12,
                                borderTop: `1px solid ${tema.line}`,
                                lineHeight: 1.6,
                              }}
                            >
                              Nenhum papel passou nos critérios desta estratégia
                              hoje. Não operar também é decisão.
                            </div>
                          )}
                          {Oe.itens.length > 0 && (
                            <div className="grade-papeis">
                              {Oe.itens.map((He, Mt) => Sr(Oe, He, Mt))}
                            </div>
                          )}
                        </section>
                      );
                    })}
                    <section
                      style={{
                        background: tema.panel,
                        border: `1px solid ${tema.line}`,
                        borderRadius: 14,
                        padding: "12px 16px",
                      }}
                    >
                      <div
                        onClick={() => _W((Oe) => !Oe)}
                        style={{
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 650,
                            fontSize: 14,
                          }}
                        >
                          Acompanhamento dia a dia
                        </span>
                        <span
                          style={{
                            color: tema.faint,
                            fontFamily: tema.mono,
                            fontSize: 12,
                          }}
                        >
                          {au ? "▾" : "▸"}
                        </span>
                      </div>
                      {!au && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: tema.faint,
                            marginTop: 6,
                          }}
                        >
                          o que cada estratégia marcada teria feito nos últimos
                          pregões, tenha você operado ou não
                        </div>
                      )}
                      {au && !Gy && (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: tema.dim,
                            marginTop: 12,
                          }}
                        >
                          calculando…
                        </div>
                      )}
                      {au && Gy && (
                        <>
                          {Ji.map((Oe) => {
                            let ke = Gy[Oe.id];
                            return ke ? (
                              <div
                                key={Oe.id}
                                style={{
                                  marginTop: 16,
                                  paddingTop: 14,
                                  borderTop: `1px solid ${tema.line}`,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 650,
                                    color: Oe.cor,
                                  }}
                                >
                                  {Oe.nome}
                                </div>
                                {ke.resumo ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: 18,
                                      margin: "10px 0 4px",
                                    }}
                                  >
                                    {[
                                      [
                                        "NOITES FECHADAS",
                                        String(ke.resumo.n),
                                        tema.text,
                                      ],
                                      [
                                        "MÉDIA/NOITE",
                                        fmtPct(ke.resumo.media, 3),
                                        ke.resumo.media >= 0
                                          ? tema.up
                                          : tema.down,
                                      ],
                                      [
                                        "ACERTO",
                                        Math.round(ke.resumo.acerto * 100) +
                                          "%",
                                        tema.text,
                                      ],
                                      [
                                        "ACUMULADO",
                                        fmtPct(ke.resumo.acumulado, 2),
                                        ke.resumo.acumulado >= 0
                                          ? tema.up
                                          : tema.down,
                                      ],
                                    ].map(([He, Mt, aa]) => (
                                      <div key={He}>
                                        <div
                                          style={{
                                            fontSize: 10,
                                            color: tema.faint,
                                            letterSpacing: 0.4,
                                          }}
                                        >
                                          {He}
                                        </div>
                                        <div
                                          style={{
                                            fontFamily: tema.mono,
                                            fontSize: 16,
                                            fontWeight: 700,
                                            color: aa,
                                          }}
                                        >
                                          {Mt}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: tema.faint,
                                      marginTop: 8,
                                    }}
                                  >
                                    {
                                      "Nenhuma noite fechada nesta janela — esta estratégia não operou nos últimos "
                                    }
                                    {Ud}
                                    {" pregões."}
                                  </div>
                                )}
                                {ke.linhas.length > 0 && (
                                  <div
                                    style={{
                                      overflowX: "auto",
                                      marginTop: 8,
                                    }}
                                  >
                                    <table
                                      style={{
                                        borderCollapse: "collapse",
                                        width: "100%",
                                        fontSize: 12,
                                      }}
                                    >
                                      <thead>
                                        <tr
                                          style={{
                                            color: tema.faint,
                                            textAlign: "left",
                                          }}
                                        >
                                          {[
                                            "compra",
                                            "venda",
                                            "papéis",
                                            "resultado",
                                          ].map((He) => (
                                            <th
                                              key={He}
                                              style={{
                                                padding: "6px 8px",
                                                fontWeight: 500,
                                                whiteSpace: "nowrap",
                                              }}
                                            >
                                              {He}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ke.linhas.map((He) => (
                                          <tr
                                            key={He.compraTs}
                                            style={{
                                              borderTop: `1px solid ${tema.line}`,
                                            }}
                                          >
                                            <td
                                              style={{
                                                padding: "7px 8px",
                                                fontFamily: tema.mono,
                                                whiteSpace: "nowrap",
                                              }}
                                            >
                                              {fmtData(He.compraTs)}
                                            </td>
                                            <td
                                              style={{
                                                padding: "7px 8px",
                                                fontFamily: tema.mono,
                                                color: tema.dim,
                                                whiteSpace: "nowrap",
                                              }}
                                            >
                                              {He.vendaTs
                                                ? fmtData(He.vendaTs)
                                                : "—"}
                                            </td>
                                            <td
                                              style={{
                                                padding: "7px 8px",
                                                fontFamily: tema.mono,
                                                color: tema.dim,
                                              }}
                                            >
                                              {He.ativos.join(" ")}
                                            </td>
                                            <td
                                              style={{
                                                padding: "7px 8px",
                                                fontFamily: tema.mono,
                                                fontWeight: 700,
                                                whiteSpace: "nowrap",
                                                color: He.resultado
                                                  ? He.resultado.ret >= 0
                                                    ? tema.up
                                                    : tema.down
                                                  : tema.faint,
                                              }}
                                            >
                                              {He.resultado
                                                ? fmtPct(He.resultado.ret, 2)
                                                : "em aberto"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            ) : null;
                          })}
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 14,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11.5,
                                color: tema.faint,
                              }}
                            >
                              mostrar
                            </span>
                            {[10, 20, 40, 60].map((Oe) => (
                              <button
                                key={Oe}
                                onClick={() => AW(Oe)}
                                style={{
                                  ...estiloBotao,
                                  padding: "5px 11px",
                                  fontSize: 12,
                                  borderColor:
                                    Ud === Oe ? tema.amber : tema.line,
                                  color: Ud === Oe ? tema.amber : tema.dim,
                                }}
                              >
                                {Oe}
                              </button>
                            ))}
                            <span
                              style={{
                                fontSize: 11.5,
                                color: tema.faint,
                              }}
                            >
                              pregões
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: tema.faint,
                              marginTop: 10,
                              lineHeight: 1.55,
                            }}
                          >
                            Cada carteira é refeita com a informação de cada
                            dia, sem olhar o futuro, com o mesmo valor em cada
                            papel. É o resultado que a estratégia teria dado —
                            não o que você de fato operou.
                          </div>
                        </>
                      )}
                    </section>
                    <section
                      style={{
                        background: tema.panel,
                        border: `1px solid ${tema.line}`,
                        borderRadius: 14,
                        padding: "12px 16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12.5,
                            color: tema.dim,
                            lineHeight: 1.6,
                            flex: "1 1 320px",
                          }}
                        >
                          {"MIX com "}
                          <b
                            style={{
                              color: tema.text,
                            }}
                          >
                            {H.queda}
                          </b>
                          {" papéis em dia de queda (mais de "}
                          {H.limiar}
                          {"% dos líquidos) e "}
                          <b
                            style={{
                              color: tema.text,
                            }}
                          >
                            {H.normal}
                          </b>
                          {" nos demais · "}
                          <b
                            style={{
                              color: tema.text,
                            }}
                          >
                            {I}
                          </b>
                          {" papéis por estratégia"}
                        </span>
                        <button
                          onClick={() => w("config")}
                          style={{
                            ...estiloBotao,
                          }}
                        >
                          ⚙ mudar em CONFIGURAÇÕES
                        </button>
                        <button
                          onClick={() => fi({})}
                          style={{
                            ...estiloBotao,
                          }}
                        >
                          {"voltar tudo para R$ "}
                          {fmtNum(VALOR_PADRAO)}
                        </button>
                        <button
                          onClick={() => M("estrategias")}
                          style={{
                            ...estiloBotao,
                          }}
                        >
                          ver o porquê →
                        </button>
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: tema.amber,
                          marginTop: 10,
                          lineHeight: 1.55,
                        }}
                      >
                        Por que o termômetro: depois de dia de queda do mercado,
                        os cinco primeiros do MIX costumam pagar bem; depois de
                        dia de alta, só o primeiro. No backtest de 810 noites
                        (jun/2023 a set/2026), sem repetir papel, líquido da
                        taxa, com R$ 10 mil por papel: sempre 3 papéis rendeu
                        0,159% por noite, R$ 47 por noite e tombo máximo de
                        −10,5%; com o termômetro (5 em dia de queda, 3 nos
                        outros), 0,162%, R$ 70 por noite e tombo de −8,0%.
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: tema.faint,
                          marginTop: 10,
                          lineHeight: 1.55,
                        }}
                      >
                        {
                          '"Papéis por estratégia" é o mesmo número usado na aba ESTRATÉGIAS e no COMPARAR — o que você segue e o que você mede precisam ser a mesma coisa. O acumulado supõe o mesmo valor em cada papel da lista. Cada papel começa com R$ '
                        }
                        {fmtNum(VALOR_PADRAO)}; para mudar, digite no campo do
                        papel e o app converte em ações, sempre em lotes de 100.
                        Ao marcar ★ acompanhar, valor e quantidade seguem para
                        RESULTADOS.
                      </div>
                    </section>
                  </>
                );
              })()}
          </div>
        )}
        {_e && R === "estrategias" && (
          <div
            style={{
              display: "grid",
              gap: 16,
            }}
          >
            {!Vt && (
              <section
                style={{
                  background: tema.panel,
                  border: `1px solid ${tema.line}`,
                  borderRadius: 14,
                  padding: 16,
                  fontSize: 13,
                  color: tema.dim,
                }}
              >
                Base pequena demais para os indicadores. São necessários pelo
                menos 150 pregões (o histórico de gap usa janela de 120).
                Carregue a base completa e volte aqui.
              </section>
            )}
            {Vt && (
              <>
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 650,
                      fontSize: 14,
                      marginBottom: 10,
                    }}
                  >
                    {"Termômetro do pregão de "}
                    {lu ? fmtData(fe) : "—"}
                  </div>
                  {St?.erro && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: tema.faint,
                      }}
                    >
                      {St.erro}
                    </div>
                  )}
                  {St &&
                    !St.erro &&
                    (() => {
                      let D = St.mercado.amplitude,
                        V = D > 0.6;
                      return (
                        <>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 22,
                              alignItems: "baseline",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: tema.faint,
                                  letterSpacing: 0.4,
                                }}
                              >
                                PAPÉIS EM QUEDA
                              </div>
                              <div
                                style={{
                                  fontFamily: tema.mono,
                                  fontSize: 22,
                                  fontWeight: 700,
                                  color: V ? tema.down : tema.text,
                                }}
                              >
                                {Number.isFinite(D)
                                  ? Math.round(D * 100) + "%"
                                  : "—"}
                              </div>
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: tema.faint,
                                  letterSpacing: 0.4,
                                }}
                              >
                                MÉDIA DO MERCADO
                              </div>
                              <div
                                style={{
                                  fontFamily: tema.mono,
                                  fontSize: 22,
                                  fontWeight: 700,
                                  color:
                                    St.mercado.retMercado >= 0
                                      ? tema.up
                                      : tema.down,
                                }}
                              >
                                {Number.isFinite(St.mercado.retMercado)
                                  ? fmtPct(St.mercado.retMercado, 2)
                                  : "—"}
                              </div>
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: tema.faint,
                                  letterSpacing: 0.4,
                                }}
                              >
                                ATIVOS NO FILTRO
                              </div>
                              <div
                                style={{
                                  fontFamily: tema.mono,
                                  fontSize: 22,
                                  fontWeight: 700,
                                }}
                              >
                                {St.mercado.nElegiveis}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              height: 8,
                              background: tema.panelSoft,
                              borderRadius: 4,
                              marginTop: 12,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, (D || 0) * 100)}%`,
                                height: "100%",
                                background: V ? tema.down : tema.amber,
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: V ? tema.down : tema.dim,
                              marginTop: 8,
                              lineHeight: 1.55,
                            }}
                          >
                            {V
                              ? "Queda generalizada. Historicamente a melhor noite para comprar reversão — a estratégia Pânico de Mercado está ativa."
                              : "Pregão sem pânico. A estratégia Pânico de Mercado fica dormindo hoje; as demais operam normalmente."}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: tema.dim,
                              marginTop: 6,
                              lineHeight: 1.55,
                            }}
                          >
                            {"MIX hoje: "}
                            <b
                              style={{
                                color: tema.text,
                              }}
                            >
                              {St.mercado.papeisMix}
                            </b>
                            {" papéis —"} {H.queda}
                            {" quando mais de "}
                            {H.limiar}
                            {"% dos líquidos caem, "}
                            {H.normal}
                            {" nos outros dias."}
                          </div>
                        </>
                      );
                    })()}
                </section>
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 18,
                      alignItems: "flex-end",
                    }}
                  >
                    <SeletorPeriodo
                      de={on}
                      ate={U}
                      onDe={tu}
                      onAte={Z}
                      dates={_e.dates}
                    />
                    <div
                      style={{
                        fontSize: 11.5,
                        color: tema.faint,
                        lineHeight: 1.6,
                        alignSelf: "center",
                      }}
                    >
                      {"preço mínimo R$ "}
                      {numBR(j, 2)}
                      {" · "}
                      {I}
                      {" papéis por estratégia —"}{" "}
                      <button
                        onClick={() => w("config")}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: tema.amber,
                          cursor: "pointer",
                          fontSize: 11.5,
                          textDecoration: "underline",
                        }}
                      >
                        CONFIGURAÇÕES
                      </button>
                    </div>
                    <button
                      disabled={mt || on == null || U == null}
                      onClick={() => {
                        (nr(true),
                          setTimeout(() => {
                            try {
                              Ve(
                                backtestEstrategias(Vt, {
                                  minVolMM: X,
                                  precoMin: j,
                                  topN: I,
                                  tsIni: _e.dates[0],
                                  tsFim: _e.dates[_e.dates.length - 1],
                                  termometro: L,
                                  minNoites: 1,
                                }),
                              );
                            } finally {
                              nr(false);
                            }
                          }, 30));
                      }}
                      style={{
                        ...estiloBotao,
                        borderColor: tema.amber,
                        color: tema.amber,
                        opacity: mt ? 0.5 : 1,
                      }}
                    >
                      {mt ? "calculando…" : "RODAR BACKTEST"}
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: tema.faint,
                      marginTop: 10,
                      lineHeight: 1.6,
                    }}
                  >
                    Período compartilhado com a aba COMPARAR — mudar aqui também
                    muda lá, e vice-versa.
                    <b
                      style={{
                        color: tema.dim,
                      }}
                    >
                      {" Mudar De/Até não pede backtest novo:"}
                    </b>
                    {
                      " a rodada cobre a base inteira e o período só recorta os números mostrados. O botão é para quando muda algo em CONFIGURAÇÕES (preço mínimo, papéis por estratégia, termômetro, piso ou taxa). O piso de liquidez (R$ "
                    }
                    {fmtNum(X)}
                    {
                      " MM de volume médio em 20 pregões, com os 10% de pregões de maior volume descartados) e o impacto máximo valem para o app inteiro: nenhuma estratégia considera papel abaixo do piso, em nenhum pregão do backtest. O backtest percorre o período escolhido, refazendo o ranking a cada pregão com a informação que existia naquele dia. Compra no fechamento, vende na abertura seguinte, peso igual entre os papéis, custo de "
                    }
                    {numBR(k, 3)}% por operação. Splits e grupamentos são
                    descartados automaticamente.
                  </div>
                </section>
                {St &&
                  !St.erro &&
                  (St.consenso.cruzado.length > 0 ||
                    St.consenso.intenso.length > 0) &&
                  (() => {
                    let D = jl?.consenso,
                      V = (ne, le) => {
                        let ye = (ne.dados.volMed * N) / 100,
                          Ke = ne.dados.fech > 0 ? ye / ne.dados.fech : 0,
                          Xe = Math.floor(Ke / 100) * 100,
                          De = Xe >= 100 ? Xe : Math.floor(Ke);
                        return (
                          <div
                            key={ne.ativo}
                            style={{
                              padding: "10px 0",
                              borderTop: `1px solid ${tema.line}`,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: tema.mono,
                                  fontSize: 15,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                onClick={() => {
                                  (ui(ne.ativo), M("base"));
                                }}
                              >
                                {ne.ativo}
                              </span>
                              <span
                                style={{
                                  display: "flex",
                                  gap: 5,
                                  flexWrap: "wrap",
                                }}
                              >
                                {ne.em.map((Pe) => (
                                  <span
                                    key={Pe.id}
                                    style={{
                                      fontSize: 10.5,
                                      fontFamily: tema.mono,
                                      padding: "2px 7px",
                                      borderRadius: 20,
                                      border: `1px solid ${Pe.cor}66`,
                                      color: Pe.cor,
                                    }}
                                  >
                                    {Pe.nome}
                                  </span>
                                ))}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 12.5,
                                color: tema.dim,
                                marginTop: 6,
                                lineHeight: 1.5,
                              }}
                            >
                              {"R$ "}
                              {numBR(ne.dados.fech)}
                              {" · fechou a "}
                              {Math.round((ne.dados.ibs ?? 0) * 100)}
                              {"% do fundo do dia · RSI "}
                              {ne.dados.rsi14 != null
                                ? Math.round(ne.dados.rsi14)
                                : "—"}
                              {" · abriu em alta "}
                              {Math.round((ne.dados.ovWin120 ?? 0) * 100)}% das
                              últimas 120 noites
                            </div>
                            {De > 0 && (
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: le ? tema.up : tema.dim,
                                  marginTop: 5,
                                }}
                              >
                                {"Comprar "}
                                <b>{fmtNum(De)}</b>
                                {" ações · R$ "}
                                {fmtNum(De * ne.dados.fech)}
                              </div>
                            )}
                          </div>
                        );
                      };
                    return (
                      <>
                        <section
                          style={{
                            background: tema.panel,
                            border: `1px solid ${tema.amber}66`,
                            borderRadius: 14,
                            padding: "14px 16px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 650,
                              fontSize: 14,
                            }}
                          >
                            Confirmação cruzada
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: tema.dim,
                              marginTop: 6,
                              marginBottom: 4,
                              lineHeight: 1.6,
                            }}
                          >
                            {
                              "Papéis apontados ao mesmo tempo por uma estratégia de "
                            }
                            <b
                              style={{
                                color: tema.text,
                              }}
                            >
                              reversão
                            </b>
                            {" (apanhou hoje) e uma de "}
                            <b
                              style={{
                                color: tema.text,
                              }}
                            >
                              persistência
                            </b>
                            {
                              " (costuma abrir em alta). São dois motivos independentes olhando para o mesmo papel — o sinal mais forte que o app produz."
                            }
                          </div>
                          {D && !D.erro && (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 16,
                                margin: "12px 0 4px",
                                paddingTop: 10,
                                borderTop: `1px solid ${tema.line}`,
                              }}
                            >
                              {[
                                [
                                  "MÉDIA/NOITE",
                                  fmtPct(D.media, 3),
                                  D.media >= 0 ? tema.up : tema.down,
                                ],
                                [
                                  "ACERTO",
                                  Math.round(D.acerto * 100) + "%",
                                  tema.text,
                                ],
                                ["ACUMULADO", fmtPct(D.total, 1), tema.up],
                                ["PIOR QUEDA", fmtPct(D.mdd, 1), tema.down],
                                [
                                  "OPERA",
                                  Math.round(D.cobertura * 100) + "% dos dias",
                                  tema.faint,
                                ],
                              ].map(([ne, le, ye]) => (
                                <div key={ne}>
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: tema.faint,
                                      letterSpacing: 0.4,
                                    }}
                                  >
                                    {ne}
                                  </div>
                                  <div
                                    style={{
                                      fontFamily: tema.mono,
                                      fontSize: 15,
                                      fontWeight: 700,
                                      color: ye,
                                    }}
                                  >
                                    {le}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {St.consenso.cruzado.length === 0 ? (
                            <div
                              style={{
                                fontSize: 12.5,
                                color: tema.faint,
                                marginTop: 10,
                                paddingTop: 10,
                                borderTop: `1px solid ${tema.line}`,
                              }}
                            >
                              Nenhuma confirmação cruzada hoje. As duas famílias
                              estão olhando para papéis diferentes — não há o
                              sinal de maior convicção nesta noite.
                            </div>
                          ) : (
                            St.consenso.cruzado
                              .slice(0, 8)
                              .map((ne) => V(ne, true))
                          )}
                        </section>
                        {St.consenso.intenso.length > 0 && (
                          <section
                            style={{
                              background: tema.panel,
                              border: `1px solid ${tema.line}`,
                              borderRadius: 14,
                              padding: "14px 16px",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 650,
                                fontSize: 14,
                              }}
                            >
                              Sinal intenso (mesma família)
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: tema.dim,
                                marginTop: 6,
                                lineHeight: 1.6,
                              }}
                            >
                              {"Aqui várias estratégias concordam, mas "}
                              <b
                                style={{
                                  color: tema.text,
                                }}
                              >
                                pelo mesmo motivo
                              </b>
                              . Não é confirmação independente: é o mesmo sinal
                              em grau mais extremo. No histórico, o papel
                              apontado pelas 4 estratégias de reversão fechou
                              com IBS médio de 0,03 contra 0,20 do apontado por
                              só uma. Vale como medida de intensidade, não de
                              convicção.
                            </div>
                            {St.consenso.intenso
                              .slice(0, 6)
                              .map((ne) => V(ne, false))}
                          </section>
                        )}
                      </>
                    );
                  })()}
                {St &&
                  !St.erro &&
                  St.listas.map((D) => {
                    let V = jl?.[D.est.id],
                      ne = Ln === D.est.id;
                    return (
                      <section
                        key={D.est.id}
                        style={{
                          background: tema.panel,
                          border: `1px solid ${ne ? D.est.cor + "66" : tema.line}`,
                          borderRadius: 14,
                          padding: "14px 16px",
                        }}
                      >
                        <div
                          onClick={() => Pr(ne ? null : D.est.id)}
                          style={{
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: 9,
                                  background: D.est.cor,
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  fontWeight: 650,
                                  fontSize: 14.5,
                                }}
                              >
                                {D.est.nome}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: tema.dim,
                                marginTop: 4,
                              }}
                            >
                              {D.est.resumo}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                marginTop: 7,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: tema.mono,
                                  padding: "2px 7px",
                                  borderRadius: 20,
                                  border: `1px solid ${tema.line}`,
                                  color: tema.faint,
                                }}
                              >
                                {D.est.familia === "REV"
                                  ? "REVERSÃO"
                                  : D.est.familia === "PER"
                                    ? "PERSISTÊNCIA"
                                    : "MISTA"}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: tema.mono,
                                  padding: "2px 7px",
                                  borderRadius: 20,
                                  border: `1px solid ${D.est.frescor === "vivo" ? tema.down : tema.up}55`,
                                  color:
                                    D.est.frescor === "vivo"
                                      ? tema.down
                                      : tema.up,
                                }}
                              >
                                {D.est.frescor === "vivo"
                                  ? "PERDE FORÇA COM 1 DIA DE ATRASO"
                                  : "AGUENTA 1 DIA DE ATRASO"}
                              </span>
                            </div>
                          </div>
                          <span
                            style={{
                              color: tema.faint,
                              fontFamily: tema.mono,
                              fontSize: 12,
                            }}
                          >
                            {ne ? "▾" : "▸"}
                          </span>
                        </div>
                        {V && !V.erro && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 16,
                              marginTop: 12,
                              paddingTop: 12,
                              borderTop: `1px solid ${tema.line}`,
                            }}
                          >
                            {[
                              [
                                "MÉDIA/NOITE",
                                fmtPct(V.media, 3),
                                V.media >= 0 ? tema.up : tema.down,
                              ],
                              [
                                "ACERTO",
                                Math.round(V.acerto * 100) + "%",
                                tema.text,
                              ],
                              [
                                "ACUMULADO",
                                fmtPct(V.total, 1),
                                V.total >= 0 ? tema.up : tema.down,
                              ],
                              ["PIOR NOITE", fmtPct(V.mdd, 1), tema.down],
                              [
                                "SHARPE",
                                V.sharpe != null ? numBR(V.sharpe, 2) : "—",
                                tema.text,
                              ],
                              ["NOITES", String(V.n), tema.faint],
                              [
                                "OPERA",
                                Math.round(V.cobertura * 100) + "% dos dias",
                                tema.faint,
                              ],
                            ].map(([le, ye, Ke]) => (
                              <div key={le}>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: tema.faint,
                                    letterSpacing: 0.4,
                                  }}
                                >
                                  {le}
                                </div>
                                <div
                                  style={{
                                    fontFamily: tema.mono,
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: Ke,
                                  }}
                                >
                                  {ye}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {V && !V.erro && V.n < 20 && (
                          <div
                            style={{
                              fontSize: 11.5,
                              color: tema.amber,
                              marginTop: 8,
                            }}
                          >
                            {"Amostra curta: "}
                            {V.n} {V.n === 1 ? "noite" : "noites"}
                            {" no período — uma noite decide o placar."}
                          </div>
                        )}
                        {V?.erro && (
                          <div
                            style={{
                              fontSize: 12,
                              color: tema.faint,
                              marginTop: 10,
                            }}
                          >
                            {V.erro}
                          </div>
                        )}
                        {!jl && (
                          <div
                            style={{
                              fontSize: 11.5,
                              color: tema.faint,
                              marginTop: 10,
                              fontStyle: "italic",
                            }}
                          >
                            Rode o backtest acima para ver o histórico desta
                            estratégia.
                          </div>
                        )}
                        {ne && (
                          <div
                            style={{
                              marginTop: 12,
                              paddingTop: 12,
                              borderTop: `1px solid ${tema.line}`,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12.5,
                                color: tema.dim,
                                lineHeight: 1.6,
                                marginBottom: 10,
                              }}
                            >
                              {D.est.explica}
                            </div>
                            <div
                              style={{
                                fontSize: 11.5,
                                lineHeight: 1.6,
                                marginBottom: 12,
                                padding: "9px 11px",
                                background: tema.panelSoft,
                                borderRadius: 7,
                                color:
                                  D.est.frescor === "vivo"
                                    ? tema.down
                                    : tema.dim,
                              }}
                            >
                              {D.est.frescor === "vivo"
                                ? `Sinal perecível. Ele é calculado normalmente com o COTAHIST — o que você vê aqui em dia sem cotação ao vivo é a ordem correta para aquele pregão. O problema é agir: comprar um dia depois faz o ganho médio cair ${numBR(D.est.perdaAtraso, 3)} ponto percentual por noite.`
                                : `Sinal durável. Baseia-se no hábito do papel, não no estado de hoje: comprar um dia depois custa só ${numBR(D.est.perdaAtraso, 3)} pp por noite. Esta dá para montar com o COTAHIST das 20h sem prejuízo relevante.`}
                            </div>
                            {D.dormindo && (
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: tema.faint,
                                  lineHeight: 1.55,
                                }}
                              >
                                Dormindo hoje: o regime de mercado exigido por
                                esta estratégia não ocorreu. Não operar por aqui
                                é a recomendação — e faz parte do resultado
                                dela.
                              </div>
                            )}
                            {!D.dormindo && D.itens.length === 0 && (
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: tema.faint,
                                }}
                              >
                                {"Nenhum papel passou nos critérios em "}
                                {lu ? fmtData(fe) : "—"}.
                              </div>
                            )}
                            {D.itens.map((le, ye) => {
                              let Ke = (le.volMed * N) / 100,
                                Xe = le.fech > 0 ? Ke / le.fech : 0,
                                De = Math.floor(Xe / 100) * 100,
                                Pe = De >= 100 ? De : Math.floor(Xe);
                              return (
                                <div
                                  key={le.ativo}
                                  style={{
                                    padding: "10px 0",
                                    borderTop: `1px solid ${tema.line}`,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "baseline",
                                      gap: 10,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontFamily: tema.mono,
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                      onClick={() => {
                                        (ui(le.ativo), M("base"));
                                      }}
                                    >
                                      <span
                                        style={{
                                          color: tema.faint,
                                          marginRight: 7,
                                        }}
                                      >
                                        {ye + 1}
                                      </span>
                                      {le.ativo}
                                    </span>
                                    <span
                                      style={{
                                        fontFamily: tema.mono,
                                        fontSize: 12,
                                        color: tema.faint,
                                      }}
                                    >
                                      {"placar "}
                                      {Math.round(le.placar * 100)}
                                      {" · R$ "}
                                      {numBR(le.fech)}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: tema.dim,
                                      marginTop: 5,
                                      lineHeight: 1.55,
                                    }}
                                  >
                                    {le.varDia != null && (
                                      <>
                                        {"dia "}
                                        <b
                                          style={{
                                            color:
                                              le.varDia >= 0
                                                ? tema.up
                                                : tema.down,
                                          }}
                                        >
                                          {fmtPct(le.varDia, 1)}
                                        </b>
                                        {" · "}
                                      </>
                                    )}
                                    {"fechou a "}
                                    {Math.round((le.ibs ?? 0) * 100)}
                                    {"% do fundo · RSI "}
                                    {le.rsi14 != null
                                      ? Math.round(le.rsi14)
                                      : "—"}
                                    {" · range 60d "}
                                    {le.pos60 != null
                                      ? Math.round(le.pos60 * 100) + "%"
                                      : "—"}
                                    {" · gap+ em "}
                                    {Math.round((le.ovWin120 ?? 0) * 100)}% das
                                    noites
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      flexWrap: "wrap",
                                      gap: 8,
                                    }}
                                  >
                                    {Pe > 0 ? (
                                      <div
                                        style={{
                                          fontSize: 12.5,
                                          color: tema.up,
                                          marginTop: 5,
                                        }}
                                      >
                                        {"Comprar "}
                                        <b>{fmtNum(Pe)}</b>
                                        {" ações · R$ "}
                                        {fmtNum(Pe * le.fech)}
                                        <span
                                          style={{
                                            color: tema.faint,
                                            fontSize: 11,
                                            marginLeft: 6,
                                          }}
                                        >
                                          ({N.toLocaleString("pt-BR")}% do
                                          volume médio)
                                        </span>
                                      </div>
                                    ) : (
                                      <div
                                        style={{
                                          fontSize: 12,
                                          color: tema.faint,
                                          marginTop: 5,
                                        }}
                                      >
                                        Volume não comporta nem 1 ação nesse
                                        limite de impacto.
                                      </div>
                                    )}
                                    {(() => {
                                      let it = di.some(
                                        (ve) =>
                                          ve.ticker === le.ativo &&
                                          ve.estrategiaId === D.est.id &&
                                          ve.dataEnvio === fe,
                                      );
                                      return (
                                        <button
                                          onClick={() =>
                                            Ck(
                                              le.ativo,
                                              D.est.id,
                                              D.est.nome,
                                              le.fech,
                                              fe,
                                            )
                                          }
                                          title={
                                            Ph(fe)
                                              ? "Vai para RESULTADOS com o preço de agora, marcado como provisório. O COTAHIST corrige sozinho à noite."
                                              : "Vai para RESULTADOS com o fechamento oficial da B3."
                                          }
                                          style={{
                                            ...estiloBotao,
                                            padding: "4px 9px",
                                            fontSize: 10.5,
                                            marginTop: 5,
                                            color: it ? tema.up : tema.faint,
                                            borderColor: it
                                              ? tema.up
                                              : tema.line,
                                          }}
                                        >
                                          {it
                                            ? "✓ acompanhando"
                                            : "★ acompanhar"}
                                        </button>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                {jl?.__correl && (
                  <section
                    style={{
                      background: tema.panel,
                      border: `1px solid ${tema.line}`,
                      borderRadius: 14,
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      onClick={() => Dl((D) => !D)}
                      style={{
                        fontWeight: 650,
                        fontSize: 14,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Quais estratégias realmente diversificam</span>
                      <span
                        style={{
                          color: tema.faint,
                          fontFamily: tema.mono,
                          fontSize: 12,
                        }}
                      >
                        {En ? "▾" : "▸"}
                      </span>
                    </div>
                    {!En && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: tema.faint,
                          marginTop: 6,
                        }}
                      >
                        correlação noite a noite entre as 7 · quanto menor, mais
                        independente
                      </div>
                    )}
                    {En &&
                      (() => {
                        let D = ESTRATEGIAS.map((V) => V.id).filter(
                          (V) => jl[V] && !jl[V].erro,
                        );
                        return (
                          <div
                            style={{
                              overflowX: "auto",
                              marginTop: 12,
                            }}
                          >
                            <table
                              style={{
                                borderCollapse: "collapse",
                                fontFamily: tema.mono,
                                fontSize: 11.5,
                              }}
                            >
                              <thead>
                                <tr>
                                  <th
                                    style={{
                                      padding: "5px 8px",
                                    }}
                                  />
                                  {D.map((V) => (
                                    <th
                                      key={V}
                                      style={{
                                        padding: "5px 8px",
                                        color: tema.faint,
                                        fontWeight: 500,
                                      }}
                                    >
                                      {
                                        ESTRATEGIAS.find(
                                          (ne) => ne.id === V,
                                        ).nome.split(" ")[0]
                                      }
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {D.map((V) => (
                                  <tr key={V}>
                                    <td
                                      style={{
                                        padding: "5px 8px",
                                        color: tema.dim,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {
                                        ESTRATEGIAS.find((ne) => ne.id === V)
                                          .nome
                                      }
                                    </td>
                                    {D.map((ne) => {
                                      let le = jl.__correl[V]?.[ne],
                                        ye = le == null ? 0 : Math.abs(le);
                                      return (
                                        <td
                                          key={ne}
                                          style={{
                                            padding: "5px 8px",
                                            textAlign: "center",
                                            background:
                                              V === ne
                                                ? "transparent"
                                                : `rgba(255,183,3,${(ye * 0.3).toFixed(2)})`,
                                            color:
                                              V === ne ? tema.faint : tema.text,
                                          }}
                                        >
                                          {le == null ? "—" : numBR(le, 2)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div
                              style={{
                                fontSize: 11.5,
                                color: tema.faint,
                                marginTop: 10,
                                lineHeight: 1.6,
                              }}
                            >
                              {"Isto mede a "}
                              <b
                                style={{
                                  color: tema.text,
                                }}
                              >
                                carteira
                              </b>
                              , não o papel: pares abaixo de 0,60 produzem
                              curvas de resultado diferentes e valem rodar
                              juntos; acima de 0,85 você estaria dobrando a
                              mesma aposta e pagando corretagem por isso. Não
                              confunda com o painel de consenso lá em cima —
                              duas estratégias podem ter correlação alta de
                              carteira e ainda assim discordar sobre qual papel
                              comprar hoje. Quando elas concordam, o papel é um
                              caso extremo do mesmo sinal.
                            </div>
                          </div>
                        );
                      })()}
                  </section>
                )}
              </>
            )}
          </div>
        )}
        {_e && R === "base" && _e.eventos.length > 0 && (
          <section
            style={{
              background: tema.panel,
              border: `1px solid ${tema.line}`,
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: `1px solid ${tema.line}`,
                background: tema.panelSoft,
              }}
            >
              <div
                style={{
                  fontWeight: 650,
                  fontSize: 14,
                }}
              >
                Noites descartadas por evento societário{" "}
                <span
                  style={{
                    fontFamily: tema.mono,
                    fontSize: 11.5,
                    color: tema.amber,
                  }}
                >
                  {_e.eventos.length}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: tema.faint,
                  lineHeight: 1.6,
                  marginTop: 5,
                  maxWidth: 900,
                }}
              >
                O COTAHIST traz o preço como negociado: ele não ajusta
                grupamento, desdobramento, bonificação nem cisão. MGLU3 grupou
                1:10 em 27/05/2024 e o gap mecânico de +872% entrava no
                resultado como lucro. Regra: gap acima de{" "}
                {fmtPct(LIMITE_SALTO, 0)}
                {" — ou acima de "}
                {fmtPct(LIMITE_SALTO_ABERTURA, 0)}
                {
                  " com deslocamento do patamar de preço — não entra na conta daquele ativo naquela noite. Vale nos dois sentidos: separar evento de queda real olhando só preço e volume não é possível (AMER3 em 12/01/2023 caiu 77% de verdade e tem a mesma assinatura de um desdobramento 1:4), e um dia de ±80% num teste de 900 noites inutiliza a estatística de qualquer forma. Os preços na base seguem crus."
                }
              </div>
            </div>
            <div
              style={{
                maxHeight: 320,
                overflow: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: tema.mono,
                  fontSize: 11.5,
                }}
              >
                <thead>
                  <tr
                    style={{
                      color: tema.faint,
                      fontSize: 10,
                      letterSpacing: 1,
                      position: "sticky",
                      top: 0,
                      background: tema.panel,
                    }}
                  >
                    {[
                      "ATIVO",
                      "NOITE",
                      "FECH. ANT.",
                      "ABERTURA",
                      "PREÇO ×",
                      "QTDE ×",
                      "R$ VOL ×",
                      "GAP DESCARTADO",
                    ].map((D, V) => (
                      <th
                        key={D}
                        style={{
                          textAlign: V < 2 ? "left" : "right",
                          padding: "7px 10px",
                          borderBottom: `1px solid ${tema.line}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {D}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {_e.eventos.map((D, V) => {
                    let ne =
                        D.qtdAnt > 0 && D.qtd != null ? D.qtd / D.qtdAnt : null,
                      le =
                        D.volAnt > 0 && D.vol != null ? D.vol / D.volAnt : null;
                    return (
                      <tr key={D.ativo + D.ts + V} className="rowhover">
                        <td
                          style={{
                            padding: "6px 10px",
                            color: tema.amber,
                            fontWeight: 700,
                          }}
                        >
                          {D.ativo}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            color: tema.dim,
                          }}
                        >
                          {fmtData(D.ts)}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            textAlign: "right",
                            color: tema.dim,
                          }}
                        >
                          {numBR(D.fechAnt)}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            textAlign: "right",
                            color: tema.dim,
                          }}
                        >
                          {numBR(D.abertura)}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            textAlign: "right",
                            color: tema.text,
                          }}
                        >
                          {numBR(D.razaoPreco, 3)}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            textAlign: "right",
                            color: tema.faint,
                          }}
                        >
                          {ne == null ? "—" : numBR(ne, 3)}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            textAlign: "right",
                            color: tema.faint,
                          }}
                        >
                          {le == null ? "—" : numBR(le, 2)}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            textAlign: "right",
                            color: D.gap >= 0 ? tema.up : tema.down,
                          }}
                        >
                          {fmtPct(D.gap, 1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {_e && R === "base" && (
          <section
            style={{
              background: tema.panel,
              border: `1px solid ${tema.line}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: `1px solid ${tema.line}`,
                display: "flex",
                flexWrap: "wrap",
                gap: 22,
                alignItems: "center",
                fontFamily: tema.mono,
                fontSize: 12,
                color: tema.dim,
                background: tema.panelSoft,
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: tema.faint,
                }}
              >
                Origem dos dados
              </span>
              <span>
                {"histórico: "}
                <b
                  style={{
                    color: tema.text,
                  }}
                >
                  COTAHIST / B3
                </b>
                {f?.geradoEm
                  ? ` · coletado em ${new Date(f.geradoEm).toLocaleString("pt-BR")}`
                  : ""}
              </span>
              <span>
                {"dia em andamento: "}
                <b
                  style={{
                    color: tema.text,
                  }}
                >
                  cotação ao vivo
                </b>
                {y?.consultadoEm
                  ? ` · ${new Date(y.consultadoEm).toLocaleTimeString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}`
                  : " · não consultada"}
              </span>
              <span
                style={{
                  flex: 1,
                }}
              />
              <span
                style={{
                  color: tema.faint,
                }}
              >
                o COTAHIST sobrescreve o histórico a cada sincronização
              </span>
            </div>
            <div
              style={{
                padding: "14px 18px",
                borderBottom: `1px solid ${tema.line}`,
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                alignItems: "center",
              }}
            >
              <Campo label="Ativo">
                <select
                  value={Ps ?? ""}
                  onChange={(D) => ui(D.target.value)}
                  style={{
                    ...estiloInput,
                    minWidth: 120,
                  }}
                >
                  {ql.map((D) => (
                    <option key={D} value={D}>
                      {D}
                    </option>
                  ))}
                </select>
              </Campo>
              {Zi.length > 0 &&
                (() => {
                  let D = Zi.filter((ye) => ye.over != null).map(
                      (ye) => ye.over,
                    ),
                    V = D.reduce((ye, Ke) => ye + Ke, 0) / (D.length || 1),
                    ne = D.filter((ye) => ye > 0).length / (D.length || 1),
                    le = Zi.reduce((ye, Ke) => ye + Ke.vol, 0) / Zi.length;
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 18,
                        fontFamily: tema.mono,
                        fontSize: 12,
                        color: tema.dim,
                      }}
                    >
                      <span>
                        {Zi.length}
                        {" pregões"}
                      </span>
                      <span>
                        {fmtData(Zi[Zi.length - 1].ts)}
                        {" → "}
                        <b
                          style={{
                            color: tema.text,
                          }}
                        >
                          {fmtData(Zi[0].ts)}
                        </b>
                      </span>
                      <span>
                        {"over médio: "}
                        <b
                          style={{
                            color: V >= 0 ? tema.up : tema.down,
                          }}
                        >
                          {fmtPct(V, 3)}
                        </b>
                      </span>
                      <span>
                        {"win: "}
                        {fmtPct(ne, 0)}
                      </span>
                      <span>
                        {"vol médio: R$ "}
                        {fmtNum(le / 1000000)}MM
                      </span>
                    </div>
                  );
                })()}
            </div>
            <div
              style={{
                overflowX: "auto",
                maxHeight: "70vh",
                overflowY: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: tema.mono,
                  fontSize: 12.5,
                }}
              >
                <thead>
                  <tr
                    style={{
                      color: tema.faint,
                      fontSize: 10.5,
                      letterSpacing: 1,
                      position: "sticky",
                      top: 0,
                      background: tema.panel,
                    }}
                  >
                    {[
                      "DATA",
                      "ABERTURA",
                      "MÁXIMA",
                      "MÍNIMA",
                      "FECHAMENTO",
                      "VOLUME (R$)",
                      "QTD",
                      "OVER (na abertura)",
                    ].map((D, V) => (
                      <th
                        key={D}
                        style={{
                          textAlign: V === 0 ? "left" : "right",
                          padding: "9px 12px",
                          borderBottom: `1px solid ${tema.line}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {D}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Zi.map((D) => (
                    <tr key={D.ts} className="rowhover">
                      <td
                        style={{
                          padding: "7px 12px",
                          color: tema.dim,
                        }}
                      >
                        {fmtData(D.ts)}
                      </td>
                      <td
                        style={{
                          padding: "7px 12px",
                          textAlign: "right",
                        }}
                      >
                        {numBR(D.abertura)}
                      </td>
                      <td
                        style={{
                          padding: "7px 12px",
                          textAlign: "right",
                          color: tema.dim,
                        }}
                      >
                        {numBR(D.maxima)}
                      </td>
                      <td
                        style={{
                          padding: "7px 12px",
                          textAlign: "right",
                          color: tema.dim,
                        }}
                      >
                        {numBR(D.minima)}
                      </td>
                      <td
                        style={{
                          padding: "7px 12px",
                          textAlign: "right",
                        }}
                      >
                        {numBR(D.fech)}
                      </td>
                      <td
                        style={{
                          padding: "7px 12px",
                          textAlign: "right",
                          color: tema.dim,
                        }}
                      >
                        {fmtNum(D.vol)}
                      </td>
                      <td
                        style={{
                          padding: "7px 12px",
                          textAlign: "right",
                          color: tema.faint,
                        }}
                      >
                        {D.qtd != null ? fmtNum(D.qtd) : "—"}
                      </td>
                      <td
                        style={{
                          padding: "7px 12px",
                          textAlign: "right",
                          color:
                            D.over == null
                              ? tema.faint
                              : D.over >= 0
                                ? tema.up
                                : tema.down,
                        }}
                      >
                        {D.over == null ? "—" : fmtPct(D.over, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {_e &&
          R === "acompanhar" &&
          (() => {
            let D = di.filter((de) => !de.grupoId),
              V = (de) => di.filter((Fe) => Fe.grupoId === de),
              ne = (de) => Nl[de] ?? LOTE_PADRAO,
              le = (de) => resultadoDoItem(de, k, ne(de.ticker)),
              ye = (de, Fe) => {
                let Le = Fe === "" ? null : Math.max(0, +Fe),
                  ct =
                    Le > 0 ? qtdPara(Le, de.precoEntrada, ne(de.ticker)) : null;
                nu(de.id, {
                  valorInvestido: Le,
                  qtd: Le > 0 ? (ct ?? null) : null,
                });
              },
              Ke = (de, Fe) => {
                let Le = Fe === "" ? null : Math.max(0, Math.floor(+Fe || 0)),
                  ct = de.precoEntrada;
                nu(de.id, {
                  qtd: Le,
                  valorInvestido:
                    Le > 0 && ct > 0 ? +(Le * ct).toFixed(2) : null,
                });
              },
              Xe = (de) => {
                let Fe = ne(de.ticker);
                if (!(de.qtd > 0) || de.qtd % Fe === 0) return;
                let Le = arredondarLote(de.qtd, Fe),
                  ct = de.precoEntrada;
                nu(de.id, {
                  qtd: Le,
                  valorInvestido:
                    ct > 0 ? +(Le * ct).toFixed(2) : de.valorInvestido,
                });
              },
              De = (de) => {
                if (de.qtd != null) return de.qtd;
                let Fe = le(de);
                return Fe && de.valorInvestido > 0 ? Fe.acoes : "";
              },
              Pe = (de) => {
                let Fe = ne(de.ticker);
                return de.valorInvestido > 0 &&
                  de.qtd === 0 &&
                  de.precoEntrada > 0
                  ? {
                      cor: tema.down,
                      txt: `não dá 1 lote — mín. R$ ${fmtNum(Math.ceil(de.precoEntrada * Fe))}`,
                    }
                  : de.qtd > 0 && de.qtd % Fe !== 0
                    ? {
                        cor: tema.amber,
                        txt: `vira ${fmtNum(arredondarLote(de.qtd, Fe))} (lote de ${Fe})`,
                      }
                    : null;
              },
              it = (de, Fe = {}) => (
                <input
                  type="number"
                  min="0"
                  step="1000"
                  inputMode="decimal"
                  value={de.valorInvestido ?? ""}
                  placeholder="—"
                  onChange={(Le) => ye(de, Le.target.value)}
                  style={{
                    ...estiloInput,
                    width: 96,
                    textAlign: "right",
                    padding: "4px 6px",
                    ...Fe,
                  }}
                />
              ),
              ve = (de) => (
                <input
                  type="number"
                  min="0"
                  step={ne(de.ticker)}
                  inputMode="numeric"
                  value={De(de)}
                  placeholder="—"
                  onChange={(Fe) => Ke(de, Fe.target.value)}
                  onBlur={() => Xe(de)}
                  onKeyDown={(Fe) => {
                    Fe.key === "Enter" && Fe.currentTarget.blur();
                  }}
                  style={{
                    ...estiloInput,
                    width: 82,
                    textAlign: "right",
                    padding: "4px 6px",
                  }}
                />
              ),
              Ee = new Map(
                Qi.map((de) => [de.id, resumoPorEnvio(V(de.id), k, ne)]),
              ),
              Ne = (de) => {
                let Fe = (Ee.get(de) || []).filter((Ir) => Ir.retorno != null);
                if (Fe.length === 0) return null;
                let Le = 1,
                  ct = 0,
                  Qt = 0,
                  dr = 0,
                  Qr = 0;
                for (let Ir of Fe)
                  ((Le = compor(MODO_OVER, Le, Ir.retorno)),
                    (ct += Ir.resultado),
                    (Qt += Ir.compra),
                    (dr += Ir.sobra),
                    Ir.retorno >= 0 && Qr++);
                return {
                  nNoites: Fe.length,
                  acum: Le - 1,
                  resultado: ct,
                  compra: Qt,
                  sobra: dr,
                  acertos: Qr,
                };
              },
              wt = corDoGrupo,
              ht = "Overnight padrão",
              Ft = curvaCarteira(_e, Ll, xa, k, ne)
                .map((de) => ({
                  ...de,
                  tsVenda: de.ts,
                  ts: pregaoAnterior(_e, de.ts),
                }))
                .filter((de) => de.ts != null),
              Sr = new Map(Ft.map((de) => [de.ts, de.ret])),
              Oe = Ft.length ? Ft[0].ts : null,
              ke = Ft.length ? Ft[Ft.length - 1].ts : null,
              He = Qi.filter((de) => Ne(de.id) != null),
              Mt = (de) => de >= (Iy ?? -1 / 0) && de <= (Fy ?? 1 / 0),
              aa = (() => {
                let de = new Set();
                for (let Fe of He)
                  for (let Le of Ee.get(Fe.id) || [])
                    Le.retorno != null && Mt(Le.ts) && de.add(Le.ts);
                return Array.from(de).sort((Fe, Le) => Fe - Le);
              })(),
              mi =
                Eh === "periodo"
                  ? Array.from(
                      new Set([...Ft.map((de) => de.ts).filter(Mt), ...aa]),
                    ).sort((de, Fe) => de - Fe)
                  : aa,
              Lo = (() => {
                let de = mi.map((ct) => Sr.get(ct)).filter((ct) => ct != null);
                if (de.length === 0) return null;
                let Fe = 1,
                  Le = 0;
                for (let ct of de)
                  ((Fe = compor(MODO_OVER, Fe, ct)), ct >= 0 && Le++);
                return {
                  nNoites: de.length,
                  acum: Fe - 1,
                  acertos: Le,
                };
              })(),
              Fa = new Map(
                He.map((de) => [
                  de.id,
                  new Map(
                    (Ee.get(de.id) || [])
                      .filter((Fe) => Fe.retorno != null && Mt(Fe.ts))
                      .map((Fe) => [Fe.ts, Fe]),
                  ),
                ]),
              ),
              uu = new Map(
                He.map((de) => {
                  let Fe = Array.from(Fa.get(de.id).keys());
                  return [
                    de.id,
                    Fe.length
                      ? [Math.min(...Fe), Math.max(...Fe)]
                      : [1 / 0, -1 / 0],
                  ];
                }),
              ),
              hi = (() => {
                let de = new Map(He.map((Le) => [Le.id, 1])),
                  Fe = 1;
                return mi.map((Le) => {
                  let ct = {
                    label: fmtData(Le),
                  };
                  for (let dr of He) {
                    let [Qr, Ir] = uu.get(dr.id),
                      vi = "g_" + dr.id;
                    if (Le < Qr || Le > Ir) {
                      ct[vi] = null;
                      continue;
                    }
                    let no = Fa.get(dr.id).get(Le);
                    Ms === "acum"
                      ? (no &&
                          de.set(
                            dr.id,
                            compor(MODO_OVER, de.get(dr.id), no.retorno),
                          ),
                        (ct[vi] = +((de.get(dr.id) - 1) * 100).toFixed(3)))
                      : (ct[vi] = no ? +(no.retorno * 100).toFixed(3) : null);
                  }
                  let Qt = Sr.get(Le);
                  return (
                    ke == null || Le > ke || Le < Oe
                      ? (ct[ht] = null)
                      : Ms === "acum"
                        ? (Qt != null && (Fe = compor(MODO_OVER, Fe, Qt)),
                          (ct[ht] = +((Fe - 1) * 100).toFixed(3)))
                        : (ct[ht] = Qt != null ? +(Qt * 100).toFixed(3) : null),
                    ct
                  );
                });
              })(),
              Ce = (de) => {
                let Le = {
                  cotahist: {
                    txt: "✓ COTAHIST",
                    cor: tema.up,
                  },
                  yahoo: {
                    txt: "⏳ Yahoo",
                    cor: tema.amber,
                  },
                  manual: {
                    txt: "✎ manual",
                    cor: tema.amber,
                  },
                }[de] || {
                  txt: "⏳ provisório",
                  cor: tema.faint,
                };
                return (
                  <span
                    style={{
                      fontSize: 9.5,
                      color: Le.cor,
                      letterSpacing: 0.3,
                    }}
                  >
                    {Le.txt}
                  </span>
                );
              },
              Ye = (de) => {
                if (!ru) return;
                let Fe = _e.byTicker.get(ru),
                  Le = Fe && Fe.length ? Fe[Fe.length - 1] : null,
                  ct = Le ? Le.fech : null,
                  Qt = Le ? Le.ts : fe;
                (Yi((dr) => {
                  let Qr = [
                    ...dr,
                    {
                      id: `${ru}_manual_${Qt}_${Date.now()}`,
                      ticker: ru,
                      estrategiaId: "manual",
                      estrategiaNome: "lançamento manual",
                      dataEnvio: Qt,
                      grupoId: de,
                      precoEntrada: ct,
                      origemPreco: "provisorio",
                      precoProvisorio: ct,
                      valorInvestido: VALOR_PADRAO,
                      qtd: qtdPara(VALOR_PADRAO, ct, ne(ru)) ?? null,
                      abertura: null,
                      origemAbertura: null,
                    },
                  ];
                  return (
                    window.storage
                      .set("ovr3:acomp_itens", JSON.stringify(Qr))
                      .catch(() => {}),
                    Qr
                  );
                }),
                  bk(""));
              },
              fr = (de) => (
                <div
                  style={{
                    overflowX: "auto",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontFamily: tema.mono,
                      fontSize: 12,
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
                          ATIVO
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "left",
                            borderBottom: `1px solid ${tema.line}`,
                          }}
                        >
                          ESTRATÉGIA
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: `1px solid ${tema.line}`,
                          }}
                        >
                          ENTRADA (FECHAMENTO)
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: `1px solid ${tema.line}`,
                            color: tema.amber,
                          }}
                        >
                          VALOR R$ ✎
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: `1px solid ${tema.line}`,
                            color: tema.amber,
                          }}
                        >
                          AÇÕES ✎
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: `1px solid ${tema.line}`,
                            color: tema.amber,
                          }}
                        >
                          LOTE ✎
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: `1px solid ${tema.line}`,
                          }}
                        >
                          COMPRA EFETIVA
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: `1px solid ${tema.line}`,
                            color: tema.amber,
                          }}
                        >
                          SAÍDA (ABERTURA) ✎
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: `1px solid ${tema.line}`,
                          }}
                        >
                          RETORNO
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderBottom: `1px solid ${tema.line}`,
                          }}
                        >
                          RESULTADO
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            borderBottom: `1px solid ${tema.line}`,
                          }}
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {de.itens.map((Fe) => {
                        let Le = le(Fe),
                          ct = ne(Fe.ticker),
                          Qt = liquidezNoDia(_e, Fe.ticker, Fe.dataEnvio),
                          dr = Qt != null ? (Qt * N) / 100 : null,
                          Qr = dr != null && Le && Le.compra > dr,
                          Ir = Qt == null || Qt < X * 1000000,
                          vi =
                            Fe.origemPreco === "cotahist" &&
                            Fe.precoProvisorio != null &&
                            Math.abs(Fe.precoProvisorio - Fe.precoEntrada) >
                              0.005;
                        return (
                          <tr key={Fe.id} className="rowhover">
                            <td
                              style={{
                                padding: "6px 10px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                (ui(Fe.ticker), M("base"));
                              }}
                            >
                              {Fe.ticker}
                              {Ir && (
                                <span
                                  title={`volume médio de 20 pregões em ${fmtData(Fe.dataEnvio)}: ${Qt == null ? "sem dado" : "R$ " + fmtNum(Qt / 1000000) + " MM"} — abaixo do piso de R$ ${fmtNum(X)} MM`}
                                  style={{
                                    color: tema.down,
                                    fontSize: 10,
                                    fontWeight: 400,
                                    marginLeft: 6,
                                  }}
                                >
                                  ▼ liq
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                color: tema.dim,
                              }}
                            >
                              {Fe.estrategiaNome}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                textAlign: "right",
                              }}
                            >
                              <div>
                                {"R$ "}
                                {Fe.precoEntrada != null
                                  ? numBR(Fe.precoEntrada)
                                  : "—"}
                              </div>
                              <div>{Ce(Fe.origemPreco)}</div>
                              {vi && (
                                <div
                                  style={{
                                    fontSize: 9.5,
                                    color: tema.amber,
                                  }}
                                >
                                  {"ajustado de "}
                                  {numBR(Fe.precoProvisorio)}
                                </div>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "4px 6px",
                                textAlign: "right",
                                background: tema.amberSoft,
                              }}
                            >
                              {it(Fe, {
                                borderColor: Qr ? tema.down : tema.line,
                              })}
                              {dr != null && (
                                <div
                                  style={{
                                    fontSize: 9.5,
                                    color: Qr ? tema.down : tema.faint,
                                    marginTop: 2,
                                  }}
                                >
                                  {Qr ? "acima do " : ""}
                                  {"limite R$ "}
                                  {fmtNum(dr)}
                                </div>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "4px 6px",
                                textAlign: "right",
                                background: tema.amberSoft,
                              }}
                            >
                              {ve(Fe)}
                              {Pe(Fe) && (
                                <div
                                  style={{
                                    fontSize: 9.5,
                                    color: Pe(Fe).cor,
                                    marginTop: 2,
                                  }}
                                >
                                  {Pe(Fe).txt}
                                </div>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "4px 6px",
                                textAlign: "right",
                                background: tema.amberSoft,
                              }}
                            >
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={ct}
                                onChange={(no) =>
                                  gW(
                                    Fe.ticker,
                                    Math.max(
                                      1,
                                      +no.target.value || LOTE_PADRAO,
                                    ),
                                  )
                                }
                                style={{
                                  ...estiloInput,
                                  width: 58,
                                  textAlign: "right",
                                  padding: "4px 6px",
                                }}
                                title="100 para ações e units, 1 para FII, 10 para a maioria dos ETFs"
                              />
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                textAlign: "right",
                                color: tema.dim,
                              }}
                            >
                              {Le && Le.compra > 0 ? (
                                <>
                                  <div>
                                    {"R$ "}
                                    {fmtNum(Le.compra)}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 9.5,
                                      color: tema.faint,
                                    }}
                                  >
                                    {+Le.lotes.toFixed(2)}{" "}
                                    {Le.lotes === 1 ? "lote" : "lotes"}
                                    {" · "}
                                    {fmtNum(Le.acoes)}
                                    {" un"}
                                  </div>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td
                              style={{
                                padding: "4px 6px",
                                textAlign: "right",
                                background:
                                  Fe.origemAbertura === "cotahist"
                                    ? "transparent"
                                    : tema.amberSoft,
                              }}
                            >
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={Fe.abertura ?? ""}
                                placeholder="—"
                                disabled={Fe.origemAbertura === "cotahist"}
                                onChange={(no) =>
                                  nu(Fe.id, {
                                    abertura:
                                      no.target.value === ""
                                        ? null
                                        : +no.target.value,
                                    origemAbertura:
                                      no.target.value === "" ? null : "manual",
                                  })
                                }
                                style={{
                                  ...estiloInput,
                                  width: 82,
                                  textAlign: "right",
                                  padding: "4px 6px",
                                }}
                                title={
                                  Fe.origemAbertura === "cotahist"
                                    ? "dado oficial da B3 — não editável"
                                    : "manual ou Yahoo; o COTAHIST substitui quando chegar"
                                }
                              />
                              <div>{Ce(Fe.origemAbertura)}</div>
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                textAlign: "right",
                                fontWeight: 700,
                                color:
                                  !Le || Le.retorno == null
                                    ? tema.faint
                                    : Le.retorno >= 0
                                      ? tema.up
                                      : tema.down,
                              }}
                            >
                              {!Le || Le.retorno == null
                                ? "—"
                                : fmtPct(Le.retorno, 2)}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                textAlign: "right",
                                color:
                                  !Le || Le.resultado == null
                                    ? tema.faint
                                    : Le.resultado >= 0
                                      ? tema.up
                                      : tema.down,
                              }}
                            >
                              {!Le || Le.resultado == null
                                ? "—"
                                : `R$ ${fmtNum(Le.resultado)}`}
                              {Le && Le.resultado != null && (
                                <div
                                  style={{
                                    fontSize: 9.5,
                                    color: tema.faint,
                                  }}
                                >
                                  {"taxa R$ "}
                                  {fmtNum(Le.custo)}
                                </div>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                textAlign: "right",
                              }}
                            >
                              <button
                                onClick={() => Ik(Fe.id)}
                                style={{
                                  ...estiloBotao,
                                  padding: "2px 7px",
                                  fontSize: 10.5,
                                  color: tema.faint,
                                }}
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
              );
            return (
              <div
                style={{
                  display: "grid",
                  gap: 16,
                }}
              >
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 14,
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12.5,
                      color: tema.dim,
                      lineHeight: 1.7,
                      maxWidth: 660,
                    }}
                  >
                    {"Cada compra entra no "}
                    <b
                      style={{
                        color: tema.text,
                      }}
                    >
                      fechamento do leilão
                    </b>
                    {" e sai na"}{" "}
                    <b
                      style={{
                        color: tema.text,
                      }}
                    >
                      abertura do pregão seguinte
                    </b>
                    {". Valor e ações chegam da aba OPERAR (padrão R$ "}
                    {fmtNum(VALOR_PADRAO)}
                    {
                      ", lotes de 100) e andam juntos: mexa no valor e as ações acompanham; mexa nas ações e o valor acompanha. O resultado sai líquido da taxa de "
                    }
                    {numBR(k, 3)}%.
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily: tema.mono,
                        fontSize: 11,
                        color: tema.faint,
                      }}
                    >
                      {Ce("cotahist")}
                      {" dado oficial, definitivo · "}
                      {Ce("yahoo")}
                      {" cotação viva ·"} {Ce("manual")}
                      {" digitado por você · "}
                      {Ce(null)}
                      {" preço do momento do clique, ainda não confirmado"}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Chip active={Ms === "acum"} onClick={() => wk("acum")}>
                      Acumulado
                    </Chip>
                    <Chip active={Ms === "diario"} onClick={() => wk("diario")}>
                      Diário
                    </Chip>
                    <button
                      onClick={SW}
                      disabled={hk}
                      style={{
                        ...estiloBotao,
                        color: tema.up,
                        borderColor: tema.up,
                      }}
                      title="preenche a abertura pelo Yahoo; nunca por cima de dado oficial"
                    >
                      {hk ? "buscando…" : "🔄 cotação de agora"}
                    </button>
                    <button
                      onClick={() => Pk(null)}
                      style={{
                        ...estiloBotao,
                        color: tema.amber,
                        borderColor: tema.amber,
                      }}
                      title="relatório do mês para o imposto de renda, com o DARF"
                    >
                      📄 relatório IR / DARF
                    </button>
                  </div>
                </section>
                {gk && (
                  <div
                    style={{
                      fontFamily: tema.mono,
                      fontSize: 12,
                      color: tema.dim,
                    }}
                  >
                    {gk}
                  </div>
                )}
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    padding: "13px 16px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 14,
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12.5,
                      color: tema.dim,
                      lineHeight: 1.6,
                      flex: "1 1 100%",
                    }}
                  >
                    <b
                      style={{
                        color: tema.text,
                      }}
                    >
                      Overnight padrão
                    </b>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11.5,
                        color: tema.faint,
                      }}
                    >
                      {
                        "Cesta fixa, reconstruída do COTAHIST no intervalo escolhido — não depende de lançamento. Mexa nos ativos e no valor de cada um; a curva sai desses valores, com arredondamento de lote igual ao da aba OPERAR. Série disponível desde "
                      }
                      {Oe != null ? fmtData(Oe) : "—"}.
                    </div>
                  </div>
                  <div
                    style={{
                      flex: "1 1 100%",
                    }}
                  >
                    <EditorCarteira
                      carteira={Ll}
                      onChange={It}
                      tickers={ql}
                      marked={null}
                      sizing={null}
                      rank={null}
                      titulo="Ativos e valores da cesta"
                      nu={true}
                      abaixoDoPiso={Hy}
                      piso={X}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 18,
                      alignItems: "flex-end",
                      flex: "1 1 100%",
                    }}
                  >
                    <SeletorPeriodo
                      de={Iy}
                      ate={Fy}
                      onDe={Ek}
                      onAte={My}
                      dates={_e.dates}
                    />
                    <Campo label="Escopo do gráfico">
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <Chip
                          active={Eh === "periodo"}
                          onClick={() => Ak("periodo")}
                        >
                          Intervalo inteiro
                        </Chip>
                        <Chip
                          active={Eh === "operadas"}
                          onClick={() => Ak("operadas")}
                        >
                          Só as noites que operei
                        </Chip>
                      </div>
                    </Campo>
                    {Lo && (
                      <div
                        style={{
                          fontFamily: tema.mono,
                          fontSize: 11.5,
                          color: tema.faint,
                          paddingBottom: 4,
                        }}
                      >
                        padrão no recorte:{" "}
                        <b
                          style={{
                            color: Lo.acum >= 0 ? tema.up : tema.down,
                          }}
                        >
                          {fmtPct(Lo.acum, 1)}
                        </b>{" "}
                        {"em "}
                        {Lo.nNoites}
                        {" noites"}
                      </div>
                    )}
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: tema.dim,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={xa}
                      onChange={(de) => {
                        (mk(de.target.checked),
                          window.storage
                            .set("ovr3:encadear", de.target.checked ? "1" : "0")
                            .catch(() => {}));
                      }}
                    />
                    emendar ticker antigo
                    <span
                      style={{
                        fontSize: 11,
                        color: tema.faint,
                      }}
                    >
                      (EMBR3→EMBJ3, RRRP3→BRAV3; sem isso a curva só começa em
                      nov/2025)
                    </span>
                  </label>
                </section>
                {D.length > 0 && (
                  <section
                    style={{
                      background: tema.panel,
                      border: `1px solid ${tema.amber}`,
                      borderRadius: 14,
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 650,
                        fontSize: 14,
                        marginBottom: 4,
                      }}
                    >
                      {"A organizar "}
                      <span
                        style={{
                          fontFamily: tema.mono,
                          fontSize: 11.5,
                          color: tema.amber,
                        }}
                      >
                        {D.length}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: tema.faint,
                        marginBottom: 10,
                      }}
                    >
                      Marcados com ★ em OPERAR ou ESTRATÉGIAS. Escolha o grupo
                      de cada um.
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: 7,
                      }}
                    >
                      {D.map((de) => (
                        <div
                          key={de.id}
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 10,
                            alignItems: "center",
                            padding: "7px 10px",
                            background: tema.panelSoft,
                            borderRadius: 7,
                          }}
                        >
                          <b
                            style={{
                              fontFamily: tema.mono,
                              fontSize: 14,
                            }}
                          >
                            {de.ticker}
                          </b>
                          <span
                            style={{
                              fontSize: 11.5,
                              color: tema.dim,
                            }}
                          >
                            {de.estrategiaNome}
                          </span>
                          <span
                            style={{
                              fontFamily: tema.mono,
                              fontSize: 11.5,
                              color: tema.faint,
                            }}
                          >
                            {fmtData(de.dataEnvio)}
                          </span>
                          <span
                            style={{
                              fontFamily: tema.mono,
                              fontSize: 11.5,
                            }}
                          >
                            {"R$ "}
                            {de.precoEntrada != null
                              ? numBR(de.precoEntrada)
                              : "—"}{" "}
                            {Ce(de.origemPreco)}
                          </span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11.5,
                                color: tema.faint,
                              }}
                            >
                              R$
                            </span>
                            {it(de)}
                            <span
                              style={{
                                fontSize: 11.5,
                                color: tema.faint,
                              }}
                            >
                              ações
                            </span>
                            {ve(de)}
                            {Pe(de) && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  color: Pe(de).cor,
                                }}
                              >
                                {Pe(de).txt}
                              </span>
                            )}
                          </span>
                          <span
                            style={{
                              flex: 1,
                            }}
                          />
                          <select
                            value=""
                            onChange={(Fe) =>
                              Fe.target.value &&
                              nu(de.id, {
                                grupoId: Fe.target.value,
                              })
                            }
                            style={{
                              ...estiloInput,
                              minWidth: 150,
                            }}
                          >
                            <option value="">mandar para…</option>
                            {Qi.map((Fe) => (
                              <option key={Fe.id} value={Fe.id}>
                                {Fe.nome}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => Ik(de.id)}
                            style={{
                              ...estiloBotao,
                              padding: "3px 8px",
                              fontSize: 11,
                              color: tema.faint,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 650,
                      fontSize: 15,
                      marginBottom: 2,
                    }}
                  >
                    {Ms === "acum" ? "Retorno acumulado" : "Retorno por noite"}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: tema.faint,
                      marginBottom: 10,
                    }}
                  >
                    Sempre em %, líquido de taxa, cada ponto pela data da compra
                    (a data da cesta).
                    {Eh === "operadas"
                      ? " O Overnight padrão acumula só nas mesmas noites em que seus grupos operaram, para a comparação ser de igual para igual."
                      : " O Overnight padrão cobre o intervalo inteiro; cada grupo aparece da primeira à última cesta dele."}
                  </div>
                  {mi.length === 0 ? (
                    <div
                      style={{
                        padding: "26px 0",
                        textAlign: "center",
                        color: tema.faint,
                        fontSize: 13,
                      }}
                    >
                      Sem noite fechada ainda. Informe o valor investido e
                      espere a abertura do pregão seguinte.
                    </div>
                  ) : (
                    <div
                      style={{
                        height: 300,
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={hi} margin={MARGEM}>
                          <defs>
                            {He.map((de) => (
                              <Degrade
                                key={de.id}
                                id={"grad_g_" + de.id}
                                cor={wt(de, Qi.indexOf(de))}
                                opacidade={He.length > 2 ? 0.1 : 0.2}
                              />
                            ))}
                          </defs>
                          <CartesianGrid {...GRADE} />
                          <XAxis {...EIXO_X} dataKey="label" minTickGap={48} />
                          <YAxis
                            {...EIXO_Y}
                            tickFormatter={(de) =>
                              de.toFixed(Ms === "acum" ? 0 : 1) + "%"
                            }
                          />
                          <Tooltip
                            content={<TooltipGrafico casas={2} />}
                            cursor={CURSOR}
                          />
                          <Legend content={<LegendaGrafico />} />
                          <ReferenceLine
                            y={0}
                            stroke={tema.faint}
                            strokeOpacity={0.6}
                          />
                          <Line
                            type="monotone"
                            dataKey={ht}
                            stroke={tema.dim}
                            dot={false}
                            activeDot={PONTO_ATIVO}
                            strokeWidth={1.6}
                            strokeDasharray="5 4"
                            connectNulls={Ms === "acum"}
                            animationDuration={700}
                          />
                          {He.map((de) =>
                            Ms === "acum" ? (
                              <Area
                                key={de.id}
                                type="monotone"
                                dataKey={"g_" + de.id}
                                name={de.nome}
                                stroke={wt(de, Qi.indexOf(de))}
                                fill={`url(#grad_g_${de.id})`}
                                dot={false}
                                activeDot={PONTO_ATIVO}
                                strokeWidth={2.2}
                                connectNulls={true}
                                animationDuration={700}
                              />
                            ) : (
                              <Line
                                key={de.id}
                                type="monotone"
                                dataKey={"g_" + de.id}
                                name={de.nome}
                                stroke={wt(de, Qi.indexOf(de))}
                                dot={false}
                                activeDot={PONTO_ATIVO}
                                strokeWidth={1.4}
                                connectNulls={false}
                                animationDuration={700}
                              />
                            ),
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    padding: "12px 16px",
                    display: "flex",
                    gap: 9,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: tema.faint,
                    }}
                  >
                    novo grupo:
                  </span>
                  <input
                    value={xk}
                    onChange={(de) => yk(de.target.value)}
                    placeholder="ex: MIX, Reversão Clássica…"
                    style={{
                      ...estiloInput,
                      minWidth: 210,
                    }}
                  />
                  <button
                    onClick={() => {
                      bW(xk) && yk("");
                    }}
                    style={{
                      ...estiloBotao,
                      color: tema.amber,
                      borderColor: tema.amber,
                    }}
                  >
                    + criar
                  </button>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: tema.faint,
                    }}
                  >
                    o mesmo grupo recebe uma cesta nova a cada dia; a curva soma
                    todas
                  </span>
                </section>
                {Qi.map((de, Fe) => {
                  let Le = Ee.get(de.id) || [],
                    ct = Ne(de.id),
                    Qt = V(de.id).length,
                    dr = wt(de, Fe),
                    Qr = new Map();
                  for (let rt of Le.slice().reverse()) {
                    let or = anoMes(rt.ts);
                    (Qr.has(or) || Qr.set(or, []), Qr.get(or).push(rt));
                  }
                  let Ir = Array.from(Qr.entries()).map(([rt, or]) => {
                      let Ma = or.filter((Ra) => Ra.retorno != null),
                        gi = 0,
                        sr = 0,
                        fu = 0;
                      for (let Ra of Ma)
                        ((gi = compor(MODO_OVER, gi, Ra.retorno)),
                          (sr += Ra.resultado),
                          Ra.retorno >= 0 && fu++);
                      return {
                        ym: rt,
                        cestas: or,
                        nFechadas: Ma.length,
                        acum: gi,
                        resultado: sr,
                        acertos: fu,
                        nCompras: or.reduce(
                          (Ra, Ih) => Ra + Ih.itens.length,
                          0,
                        ),
                        pendentes: or.filter((Ra) => Ra.semValor > 0).length,
                        abertas: or.filter((Ra) => Ra.retorno == null).length,
                      };
                    }),
                    vi = Le.length ? Le[Le.length - 1].ts : null,
                    no = Ir.length ? Ir[0].ym : null,
                    Hk = `g:${de.id}`,
                    Qy = (rt) => `m:${de.id}:${rt}`,
                    Jy = (rt) => `d:${de.id}:${rt}`,
                    Ul = Py[Hk] ?? true,
                    Vk = (rt) =>
                      Py[Qy(rt.ym)] ?? (rt.ym === no || rt.pendentes > 0),
                    Gk = (rt) =>
                      Py[Jy(rt.ts)] ?? (rt.ts === vi || rt.semValor > 0),
                    Xk = Ir.some(
                      (rt) => Vk(rt) && rt.cestas.some((or) => Gk(or)),
                    ),
                    BW = (rt) => {
                      let or = {};
                      for (let Ma of Ir) {
                        or[Qy(Ma.ym)] = rt;
                        for (let gi of Ma.cestas) or[Jy(gi.ts)] = rt;
                      }
                      Ry(or);
                    },
                    Zy = (rt, or) => ({
                      role: "button",
                      tabIndex: 0,
                      "aria-expanded": or,
                      "data-no": rt,
                      onClick: () =>
                        Ry({
                          [rt]: !or,
                        }),
                      onKeyDown: (Ma) => {
                        (Ma.key === "Enter" || Ma.key === " ") &&
                          (Ma.preventDefault(),
                          Ry({
                            [rt]: !or,
                          }));
                      },
                    }),
                    eb = (rt) => (
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-block",
                          width: 12,
                          color: tema.faint,
                          fontFamily: tema.mono,
                        }}
                      >
                        {rt ? "▾" : "▸"}
                      </span>
                    ),
                    Kk = (rt, or, Ma, gi, sr) => (
                      <span
                        style={{
                          fontFamily: tema.mono,
                          fontSize: 12.5,
                        }}
                      >
                        <b
                          style={{
                            color: rt >= 0 ? tema.up : tema.down,
                          }}
                        >
                          {fmtPct(rt, 2)}
                        </b>
                        <span
                          style={{
                            color: tema.faint,
                          }}
                        >
                          {" "}
                          {sr}
                          {" · "}
                        </span>
                        <b
                          style={{
                            color: or >= 0 ? tema.up : tema.down,
                          }}
                        >
                          {"R$ "}
                          {fmtNum(or)}
                        </b>
                        <span
                          style={{
                            color: tema.faint,
                          }}
                        >
                          {" · "}
                          {Ma}/{gi} {gi === 1 ? "noite" : "noites"}
                        </span>
                      </span>
                    );
                  return (
                    <section
                      key={de.id}
                      style={{
                        background: tema.panel,
                        border: `1px solid ${tema.line}`,
                        borderRadius: 14,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "14px 18px",
                          borderBottom: Ul ? `1px solid ${tema.line}` : "none",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <div
                          {...Zy(Hk, Ul)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          title={Ul ? "recolher o grupo" : "abrir o grupo"}
                        >
                          {eb(Ul)}
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: 9,
                              background: dr,
                            }}
                          />
                          <span
                            style={{
                              fontWeight: 650,
                              fontSize: 15,
                            }}
                          >
                            {de.nome}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: tema.mono,
                              color: tema.faint,
                            }}
                          >
                            {Le.length} {Le.length === 1 ? "cesta" : "cestas"}
                            {" · "}
                            {Qt} {Qt === 1 ? "compra" : "compras"}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          {ct &&
                            Kk(
                              ct.acum,
                              ct.resultado,
                              ct.acertos,
                              ct.nNoites,
                              "acumulado",
                            )}
                          {Ul && Ir.length > 0 && (
                            <button
                              onClick={() => BW(!Xk)}
                              style={{
                                ...estiloBotao,
                                padding: "4px 9px",
                                fontSize: 11,
                                color: tema.dim,
                              }}
                            >
                              {Xk ? "recolher tudo" : "abrir tudo"}
                            </button>
                          )}
                          {Qt > 0 && (
                            <button
                              onClick={() => Pk(de.id)}
                              style={{
                                ...estiloBotao,
                                padding: "4px 9px",
                                fontSize: 11,
                                color: tema.amber,
                              }}
                              title="relatório deste grupo para o imposto de renda"
                            >
                              relatório IR
                            </button>
                          )}
                          {de.tipo === "sim" && (
                            <button
                              onClick={() => wW(de.id)}
                              style={{
                                ...estiloBotao,
                                padding: "4px 9px",
                                fontSize: 11,
                                color: tema.faint,
                              }}
                            >
                              excluir grupo
                            </button>
                          )}
                        </div>
                      </div>
                      {Ul && (
                        <div
                          style={{
                            padding: "10px 18px",
                            borderBottom: `1px solid ${tema.line}`,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 10,
                            alignItems: "center",
                            background: tema.panelSoft,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11.5,
                              color: tema.faint,
                            }}
                          >
                            lançar direto neste grupo:
                          </span>
                          <select
                            value={ru}
                            onChange={(rt) => bk(rt.target.value)}
                            style={{
                              ...estiloInput,
                              minWidth: 110,
                            }}
                          >
                            <option value="">ativo…</option>
                            <optgroup
                              label={`passam no piso (${fmtNum(X)} MM)`}
                            >
                              {ql
                                .filter((rt) => !Hy(rt))
                                .map((rt) => (
                                  <option key={rt} value={rt}>
                                    {rt}
                                  </option>
                                ))}
                            </optgroup>
                            <optgroup label="abaixo do piso de liquidez">
                              {ql
                                .filter((rt) => Hy(rt))
                                .map((rt) => (
                                  <option key={rt} value={rt}>
                                    {rt}
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                          <button
                            onClick={() => Ye(de.id)}
                            style={{
                              ...estiloBotao,
                              color: tema.amber,
                              borderColor: tema.amber,
                            }}
                          >
                            + adicionar
                          </button>
                          {ct && Math.abs(ct.sobra) >= 0.01 && (
                            <span
                              style={{
                                fontSize: 11.5,
                                color: tema.faint,
                                marginLeft: "auto",
                                fontFamily: tema.mono,
                              }}
                            >
                              {"sobra em caixa por arredondamento de lote: R$ "}
                              {fmtNum(ct.sobra)}
                            </span>
                          )}
                        </div>
                      )}
                      {Ul &&
                        (Le.length === 0 ? (
                          <div
                            style={{
                              padding: "24px 18px",
                              textAlign: "center",
                              color: tema.faint,
                              fontSize: 13,
                            }}
                          >
                            Nenhuma cesta neste grupo ainda.
                          </div>
                        ) : (
                          Ir.map((rt) => {
                            let or = Vk(rt),
                              Ma = Math.floor(rt.ym / 100),
                              gi = rt.ym % 100;
                            return (
                              <div key={rt.ym}>
                                <div
                                  {...Zy(Qy(rt.ym), or)}
                                  style={{
                                    padding: "10px 18px",
                                    background: tema.panelSoft,
                                    borderBottom: `1px solid ${tema.line}`,
                                    borderLeft: `3px solid ${or ? dr : "transparent"}`,
                                    cursor: "pointer",
                                    userSelect: "none",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    {eb(or)}
                                    <span
                                      style={{
                                        fontWeight: 650,
                                        fontSize: 13.5,
                                        textTransform: "capitalize",
                                      }}
                                    >
                                      {MESES_LONGOS[gi - 1]} {Ma}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 12,
                                        color: dr,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {de.nome}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontFamily: tema.mono,
                                        color: tema.faint,
                                      }}
                                    >
                                      {rt.cestas.length}{" "}
                                      {rt.cestas.length === 1
                                        ? "cesta"
                                        : "cestas"}
                                      {" · "}
                                      {rt.nCompras}{" "}
                                      {rt.nCompras === 1 ? "compra" : "compras"}
                                    </span>
                                    {rt.pendentes > 0 && (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontFamily: tema.mono,
                                          color: tema.amber,
                                        }}
                                      >
                                        {rt.pendentes}{" "}
                                        {rt.pendentes === 1
                                          ? "cesta"
                                          : "cestas"}
                                        {" com valor faltando"}
                                      </span>
                                    )}
                                  </span>
                                  {rt.nFechadas > 0 ? (
                                    Kk(
                                      rt.acum,
                                      rt.resultado,
                                      rt.acertos,
                                      rt.nFechadas,
                                      "no mês",
                                    )
                                  ) : (
                                    <span
                                      style={{
                                        fontFamily: tema.mono,
                                        fontSize: 12,
                                        color: tema.faint,
                                      }}
                                    >
                                      sem noite fechada
                                    </span>
                                  )}
                                </div>
                                {or &&
                                  rt.cestas.map((sr) => {
                                    let fu = Gk(sr),
                                      Ra = DIAS_SEMANA[
                                        new Date(sr.ts).getUTCDay()
                                      ].slice(0, 3);
                                    return (
                                      <div key={sr.ts}>
                                        <div
                                          {...Zy(Jy(sr.ts), fu)}
                                          style={{
                                            padding: "8px 18px 8px 34px",
                                            background: tema.bg,
                                            borderBottom: `1px solid ${tema.line}`,
                                            cursor: "pointer",
                                            userSelect: "none",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                            gap: 8,
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontFamily: tema.mono,
                                              fontSize: 12,
                                              color: tema.text,
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 6,
                                              flexWrap: "wrap",
                                            }}
                                          >
                                            {eb(fu)}
                                            <span>
                                              {"cesta de "}
                                              {fmtData(sr.ts)}
                                            </span>
                                            <span
                                              style={{
                                                color: tema.faint,
                                              }}
                                            >
                                              {Ra}
                                              {" · "}
                                              {sr.itens.length}{" "}
                                              {sr.itens.length === 1
                                                ? "papel"
                                                : "papéis"}
                                            </span>
                                            {sr.semValor > 0 && (
                                              <span
                                                style={{
                                                  color: tema.amber,
                                                }}
                                              >
                                                {"· "}
                                                {sr.semValor}
                                                {" sem valor"}
                                              </span>
                                            )}
                                            {(() => {
                                              let Ih = sr.itens.filter((Yk) => {
                                                let Qk = liquidezNoDia(
                                                  _e,
                                                  Yk.ticker,
                                                  Yk.dataEnvio,
                                                );
                                                return (
                                                  Qk == null || Qk < X * 1000000
                                                );
                                              }).length;
                                              return Ih > 0 ? (
                                                <span
                                                  style={{
                                                    color: tema.down,
                                                  }}
                                                >
                                                  {"· ▼ "}
                                                  {Ih}
                                                  {" abaixo do piso"}
                                                </span>
                                              ) : null;
                                            })()}
                                          </span>
                                          <span
                                            style={{
                                              fontFamily: tema.mono,
                                              fontSize: 12,
                                            }}
                                          >
                                            {sr.retorno == null ? (
                                              <span
                                                style={{
                                                  color: tema.faint,
                                                }}
                                              >
                                                {sr.semValor === sr.itens.length
                                                  ? "informe o valor de cada papel"
                                                  : "aguardando abertura do pregão seguinte"}
                                              </span>
                                            ) : (
                                              <>
                                                <span
                                                  style={{
                                                    color: tema.faint,
                                                  }}
                                                >
                                                  {"investido R$ "}
                                                  {fmtNum(sr.compra)}
                                                  {" · "}
                                                </span>
                                                <span
                                                  style={{
                                                    color: tema.faint,
                                                  }}
                                                  title="papéis que fecharam a noite no lucro, já com taxa"
                                                >
                                                  {sr.positivos}/{sr.comDado}
                                                  {" no lucro ·"}{" "}
                                                </span>
                                                <b
                                                  style={{
                                                    color:
                                                      sr.retorno >= 0
                                                        ? tema.up
                                                        : tema.down,
                                                  }}
                                                >
                                                  {fmtPct(sr.retorno, 2)}
                                                </b>
                                                <span
                                                  style={{
                                                    color: tema.faint,
                                                  }}
                                                >
                                                  {" · "}
                                                </span>
                                                <b
                                                  style={{
                                                    color:
                                                      sr.resultado >= 0
                                                        ? tema.up
                                                        : tema.down,
                                                  }}
                                                >
                                                  {"R$ "}
                                                  {fmtNum(sr.resultado)}
                                                </b>
                                              </>
                                            )}
                                          </span>
                                        </div>
                                        {fu && fr(sr)}
                                      </div>
                                    );
                                  })}
                              </div>
                            );
                          })
                        ))}
                    </section>
                  );
                })}
                <Resultados
                  ds={_e}
                  itens={di}
                  grupos={Qi}
                  feePct={k}
                  lotes={Nl}
                  tiposIR={dW}
                  onTipo={xW}
                  ajustes={pW}
                  onAjuste={yW}
                  nOrganizar={D.length}
                  pedido={mW}
                />
              </div>
            );
          })()}
        {_e &&
          R === "comparar" &&
          (() => {
            let D = (ye) => Nl[ye] ?? LOTE_PADRAO,
              V = Qi.map((ye, Ke) => ({
                g: ye,
                gi: Ke,
                cestas: resumoPorEnvio(
                  di.filter((Xe) => Xe.grupoId === ye.id),
                  k,
                  D,
                ),
              })),
              ne = (() => {
                let ye = new Set();
                for (let Ke of V)
                  for (let Xe of Ke.cestas)
                    Xe.retorno != null &&
                      Xe.ts >= (on ?? -1 / 0) &&
                      Xe.ts <= (U ?? 1 / 0) &&
                      ye.add(Xe.ts);
                return ye;
              })(),
              le = (() => {
                let ye = null;
                for (let Ke of V)
                  for (let Xe of Ke.cestas)
                    Xe.retorno != null &&
                      (ye == null || Xe.ts < ye) &&
                      (ye = Xe.ts);
                return ye;
              })();
            return (
              <>
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    padding: "16px 18px",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 650,
                      fontSize: 15,
                      marginBottom: 4,
                    }}
                  >
                    Backtest de estratégias
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: tema.dim,
                      lineHeight: 1.65,
                      marginBottom: 14,
                    }}
                  >
                    Repete a operação noite a noite dentro do período: no
                    fechamento de cada pregão, ordena os ativos usando só os
                    dados até aquele dia, compra os primeiros em peso igual e
                    realiza na abertura seguinte. Nenhum dado do dia seguinte
                    entra na escolha, então o resultado não é enviesado por
                    informação que você não teria na hora. As três estratégias
                    usam os mesmos filtros de volume e tamanho, e diferem
                    <b
                      style={{
                        color: tema.text,
                      }}
                    >
                      {" apenas em como escolhem o ativo"}
                    </b>
                    {
                      ": pela média da janela, pela média aparada da janela, ou pelo sinal de reversão do próprio pregão (caiu 2%+ e fechou colado na mínima). A reversão não tem sinal todo dia — nessas noites o capital fica parado, e a coluna SEM SINAL mostra quantas foram. Todas respeitam o piso de liquidez de CONFIGURAÇÕES (R$ "
                    }
                    {fmtNum(X)}
                    {
                      " MM de volume médio em 20 pregões, descartados os 10% de maior volume), medido no dia da compra."
                    }
                    <div
                      style={{
                        marginTop: 6,
                      }}
                    >
                      {"Cada ponto é uma noite, pela "}
                      <b
                        style={{
                          color: tema.text,
                        }}
                      >
                        data da compra
                      </b>
                      {
                        " — a mesma da cesta no RESULTADOS. O período conta as noites compradas entre De e Até. Os grupos do RESULTADOS entram marcados com ◆, com as cestas que você lançou."
                      }
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                      }}
                    >
                      <b
                        style={{
                          color: tema.text,
                        }}
                      >
                        Rodada:
                      </b>
                      {
                        " percorre a base inteira de uma vez. Mudar De/Até ou o escopo só recorta o que já foi calculado — o resultado de cada noite é o mesmo em qualquer recorte, porque a escolha do papel olha só para trás. Rodar de novo só é preciso quando muda algo em CONFIGURAÇÕES (piso de liquidez, taxa, preço mínimo, papéis por estratégia, termômetro ou janela) ou a cesta padrão."
                      }
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      alignItems: "flex-end",
                      marginBottom: 14,
                    }}
                  >
                    <SeletorPeriodo
                      de={on}
                      ate={U}
                      onDe={tu}
                      onAte={Z}
                      dates={_e.dates}
                    />
                    <Campo label="Escopo do gráfico">
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <Chip
                          active={ee === "periodo"}
                          onClick={() => re("periodo")}
                        >
                          Intervalo inteiro
                        </Chip>
                        <Chip
                          active={ee === "operadas"}
                          onClick={() => re("operadas")}
                          disabled={ne.size === 0}
                        >
                          Só as noites que operei
                        </Chip>
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: tema.faint,
                          marginTop: 5,
                          maxWidth: 330,
                          lineHeight: 1.5,
                        }}
                      >
                        {ne.size === 0
                          ? "Nenhuma cesta lançada no período — o filtro por noites operadas fica sem noite para comparar."
                          : `${ne.size} noite(s) lançada(s) no período. No escopo pareado, todas as curvas contam só essas noites.`}
                      </div>
                    </Campo>
                    {le != null && (
                      <button
                        onClick={() => {
                          (tu(le), Z(pi));
                        }}
                        style={{
                          ...estiloBotao,
                          fontSize: 11.5,
                          color: tema.dim,
                        }}
                        title="De = primeira cesta com resultado nos grupos do RESULTADOS; Até = último pregão"
                      >
                        {"desde a 1ª cesta dos grupos · "}
                        {fmtData(le)}
                      </button>
                    )}
                    <div
                      style={{
                        fontSize: 11,
                        color: tema.faint,
                        lineHeight: 1.6,
                        maxWidth: 330,
                        alignSelf: "center",
                      }}
                    >
                      {C}
                      {" papéis por estratégia · MIX com "}
                      {H.queda}
                      {" papéis em dia de queda e "}
                      {H.normal}
                      {" nos outros · MÉDIA e MÉDIA APARADA com janela de "}
                      {q}
                      {" pregões —"}{" "}
                      <button
                        onClick={() => w("config")}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: tema.amber,
                          cursor: "pointer",
                          fontSize: 11,
                          textDecoration: "underline",
                        }}
                      >
                        mudar em CONFIGURAÇÕES
                      </button>
                    </div>
                    <button
                      onClick={IW}
                      disabled={K || on == null}
                      style={{
                        ...estiloBotao,
                        color: tema.amber,
                        borderColor: tema.amber,
                        padding: "9px 16px",
                      }}
                    >
                      {K ? "rodando…" : "▶ rodar comparação"}
                    </button>
                    <button
                      onClick={FW}
                      disabled={zk || !Vt || on == null}
                      title="uma aba por estratégia, uma linha por compra: data, TOP, OHLC, volume, resultado e indicadores. Usa o período De/Até desta aba — a base inteira gera arquivo grande"
                      style={{
                        ...estiloBotao,
                        padding: "9px 14px",
                      }}
                    >
                      {zk ? "gerando…" : "⬇ Excel das operações"}
                    </button>
                  </div>
                  {Uk && (
                    <div
                      style={{
                        fontFamily: tema.mono,
                        fontSize: 11.5,
                        color: tema.dim,
                        marginTop: -4,
                        marginBottom: 6,
                      }}
                    >
                      {Uk}
                    </div>
                  )}
                  {K && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: tema.faint,
                      }}
                    >
                      Percorrendo pregão a pregão. Janelas longas em períodos
                      longos demoram alguns segundos.
                    </div>
                  )}
                  {ue?.erro && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: tema.down,
                      }}
                    >
                      {ue.erro}
                    </div>
                  )}
                  {ue && !ue.erro && ue.params && ue.params.assin !== Wy && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: tema.amber,
                        border: `1px solid ${tema.amber}`,
                        borderRadius: 10,
                        padding: "9px 12px",
                        marginBottom: 12,
                        lineHeight: 1.55,
                      }}
                    >
                      Algum parâmetro mudou depois desta rodada (algo em
                      CONFIGURAÇÕES, a cesta padrão ou a base foi sincronizada).
                      O gráfico abaixo ainda é o da rodada anterior — aperte
                      “rodar comparação” para recalcular.
                    </div>
                  )}
                  {ue &&
                    !ue.erro &&
                    (() => {
                      let ye = ue.novas || {},
                        Ke = ue.padrao ?? null,
                        Xe = ue.params?.tsIni ?? -1 / 0,
                        De = ue.params?.tsFim ?? 1 / 0,
                        Pe = Math.max(on ?? -1 / 0, Xe),
                        it = Math.min(U ?? 1 / 0, De),
                        ve = Math.min(it, ue.params?.compraMax ?? it),
                        Ee = ee === "operadas" && ne.size > 0 ? ne : null,
                        Ne = (Ce, Ye = it) =>
                          recortarResultado(Ce, _e, Pe, Ye, Ee),
                        ht = [
                          ...(Ke
                            ? [
                                {
                                  id: "cesta_padrao",
                                  nome: `Overnight padrão · ${ue.nCesta ?? 0} ativos`,
                                  cor: "#E8E8E8",
                                  res: Ne(Ke),
                                },
                              ]
                            : []),
                          ...V.map(({ g: Ce, gi: Ye, cestas: fr }) => ({
                            id: "g_" + Ce.id,
                            nome: `◆ ${Ce.nome}`,
                            cor: corDoGrupo(Ce, Ye),
                            grupo: true,
                            res: Ne(curvaDoGrupo(fr, _e, Pe, ve), ve),
                          })),
                          {
                            id: "media",
                            nome: "Escolha pela MÉDIA",
                            cor: tema.amber,
                            res: Ne(ue.media),
                          },
                          {
                            id: "aparada",
                            nome: "Escolha pela MÉDIA APARADA",
                            cor: "#4CC9F0",
                            res: Ne(ue.aparada),
                          },
                          {
                            id: "reversao",
                            nome: "Queda Forte no Fundo",
                            cor: "#C77DFF",
                            res: Ne(ue.reversao),
                          },
                          ...ESTRATEGIAS.map((Ce) => ({
                            id: "n_" + Ce.id,
                            nome: Ce.nome,
                            cor: Ce.cor,
                            res: Ne(ye[Ce.id]),
                          })),
                          {
                            id: "n_consenso",
                            nome: "Consenso Cruzado",
                            cor: "#FFD166",
                            res: Ne(ye.consenso),
                          },
                          {
                            id: "n_mix",
                            nome: "MIX",
                            cor: "#06D6A0",
                            res: Ne(ye.mix),
                          },
                          {
                            id: "n_mix_nr",
                            nome: "MIX sem repetir",
                            cor: COR_MIX_NR,
                            res: Ne(ye.mix_nr),
                          },
                          {
                            id: "n_mix_nr_fixo",
                            nome: "MIX sem repetir · sem termômetro",
                            cor: COR_MIX_FIXO,
                            res: Ne(ye.mix_nr_fixo),
                          },
                        ].filter(
                          (Ce) =>
                            Ce.res &&
                            !Ce.res.erro &&
                            !J.has(Ce.grupo ? "grupos" : Ce.id),
                        ),
                        Ft = ht.filter((Ce) => Ue.has(Ce.id)),
                        Sr = Ft.length ? Ft : ht.slice(0, 1);
                      if (ht.length === 0)
                        return (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: tema.down,
                            }}
                          >
                            {ue.media?.erro ||
                              ue.aparada?.erro ||
                              ue.reversao?.erro ||
                              "Sem resultado."}
                          </div>
                        );
                      let Oe = (Ce) =>
                          Je((Ye) => {
                            let fr = new Set(Ye);
                            return (
                              fr.has(Ce)
                                ? ht.filter((de) => fr.has(de.id)).length > 1 &&
                                  fr.delete(Ce)
                                : fr.add(Ce),
                              fr
                            );
                          }),
                        ke = new Map(
                          ht.map((Ce) => [
                            Ce.id,
                            Ce.res.curva.map((Ye) => ({
                              ...Ye,
                              ts:
                                Ye.tsCompra ??
                                pregaoAnterior(_e, Ye.ts) ??
                                Ye.ts,
                            })),
                          ]),
                        ),
                        He = datasDasCurvas(
                          ht.map((Ce) => ({
                            curva: ke.get(Ce.id),
                          })),
                          Pe,
                          it,
                        ),
                        Mt = new Map(
                          ht.map((Ce) => [
                            Ce.id,
                            new Map(ke.get(Ce.id).map((Ye) => [Ye.ts, Ye.eq])),
                          ]),
                        ),
                        aa = new Map(
                          ht.map((Ce) => [
                            Ce.id,
                            new Map(ke.get(Ce.id).map((Ye) => [Ye.ts, Ye.ret])),
                          ]),
                        ),
                        mi = new Map(
                          ht.map((Ce) => {
                            let Ye = ke.get(Ce.id);
                            return [Ce.id, Ye.length ? Ye[0].ts : 1 / 0];
                          }),
                        ),
                        Lo = new Map(
                          ht.map((Ce) => {
                            let Ye = ke.get(Ce.id);
                            return [
                              Ce.id,
                              Ye.length ? Ye[Ye.length - 1].ts : -1 / 0,
                            ];
                          }),
                        ),
                        Fa = new Map(ht.map((Ce) => [Ce.id, 1])),
                        uu = He.map((Ce) => {
                          let Ye = {
                            label: fmtData(Ce),
                          };
                          for (let fr of Sr) {
                            if (
                              Ce < mi.get(fr.id) ||
                              (fr.grupo && Ce > Lo.get(fr.id))
                            ) {
                              Ye[fr.id] = null;
                              continue;
                            }
                            if (he === "acum") {
                              let de = Mt.get(fr.id).get(Ce);
                              (de != null && Fa.set(fr.id, de),
                                (Ye[fr.id] = +(
                                  (Fa.get(fr.id) - 1) *
                                  100
                                ).toFixed(3)));
                            } else {
                              let de = aa.get(fr.id).get(Ce);
                              Ye[fr.id] =
                                de == null ? null : +(de * 100).toFixed(3);
                            }
                          }
                          return Ye;
                        }),
                        hi = Sr.slice().sort(
                          (Ce, Ye) => Ye.res.stats.total - Ce.res.stats.total,
                        )[0];
                      return (
                        <>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 20,
                              alignItems: "flex-end",
                              marginTop: 4,
                              marginBottom: 10,
                            }}
                          >
                            <Campo label="Visão do gráfico">
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                }}
                              >
                                <Chip
                                  active={he === "acum"}
                                  onClick={() => Re("acum")}
                                >
                                  Acumulado
                                </Chip>
                                <Chip
                                  active={he === "diario"}
                                  onClick={() => Re("diario")}
                                >
                                  Resultado diário
                                </Chip>
                              </div>
                            </Campo>
                            <div
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
                                Estratégias exibidas
                              </span>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 14,
                                }}
                              >
                                {ht.map((Ce) => (
                                  <span
                                    key={Ce.id}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 5,
                                    }}
                                  >
                                    <label
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 7,
                                        cursor: "pointer",
                                        fontSize: 12.5,
                                        color: Ue.has(Ce.id)
                                          ? tema.text
                                          : tema.faint,
                                        userSelect: "none",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={Ue.has(Ce.id)}
                                        onChange={() => Oe(Ce.id)}
                                        style={{
                                          width: 16,
                                          height: 16,
                                          accentColor: Ce.cor,
                                          cursor: "pointer",
                                        }}
                                      />
                                      <span
                                        style={{
                                          width: 10,
                                          height: 10,
                                          borderRadius: 2,
                                          background: Ce.cor,
                                          display: "inline-block",
                                        }}
                                      />
                                      {Ce.nome}
                                    </label>
                                    <FichaEstrategia
                                      id={Ce.id}
                                      nomeExibido={Ce.nome}
                                      cor={Ce.cor}
                                      aoAbrirManual={ou}
                                    />
                                  </span>
                                ))}
                              </div>
                              <div
                                style={{
                                  fontSize: 10.5,
                                  color: tema.faint,
                                  marginTop: 2,
                                }}
                              >
                                {"clique no "}
                                <b
                                  style={{
                                    color: tema.dim,
                                  }}
                                >
                                  ?
                                </b>
                                {
                                  " para o resumo · aba MANUAL para a explicação inteira"
                                }
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              width: "100%",
                              height: 320,
                              marginTop: 6,
                            }}
                          >
                            <ResponsiveContainer>
                              <LineChart data={uu} margin={MARGEM}>
                                <CartesianGrid {...GRADE} />
                                <XAxis
                                  {...EIXO_X}
                                  dataKey="label"
                                  minTickGap={60}
                                />
                                <YAxis
                                  {...EIXO_Y}
                                  tickFormatter={(Ce) =>
                                    Ce.toFixed(he === "acum" ? 0 : 1) + "%"
                                  }
                                />
                                <Tooltip
                                  content={<TooltipGrafico casas={2} />}
                                  cursor={CURSOR}
                                />
                                <Legend content={<LegendaGrafico />} />
                                <ReferenceLine
                                  y={0}
                                  stroke={tema.faint}
                                  strokeOpacity={0.6}
                                />
                                {Sr.map((Ce) => (
                                  <Line
                                    key={Ce.id}
                                    type="monotone"
                                    dataKey={Ce.id}
                                    name={Ce.nome}
                                    stroke={Ce.cor}
                                    dot={
                                      Ce.grupo
                                        ? {
                                            r: 2.6,
                                            strokeWidth: 0,
                                            fill: Ce.cor,
                                          }
                                        : false
                                    }
                                    activeDot={PONTO_ATIVO}
                                    strokeDasharray={
                                      Ce.grupo ? "7 3" : undefined
                                    }
                                    strokeWidth={
                                      Ce.grupo ? 2.4 : he === "acum" ? 1.9 : 1.2
                                    }
                                    strokeOpacity={0.95}
                                    connectNulls={he === "acum"}
                                    animationDuration={700}
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
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
                                fontFamily: tema.mono,
                                fontSize: 12,
                              }}
                            >
                              <thead>
                                <tr
                                  style={{
                                    color: tema.faint,
                                    fontSize: 10.5,
                                    letterSpacing: 1,
                                  }}
                                >
                                  {[
                                    "ESTRATÉGIA",
                                    "RESULTADO",
                                    "MÉDIA/NOITE",
                                    "DESVIO",
                                    "% NOITES +",
                                    "PIOR",
                                    "MELHOR",
                                    "MAX DD",
                                    "NOITES OPERADAS",
                                    "SEM SINAL",
                                    "ATIVOS USADOS",
                                  ].map((Ce, Ye) => (
                                    <th
                                      key={Ce}
                                      style={{
                                        textAlign: Ye === 0 ? "left" : "right",
                                        padding: "8px 10px",
                                        borderBottom: `1px solid ${tema.line}`,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {Ce}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Sr.map((Ce) => {
                                  let Ye = Ce.res.stats;
                                  return (
                                    <tr key={Ce.id} className="rowhover">
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          fontWeight: 700,
                                          color: Ce.cor,
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {Ce.nome}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          textAlign: "right",
                                          fontWeight: 700,
                                          color:
                                            Ye.total >= 0 ? tema.up : tema.down,
                                        }}
                                      >
                                        {fmtPct(Ye.total, 1)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          textAlign: "right",
                                          color:
                                            Ye.media >= 0 ? tema.up : tema.down,
                                        }}
                                      >
                                        {fmtPct(Ye.media, 3)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          textAlign: "right",
                                          color: tema.dim,
                                        }}
                                      >
                                        {fmtPct(Ye.dp, 2)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          textAlign: "right",
                                          color: tema.dim,
                                        }}
                                      >
                                        {fmtPct(Ye.posPct, 0)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          textAlign: "right",
                                          color: tema.down,
                                        }}
                                      >
                                        {fmtPct(Ye.pior, 2)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          textAlign: "right",
                                          color: tema.up,
                                        }}
                                      >
                                        {fmtPct(Ye.melhor, 2)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          textAlign: "right",
                                          color: tema.down,
                                        }}
                                      >
                                        {fmtPct(Ye.mdd, 1)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          textAlign: "right",
                                          color: tema.faint,
                                        }}
                                      >
                                        {Ye.n}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          textAlign: "right",
                                          color:
                                            Ye.semOperar > 0
                                              ? tema.amber
                                              : tema.faint,
                                        }}
                                      >
                                        {Ye.semOperar > 0 ? Ye.semOperar : "—"}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px 10px",
                                          textAlign: "right",
                                          color: tema.faint,
                                        }}
                                      >
                                        {Ye.nAtivos}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div
                            style={{
                              fontSize: 12.5,
                              color: tema.dim,
                              lineHeight: 1.6,
                              marginTop: 10,
                              paddingTop: 10,
                              borderTop: `1px solid ${tema.line}`,
                            }}
                          >
                            {"No período testado, "}
                            <b
                              style={{
                                color: hi.cor,
                              }}
                            >
                              {hi.nome}
                            </b>
                            {" entregou o maior resultado ("}
                            {fmtPct(hi.res.stats.total, 1)}). Um período só não
                            decide a questão: rode outros recortes antes de
                            mudar como você opera.
                            {Sr.some((Ce) => Ce.res.stats.semOperar > 0) && (
                              <>
                                {
                                  " Atenção ao comparar: estratégias com noites "
                                }
                                <b
                                  style={{
                                    color: tema.amber,
                                  }}
                                >
                                  sem sinal
                                </b>
                                {
                                  " operaram menos vezes, então o resultado total delas vem de menos apostas. Olhe também a MÉDIA/NOITE, que não depende de quantas noites houve."
                                }
                              </>
                            )}
                            {Sr.some((Ce) => Ce.grupo) && (
                              <>
                                {
                                  " Nos grupos ◆, SEM SINAL são os pregões sem cesta entre a primeira e a última lançada."
                                }
                              </>
                            )}
                            {Sr.some((Ce) => Ce.res.stats.n < 20) && (
                              <>
                                {" "}
                                <b
                                  style={{
                                    color: tema.amber,
                                  }}
                                >
                                  Amostra curta:
                                </b>
                                {
                                  " com menos de 20 noites, uma noite boa ou ruim decide o placar — use o recorte para comparar, não para concluir."
                                }
                              </>
                            )}
                          </div>
                          <div
                            style={{
                              marginTop: 20,
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 650,
                                fontSize: 14,
                                marginBottom: 4,
                              }}
                            >
                              Contribuição de cada ativo
                            </div>
                            <div
                              style={{
                                fontSize: 11.5,
                                color: tema.faint,
                                lineHeight: 1.6,
                                marginBottom: 12,
                              }}
                            >
                              {
                                "O primeiro número é quanto o papel somou ou tirou do resultado, em pontos percentuais — com base fixa toda noite vale o mesmo, e a soma de todos bate exatamente com o resultado. O número depois do papel (ex.: 12n) é em quantas noites ele entrou. O último, em cinza, é a fatia do resultado que veio dele. Nos grupos ◆, cada papel pesa o que você de fato investiu nele na noite. O "
                              }
                              <b
                                style={{
                                  color: tema.down,
                                }}
                              >
                                ▼
                              </b>
                              {" depois do papel é a liquidez dele HOJE ("}
                              {fmtData(fe)}
                              {
                                "): quem aparece marcado passava no piso na noite em que foi escolhido e não passa mais, então aquele resultado não está à sua disposição agora. "
                              }
                              <b
                                style={{
                                  color: tema.down,
                                }}
                              >
                                ▼ sem negócio
                              </b>
                              {
                                " é papel que saiu da base (fusão sem emenda possível, fechamento de capital, suspensão)."
                              }
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: `repeat(${Math.min(Sr.length, 3)}, minmax(0,1fr))`,
                                gap: 16,
                              }}
                            >
                              {Sr.map((Ce) => {
                                let Ye = Ce.res.porAtivo,
                                  fr = Math.max(
                                    ...Ye.map((Le) => Math.abs(Le.contrib)),
                                    1e-9,
                                  ),
                                  de = me === Ce.id,
                                  Fe = de ? Ye : Ye.slice(0, 12);
                                return (
                                  <div
                                    key={Ce.id}
                                    style={{
                                      border: `1px solid ${tema.line}`,
                                      borderRadius: 10,
                                      padding: "10px 12px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontFamily: tema.mono,
                                        fontSize: 11.5,
                                        color: Ce.cor,
                                        fontWeight: 700,
                                      }}
                                    >
                                      {Ce.nome}
                                    </div>
                                    <div
                                      style={{
                                        fontFamily: tema.mono,
                                        fontSize: 11,
                                        marginTop: 3,
                                        marginBottom: 9,
                                        paddingBottom: 7,
                                        borderBottom: `1px solid ${tema.line}`,
                                        color:
                                          Ce.res.stats.total >= 0
                                            ? tema.up
                                            : tema.down,
                                      }}
                                    >
                                      {"resultado "}
                                      {Ce.grupo ? "do grupo" : "da estratégia"}
                                      {": "}
                                      {fmtPct(Ce.res.stats.total, 2)}
                                    </div>
                                    {Ce.res.stats.total <= 0.0001 && (
                                      <div
                                        style={{
                                          fontSize: 10.5,
                                          color: tema.faint,
                                          lineHeight: 1.5,
                                          marginBottom: 9,
                                        }}
                                      >
                                        Sem coluna de participação: com
                                        resultado zerado ou negativo, dividir a
                                        contribuição pelo total não produz
                                        número interpretável. Os valores abaixo
                                        continuam válidos, em pontos
                                        percentuais.
                                      </div>
                                    )}
                                    {Fe.map((Le) => {
                                      let ct = su.get(Le.ativo),
                                        Qt = ct == null,
                                        dr = !Qt && ct < X * 1000000;
                                      return (
                                        <div
                                          key={Le.ativo}
                                          style={{
                                            marginBottom: 7,
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "baseline",
                                              gap: 8,
                                              fontFamily: tema.mono,
                                              fontSize: 11.5,
                                              marginBottom: 3,
                                            }}
                                          >
                                            <span
                                              style={{
                                                color: tema.text,
                                                flex: 1,
                                                minWidth: 0,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                              }}
                                            >
                                              {Le.ativo}
                                              <span
                                                style={{
                                                  color: tema.faint,
                                                  marginLeft: 5,
                                                }}
                                                title="noites em que este papel foi operado"
                                              >
                                                {Le.vezes}n
                                              </span>
                                              {(Qt || dr) && (
                                                <span
                                                  style={{
                                                    color: tema.down,
                                                    marginLeft: 5,
                                                  }}
                                                  title={
                                                    Qt
                                                      ? `sem negócio na base em ${fmtData(fe)} — papel fora do mercado, este resultado não se repete`
                                                      : `liquidez hoje: R$ ${fmtNum(ct / 1000000)} MM de volume médio em 20 pregões (10% de maior volume descartados), abaixo do piso de R$ ${fmtNum(X)} MM`
                                                  }
                                                >
                                                  ▼
                                                  {Qt
                                                    ? " sem negócio"
                                                    : ` ${fmtNum(ct / 1000000)}`}
                                                </span>
                                              )}
                                            </span>
                                            <span
                                              style={{
                                                color:
                                                  Le.contrib >= 0
                                                    ? tema.up
                                                    : tema.down,
                                                textAlign: "right",
                                              }}
                                              title="quanto este papel somou ou tirou do resultado, em pontos percentuais"
                                            >
                                              {fmtPct(Le.contrib, 2)}
                                            </span>
                                            {Le.share != null && (
                                              <span
                                                style={{
                                                  color: tema.faint,
                                                  textAlign: "right",
                                                  minWidth: 46,
                                                }}
                                                title="fatia do resultado total da estratégia que veio deste papel"
                                              >
                                                {(Le.share * 100).toFixed(1)}%
                                              </span>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              height: 4,
                                              background: tema.line,
                                              borderRadius: 2,
                                              overflow: "hidden",
                                            }}
                                          >
                                            <div
                                              style={{
                                                width: `${(Math.abs(Le.contrib) / fr) * 100}%`,
                                                height: "100%",
                                                background:
                                                  Le.contrib >= 0
                                                    ? tema.up
                                                    : tema.down,
                                              }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {(() => {
                                      let Le = 0,
                                        ct = 0,
                                        Qt = 0,
                                        dr = 0;
                                      for (let Ir of Ye) {
                                        let vi = su.get(Ir.ativo);
                                        vi == null
                                          ? (Le++, (Qt += Ir.contrib ?? 0))
                                          : vi < X * 1000000 &&
                                            (ct++, (dr += Ir.contrib ?? 0));
                                      }
                                      if (Le + ct === 0) return null;
                                      let Qr = [];
                                      return (
                                        ct &&
                                          Qr.push(
                                            `${ct} abaixo do piso hoje (${fmtPct(dr, 2)})`,
                                          ),
                                        Le &&
                                          Qr.push(
                                            `${Le} sem negócio hoje (${fmtPct(Qt, 2)})`,
                                          ),
                                        (
                                          <div
                                            style={{
                                              fontFamily: tema.mono,
                                              fontSize: 10.5,
                                              color: tema.down,
                                              lineHeight: 1.5,
                                              marginTop: 8,
                                              paddingTop: 7,
                                              borderTop: `1px solid ${tema.line}`,
                                            }}
                                            title="pontos percentuais do resultado da estratégia que vieram de papel que hoje não passa no piso de liquidez ou não negocia mais"
                                          >
                                            {"▼ "}
                                            {Qr.join(" · ")}
                                            {" — de "}
                                            {fmtPct(Ce.res.stats.total, 2)}
                                          </div>
                                        )
                                      );
                                    })()}
                                    {Ye.length > 12 && (
                                      <button
                                        onClick={() => pe(de ? null : Ce.id)}
                                        style={{
                                          ...estiloBotao,
                                          width: "100%",
                                          marginTop: 4,
                                          fontSize: 11,
                                        }}
                                      >
                                        {de
                                          ? "mostrar só os 12 maiores"
                                          : `ver todos os ${Ye.length}`}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                </section>
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    padding: "16px 18px",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 650,
                      fontSize: 15,
                      marginBottom: 4,
                    }}
                  >
                    Benchmarks personalizados
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: tema.faint,
                      marginBottom: 12,
                      lineHeight: 1.6,
                    }}
                  >
                    {"Planilha (.xlsx/.xls/.csv) com duas colunas: "}
                    <b
                      style={{
                        color: tema.dim,
                      }}
                    >
                      data
                    </b>
                    {" e "}
                    <b
                      style={{
                        color: tema.dim,
                      }}
                    >
                      resultado do dia
                    </b>
                    {
                      " (com ou sem símbolo de %). Dê um nome, e o benchmark fica salvo na lista para usar nos gráficos e no mês a mês."
                    }
                  </div>
                  <EnviarBenchmark onAdd={ga} />
                  {Qe && (
                    <div
                      style={{
                        fontFamily: tema.mono,
                        fontSize: 12,
                        color: tema.up,
                        marginTop: 8,
                      }}
                    >
                      {Qe}
                    </div>
                  )}
                  {pt.length > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {pt.map((ye) => (
                        <LinhaBenchmark
                          key={ye.id}
                          bm={ye}
                          onRename={Kr}
                          onRemove={an}
                        />
                      ))}
                    </div>
                  )}
                </section>
                <div
                  style={{
                    fontFamily: tema.mono,
                    fontSize: 11.5,
                    color: tema.faint,
                    marginTop: -6,
                  }}
                >
                  {"A cesta do "}
                  <b
                    style={{
                      color: tema.dim,
                    }}
                  >
                    Overnight padrão
                  </b>
                  {
                    " é definida na aba RESULTADOS e entra no gráfico acima como mais uma série."
                  }
                </div>
              </>
            );
          })()}
        {!n &&
          R === "config" &&
          (() => {
            let D = {
                background: tema.panel,
                border: `1px solid ${tema.line}`,
                borderRadius: 14,
                padding: "16px 18px",
                marginBottom: 16,
              },
              V = (ve, Ee) => (
                <div
                  style={{
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 650,
                      fontSize: 15,
                    }}
                  >
                    {ve}
                  </div>
                  {Ee && (
                    <div
                      style={{
                        fontSize: 12,
                        color: tema.faint,
                        marginTop: 3,
                        lineHeight: 1.55,
                      }}
                    >
                      {Ee}
                    </div>
                  )}
                </div>
              ),
              ne = {
                display: "flex",
                flexWrap: "wrap",
                gap: "16px 30px",
                alignItems: "flex-start",
              },
              le = (ve, Ee, Ne) => (
                <div
                  style={{
                    minWidth: 200,
                    maxWidth: 300,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.5,
                      letterSpacing: 1.4,
                      textTransform: "uppercase",
                      color: tema.faint,
                      fontFamily: tema.mono,
                      marginBottom: 5,
                    }}
                  >
                    {ve}
                  </div>
                  {Ne}
                  {Ee && (
                    <div
                      style={{
                        fontSize: 11,
                        color: tema.faint,
                        marginTop: 5,
                        lineHeight: 1.5,
                      }}
                    >
                      {Ee}
                    </div>
                  )}
                </div>
              ),
              ye = (ve, Ee, Ne) => (
                <CampoNumero
                  valor={H[ve]}
                  sufixo={Ee}
                  largura={Ne}
                  onCommit={(wt) =>
                    G(
                      sanearConfig({
                        ...H,
                        [ve]: wt,
                      }),
                    )
                  }
                />
              ),
              Ke = (ve, Ee = "por quê?") => (
                <button
                  onClick={() => W(B === ve ? null : ve)}
                  style={{
                    ...estiloBotao,
                    padding: "4px 10px",
                    fontSize: 11.5,
                    color: B === ve ? tema.amber : tema.dim,
                  }}
                >
                  {B === ve ? "fechar" : Ee}
                </button>
              ),
              Xe = (ve, Ee) =>
                B === ve && (
                  <div
                    style={{
                      fontSize: 12.5,
                      color: tema.dim,
                      lineHeight: 1.65,
                      marginTop: 12,
                      padding: "11px 13px",
                      background: tema.panelSoft,
                      border: `1px solid ${tema.line}`,
                      borderRadius: 10,
                    }}
                  >
                    {Ee}
                  </div>
                ),
              De = [
                [
                  "Referências",
                  [
                    {
                      id: "cesta_padrao",
                      nome: "Overnight padrão (cesta)",
                      cor: "#E8E8E8",
                      guia: "cesta_padrao",
                    },
                    {
                      id: "grupos",
                      nome: "Grupos do RESULTADOS (◆)",
                      cor: tema.dim,
                      guia: null,
                    },
                    {
                      id: "n_mix_nr_fixo",
                      nome: "MIX sem repetir · sem termômetro",
                      cor: COR_MIX_FIXO,
                      guia: "n_mix_nr_fixo",
                    },
                  ],
                ],
                [
                  "Combinações",
                  [
                    {
                      id: "n_mix",
                      nome: "MIX",
                      cor: "#06D6A0",
                      guia: "n_mix",
                    },
                    {
                      id: "n_mix_nr",
                      nome: "MIX sem repetir",
                      cor: COR_MIX_NR,
                      guia: "n_mix_nr",
                    },
                    {
                      id: "n_consenso",
                      nome: "Consenso Cruzado",
                      cor: "#FFD166",
                      guia: "n_consenso",
                    },
                  ],
                ],
                [
                  "As oito do júri do MIX",
                  ESTRATEGIAS.map((ve) => ({
                    id: "n_" + ve.id,
                    nome: ve.nome,
                    cor: ve.cor,
                    guia: "n_" + ve.id,
                  })),
                ],
                [
                  "Motor de janela",
                  [
                    {
                      id: "media",
                      nome: "Escolha pela MÉDIA",
                      cor: tema.amber,
                      guia: "media",
                    },
                    {
                      id: "aparada",
                      nome: "Escolha pela MÉDIA APARADA",
                      cor: "#4CC9F0",
                      guia: "aparada",
                    },
                    {
                      id: "reversao",
                      nome: "Queda Forte no Fundo",
                      cor: "#C77DFF",
                      guia: "reversao",
                    },
                  ],
                ],
              ],
              Pe = De.reduce(
                (ve, [, Ee]) => ve + Ee.filter((Ne) => J.has(Ne.id)).length,
                0,
              ),
              it = (ve) => {
                let Ee = new Set(ve);
                (ie(Ee),
                  window.storage
                    .set("ovr3:ocultos", JSON.stringify(Array.from(Ee)))
                    .catch(() => {}));
              };
            return (
              <div
                style={{
                  maxWidth: 1080,
                }}
              >
                <div
                  style={{
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontFamily: tema.mono,
                      fontSize: 10.5,
                      letterSpacing: 2,
                      color: tema.amber,
                      opacity: 0.85,
                    }}
                  >
                    CONFIGURAÇÕES
                  </div>
                  <h2
                    style={{
                      margin: "4px 0 6px",
                      fontSize: 19,
                      fontWeight: 650,
                    }}
                  >
                    O que vale para o app inteiro
                  </h2>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: tema.dim,
                      lineHeight: 1.65,
                    }}
                  >
                    Cada número grava ao sair do campo e segue para os outros
                    aparelhos pela nuvem. Depois de mudar algo aqui, as listas
                    do OPERAR se refazem sozinhas; no COMPARAR, aperte “rodar
                    comparação” de novo.
                  </div>
                </div>
                <section style={D}>
                  {V(
                    "Operação",
                    "Valem para todas as estratégias, em todos os pregões do backtest.",
                  )}
                  <div style={ne}>
                    {le(
                      "Volume mínimo (R$ MM)",
                      <>
                        Média de 20 pregões, sem os 10% de maior volume. Hoje{" "}
                        <b
                          style={{
                            color: Ds.n < 20 ? tema.amber : tema.dim,
                          }}
                        >
                          {Ds.n} {Ds.n === 1 ? "ativo passa" : "ativos passam"}
                        </b>
                        {Ds.ts != null ? ` (${fmtData(Ds.ts)})` : ""}.
                      </>,
                      <CampoNumero
                        valor={X}
                        sufixo="MM"
                        onCommit={(ve) => ge(ve)}
                      />,
                    )}
                    {le(
                      "Taxa por operação (%)",
                      "Compra + venda juntas, descontada uma vez por noite operada. Todo resultado do app sai líquido dela.",
                      ye("taxa", "%"),
                    )}
                    {le(
                      "Preço mínimo (R$)",
                      "Corta papel de centavo, onde um centavo de variação é 2%.",
                      ye("precoMin", "R$"),
                    )}
                    {le(
                      "Impacto máximo (% do volume)",
                      "Teto da ordem sobre o volume médio do papel: entra na alocação e no aviso de ordem grande.",
                      ye("impacto", "%"),
                    )}
                  </div>
                </section>
                <section style={D}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {V(
                      "MIX · termômetro",
                      "O termômetro decide quantos papéis o MIX leva em cada noite: mais depois de dia de queda do mercado.",
                    )}
                    {Ke("mix")}
                  </div>
                  <div style={ne}>
                    {le(
                      "Papéis por estratégia",
                      "Quantos papéis cada uma das oito vota. Vale também no COMPARAR e no SINAIS DO DIA.",
                      ye("topN", "papéis", 90),
                    )}
                    {le(
                      "Papéis em dia de queda",
                      `Quando mais de ${H.limiar}% dos papéis líquidos fecharam em queda.`,
                      ye("queda", "papéis", 90),
                    )}
                    {le(
                      "Papéis nos outros dias",
                      "Também é o tamanho da lista do Consenso Cruzado no OPERAR.",
                      ye("normal", "papéis", 90),
                    )}
                    {le(
                      "Dia de queda: mais de",
                      "dos papéis líquidos (volume médio acima de R$ 5 MM) fechando em queda — a mesma conta do termômetro.",
                      ye("limiar", "%", 90),
                    )}
                  </div>
                  {Xe(
                    "mix",
                    <>
                      <div
                        style={{
                          marginBottom: 8,
                        }}
                      >
                        <b
                          style={{
                            color: tema.text,
                          }}
                        >
                          Por que o termômetro.
                        </b>
                        {
                          " Depois de dia de queda do mercado, os cinco primeiros do MIX costumam pagar bem (0,20% a 0,27% por noite); depois de dia de alta, só o primeiro passa de 0,1%. Por isso 5 papéis em dia de queda e 3 nos outros: mais dinheiro nas noites que pagam mais."
                        }
                      </div>
                      <div
                        style={{
                          marginBottom: 8,
                        }}
                      >
                        <b
                          style={{
                            color: tema.text,
                          }}
                        >
                          Quem entra primeiro.
                        </b>
                        {
                          " O MIX põe na frente os papéis apontados ao mesmo tempo pelas duas famílias de estratégia (REVERSÃO e HÁBITO), depois os que têm mais votos, depois os de melhor nota — e fica com os primeiros até completar o número de papéis da noite."
                        }
                      </div>
                      <div
                        style={{
                          marginBottom: 6,
                        }}
                      >
                        <b
                          style={{
                            color: tema.text,
                          }}
                        >
                          Backtest
                        </b>
                        {
                          " (810 noites, jun/2023 a set/2026, MIX sem repetir, líquido da taxa, piso 40 MM, R$ 10 mil por papel):"
                        }
                      </div>
                      <div
                        style={{
                          fontFamily: tema.mono,
                          fontSize: 12,
                          lineHeight: 1.75,
                          marginBottom: 8,
                          overflowX: "auto",
                          whiteSpace: "nowrap",
                        }}
                      >
                        sempre 3 papéis · 0,159%/noite · R$ 47/noite · tombo
                        −10,5%
                        <br />5 em dia de queda, 3 nos outros · 0,162%/noite ·
                        R$ 70/noite · tombo −8,0%
                      </div>
                      <div>
                        A série “MIX sem repetir · sem termômetro” no COMPARAR
                        acompanha essa diferença daqui para a frente.
                      </div>
                    </>,
                  )}
                </section>
                <section style={D}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {V(
                      "Estratégias no COMPARAR e no MÊS A MÊS",
                      "Desmarque o que você não quer ver nas listas de comparação. Esconder não tira nada do cálculo: as oito continuam votando no MIX e o backtest continua rodando todas.",
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={() => it([])}
                        disabled={Pe === 0}
                        style={{
                          ...estiloBotao,
                          padding: "6px 11px",
                          fontSize: 12,
                        }}
                      >
                        mostrar todas
                      </button>
                      <button
                        onClick={() =>
                          it([...J, "media", "aparada", "reversao"])
                        }
                        style={{
                          ...estiloBotao,
                          padding: "6px 11px",
                          fontSize: 12,
                        }}
                      >
                        esconder o motor de janela
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "14px 24px",
                    }}
                  >
                    {De.map(([ve, Ee]) => (
                      <div key={ve}>
                        <div
                          style={{
                            fontFamily: tema.mono,
                            fontSize: 10,
                            letterSpacing: 1.4,
                            textTransform: "uppercase",
                            color: tema.amber,
                            opacity: 0.8,
                            marginBottom: 7,
                          }}
                        >
                          {ve}
                        </div>
                        {Ee.map((Ne) => {
                          let wt = !J.has(Ne.id);
                          return (
                            <div
                              key={Ne.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 0",
                              }}
                            >
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  color: wt ? tema.text : tema.faint,
                                  userSelect: "none",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={wt}
                                  onChange={() => ce(Ne.id)}
                                  style={{
                                    width: 17,
                                    height: 17,
                                    accentColor: Ne.cor,
                                    cursor: "pointer",
                                  }}
                                />
                                <span
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 2,
                                    background: Ne.cor,
                                    display: "inline-block",
                                    opacity: wt ? 1 : 0.35,
                                  }}
                                />
                                {Ne.nome}
                              </label>
                              {Ne.guia && (
                                <FichaEstrategia
                                  id={Ne.guia}
                                  nomeExibido={Ne.nome}
                                  cor={Ne.cor}
                                  aoAbrirManual={ou}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: tema.faint,
                      marginTop: 12,
                      lineHeight: 1.6,
                    }}
                  >
                    {Pe === 0
                      ? "Nada escondido."
                      : `${Pe} ${Pe === 1 ? "série escondida" : "séries escondidas"}.`}{" "}
                    O OPERAR não muda: lá você escolhe o que seguir em “Quais
                    estratégias você vai seguir”.
                  </div>
                </section>
                <section style={D}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {V(
                      "Ranking e motor de janela",
                      "Quantos pregões para trás entram na conta da tabela RANKING E ALOCAÇÃO e de duas estratégias.",
                    )}
                    {Ke("janela")}
                  </div>
                  <div style={ne}>
                    {le(
                      "Janela (pregões)",
                      "Vale só para a tabela RANKING E ALOCAÇÃO do OPERAR e para a MÉDIA e a MÉDIA APARADA. As outras estratégias têm janela própria no indicador.",
                      ye("janela", "pregões", 90),
                    )}
                  </div>
                  {Xe(
                    "janela",
                    <>
                      A janela não mexe no MIX nem nas oito estratégias que
                      votam nele. No backtest (jun/2023 a set/2026, 6 papéis,
                      janela de 10 pregões), a MÉDIA rendeu 0,06% por noite, a
                      MÉDIA APARADA 0,08% e a Queda Forte no Fundo 0,10% —
                      abaixo de sete das oito do júri (0,12% a 0,23% por noite;
                      a oitava, o Prêmio Overnight, rende 0,075%). A MÉDIA e a
                      MÉDIA APARADA são quase a mesma aposta (correlação 0,89).
                      Se não quiser vê-las nas comparações, use “esconder o
                      motor de janela” acima.
                    </>,
                  )}
                </section>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() =>
                      G({
                        ...CONFIG_PADRAO,
                      })
                    }
                    style={{
                      ...estiloBotao,
                    }}
                  >
                    voltar os números ao padrão
                  </button>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: tema.faint,
                    }}
                  >
                    taxa 0,046% · preço mín. R$ 1 · impacto 0,1% · 6 papéis por
                    estratégia · MIX com 5 papéis em dia de queda e 3 nos outros
                    (limiar de 50%) · janela 10. O piso de liquidez não volta ao
                    padrão: ele é decisão sua.
                  </span>
                </div>
              </div>
            );
          })()}
        {!n &&
          R === "readme" &&
          (() => {
            let D = [
                "cesta_padrao",
                "media",
                "aparada",
                "reversao",
                "n_reversao",
                "n_fundorange",
                "n_premio",
                "n_placar",
                "n_panico",
                "n_teto",
                "n_elastico",
                "n_tracao",
                "n_consenso",
                "n_mix",
                "n_mix_nr",
                "n_mix_nr_fixo",
                "n_intraday",
              ],
              V = {
                fontSize: 13,
                color: tema.dim,
                lineHeight: 1.75,
                marginBottom: 11,
              },
              ne = {
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12.5,
                lineHeight: 1.55,
              },
              le = {
                padding: "7px 10px",
                textAlign: "left",
                fontFamily: tema.mono,
                fontSize: 10.5,
                letterSpacing: 0.6,
                color: tema.faint,
                borderBottom: `1px solid ${tema.line}`,
                verticalAlign: "bottom",
              },
              ye = {
                padding: "8px 10px",
                borderBottom: `1px solid ${tema.line}`,
                color: tema.dim,
                verticalAlign: "top",
              },
              Ke = {
                ...ye,
                color: tema.faint,
                fontFamily: tema.mono,
                fontSize: 11,
                whiteSpace: "nowrap",
              },
              Xe = {
                fontFamily: tema.mono,
                fontSize: 10.5,
                letterSpacing: 0.8,
                color: tema.amber,
                opacity: 0.85,
                margin: "14px 0 6px",
              },
              De = (ve, ...Ee) => (
                <tr key={ve}>
                  <td style={Ke}>{ve}</td>
                  {Ee.map((Ne, wt) => (
                    <td key={wt} style={ye}>
                      {Ne}
                    </td>
                  ))}
                </tr>
              ),
              Pe = ({ children: ve }) => (
                <b
                  style={{
                    color: tema.text,
                  }}
                >
                  {ve}
                </b>
              ),
              it = (ve) => EW.includes(ve) || (ve === "fichas" && Fk != null);
            return (
              <div
                style={{
                  maxWidth: 1080,
                }}
              >
                <div
                  style={{
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontFamily: tema.mono,
                      fontSize: 10.5,
                      letterSpacing: 2,
                      color: tema.amber,
                      opacity: 0.85,
                    }}
                  >
                    READ ME
                  </div>
                  <h2
                    style={{
                      margin: "4px 0 6px",
                      fontSize: 19,
                      fontWeight: 650,
                    }}
                  >
                    O app inteiro, explicado
                  </h2>
                  <div
                    style={{
                      fontSize: 13,
                      color: tema.dim,
                      lineHeight: 1.7,
                    }}
                  >
                    {
                      "Cada seção abre e fecha. Comece pela primeira se for a sua primeira vez; use as outras como consulta quando um número na tela não fizer sentido. As comparações entre estratégias parecidas (MIX × Placar Geral, Prêmio × MÉDIA, Queda Forte no Fundo × Reversão Clássica) ficam dentro da ficha de cada uma, no campo "
                    }
                    <Pe>NÃO CONFUNDA</Pe>.
                  </div>
                </div>
                <Secao
                  id="visao"
                  titulo="1 · Como o app funciona, em um minuto"
                  resumo="A operação, o ciclo de cada dia e onde fica cada coisa."
                  aberta={it("visao")}
                  onToggle={Ia}
                >
                  <div style={V}>
                    <Pe>A operação é uma só:</Pe>
                    {
                      " comprar no leilão de fechamento de um pregão e vender no leilão de abertura do pregão seguinte. O resultado de uma noite é a abertura de amanhã dividida pelo fechamento de hoje, menos 1, menos a taxa. Todo número do app nasce dessa conta."
                    }
                  </div>
                  <div style={V}>
                    <Pe>O ciclo de cada dia:</Pe>
                    {
                      " a base do COTAHIST chega → o app calcula os indicadores de cada papel → corta quem está abaixo do piso de liquidez e do preço mínimo → cada estratégia ordena os que sobraram e fica com os primeiros → o resultado aparece na abertura seguinte. Nenhuma escolha usa informação do dia seguinte: a decisão de uma noite só vê pregões até aquele dia."
                    }
                  </div>
                  <div style={Xe}>ONDE FICA CADA COISA</div>
                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table style={ne}>
                      <tbody>
                        {De(
                          "OPERAR",
                          "O que fazer hoje: a carteira da noite pronta para virar ordem, e o ranking do dia com alocação.",
                        )}
                        {De(
                          "ESTRATÉGIAS",
                          "Por que, e quanto rendeu: sinais do dia, backtest comparado, matriz mês a mês.",
                        )}
                        {De(
                          "RESULTADOS",
                          "O que você de fato operou: grupos lançados por você, contra a cesta padrão.",
                        )}
                        {De(
                          "BASE",
                          "Os dados crus: pregões por ativo, eventos descartados, upload e download da base.",
                        )}
                        {De(
                          "CONFIGURAÇÕES",
                          "Os números que valem para o app inteiro — piso de liquidez, taxa, preço mínimo, impacto, papéis por estratégia, termômetro do MIX, janela do ranking — e quais séries aparecem no COMPARAR e no MÊS A MÊS.",
                        )}
                        {De("READ ME", "Esta aba.")}
                      </tbody>
                    </table>
                  </div>
                </Secao>
                <Secao
                  id="dados"
                  titulo="2 · De onde vêm os dados"
                  resumo="COTAHIST oficial, coleta diária no GitHub, cotação ao vivo, upload manual e os três filtros de qualidade."
                  aberta={it("dados")}
                  onToggle={Ia}
                >
                  <div style={V}>
                    <Pe>Fonte primária: o COTAHIST da própria B3</Pe>
                    {
                      " — o arquivo oficial de fechamento, com abertura, máxima, mínima, fechamento, volume financeiro e quantidade de cada papel. Uma rotina diária no GitHub (Actions → “Coleta diária COTAHIST”) baixa o arquivo, acumula tudo num JSON e publica no repositório. O app lê esse JSON direto do GitHub, não do site: a base do dia entra sem precisar republicar nada."
                    }
                  </div>
                  <div style={V}>
                    <Pe>O navegador guarda só configuração</Pe>
                    {
                      " — carteira, cesta padrão, grupos lançados, benchmarks, quadros do mês a mês, os números de CONFIGURAÇÕES, as séries escondidas, ordem das colunas. Preço nunca: a base vem da rede a cada abertura, então dois computadores seus mostram o mesmo histórico."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Cotação ao vivo</Pe>
                    {
                      " vem de outro caminho: uma função no Netlify que consulta o Yahoo, usada para o pregão em andamento. Ela serve para você ver o preço agora; não vira pregão fechado no histórico até o COTAHIST publicar o dia."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Upload manual</Pe>
                    {
                      " (aba BASE) aceita o CSV consolidado, com 7 ou 8 colunas separadas por ponto e vírgula. O merge não apaga nada: data nova entra, data que já existia é revisada se o arquivo trouxer valor diferente. Lembre que o que o COTAHIST cobrir será sobrescrito na próxima sincronização — o oficial ganha."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Base atrasada</Pe>
                    {
                      " tem faixa vermelha no topo: o app compara o último pregão da base com o último pregão que já deveria ter arquivo (calendário da B3 com feriados, publicação perto das 22h). Para tapar um buraco: GitHub → Actions → Coleta diária COTAHIST → Run workflow → campo “Pregão específico”."
                    }
                  </div>
                  <div style={Xe}>OS TRÊS FILTROS DE QUALIDADE</div>
                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table style={ne}>
                      <tbody>
                        {De(
                          "furo de pregão",
                          "O calendário do mercado é a união das datas de todos os ativos. Se o pregão imediatamente anterior existe no calendário mas falta naquele papel, o overnight daquela noite não é calculado — senão um movimento de dois ou três dias entraria disfarçado de gap de uma noite. Na base de 27/08/2026 isso atinge 0,11% dos pares.",
                        )}
                        {De(
                          "evento societário",
                          "Gap acima de 20%, ou acima de 12% quando o NÍVEL de preço se desloca junto, é split, grupamento ou bonificação — não oportunidade. A noite inteira é descartada, e a aba BASE lista os casos para você conferir.",
                        )}
                        {De(
                          "emenda de ticker",
                          "Papel que trocou de código tem a série costurada, para o histórico não começar do zero: EMBJ3←EMBR3, BRAV3←RRRP3, AZZA3←ARZZ3, MBRF3←MRFG3, BHIA3←VIIA3, AXIA3←ELET3, AXIA6←ELET6, MOTV3←CCRO3, NATU3←NTCO3, ISAE4←TRPL4 e ALOS3←ALSO3. Todas conferidas na base: o fechamento do antecessor e a abertura do sucessor são contínuos (diferença entre −3,3% e +2,5%, sem pregão em comum). SOMA3 e BRFS3 ficam fora de propósito — entraram nas fusões por relação de troca, e emendar inventaria um gap de centenas de por cento.",
                        )}
                        {De(
                          "fora do universo",
                          "IBOV11 não entra em estratégia nenhuma: na base ele é o próprio índice, com abertura, máxima, mínima e fechamento iguais — não é papel que se compra no leilão. Continua visível na aba BASE.",
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div
                    style={{
                      ...V,
                      marginTop: 11,
                      marginBottom: 0,
                    }}
                  >
                    A emenda vale para o motor das estratégias e para a cesta; a
                    aba BASE continua mostrando cada ticker como ele é. Dá para
                    desligar no seletor da aba BASE.
                  </div>
                </Secao>
                <Secao
                  id="liquidez"
                  titulo="3 · O piso de liquidez e o preço mínimo"
                  resumo="A regra mais dura do app: como a liquidez é medida, por que os dias de pico são descartados e o que o ▼ quer dizer."
                  aberta={it("liquidez")}
                  onToggle={Ia}
                >
                  <div style={V}>
                    {
                      "O piso é um número só, em CONFIGURAÇÕES (e resumido no topo do OPERAR e das ESTRATÉGIAS), em R$ milhões — hoje "
                    }
                    <Pe>
                      {"R$ "}
                      {fmtNum(X)}
                      {" MM"}
                    </Pe>
                    {". É a regra mais dura do app: "}
                    <Pe>
                      nenhuma estratégia considera papel abaixo dele, em nenhum
                      pregão do backtest
                    </Pe>
                    . Todos os motores chamam a mesma função, então não existe
                    papel que uma aba aceita e outra recusa.
                  </div>
                  <div style={V}>
                    <Pe>Como a liquidez é medida:</Pe>
                    {
                      " média do volume financeiro dos últimos 20 pregões do mercado,"
                    }
                    <Pe>{" descartando os 10% de pregões de maior volume"}</Pe>
                    {
                      " (2 dos 20). A poda é só no topo — dia fraco continua contando, porque dia fraco é justamente o risco. O papel precisa ter negociado em pelo menos metade da janela; com menos que isso ele não tem liquidez medida e não opera."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Por que a poda existe:</Pe>
                    {
                      " sem ela, alguns dias de volume anormal — notícia, pump, rebalanceamento de índice — levantavam a média exatamente na semana em que a estratégia ia escolher o papel. Medido na base de 27/08/2026: RCSL4 foi escolhido 9 noites com média de 43,9 MM tendo hoje 4,2 MM; PLPL3, 19 noites. Com a poda, o universo elegível a 40 MM caiu de 81 para 75 papéis, e casos assim rarearam."
                    }
                  </div>
                  <div style={V}>
                    <Pe>O piso é medido na data da compra</Pe>
                    {
                      ", com a informação daquele dia — é a única forma honesta de fazer backtest. A consequência é que papel que passava e secou depois continua no histórico. Por isso, na contribuição por ativo, quem hoje não passaria aparece com "
                    }
                    <b
                      style={{
                        color: tema.down,
                      }}
                    >
                      ▼
                    </b>{" "}
                    e a liquidez de hoje ao lado, e o pé do cartão soma quantos
                    pontos do resultado estão presos nesses papéis.
                  </div>
                  <div style={V}>
                    <Pe>Escolha manual passa, mas fica marcada.</Pe>
                    {
                      " Cesta padrão e lançamento direto em grupo são sua decisão, não do motor: o app não bloqueia, só sinaliza."
                    }
                  </div>
                  <div
                    style={{
                      ...V,
                      marginBottom: 0,
                    }}
                  >
                    <Pe>Preço mínimo</Pe>
                    {
                      " (CONFIGURAÇÕES) corta papel de centavo, onde um centavo de variação é 2%. Vale para as oito do motor de placar, o Consenso e o MIX. E se num dia sobrarem menos de 8 papéis elegíveis, o dia é pulado: com universo minúsculo, “estar no quarto superior” não significa nada."
                    }
                  </div>
                </Secao>
                <Secao
                  id="controles"
                  titulo="4 · Os controles: o que cada um move"
                  resumo="Mexer num controle e ver metade das curvas paradas é o desenho, não defeito."
                  aberta={it("controles")}
                  onToggle={Ia}
                >
                  <div style={V}>
                    Os números que valem para o app inteiro ficam numa aba só,
                    CONFIGURAÇÕES. Cada um grava ao sair do campo e segue para
                    os outros aparelhos pela nuvem. Quase toda estratégia do
                    motor de placar tem janela própria dentro do indicador; por
                    isso a “Janela (pregões)” move só o ranking do OPERAR e duas
                    curvas (MÉDIA e MÉDIA APARADA), e deixa as outras exatamente
                    onde estavam.
                  </div>
                  <div style={Xe}>ABA CONFIGURAÇÕES</div>
                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table style={ne}>
                      <thead>
                        <tr>
                          <th style={le}>CONTROLE</th>
                          <th style={le}>O QUE ELE MOVE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {De(
                          "Volume mínimo (R$ MM)",
                          "Todas as estratégias, em todos os pregões. Só não vale para a cesta padrão e o lançamento manual, que são escolha sua e ficam marcados.",
                        )}
                        {De(
                          "Taxa por operação (%)",
                          "Todas, sem exceção. É o custo da ida e volta somado, descontado uma vez de cada noite operada, antes de qualquer outra conta.",
                        )}
                        {De(
                          "Preço mínimo (R$)",
                          "As oito do motor de placar, mais Consenso e MIX.",
                        )}
                        {De(
                          "Impacto máximo (% do volume)",
                          "O teto de quanto dá para comprar de cada papel sem mover o preço: entra na alocação da aba OPERAR e no aviso de ordem grande. Não muda escolha nenhuma.",
                        )}
                        {De(
                          "Papéis por estratégia",
                          "Quantos papéis cada estratégia compra por noite — e, nas oito do júri, quantos votos cada uma dá no MIX. Vale no OPERAR, no SINAIS DO DIA, no COMPARAR e no MÊS A MÊS, inclusive para as três do motor de janela. Não vale para a cesta padrão (que usa a sua lista) nem para o MIX (que usa o termômetro).",
                        )}
                        {De(
                          "Termômetro (dia de queda / outros dias / limiar)",
                          "Quantos papéis o MIX e o MIX sem repetir levam em cada noite. “Outros dias” é também o tamanho da lista do Consenso no OPERAR e o número fixo da régua “MIX sem repetir · sem termômetro”.",
                        )}
                        {De(
                          "Estratégias no COMPARAR e no MÊS A MÊS",
                          "Só o que aparece nas listas de comparação. Esconder não tira nada do cálculo: as oito continuam votando no MIX.",
                        )}
                        {De(
                          "Janela (pregões)",
                          "O ranking da aba OPERAR (média, média aparada e WIN) e duas estratégias do motor de janela: MÉDIA e MÉDIA APARADA. Mais nada.",
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={Xe}>NO TOPO DO OPERAR E DAS ESTRATÉGIAS</div>
                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table style={ne}>
                      <thead>
                        <tr>
                          <th style={le}>CONTROLE</th>
                          <th style={le}>O QUE ELE MOVE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {De(
                          "Data de referência",
                          "O “hoje” do app: o dia cujas recomendações aparecem em OPERAR e SINAIS DO DIA, e a data em que a liquidez de cada papel é medida nas listas. Não se aplica ao RESULTADOS, onde cada lançamento carrega a própria data. Ao lado dela, a linha “valendo agora” resume o que está em CONFIGURAÇÕES.",
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={Xe}>CONTROLES DE ABA</div>
                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table style={ne}>
                      <thead>
                        <tr>
                          <th style={le}>CONTROLE</th>
                          <th style={le}>ONDE</th>
                          <th style={le}>O QUE ELE MOVE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {De(
                          "Período (de / até)",
                          "COMPARAR e MÊS A MÊS",
                          "Só o recorte do que já foi calculado: a rodada cobre a base inteira. Depois de mudar algo em CONFIGURAÇÕES, aperte “rodar comparação” de novo — o gráfico fica congelado na última rodada de propósito, e um aviso aparece quando ela ficou velha.",
                        )}
                        {De(
                          "Top N e ordenar por",
                          "OPERAR · RANKING E ALOCAÇÃO",
                          "Só a tabela do ranking e a alocação sugerida. Não mexe em estratégia nenhuma.",
                        )}
                        {De(
                          "Coluna BENCH / matriz mostra",
                          "MÊS A MÊS",
                          "Só a leitura da matriz. Não muda resultado de estratégia nenhuma.",
                        )}
                        {De(
                          "Emenda de ticker",
                          "BASE",
                          "O histórico dos papéis que trocaram de código, no motor das estratégias e na cesta.",
                        )}
                      </tbody>
                    </table>
                  </div>
                </Secao>
                <Secao
                  id="abas"
                  titulo="5 · As abas, uma por uma"
                  resumo="O que cada tela responde e o que você faz nela."
                  aberta={it("abas")}
                  onToggle={Ia}
                >
                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table style={ne}>
                      <tbody>
                        {De(
                          "OPERAR · EXECUTAR",
                          "A carteira da noite, pronta para virar ordem. Você escolhe qual estratégia seguir, o termômetro diz quantos papéis o MIX leva hoje, o app converte valor em lotes, avisa quando a ordem é grande demais para o volume do papel e marca quem está abaixo do piso. Daqui sai o lançamento para o acompanhamento.",
                        )}
                        {De(
                          "OPERAR · RANKING E ALOCAÇÃO",
                          "O ranking do dia pelo motor de janela — média, média aparada e taxa de acerto na janela de CONFIGURAÇÕES — com a alocação sugerida por impacto. É a visão “tabela”, boa para conferir um papel específico.",
                        )}
                        {De(
                          "ESTRATÉGIAS · SINAIS DO DIA",
                          "O que cada estratégia aponta hoje, com o placar de cada papel e o motivo, o termômetro do pregão e o botão que roda o backtest de todas.",
                        )}
                        {De(
                          "ESTRATÉGIAS · COMPARAR",
                          "Todas as curvas no mesmo eixo e no mesmo período, a tabela de estatísticas, a contribuição de cada ativo (com o ▼ de liquidez de hoje), o gerenciador de benchmarks e a exportação das operações em Excel.",
                        )}
                        {De(
                          "ESTRATÉGIAS · MÊS A MÊS",
                          "A matriz ano × mês de qualquer fonte — a sua carteira ou qualquer estratégia — com quantos quadros você quiser empilhar.",
                        )}
                        {De(
                          "RESULTADOS",
                          "O que você operou de verdade: cada grupo lançado, com valor investido e preço de entrada, o realizado na abertura, e a comparação com a cesta padrão no mesmo período.",
                        )}
                        {De(
                          "BASE",
                          "Quantos pregões cada ativo tem, os eventos societários descartados, a lista de exclusões, o upload de CSV, o download do consolidado e o seletor da emenda de ticker.",
                        )}
                        {De(
                          "CONFIGURAÇÕES",
                          "Os números do app inteiro (seção 4) e a lista do que aparece para comparar. É o único lugar onde eles mudam; o resto do app só mostra o que está valendo.",
                        )}
                      </tbody>
                    </table>
                  </div>
                </Secao>
                <Secao
                  id="fichas"
                  titulo="6 · Ficha de cada estratégia"
                  resumo="Os dois motores, as famílias e a ficha completa das dezessete séries — incluindo com quem cada uma se confunde."
                  aberta={it("fichas")}
                  onToggle={Ia}
                >
                  <div style={V}>
                    {
                      "Todas fazem a mesma operação: compram no fechamento e vendem na abertura seguinte, em peso igual, com a taxa já descontada. O que muda entre elas é uma coisa só — "
                    }
                    <Pe>como escolhem o papel</Pe>.
                  </div>
                  <div style={V}>
                    {"Existem "}
                    <Pe>dois motores</Pe>
                    {". O "}
                    <Pe>motor de janela</Pe>
                    {
                      " ordena os papéis por um número simples: a MÉDIA e a MÉDIA APARADA usam o gap das noites dentro de uma janela de pregões que você escolhe; a Queda Forte no Fundo usa uma regra fixa do próprio pregão. O "
                    }
                    <Pe>motor de placar</Pe>
                    {
                      " transforma cada indicador em percentil do dia e soma com pesos: são as oito estratégias nomeadas, mais o Consenso e o MIX, que não têm indicador próprio e trabalham em cima dos votos das outras. O Overnight padrão não é estratégia nenhuma — é a sua cesta fixa, servindo de régua. O Leilão de Abertura é a única que opera o dia, não a noite."
                    }
                  </div>
                  <div style={V}>
                    {"As do motor de placar são catalogadas em "}
                    <Pe>famílias</Pe>:{" "}
                    <b
                      style={{
                        color: "#C77DFF",
                      }}
                    >
                      REVERSÃO
                    </b>
                    {" (“apanhou agora”),"}{" "}
                    <b
                      style={{
                        color: "#80ED99",
                      }}
                    >
                      HÁBITO
                    </b>
                    {" (“sempre abre em alta”) e"}{" "}
                    <b
                      style={{
                        color: "#FFB703",
                      }}
                    >
                      MISTA
                    </b>
                    {
                      ". A família importa porque a confirmação cruzada exige voto de REVERSÃO "
                    }
                    <Pe>e</Pe>
                    {
                      " de HÁBITO — e o voto do Placar Geral, por ser MISTA, não serve para ela. O Consenso só aceita papel confirmado; o MIX põe os confirmados na frente e completa as vagas com os mais votados."
                    }
                  </div>
                  <div
                    style={{
                      ...V,
                      marginBottom: 14,
                    }}
                  >
                    {"Clique para abrir a ficha inteira. O campo "}
                    <Pe>NÃO CONFUNDA</Pe>
                    {
                      " é onde cada estratégia é comparada com as que se parecem com ela."
                    }
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    {D.map((ve) => {
                      let Ee = GUIA_ESTRATEGIAS[ve];
                      if (!Ee) return null;
                      let Ne = Fk === ve;
                      return (
                        <div
                          key={ve}
                          id={"guia-" + ve}
                          style={{
                            borderTop: `1px solid ${Ne ? Ee.cor : tema.line}`,
                            borderRight: `1px solid ${Ne ? Ee.cor : tema.line}`,
                            borderBottom: `1px solid ${Ne ? Ee.cor : tema.line}`,
                            borderLeft: `3px solid ${Ee.cor}`,
                            borderRadius: 9,
                            background: Ne ? tema.panelSoft : "transparent",
                            overflow: "hidden",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => Mk(Ne ? null : ve)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              background: "transparent",
                              border: "none",
                              padding: "11px 14px",
                              cursor: "pointer",
                              color: tema.text,
                              fontFamily: tema.sans,
                              display: "block",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 9,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 2,
                                  background: Ee.cor,
                                  display: "inline-block",
                                }}
                              />
                              <b
                                style={{
                                  fontSize: 14,
                                }}
                              >
                                {Ee.nome}
                              </b>
                              <span
                                style={{
                                  fontFamily: tema.mono,
                                  fontSize: 10,
                                  letterSpacing: 0.6,
                                  color: tema.faint,
                                }}
                              >
                                {Ee.grupo.toUpperCase()}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                }}
                              />
                              <span
                                style={{
                                  fontFamily: tema.mono,
                                  fontSize: 15,
                                  color: tema.faint,
                                  lineHeight: 1,
                                }}
                              >
                                {Ne ? "−" : "+"}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 5,
                                marginTop: 8,
                              }}
                            >
                              {Ee.chaves.map((wt) => (
                                <span
                                  key={wt}
                                  style={{
                                    fontFamily: tema.mono,
                                    fontSize: 10.5,
                                    padding: "2px 7px",
                                    borderRadius: 20,
                                    border: `1px solid ${tema.line}`,
                                    color: tema.dim,
                                    background: tema.panel,
                                  }}
                                >
                                  {wt}
                                </span>
                              ))}
                            </div>
                            <div
                              style={{
                                fontSize: 12.5,
                                color: tema.dim,
                                lineHeight: 1.6,
                                marginTop: 8,
                              }}
                            >
                              {Ee.linha}
                            </div>
                          </button>
                          {Ne && (
                            <div
                              style={{
                                padding: "0 14px 14px",
                                display: "grid",
                                gap: 10,
                              }}
                            >
                              {[
                                ["A PERGUNTA QUE ELA FAZ", Ee.pergunta],
                                ["COMO ESCOLHE", Ee.como],
                                ["QUE JANELA USA", Ee.janela],
                                ["QUANTOS PAPÉIS", Ee.quantos],
                                ["QUANDO NÃO OPERA", Ee.quandoPara],
                                ["NÃO CONFUNDA", Ee.naoConfunda],
                              ]
                                .filter(([, wt]) => !!wt)
                                .map(([wt, ht]) => (
                                  <div key={wt}>
                                    <div
                                      style={{
                                        fontFamily: tema.mono,
                                        fontSize: 10,
                                        letterSpacing: 0.7,
                                        color: tema.faint,
                                        marginBottom: 3,
                                      }}
                                    >
                                      {wt}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 13,
                                        color: tema.dim,
                                        lineHeight: 1.65,
                                      }}
                                    >
                                      {ht}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      ...V,
                      marginTop: 14,
                      marginBottom: 0,
                    }}
                  >
                    <Pe>Duas coisas valem para todas.</Pe>
                    {
                      " Nenhuma enxerga o futuro: a escolha de cada noite usa só os pregões até aquele dia. E noite sem sinal é noite sem operação — quando uma estratégia não acha ninguém, o capital fica parado e a curva anda reta; não é zero de resultado, é ausência de operação."
                    }
                  </div>
                </Secao>
                <Secao
                  id="bench"
                  titulo="7 · Benchmarks: como incluir e comparar"
                  resumo="Renda fixa, qualquer ativo da base em dois modos, ou uma planilha sua."
                  aberta={it("bench")}
                  onToggle={Ia}
                >
                  <div style={Xe}>OS TRÊS TIPOS</div>
                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table style={ne}>
                      <tbody>
                        {De(
                          "renda fixa",
                          "Você informa a taxa anual. O app converte na taxa mensal equivalente e compõe mês a mês; em mês cortado pelo período, rende proporcional aos pregões de dentro do recorte.",
                        )}
                        {De(
                          "ativo da base",
                          "Qualquer ticker — IBOV, BOVA11, um papel específico. Em dois modos, e a diferença é grande: “manter” é posição parada (uma compra no início, uma venda no fim, sem custo por pregão) e “comprar toda noite” é uma operação por pregão, que paga a taxa em cada uma.",
                        )}
                        {De(
                          "planilha sua",
                          "Arquivo .xlsx, .xls ou .csv com duas colunas: data e resultado do dia, com ou sem símbolo de %. Sobe na aba COMPARAR, em “Benchmarks personalizados”; você dá um nome e ele fica salvo neste navegador, aparecendo como opção nos gráficos e como chip no mês a mês. É o caminho para comparar com CDI, com a carteira de um fundo, ou com o seu próprio extrato.",
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div
                    style={{
                      ...V,
                      marginTop: 12,
                    }}
                  >
                    <Pe>Onde eles aparecem:</Pe>
                    {
                      " como série no gráfico da aba COMPARAR, como coluna BENCH da matriz mês a mês (valendo para todos os quadros) e como linha de comparação nos grupos do RESULTADOS."
                    }
                  </div>
                  <div
                    style={{
                      ...V,
                      marginBottom: 0,
                    }}
                  >
                    <Pe>Cuidado com a régua.</Pe>
                    {
                      " Estratégia overnight entra com o mesmo valor toda noite e tira o lucro da mesa: a base é fixa e o acumulado é "
                    }
                    <Pe>soma</Pe>
                    {
                      ". Posição parada e renda fixa ficam investidas: o acumulado é "
                    }
                    <Pe>juros compostos</Pe>. Comparar os dois números no mesmo
                    gráfico é legítimo, desde que você saiba que são operações
                    diferentes — não é erro de conta.
                  </div>
                </Secao>
                <Secao
                  id="carteiras"
                  titulo="8 · Carteira, cesta padrão e grupos de acompanhamento"
                  resumo="As três formas de acompanhar resultado: simulada, régua fixa e o que você operou de verdade."
                  aberta={it("carteiras")}
                  onToggle={Ia}
                >
                  <div style={V}>
                    <Pe>1. A carteira (COMPARAR e MÊS A MÊS).</Pe>
                    {
                      " Uma lista de ativo + valor em R$, montada no editor no topo dessas abas. Responde “e se eu comprasse esses papéis toda noite, com esses valores?”. O peso de cada papel é o valor que você digitou, com o lote arredondado como na vida real — é a única série do app que não usa peso igual. Fica salva no navegador."
                    }
                  </div>
                  <div style={V}>
                    <Pe>2. A cesta padrão (RESULTADOS).</Pe>
                    {
                      " A régua. Mesma ideia da carteira, mas com um papel específico: é contra ela que todo grupo é comparado. A curva dela é reconstruída do COTAHIST em qualquer intervalo que você pedir, sem depender de lançamento nenhum — estratégia que não bate a cesta não vale o trabalho."
                    }
                  </div>
                  <div style={V}>
                    <Pe>3. Os grupos de acompanhamento (RESULTADOS).</Pe>
                    {
                      " Aqui não tem simulação: você lança o que operou de fato — ativo, valor investido, preço de entrada — e o app calcula o realizado na abertura seguinte, agrupado por noite. Ele marca com ▼ o papel que estava abaixo do piso no dia do lançamento, mostra quanto do resultado veio de cada um e compara o grupo com a cesta padrão no mesmo período. Dá para lançar direto da aba OPERAR, com um clique, ou manualmente."
                    }
                  </div>
                  <div
                    style={{
                      ...V,
                      marginBottom: 0,
                    }}
                  >
                    <Pe>Lote e impacto.</Pe>
                    {
                      " O lote padrão é 100, ajustável por ticker na aba RESULTADOS — importa porque o arredondamento muda o peso efetivo de cada papel. O teto de impacto (CONFIGURAÇÕES) avisa quando o valor que você quer pôr num papel é grande demais para o volume médio dele."
                    }
                  </div>
                </Secao>
                <Secao
                  id="mesames"
                  titulo="9 · Mês a mês: como ler e como empilhar quadros"
                  resumo="A matriz ano × mês, as quatro colunas e os quadros de qualquer estratégia."
                  aberta={it("mesames")}
                  onToggle={Ia}
                >
                  <div style={V}>
                    Cada linha é um ano, cada coluna um mês, e o número pintado
                    é a métrica escolhida no próprio quadro. À direita ficam os
                    quatro acumulados do ano e a coluna MELHOR.
                  </div>
                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table style={ne}>
                      <tbody>
                        {De(
                          "OVER",
                          "O resultado da fonte do quadro: a carteira operando overnight, ou a estratégia escolhida, com a taxa já descontada.",
                        )}
                        {De(
                          "POS",
                          "Manter posicionado nos mesmos ativos e proporções, sem operar. Só existe para a carteira — numa estratégia cuja lista muda toda noite, “manter os mesmos ativos” não quer dizer nada, e a coluna fica vazia de propósito.",
                        )}
                        {De(
                          "BENCH",
                          "O benchmark escolhido no topo da aba, aplicado sobre o mesmo calendário de noites.",
                        )}
                        {De(Rs, "Manter o total no índice, no mesmo período.")}
                      </tbody>
                    </table>
                  </div>
                  <div
                    style={{
                      ...V,
                      marginTop: 12,
                    }}
                  >
                    <Pe>Vários quadros.</Pe>
                    {
                      " O botão “adicionar quadro” empilha quantas matrizes você quiser, e cada uma escolhe a fonte: a carteira ou qualquer estratégia do app, inclusive as três do motor de janela. As estratégias usam os números de CONFIGURAÇÕES (papéis por estratégia, termômetro, janela e piso), os mesmos do gráfico do COMPARAR. Série escondida em CONFIGURAÇÕES não aparece na lista de fontes. Os quadros ficam salvos neste navegador."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Período e benchmark são únicos</Pe>
                    {
                      " para todos os quadros. Isso é de propósito: quadros com períodos ou réguas diferentes não podem ser lidos um ao lado do outro."
                    }
                  </div>
                  <div
                    style={{
                      ...V,
                      marginBottom: 0,
                    }}
                  >
                    <Pe>A noite conta no dia da venda</Pe>
                    {
                      " (a abertura), que é o dia em que o índice e a posição parada também se mexem — é o que mantém as quatro colunas no mesmo calendário. Mês em branco numa estratégia é mês sem sinal, não mês com resultado zero: as de regime, como o Pânico e o Consenso, passam meses inteiros assim. Cada quadro tem o próprio botão de extrair imagem."
                    }
                  </div>
                </Secao>
                <Secao
                  id="export"
                  titulo="10 · O que dá para exportar"
                  resumo="A base em CSV, o quadro em imagem e as operações, uma por uma, em Excel."
                  aberta={it("export")}
                  onToggle={Ia}
                >
                  <div style={V}>
                    <Pe>Base consolidada (aba BASE).</Pe>
                    {
                      " CSV com a base inteira: ativo, data, abertura, máxima, mínima, fechamento, volume financeiro e quantidade, ordenado por ativo e da data mais nova para a mais antiga. É o arquivo que volta pelo upload, então serve de backup."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Quadro mês a mês em imagem (aba MÊS A MÊS).</Pe>
                    {
                      " PNG da matriz como ela está na tela, com as quatro colunas e o total. Cada quadro tem o seu botão."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Operações em Excel (aba COMPARAR).</Pe>
                    {" Uma planilha com "}
                    <Pe>uma aba por estratégia</Pe>
                    {
                      " mais uma aba RESUMO. Cada linha é uma compra: a data da compra e a da venda, o papel, a posição dele na lista daquela noite (TOP 1, 2, 3…), o OHLC do dia da compra, o volume financeiro do dia, a liquidez podada de 20 pregões, a abertura da venda, o resultado líquido da noite, o gap bruto, a variação do dia, o gap da noite anterior, IBS, RSI 14, posição nas faixas de 20 e 60 pregões, a taxa de acerto overnight em 60 noites, o placar que a estratégia deu ao papel, quantos votos ele teve (no MIX e no Consenso), quantos papéis o termômetro mandou, quantos a noite teve e o resultado da noite inteira. Os percentuais já vão formatados como % — dá para somar e filtrar direto no Excel."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Relatório de IR em Excel ou PDF (aba RESULTADOS).</Pe>
                    {
                      " Por grupo, no mês da venda: cada operação com compra, quantidade e venda pelos preços do COTAHIST, a apuração do mês e o DARF (código 6015, vencimento, valor). O Excel traz também a apuração como a Receita enxerga, o quadro para a declaração anual e as premissas. Detalhes na seção 13."
                    }
                  </div>
                  <div
                    style={{
                      ...V,
                      marginBottom: 0,
                    }}
                  >
                    As linhas exportadas são refeitas pelo mesmo motor do
                    backtest — mesmo filtro de liquidez, mesma ordenação, mesmo
                    limite de papéis. São as mesmas operações do gráfico, não
                    uma reconstrução aproximada: se um dia os dois divergirem, é
                    defeito de um dos lados e a planilha serve de prova.
                  </div>
                </Secao>
                <Secao
                  id="numeros"
                  titulo="11 · Como ler os números"
                  resumo="Cobertura, média por noite, tombo máximo, contribuição por ativo e por que participação às vezes não aparece."
                  aberta={it("numeros")}
                  onToggle={Ia}
                >
                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table style={ne}>
                      <tbody>
                        {De(
                          "RESULTADO (total)",
                          "Soma dos resultados das noites operadas, com base fixa. Não é rentabilidade composta: o modelo é entrar com o mesmo valor toda noite e tirar o lucro.",
                        )}
                        {De(
                          "MÉDIA/NOITE",
                          "O número que permite comparar estratégias que operam quantidades diferentes de noites. Estratégia que opera 10 vezes no ano e outra que opera 240 não se comparam pelo total.",
                        )}
                        {De(
                          "COBERTURA · SEM SINAL",
                          "Em que fatia das noites do período a estratégia realmente operou. É a primeira coluna a olhar antes de se impressionar com um total.",
                        )}
                        {De(
                          "TOMBO MÁXIMO (MDD)",
                          "A maior queda do topo até o fundo da curva acumulada, em pontos percentuais da base fixa. Mede o pior momento que você teria atravessado.",
                        )}
                        {De(
                          "SHARPE",
                          "Média por noite dividida pelo desvio padrão, anualizado. Serve para ordenar risco/retorno entre as estratégias do app; não é comparável com Sharpe de fundo.",
                        )}
                        {De(
                          "ACERTO",
                          "Fatia das noites com resultado positivo. Não decide nada sozinho: acerto alto com uma noite catastrófica pode render menos que acerto médio e regular.",
                        )}
                        {De(
                          "CONTRIBUIÇÃO POR ATIVO",
                          "Quanto cada papel somou ou tirou do resultado, em pontos percentuais. Com peso igual toda noite, a soma de todos fecha exatamente com o total da estratégia — se não fechar, é bug.",
                        )}
                        {De(
                          "PARTICIPAÇÃO (%)",
                          "A fatia do resultado que veio de cada papel. Só aparece quando o total é positivo: dividir contribuição por um total negativo produz número absurdo (+3% sobre −1% daria −300%).",
                        )}
                        {De(
                          "▼ no nome do papel",
                          "A liquidez dele HOJE está abaixo do piso, ou ele não negocia mais. O resultado histórico continua válido; o que ele não é mais é repetível.",
                        )}
                        {De(
                          "AMOSTRA CURTA",
                          "Com menos de 20 noites, uma noite boa ou ruim decide o placar. O app avisa; use o recorte para comparar, não para concluir.",
                        )}
                        {De(
                          "CORRELAÇÃO",
                          "Na tabela do backtest do SINAIS DO DIA: quais das oito estratégias andam juntas. Duas estratégias muito correlacionadas não diversificam nada, mesmo que as duas sejam boas.",
                        )}
                      </tbody>
                    </table>
                  </div>
                </Secao>
                <Secao
                  id="limites"
                  titulo="12 · Limites, riscos e o que o app não faz"
                  resumo="Leia antes de mudar como você opera por causa de um número daqui."
                  aberta={it("limites")}
                  onToggle={Ia}
                >
                  <div style={V}>
                    <Pe>
                      Backtest é passado, e o passado tem papéis que morreram.
                    </Pe>
                    {
                      " O histórico inclui ações que hoje não negociam — fusão, fechamento de capital, recuperação judicial. Elas passavam no piso na época e por isso continuam no resultado. Olhe sempre o ▼ e o rodapé do cartão de contribuição antes de tratar o total como algo que você conseguiria repetir hoje."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Preço de leilão não é preço garantido.</Pe>
                    {
                      " Todo o app assume execução no preço do leilão de fechamento e no do leilão de abertura. Entrar um pouco pior come a margem, e nas estratégias de margem fina isso é fatal: no Leilão de Abertura, a margem é 0,266% por dia e entrar 0,3% acima do preço do leilão já a deixa negativa."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Custos e imposto.</Pe>
                    {
                      " A taxa é um número que você informa e cobre a ida e a volta. Os resultados das estratégias e dos grupos são antes do imposto de renda: o imposto só aparece no relatório de IR (seção 13). Emolumentos discriminados e aluguel não entram em conta nenhuma."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Sobreajuste.</Pe>
                    {
                      " São dezessete séries testadas no mesmo histórico; a melhor de um período não é a melhor por mérito garantido. Rode recortes diferentes, olhe a cobertura e a correlação, e desconfie de estratégia que só brilha num pedaço do gráfico."
                    }
                  </div>
                  <div
                    style={{
                      ...V,
                      marginBottom: 0,
                    }}
                  >
                    <Pe>Nada aqui é recomendação de investimento.</Pe>
                    {
                      " O app organiza dado público da B3 e testa regras que você escolheu. A decisão, o dinheiro e o risco são seus."
                    }
                  </div>
                </Secao>
                <Secao
                  id="ir"
                  titulo="13 · Relatório de IR e DARF"
                  resumo="O que o relatório da aba RESULTADOS calcula, de onde vêm os números e o que conferir antes de pagar."
                  aberta={it("ir")}
                  onToggle={Ia}
                >
                  <div style={V}>
                    <Pe>Onde fica.</Pe>
                    {
                      " No fim da aba RESULTADOS, com atalho no cabeçalho da aba e em cada grupo. Escolha o grupo e o mês da venda — ou o ano inteiro, ou um De/Até por dia — e baixe em Excel ou imprima/salve em PDF."
                    }
                  </div>
                  <div style={V}>
                    <Pe>De onde vêm os números.</Pe>
                    {
                      " Cada compra marcada em ★ acompanhar vira uma operação. O preço é sempre o do COTAHIST: fechamento do pregão da compra e abertura do pregão seguinte. Quantidade e valor são os do grupo. Sem o COTAHIST do dia, o relatório usa o preço do item e marca provisório — ele se corrige sozinho quando a base chega."
                    }
                  </div>
                  <div style={V}>
                    <Pe>Mês do imposto.</Pe>
                    {
                      " A operação conta no mês da venda. Comprou no último pregão do mês e vendeu na abertura do mês seguinte: entra no mês seguinte."
                    }
                  </div>
                  <div style={V}>
                    <Pe>As regras aplicadas.</Pe>
                    {
                      " 15% sobre o ganho líquido das operações comuns; 20% em day trade e em FII. Ganho em ações é isento quando as vendas de ações do mês não passam de R$ 20 mil — com o volume do overnight, na prática não se aplica. Custos somam à compra e saem da venda. Prejuízo compensa ganho futuro só na mesma modalidade. O IRRF de 0,005% das vendas abate do imposto. DARF código 6015, com vencimento no último dia útil do mês seguinte; abaixo de R$ 10, o valor passa para o mês seguinte."
                    }
                  </div>
                  <div style={V}>
                    <Pe>O caso que pega o overnight.</Pe>
                    {
                      " Day trade não é só comprar e vender no mesmo dia: vender de manhã o que já se tinha e comprar o mesmo papel de novo no leilão de fechamento também é. O mesmo papel em duas noites seguidas gera um day trade no dia do meio (20%, prejuízo separado), e a posição antiga segue com o custo antigo. O relatório faz essa separação sozinho e avisa."
                    }
                  </div>
                  <div style={V}>
                    <Pe>O que conferir antes de pagar.</Pe>
                    {
                      " A nota de corretagem é o documento que vale. Em “ajustes para o DARF”, informe os custos e o IRRF das notas do mês, o prejuízo que você já tinha antes do app e o tipo de cada papel terminado em 11 (unit de empresa tributa como ação; cota de fundo, como FII). Se houve venda fora do grupo no mesmo CPF — outra corretora, posição de longo prazo no mesmo papel —, o imposto é da soma de tudo."
                    }
                  </div>
                  <div
                    style={{
                      ...V,
                      marginBottom: 0,
                    }}
                  >
                    <Pe>Clube de investimento.</Pe>
                    {
                      " Operação feita pelo clube (CNPJ do clube) não gera DARF para o cotista: o IR é retido pelo administrador no resgate das cotas. Nesse caso o relatório serve só de controle."
                    }
                  </div>
                </Secao>
              </div>
            );
          })()}
        {_e &&
          R === "mesames" &&
          (() => {
            let D =
                Ze != null && Bt != null
                  ? `${fmtData(Ze)} a ${fmtData(Bt)}`
                  : "—",
              V =
                Ut.type === "rf"
                  ? `RF ${String(Ut.annual).replace(".", ",")}%aa`
                  : Ut.type === "ticker"
                    ? rotuloBenchmark(Ut)
                    : (pt.find((Ne) => Ne.id === Ut.id)?.name ?? "BENCH"),
              ne = {
                over: "OVER",
                pos: "POS",
                bench: V,
                ibov: Rs,
              },
              le = {
                over: tema.amber,
                pos: tema.up,
                bench: "#C77DFF",
                ibov: "#5B9BD5",
              },
              ye = [
                ["over", "OVER"],
                ["pos", "POS"],
                ["bench", V],
                ["ibov", Rs],
              ],
              Ke = [ne.over, ne.pos, ne.bench, ne.ibov],
              Xe =
                Ge.length === 1
                  ? Ge[0].ativo
                  : `Carteira (${Ge.length} ativos)`,
              De = () =>
                Bd([
                  ...Do,
                  {
                    id:
                      String(Date.now()) +
                      String(Math.floor(Math.random() * 1000)),
                    fonte: "mix",
                    metric: "over",
                  },
                ]),
              Pe = (Ne, wt) =>
                Bd(
                  Do.map((ht) =>
                    ht.id === Ne
                      ? {
                          ...ht,
                          ...wt,
                        }
                      : ht,
                  ),
                ),
              it = (Ne) => Bd(Do.filter((wt) => wt.id !== Ne)),
              ve = (
                <div
                  style={{
                    padding: "10px 18px",
                    fontSize: 11,
                    color: tema.faint,
                    lineHeight: 1.6,
                  }}
                >
                  {
                    "OVER = estratégia overnight na carteira, ponderada pelos valores · POS = manter posicionado nos mesmos ativos e proporções · BENCH = aplicar o total no benchmark escolhido · "
                  }
                  {Rs}
                  {
                    " = manter o total no índice. Anos parciais acumulam só os meses do filtro."
                  }
                  <div
                    style={{
                      marginTop: 4,
                    }}
                  >
                    <b
                      style={{
                        color: tema.dim,
                      }}
                    >
                      Período por dia:
                    </b>
                    {
                      " aqui a noite conta no dia da venda (abertura), que é o dia em que o POS e o índice também se mexem — assim as quatro colunas ficam no mesmo calendário. Mês cortado pelo período mostra só os pregões de dentro; a renda fixa desse mês rende proporcional a eles."
                    }
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                    }}
                  >
                    <b
                      style={{
                        color: tema.dim,
                      }}
                    >
                      Taxa:
                    </b>
                    {
                      " quem opera paga, quem só fica posicionado não. OVER desconta "
                    }
                    {numBR(k, 3)}
                    {
                      "% em cada noite operada; BENCH também, quando está em “comprar toda noite”. POS, "
                    }
                    {Rs}
                    {
                      " e BENCH em “manter” são posição parada — uma compra no início e uma venda no fim, sem custo por pregão."
                    }
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                    }}
                  >
                    <b
                      style={{
                        color: tema.dim,
                      }}
                    >
                      Acumulação:
                    </b>
                    {
                      " OVER entra com o mesmo valor toda noite e o lucro sai, então a base é fixa e mês, ano e total são "
                    }
                    <b>soma</b>
                    {" dos resultados. POS, "}
                    {Rs}
                    {" e a renda fixa ficam investidos, então acumulam "}
                    <b>juros compostos</b>. Por isso a coluna OVER fecha somando
                    e as outras não — são réguas diferentes porque são operações
                    diferentes.
                  </div>
                </div>
              ),
              Ee = (
                <div
                  style={{
                    padding: "10px 18px",
                    fontSize: 11,
                    color: tema.faint,
                    lineHeight: 1.6,
                  }}
                >
                  {
                    "OVER = resultado da estratégia, peso igual entre os papéis da noite, taxa de "
                  }
                  {numBR(k, 3)}
                  {"% já descontada · BENCH e "}
                  {Rs}
                  {
                    " usam o mesmo calendário de noites operadas, para comparar maçã com maçã."
                  }
                  <div
                    style={{
                      marginTop: 4,
                    }}
                  >
                    <b
                      style={{
                        color: tema.dim,
                      }}
                    >
                      POS fica vazio de propósito:
                    </b>
                    {
                      " “manter posicionado nos mesmos ativos” não existe numa estratégia cuja lista muda toda noite. Para comparar com posição parada, use a coluna do índice ou um benchmark de ativo em modo “manter”."
                    }
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                    }}
                  >
                    <b
                      style={{
                        color: tema.dim,
                      }}
                    >
                      Mês sem número
                    </b>
                    {
                      " é mês em que a estratégia não achou sinal — não é zero de resultado, é ausência de operação. As estratégias de regime (Pânico, Consenso) passam meses inteiros assim."
                    }
                  </div>
                </div>
              );
            return (
              <>
                <EditorCarteira
                  carteira={Ge}
                  onChange={Lt}
                  tickers={ql.filter((Ne) => Ne !== Bn)}
                  marked={Bl}
                  sizing={zl}
                  rank={Tn}
                />
                <section
                  style={{
                    background: tema.panel,
                    border: `1px solid ${tema.line}`,
                    borderRadius: 14,
                    overflow: "hidden",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      padding: "14px 18px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 16,
                      alignItems: "flex-end",
                    }}
                  >
                    <SeletorPeriodo
                      de={Ze}
                      ate={Bt}
                      onDe={Ht}
                      onAte={wr}
                      dates={iu}
                    />
                    <Campo label="Coluna BENCH compara com">
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Chip
                          active={Ut.type === "rf"}
                          onClick={() =>
                            Xi({
                              type: "rf",
                              annual: Ut.type === "rf" ? Ut.annual : 12,
                            })
                          }
                        >
                          Renda fixa
                        </Chip>
                        {Ut.type === "rf" && (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={Ut.annual}
                              onChange={(Ne) =>
                                Xi({
                                  type: "rf",
                                  annual: Math.max(0, +Ne.target.value || 0),
                                })
                              }
                              style={{
                                ...estiloInput,
                                width: 70,
                              }}
                            />
                            <span
                              style={{
                                fontFamily: tema.mono,
                                fontSize: 12,
                                color: tema.faint,
                              }}
                            >
                              % a.a.
                            </span>
                          </span>
                        )}
                        {pt.map((Ne) => (
                          <Chip
                            key={Ne.id}
                            active={Ut.type === "custom" && Ut.id === Ne.id}
                            onClick={() =>
                              Xi({
                                type: "custom",
                                id: Ne.id,
                              })
                            }
                          >
                            {Ne.name}
                          </Chip>
                        ))}
                        <select
                          value={Ut.type === "ticker" ? Ut.t : ""}
                          onChange={(Ne) =>
                            Ne.target.value &&
                            Xi({
                              type: "ticker",
                              t: Ne.target.value,
                              modo:
                                Ut.type === "ticker"
                                  ? (Ut.modo ?? "pos")
                                  : Ut.type === "custom"
                                    ? (Ut.modo ?? "over")
                                    : "pos",
                            })
                          }
                          style={{
                            ...estiloInput,
                            minWidth: 100,
                          }}
                        >
                          <option value="">ativo…</option>
                          {ql.map((Ne) => (
                            <option key={Ne} value={Ne}>
                              {Ne}
                            </option>
                          ))}
                        </select>
                        {Ut.type === "ticker" && (
                          <>
                            <Chip
                              active={(Ut.modo ?? "pos") === "pos"}
                              onClick={() =>
                                Xi({
                                  ...Ut,
                                  modo: "pos",
                                })
                              }
                            >
                              manter
                            </Chip>
                            <Chip
                              active={Ut.modo === "over"}
                              onClick={() =>
                                Xi({
                                  ...Ut,
                                  modo: "over",
                                })
                              }
                            >
                              comprar toda noite
                            </Chip>
                            <span
                              style={{
                                fontSize: 11,
                                color: tema.faint,
                              }}
                            >
                              {Ut.modo === "over"
                                ? `opera todo pregão — taxa de ${numBR(k, 3)}% descontada`
                                : "posição parada — sem taxa"}
                            </span>
                          </>
                        )}
                      </div>
                    </Campo>
                    <span
                      style={{
                        flex: 1,
                      }}
                    />
                    <button
                      onClick={De}
                      style={{
                        ...estiloBotao,
                        color: tema.amber,
                        borderColor: tema.amber,
                      }}
                    >
                      + adicionar quadro
                    </button>
                  </div>
                  <div
                    style={{
                      padding: "0 18px 13px",
                      fontSize: 11.5,
                      color: tema.faint,
                      lineHeight: 1.6,
                    }}
                  >
                    {
                      "Período e benchmark valem para todos os quadros: é isso que torna os quadros comparáveis entre si. Cada quadro escolhe a "
                    }
                    <b
                      style={{
                        color: tema.dim,
                      }}
                    >
                      fonte
                    </b>
                    {
                      " (a carteira ou qualquer estratégia do app) e qual coluna a "
                    }
                    <b
                      style={{
                        color: tema.dim,
                      }}
                    >
                      matriz pinta
                    </b>
                    {". As estratégias usam os números de CONFIGURAÇÕES: "}
                    {C}
                    {" papéis por estratégia, MIX com "}
                    {H.queda}
                    {" papéis em dia de queda e "}
                    {H.normal}
                    {" nos outros, janela de "}
                    {q}
                    {" pregões e piso de R$ "}
                    {fmtNum(X)}
                    {" MM."}
                    {Do.length > 0 &&
                      " Os quadros ficam salvos neste navegador."}
                  </div>
                </section>
                <QuadroMesAMes
                  titulo={Xe}
                  cor={CORES_SERIES.carteira}
                  labelPeriodo={D}
                  colLabels={ne}
                  colColor={le}
                  metricOpts={ye}
                  res={Ch}
                  metric={Ml}
                  onMetric={wh}
                  onExport={
                    Ch ? () => exportarMesAMesPNG(Ch, Xe, ne[Ml], D, Ke) : null
                  }
                  aviso={
                    Ge.length === 0
                      ? "Monte a carteira acima para gerar o quadro."
                      : Ch
                        ? null
                        : "Sem dados para o filtro selecionado."
                  }
                  rodape={ve}
                />
                {MW.map((Ne) => {
                  let wt = Ne.fonte === "carteira",
                    ht = wt ? Xe : Ne.nome;
                  return (
                    <QuadroMesAMes
                      key={Ne.id}
                      titulo={ht}
                      cor={CORES_SERIES[Ne.fonte] ?? tema.amber}
                      labelPeriodo={D}
                      colLabels={ne}
                      colColor={le}
                      metricOpts={ye}
                      res={Ne.res}
                      metric={Ne.metric ?? "over"}
                      onMetric={(Ft) =>
                        Pe(Ne.id, {
                          metric: Ft,
                        })
                      }
                      onRemove={() => it(Ne.id)}
                      onExport={
                        Ne.res
                          ? () =>
                              exportarMesAMesPNG(
                                Ne.res,
                                ht,
                                ne[Ne.metric ?? "over"],
                                D,
                                Ke,
                              )
                          : null
                      }
                      seletor={
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <select
                            value={Ne.fonte}
                            onChange={(Ft) =>
                              Pe(Ne.id, {
                                fonte: Ft.target.value,
                              })
                            }
                            style={{
                              ...estiloInput,
                              minWidth: 230,
                              fontWeight: 700,
                            }}
                          >
                            {Object.entries(NOMES_SERIES)
                              .filter(
                                ([Ft]) =>
                                  Ft === Ne.fonte ||
                                  Ft === "carteira" ||
                                  !J.has(JUIZES[Ft] ?? "n_" + Ft),
                              )
                              .map(([Ft, Sr]) => (
                                <option key={Ft} value={Ft}>
                                  {Sr}
                                </option>
                              ))}
                          </select>
                          {GUIA_DA_SERIE[Ne.fonte] && (
                            <button
                              type="button"
                              onClick={() => ou(GUIA_DA_SERIE[Ne.fonte])}
                              title="abrir a ficha desta estratégia no READ ME"
                              style={{
                                ...estiloBotao,
                                padding: "3px 9px",
                                color: tema.faint,
                              }}
                            >
                              ?
                            </button>
                          )}
                        </span>
                      }
                      aviso={
                        wt && Ge.length === 0
                          ? "Monte a carteira acima para gerar o quadro."
                          : !Vt && !wt
                            ? "Base curta demais para rodar as estratégias (precisa de 150 pregões)."
                            : Ne.res
                              ? null
                              : "Sem noite operada no período para esta fonte."
                      }
                      rodape={wt ? ve : Ee}
                    />
                  );
                })}
                <button
                  onClick={De}
                  style={{
                    ...estiloBotao,
                    color: tema.amber,
                    borderColor: tema.amber,
                    width: "100%",
                    padding: "11px 0",
                  }}
                >
                  + adicionar quadro mês a mês
                </button>
              </>
            );
          })()}
      </main>
      <AbasCelular aba={A} aoTrocar={w} />
    </div>
  );
}
