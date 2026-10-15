/* Aba SWING: sinal "demanda retraída em empresa lucrativa" para segurar
   dias/semanas, com alvo, stop e prazo. A regra mora em swing.js. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Chip, Estatistica } from "./componentes.jsx";
import {
  BotaoImagem,
  CURSOR_HASTES,
  EIXO_X,
  EIXO_Y,
  GRADE,
  GRAFICO_HASTES,
  Haste,
  MARGEM,
  TooltipGrafico,
  baixarGraficoPNG,
  larguraHaste,
  useLargura,
} from "./graficos.jsx";
import {
  REGRA_SWING,
  SAIDAS_SWING,
  buscarFundamentos,
  calcularSwing,
} from "./swing.js";
import { fmtData, fmtNum, tema } from "./tema.js";

const cartao = {
  background: tema.panel,
  border: `1px solid ${tema.line}`,
  borderRadius: tema.raio,
  padding: "16px 18px",
  marginBottom: 14,
};
const rotulo = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: tema.faint,
};
const th = {
  ...rotulo,
  textAlign: "left",
  padding: "0 10px 8px 0",
  whiteSpace: "nowrap",
};
const td = {
  padding: "8px 10px 8px 0",
  borderTop: `1px solid ${tema.lineSoft}`,
  whiteSpace: "nowrap",
  fontSize: 13,
};

const reais = (v) => (Number.isFinite(v) ? "R$ " + fmtNum(v, 2) : "—");
const pct = (v, c = 1) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtNum(Math.abs(v) * 100, c)}%`;
const corDe = (v) => (v > 0 ? tema.up : v < 0 ? tema.down : tema.dim);

const STATUS = {
  alvo: { txt: "alvo", cor: tema.up },
  stop: { txt: "stop", cor: tema.down },
  prazo: { txt: "prazo", cor: tema.dim },
  aberta: { txt: "aberta", cor: tema.amber },
  evento: { txt: "evento societário", cor: tema.faint },
};

function Titulo({ children, extra }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
        flexWrap: "wrap",
      }}
    >
      <b style={{ fontSize: 15, fontWeight: 650 }}>{children}</b>
      <span style={{ flex: 1 }} />
      {extra}
    </div>
  );
}

function Selo({ status }) {
  let s = STATUS[status] || STATUS.prazo;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        color: s.cor,
        border: `1px solid ${s.cor}55`,
        background: s.cor + "1A",
      }}
    >
      {s.txt}
    </span>
  );
}

/* posição do preço atual entre o stop (esquerda) e o alvo (direita) */
function Trilho({ ret, saida }) {
  let p = Math.max(0, Math.min(1, (ret + saida.stop) / (saida.alvo + saida.stop))),
    zero = saida.stop / (saida.alvo + saida.stop);
  return (
    <div
      title={`stop −${saida.stop * 100}% · entrada · alvo +${saida.alvo * 100}%`}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 220,
        height: 8,
        borderRadius: 99,
        background: `linear-gradient(90deg, ${tema.downSoft}, ${tema.panelSoft} ${zero * 100}%, ${tema.upSoft})`,
        border: `1px solid ${tema.lineSoft}`,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: `${zero * 100}%`,
          top: -2,
          bottom: -2,
          width: 1,
          background: tema.faint,
        }}
      />
      <span
        style={{
          position: "absolute",
          left: `calc(${p * 100}% - 5px)`,
          top: -2,
          width: 10,
          height: 10,
          borderRadius: 99,
          background: corDe(ret),
          boxShadow: `0 0 0 2px ${tema.panel}`,
        }}
      />
    </div>
  );
}

function CartaoSinal({ o, saida }) {
  let linha = (r, v, cor) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: tema.dim, fontSize: 12.5 }}>{r}</span>
      <span style={{ fontFamily: tema.mono, fontSize: 13.5, color: cor || tema.text }}>{v}</span>
    </div>
  );
  return (
    <div
      style={{
        background: tema.panelSoft,
        border: "1px solid rgba(61,199,150,.35)",
        borderRadius: tema.raioP,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <b style={{ fontSize: 18, fontFamily: tema.mono }}>{o.ativo}</b>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tema.up }}>COMPRE</span>
      </div>
      {linha("Entrada (fechamento)", reais(o.entrada))}
      {linha(`Alvo +${saida.alvo * 100}%`, reais(o.alvoPreco), tema.up)}
      {linha(`Stop −${saida.stop * 100}%`, reais(o.stopPreco), tema.down)}
      {linha("Prazo", `${saida.prazo} pregões`)}
      <div className="pilulas" style={{ marginTop: 4 }}>
        <span className="pilula">P/L <b>{o.pl ? fmtNum(o.pl, 1) : "—"}</b></span>
        <span className="pilula">ROE <b>{pct(o.roe, 0)}</b></span>
        <span className="pilula">lucro do tri a/a <b>{pct(o.lucroTriAA, 0)}</b></span>
        <span className="pilula">IFR <b>{fmtNum(o.ifr, 0)}</b></span>
        <span className="pilula">volume 10/60 <b>{fmtNum(o.volSeca, 2)}</b></span>
        <span className="pilula">vs MM200 <b>{pct(o.mm200, 0)}</b></span>
      </div>
    </div>
  );
}

function CartaoAberta({ o, saida }) {
  let par = (r, v, cor) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={rotulo}>{r}</span>
      <span style={{ fontFamily: tema.mono, fontSize: 13, color: cor || tema.text }}>{v}</span>
    </div>
  );
  return (
    <div
      style={{
        background: tema.panelSoft,
        border: `1px solid ${tema.lineSoft}`,
        borderRadius: tema.raioP,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <b style={{ fontSize: 16, fontFamily: tema.mono }}>{o.ativo}</b>
        <span style={{ fontFamily: tema.mono, fontSize: 15, color: corDe(o.ret) }}>{pct(o.ret)}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: tema.dim, fontFamily: tema.mono }}>
          pregão {o.dias} de {saida.prazo}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: tema.mono, fontSize: 11.5 }}>
        <span style={{ color: tema.down }}>{reais(o.stopPreco)}</span>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <Trilho ret={o.ret} saida={saida} />
        </div>
        <span style={{ color: tema.up }}>{reais(o.alvoPreco)}</span>
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {par("Compra", `${fmtData(o.data)} · ${reais(o.entrada)}`)}
        {par("Agora", reais(o.preco))}
      </div>
    </div>
  );
}

export function AbaSwing({ ind }) {
  let [fund, setFund] = useState(null),
    [erro, setErro] = useState(null),
    [modo, setModo] = useState("padrao"),
    [todas, setTodas] = useState(false),
    [verRegra, setVerRegra] = useState(false),
    refGraf = useRef(null),
    [refLarg, largura] = useLargura();
  useEffect(() => {
    let vivo = true;
    buscarFundamentos()
      .then((f) => vivo && setFund(f))
      .catch((e) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, []);
  let saida = SAIDAS_SWING[modo],
    r = useMemo(
      () => (ind && fund ? calcularSwing(ind, fund, saida) : null),
      [ind, fund, saida],
    );

  if (erro)
    return (
      <div style={{ ...cartao, color: tema.down }}>
        Não consegui carregar os balanços da CVM ({erro}). A aba Swing precisa
        do arquivo public/fundamentos.json.
      </div>
    );
  if (!ind || !r)
    return (
      <div style={{ ...cartao, color: tema.dim }}>
        {ind ? "Carregando balanços da CVM…" : "Carregando a base…"}
      </div>
    );

  let n = ind.dates.length,
    hoje = r.operacoes.filter((o) => o.w === n - 1),
    abertas = r.operacoes.filter((o) => o.status === "aberta" && o.w < n - 1).reverse(),
    fechadas = r.resumo.fechadas,
    g = r.resumo.geral,
    lista = (todas ? fechadas : fechadas.slice(-15)).slice().reverse(),
    dadosGraf = fechadas.map((o) => ({
      label: `${fmtData(o.data)} ${o.ativo}`,
      Resultado: o.liq * 100,
    })),
    saidaTxt = `alvo +${saida.alvo * 100}% · stop −${saida.stop * 100}% · ${saida.prazo} pregões`;

  return (
    <div>
      <div style={cartao}>
        <div style={{ ...rotulo, color: tema.amber, letterSpacing: 2 }}>swing · segurar por dias</div>
        <h2 style={{ margin: "4px 0 6px", fontSize: 19, fontWeight: 650 }}>
          Demanda retraída em empresa lucrativa
        </h2>
        <div style={{ color: tema.dim, fontSize: 13, lineHeight: 1.6, maxWidth: 760 }}>
          O papel caiu, mas a venda perdeu força (o IFR não acompanhou o novo
          fundo), o volume secou e ele está abaixo da média de 200 — numa
          empresa que dá lucro. Compra no fechamento e segura até o alvo, o
          stop ou o fim do prazo.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          {Object.values(SAIDAS_SWING).map((s) => (
            <Chip key={s.id} active={modo === s.id} onClick={() => setModo(s.id)}>
              {s.rotulo}: +{s.alvo * 100}% / −{s.stop * 100}% / {s.prazo} pregões
            </Chip>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: tema.faint, fontFamily: tema.mono }}>
            cotações até {fmtData(r.ultimoDia)} · balanços CVM de {fund.gerado_em?.split("-").reverse().join("/")}
          </span>
        </div>
      </div>

      <div style={cartao}>
        <Titulo>Compre no fechamento de {fmtData(r.ultimoDia)}</Titulo>
        {hoje.length ? (
          <div className="grade-papeis" style={{ marginTop: 0 }}>
            {hoje.map((o) => (
              <CartaoSinal key={o.ativo} o={o} saida={saida} />
            ))}
          </div>
        ) : (
          <div style={{ color: tema.dim, fontSize: 13, lineHeight: 1.7 }}>
            Nenhum papel deu o sinal neste pregão. Dos {r.hoje.elegiveis} papéis
            líquidos com balanço na CVM, {r.hoje.lucrativas} dão lucro,{" "}
            {r.hoje.abaixoMM200} estão abaixo da média de 200,{" "}
            {r.hoje.volSeco} estão com volume secando e {r.hoje.div} com
            divergência de IFR.
          </div>
        )}
        <div style={{ fontSize: 11.5, color: tema.faint, marginTop: 10 }}>
          Se a cotação do dia ainda não fechou, o sinal pode mudar até o fim do pregão.
        </div>
      </div>

      <div style={cartao}>
        <Titulo>Em andamento</Titulo>
        {abertas.length === 0 ? (
          <div style={{ color: tema.dim, fontSize: 13 }}>Nenhuma operação aberta.</div>
        ) : (
          <div className="grade-papeis" style={{ marginTop: 0 }}>
            {abertas.map((o) => (
              <CartaoAberta key={o.ativo + o.w} o={o} saida={saida} />
            ))}
          </div>
        )}
      </div>

      <div style={cartao}>
        <Titulo>Radar · falta uma condição</Titulo>
        {r.radar.length === 0 ? (
          <div style={{ color: tema.dim, fontSize: 13 }}>
            Nenhuma empresa lucrativa a uma condição do sinal.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {["Papel", "Preço", "Divergência IFR", "Volume 10/60", "Vs MM200"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.radar.map((x) => {
                  let ok = (b) => ({ color: b ? tema.up : tema.faint });
                  return (
                    <tr key={x.ativo}>
                      <td style={{ ...td, fontFamily: tema.mono, fontWeight: 600 }}>{x.ativo}</td>
                      <td style={{ ...td, fontFamily: tema.mono }}>{reais(x.preco)}</td>
                      <td style={{ ...td, ...ok(x.div) }}>{x.div ? "✔ sim" : "· não"}</td>
                      <td style={{ ...td, fontFamily: tema.mono, ...ok(x.volSeco) }}>
                        {fmtNum(x.volSeca, 2)} {x.volSeco ? "✔" : `(precisa ≤ ${fmtNum(REGRA_SWING.volSeco, 2)})`}
                      </td>
                      <td style={{ ...td, fontFamily: tema.mono, ...ok(x.abaixoMM200) }}>
                        {pct(x.mm200, 0)} {x.abaixoMM200 ? "✔" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={cartao}>
        <Titulo
          extra={
            dadosGraf.length > 0 && (
              <BotaoImagem
                onClick={() =>
                  baixarGraficoPNG(refGraf.current, {
                    titulo: "Swing · resultado de cada operação",
                    subtitulo: `${saidaTxt} · líquido de taxa`,
                    series: [
                      { nome: "Ganho", cor: tema.up, haste: true },
                      { nome: "Perda", cor: tema.down, haste: true },
                    ],
                    arquivo: "swing_operacoes",
                  })
                }
              />
            )
          }
        >
          Histórico do sinal
        </Titulo>
        {!g ? (
          <div style={{ color: tema.dim, fontSize: 13 }}>Sem operação encerrada.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 14 }}>
              <Estatistica label="Operações">{g.n}</Estatistica>
              <Estatistica label="Média por operação" color={corDe(g.media)}>{pct(g.media, 2)}</Estatistica>
              <Estatistica label="Acerto">{fmtNum(g.acerto * 100, 0)}%</Estatistica>
              <Estatistica label="Saiu no alvo" color={tema.up}>{fmtNum(g.alvo * 100, 0)}%</Estatistica>
              <Estatistica label="Saiu no stop" color={tema.down}>{fmtNum(g.stop * 100, 0)}%</Estatistica>
              <Estatistica label="Venceu o prazo" color={tema.dim}>{fmtNum(g.prazo * 100, 0)}%</Estatistica>
              <Estatistica label="Duração média">{fmtNum(g.dias, 1)} pregões</Estatistica>
            </div>
            <div className="pilulas" style={{ marginBottom: 14 }}>
              {r.resumo.anos.map((a) => (
                <span key={a.ano} className="pilula">
                  {a.ano}{" "}
                  <b style={{ color: corDe(a.media) }}>{pct(a.media, 1)}</b> · {a.n} op. ·{" "}
                  {fmtNum(a.acerto * 100, 0)}% acerto
                </span>
              ))}
            </div>
            <div ref={refLarg}>
              <div ref={refGraf} style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dadosGraf}
                    margin={MARGEM}
                    {...GRAFICO_HASTES}
                    barSize={larguraHaste(largura, dadosGraf.length, 1)}
                  >
                    <CartesianGrid {...GRADE} />
                    <XAxis {...EIXO_X} dataKey="label" minTickGap={60} tickFormatter={(t) => t.split(" ")[0]} />
                    <YAxis {...EIXO_Y} tickFormatter={(v) => v.toFixed(0) + "%"} />
                    <Tooltip content={<TooltipGrafico casas={2} />} cursor={CURSOR_HASTES} />
                    <ReferenceLine y={0} stroke={tema.faint} strokeOpacity={0.6} />
                    <Bar dataKey="Resultado" shape={<Haste />} animationDuration={500}>
                      {dadosGraf.map((d, i) => (
                        <Cell key={i} fill={d.Resultado > 0 ? tema.up : tema.down} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {["Papel", "Compra", "Entrada", "Saída", "Pregões", "Resultado", ""].map((h, i) => (
                      <th key={i} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((o) => (
                    <tr key={o.ativo + o.w}>
                      <td style={{ ...td, fontFamily: tema.mono, fontWeight: 600 }}>{o.ativo}</td>
                      <td style={{ ...td, color: tema.dim }}>{fmtData(o.data)}</td>
                      <td style={{ ...td, fontFamily: tema.mono }}>{reais(o.entrada)}</td>
                      <td style={{ ...td, fontFamily: tema.mono }}>{reais(o.preco)}</td>
                      <td style={{ ...td, fontFamily: tema.mono, color: tema.dim }}>{o.dias}</td>
                      <td style={{ ...td, fontFamily: tema.mono, color: corDe(o.liq) }}>{pct(o.liq)}</td>
                      <td style={td}><Selo status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fechadas.length > 15 && (
              <button
                onClick={() => setTodas((v) => !v)}
                style={{ marginTop: 10, background: "none", border: "none", color: tema.amber, cursor: "pointer", fontSize: 12.5, padding: 0 }}
              >
                {todas ? "mostrar só as 15 últimas" : `mostrar as ${fechadas.length} operações`}
              </button>
            )}
          </>
        )}
      </div>

      <div style={cartao}>
        <Titulo
          extra={
            <button
              onClick={() => setVerRegra((v) => !v)}
              style={{ background: "none", border: "none", color: tema.amber, cursor: "pointer", fontSize: 12.5 }}
            >
              {verRegra ? "esconder" : "ver detalhes"}
            </button>
          }
        >
          Como o sinal funciona
        </Titulo>
        {verRegra && (
          <div style={{ color: tema.dim, fontSize: 13, lineHeight: 1.75, maxWidth: 820 }}>
            <b style={{ color: tema.text }}>Sinal</b> — todas as condições no fechamento do mesmo pregão:
            <ol style={{ margin: "6px 0 12px", paddingLeft: 20 }}>
              <li>Divergência altista de IFR(14): nos últimos 10 pregões o preço fez fundo abaixo do fundo dos 20 pregões anteriores, mas o fundo do IFR ficou pelo menos {REGRA_SWING.folgaIfr} pontos acima.</li>
              <li>Volume secando: volume médio de 10 pregões até {fmtNum(REGRA_SWING.volSeco, 2)} vez o de 60 pregões.</li>
              <li>Preço abaixo da média móvel de 200 pregões.</li>
              <li>Lucro líquido dos últimos 12 meses positivo, pelo último balanço entregue à CVM até o pregão anterior.</li>
              <li>Liquidez média de 20 pregões de pelo menos R$ {fmtNum(REGRA_SWING.liqMin / 1e6)} mi e preço de pelo menos R$ {fmtNum(REGRA_SWING.precoMin)}.</li>
            </ol>
            Depois de um sinal, o mesmo papel só volta a sinalizar {REGRA_SWING.espera} pregões depois.
            <br />
            <b style={{ color: tema.text }}>Saída</b> — o que vier primeiro: stop, alvo ou o último pregão do prazo (vende no fechamento). Se a abertura já passar do stop ou do alvo, a saída é na abertura. Se a mínima e a máxima do mesmo dia tocarem os dois, conta o stop. Resultados líquidos de taxa ({fmtNum(REGRA_SWING.taxa * 100, 3)}%).
            <br />
            <b style={{ color: tema.text }}>Estudo</b> — regra escolhida em 2023-24 e conferida em 2025-26, período que ela não tinha visto. Com +12% / −10% / 30 pregões: +2,1% e +4,2% por operação (acerto de 59% e 67%), contra −0,6% e +2,2% de um papel qualquer comprado no mesmo esquema. A amostra é pequena (cerca de 80 operações por período) e 2025-26 foi um mercado em alta.
            <br />
            <b style={{ color: tema.text }}>Por que o stop é largo</b> — no caminho, a queda típica foi de 4% a 6% antes de o papel subir; um stop de 7% derrubava muitas operações que terminariam no lucro.
            <br />
            <b style={{ color: tema.text }}>O que não entrou</b> — "balanço forte" (lucro do trimestre muito acima do ano anterior) perdeu quase toda a vantagem quando a compra passou a ser no pregão seguinte à entrega do balanço; combinações de P/L baixo com outros sinais técnicos não se repetiram em 2025-26.
            <br />
            <span style={{ color: tema.faint }}>
              Os balanços vêm dos dados abertos da CVM, atualizados toda terça e sexta. Bancos, seguradoras e units ficam de fora. Resultado passado não garante resultado futuro.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
