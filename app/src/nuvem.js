/* Dados compartilhados entre aparelhos: espelha o localStorage na função /.netlify/functions/dados e instala window.storage. */

const URL_DADOS = "/.netlify/functions/dados",
  CHAVES_SO_LOCAIS = [/^ovr3:g:/, /^ovr3:acomp_abertos$/, /^ovr3:colOrder$/],
  vaiParaNuvem = (e) =>
    typeof e == "string" &&
    e.startsWith("ovr3:") &&
    !CHAVES_SO_LOCAIS.some((t) => t.test(e)),
  K_ETAGS = "ovr3sync:etags",
  K_PENDENTES = "ovr3sync:pend",
  K_MIGRADO = "ovr3sync:migrado",
  K_CONFLITOS = "ovr3sync:conflitos",
  K_ULTIMA = "ovr3sync:ultima",
  K_BACKUP_ANTES_NUVEM = "ovr3bkp:antes-nuvem",
  CHAVES_LISTA = new Set([
    "ovr3:acomp_itens",
    "ovr3:acomp_grupos",
    "ovr3:bmidx",
    "ovr3:mm_quadros",
  ]),
  CHAVES_CONJUNTO = new Set([
    "ovr3:marcados",
    "ovr3:excluidos",
    "ovr3:estr_operar",
    "ovr3:ocultos",
  ]),
  CHAVES_MAPA = new Set([
    "ovr3:lotes",
    "ovr3:tipos_ir",
    "ovr3:ir_ajustes",
    "ovr3:config",
  ]);

function tipoDaChave(e) {
  return CHAVES_LISTA.has(e)
    ? "lista"
    : CHAVES_CONJUNTO.has(e)
      ? "conjunto"
      : CHAVES_MAPA.has(e)
        ? "mapa"
        : "valor";
}

export const DESCRICAO_CHAVES = {
    "ovr3:cesta_padrao": "cesta padrão (RESULTADOS)",
    "ovr3:cesta_vigencias": "vigências da cesta padrão (RESULTADOS)",
    "ovr3:tipos_ir": "tipo fiscal dos papéis (relatório de IR)",
    "ovr3:ir_ajustes":
      "ajustes do relatório de IR (custos, IRRF, prejuízo anterior)",
    "ovr3:carteira": "carteira (mês a mês / comparar)",
    "ovr3:vol_min": "piso de liquidez",
    "ovr3:encadear": "encadear tickers",
    "ovr3:config":
      "configurações (taxa, termômetro, papéis por estratégia, janela)",
    "ovr3:ocultos": "estratégias escondidas no COMPARAR e no MÊS A MÊS",
  },
  descreverChave = (e) =>
    DESCRICAO_CHAVES[e] ||
    (e.startsWith("ovr3:bm:")
      ? "série de benchmark importado"
      : e.replace(/^ovr3:/, "")),
  normalizarEtag = (e) =>
    String(e ?? "")
      .replace(/^W\//, "")
      .replace(/"/g, ""),
  mesmoJson = (e, t) => JSON.stringify(e) === JSON.stringify(t);

function lerJson(e) {
  if (e == null) return null;
  try {
    return JSON.parse(e);
  } catch {
    return;
  }
}

function mesclarValores(e, t, r, n) {
  if (r === n) return n;
  if (t === n) return r;
  if (t === r) return n;
  if (n == null) return r;
  if (r == null) return n;
  let a = tipoDaChave(e),
    o = lerJson(t),
    i = lerJson(r),
    s = lerJson(n);
  if (a === "lista" && Array.isArray(i) && Array.isArray(s)) {
    let l = (h) => h && typeof h == "object" && h.id != null,
      c = new Map((Array.isArray(o) ? o : []).filter(l).map((h) => [h.id, h])),
      u = new Map(i.filter(l).map((h) => [h.id, h])),
      f = [],
      p = new Set();
    for (let h of s) {
      if (!l(h)) {
        f.push(h);
        continue;
      }
      p.add(h.id);
      let g = u.get(h.id),
        m = c.get(h.id);
      if (g === undefined) {
        if (m !== undefined && mesmoJson(m, h)) continue;
        f.push(h);
      } else m !== undefined && mesmoJson(g, m) ? f.push(h) : f.push(g);
    }
    for (let h of i) {
      if (!l(h) || p.has(h.id)) continue;
      let g = c.get(h.id);
      (g !== undefined && mesmoJson(g, h)) || f.push(h);
    }
    return JSON.stringify(f);
  }
  if (a === "conjunto" && Array.isArray(i) && Array.isArray(s)) {
    let l = new Set(Array.isArray(o) ? o : []),
      c = new Set(i),
      u = new Set(s),
      f = s.filter((p) => c.has(p) || !l.has(p));
    for (let p of i) !u.has(p) && !l.has(p) && f.push(p);
    return JSON.stringify(f);
  }
  if (a === "mapa" && i && s && typeof i == "object" && typeof s == "object") {
    let l = o && typeof o == "object" ? o : {},
      c = {};
    for (let u of new Set([...Object.keys(s), ...Object.keys(i)])) {
      let f = u in i,
        p = u in s,
        h = u in l;
      f && p
        ? (c[u] = h && mesmoJson(i[u], l[u]) ? s[u] : i[u])
        : p
          ? (h && mesmoJson(s[u], l[u])) || (c[u] = s[u])
          : (h && mesmoJson(i[u], l[u])) || (c[u] = i[u]);
    }
    return JSON.stringify(c);
  }
  return r;
}

function criarNuvem({
  fetchFn: e = (...o) => fetch(...o),
  ls: t = typeof localStorage < "u" ? localStorage : null,
  url: r = URL_DADOS,
  tempoInicial: n = 20000,
  agora: a = () => new Date(),
} = {}) {
  let o = (I, C) => {
      try {
        let L = t.getItem(I);
        return L == null ? C : JSON.parse(L);
      } catch {
        return C;
      }
    },
    i = (I, C) => {
      try {
        t.setItem(I, JSON.stringify(C));
      } catch {}
    },
    s = (I, C) => {
      try {
        t.setItem(I, C);
      } catch {}
    },
    l = () => {
      let I = [];
      for (let C = 0; C < t.length; C++) {
        let L = t.key(C);
        vaiParaNuvem(L) && I.push(L);
      }
      return I;
    },
    c = o(K_ETAGS, {}),
    u = o(K_PENDENTES, {}),
    f = {},
    p = {},
    h = new Set(),
    g = {
      fase: "iniciando",
      erro: null,
      ultima: t.getItem(K_ULTIMA),
      alteradoFora: false,
      recarregar: false,
      conflitos: o(K_CONFLITOS, []),
      migrado: t.getItem(K_MIGRADO) === "1",
    },
    m = () => ({
      ...g,
      pendentes: Object.keys(u).length,
    }),
    x = () => {
      let I = m();
      h.forEach((C) => {
        try {
          C(I);
        } catch {}
      });
    },
    y = () => {
      (i(K_ETAGS, c), i(K_PENDENTES, u));
    },
    b = () => {
      ((g.ultima = a().toISOString()), s(K_ULTIMA, g.ultima), (g.erro = null));
    };
  async function S(I, C, L = "", B = 15000) {
    let W = typeof AbortController < "u" ? new AbortController() : null,
      J = W ? setTimeout(() => W.abort(), B) : null;
    try {
      let ie = await e(r + L, {
          method: I,
          headers: C
            ? {
                "Content-Type": "application/json",
              }
            : undefined,
          body: C ? JSON.stringify(C) : undefined,
          cache: "no-store",
          signal: W ? W.signal : undefined,
        }),
        ce = await ie.json().catch(() => ({}));
      return {
        status: ie.status,
        j: ce,
      };
    } finally {
      J && clearTimeout(J);
    }
  }
  async function T(I) {
    let C = u[I];
    if (!C) return;
    ((f[I] = C), (C.enviado = C.valor));
    let L = C.base,
      B = C.valor,
      W = false;
    try {
      for (let ie = 0; ie < 5 && !W; ie++) {
        let ce =
          B === null
            ? await S("DELETE", null, `?chave=${encodeURIComponent(I)}`)
            : await S("PUT", {
                chave: I,
                valor: B,
                etag: c[I] ?? null,
              });
        if (ce.status === 200)
          (B === null ? delete c[I] : (c[I] = ce.j.etag), (W = true));
        else if (ce.status === 409) {
          let X = ce.j.atual || null,
            se = X ? X.valor : null;
          X ? (c[I] = X.etag) : delete c[I];
          let ge = mesclarValores(I, L, B, se);
          (ge !== C.enviado && (g.recarregar = true),
            ge === se ? ((B = se), (W = true)) : ((L = se), (B = ge)));
        } else throw new Error(ce.j?.erro || `HTTP ${ce.status}`);
      }
      if (!W) throw new Error("conflito repetido na gravação");
      (!(u[I] && u[I] !== C) &&
        B !== C.enviado &&
        (B === null ? t.removeItem(I) : s(I, B)),
        u[I] === C ? delete u[I] : u[I] && (u[I].base = C.enviado));
    } finally {
      (delete f[I], delete C.enviado, y());
    }
  }
  let A = null,
    w = null;
  function _() {
    w ||
      (w = setTimeout(() => {
        ((w = null), E());
      }, 30000));
  }
  function E() {
    if (A) return A;
    let I = (async () => {
      await null;
      let C = true;
      try {
        for (;;) {
          let L = Object.keys(u).filter((B) => u[B] !== f[B]);
          if (!L.length) break;
          ((g.fase = "enviando"), x());
          for (let B of L) await T(B);
        }
        (b(), g.fase !== "iniciando" && (g.fase = "ok"));
      } catch (L) {
        ((C = false),
          (g.erro =
            L?.name === "AbortError"
              ? "sem resposta da nuvem"
              : L?.message || "falha de rede"),
          g.fase !== "iniciando" && (g.fase = "offline"),
          _());
      } finally {
        (A === I && (A = null), x());
      }
      return C;
    })();
    return ((A = I), I);
  }
  function P(I) {
    for (let [C, L] of Object.entries(I))
      !vaiParaNuvem(C) || u[C] || (s(C, L.valor), (c[C] = L.etag));
    if (g.migrado) {
      for (let C of l()) !(C in I) && !u[C] && (t.removeItem(C), delete c[C]);
      for (let C of Object.keys(c)) !(C in I) && !u[C] && delete c[C];
    }
    y();
  }
  function O() {
    for (let I of l()) p[I] = t.getItem(I);
  }
  async function R() {
    if (!g.migrado && t.getItem(K_BACKUP_ANTES_NUVEM) == null) {
      let W = {};
      for (let J of l()) W[J] = t.getItem(J);
      i(K_BACKUP_ANTES_NUVEM, {
        em: a().toISOString(),
        dados: W,
      });
    }
    let I = await S("GET", null, "", 12000);
    if (I.status !== 200 || !I.j || typeof I.j.dados != "object")
      throw new Error(I.j?.erro || `HTTP ${I.status}`);
    let C = I.j.dados;
    if (!g.migrado) {
      let W = new Set(g.conflitos);
      for (let J of l()) {
        if (u[J]) continue;
        let ie = t.getItem(J),
          ce = C[J];
        if (!ce) {
          u[J] = {
            valor: ie,
            base: null,
          };
          continue;
        }
        if (ce.valor === ie) continue;
        if (((c[J] = ce.etag), tipoDaChave(J) === "valor")) {
          W.add(J);
          continue;
        }
        let X = mesclarValores(J, null, ie, ce.valor);
        X !== ce.valor &&
          (u[J] = {
            valor: X,
            base: ce.valor,
          });
      }
      ((g.conflitos = Array.from(W)), i(K_CONFLITOS, g.conflitos), y());
    }
    (await E()) && !g.migrado && ((g.migrado = true), s(K_MIGRADO, "1"));
    let B = await S("GET", null, "", 12000);
    (B.status === 200 && B.j && typeof B.j.dados == "object" && (C = B.j.dados),
      P(C),
      b(),
      (g.fase = Object.keys(u).length ? "offline" : "ok"));
  }
  let M = null;
  function H() {
    if (M) return M;
    let I = false;
    return (
      (M = new Promise((C) => {
        let L = () => {
            I || ((I = true), O(), x(), C());
          },
          B = setTimeout(() => {
            ((g.fase = "offline"),
              (g.erro = "nuvem demorando a responder"),
              L());
          }, n);
        R()
          .catch((W) => {
            ((g.fase = "offline"),
              (g.erro =
                W?.name === "AbortError"
                  ? "sem resposta da nuvem"
                  : W?.message || "falha de rede"),
              _());
          })
          .finally(() => {
            if ((clearTimeout(B), I)) {
              for (let W of l()) p[W] !== t.getItem(W) && (g.recarregar = true);
              x();
            }
            L();
          });
      })),
      M
    );
  }
  function Y(I, C) {
    let L = C === null ? null : String(C);
    if ((L === null ? t.removeItem(I) : s(I, L), !u[I] && p[I] === L)) return;
    let B = f[I],
      W = u[I];
    (W && W !== B
      ? (W.valor = L)
      : (u[I] = {
          valor: L,
          base: B ? B.base : (p[I] ?? null),
        }),
      (p[I] = L),
      y(),
      x(),
      g.fase !== "iniciando" && E());
  }
  async function G() {
    if (Object.keys(u).length) {
      E();
      return;
    }
    try {
      let I = await S("GET", null, "?meta=1", 10000);
      if (I.status !== 200 || !I.j?.meta) throw new Error(`HTTP ${I.status}`);
      let C = I.j.meta,
        L = false;
      for (let [B, W] of Object.entries(C))
        !vaiParaNuvem(B) ||
          u[B] ||
          f[B] ||
          (normalizarEtag(c[B]) !== normalizarEtag(W) && (L = true));
      for (let B of Object.keys(c)) !(B in C) && !u[B] && !f[B] && (L = true);
      (L && (g.alteradoFora = true),
        g.fase === "offline" && (g.fase = "ok"),
        b());
    } catch (I) {
      ((g.fase = "offline"),
        (g.erro =
          I?.name === "AbortError"
            ? "sem resposta da nuvem"
            : I?.message || "falha de rede"));
    }
    x();
  }
  async function k(I) {
    for (let [C, L] of Object.entries(I)) {
      if (!vaiParaNuvem(C) || L == null) continue;
      let B = t.getItem(C);
      B !== L &&
        (s(C, L),
        (u[C] = {
          valor: String(L),
          base: B,
        }),
        (p[C] = String(L)));
    }
    return (y(), E());
  }
  async function F() {
    let I = o(K_BACKUP_ANTES_NUVEM, null),
      C = {};
    for (let B of g.conflitos) I?.dados?.[B] != null && (C[B] = I.dados[B]);
    let L = await k(C);
    return (L && ((g.conflitos = []), i(K_CONFLITOS, [])), x(), L);
  }
  function q() {
    ((g.conflitos = []), i(K_CONFLITOS, []), x());
  }
  function N() {
    let I = {};
    for (let C = 0; C < t.length; C++) {
      let L = t.key(C);
      L &&
        L.startsWith("ovr3:") &&
        !L.startsWith("ovr3:g:") &&
        (I[L] = t.getItem(L));
    }
    return {
      app: "leilao-overnight",
      versao: 30,
      em: a().toISOString(),
      dados: I,
      antesDaNuvem: o(K_BACKUP_ANTES_NUVEM, null),
    };
  }
  async function j(I) {
    let C = I?.dados;
    if (!C || typeof C != "object")
      throw new Error('arquivo sem o campo "dados"');
    let L = await k(C);
    for (let [B, W] of Object.entries(C))
      !vaiParaNuvem(B) &&
        B.startsWith("ovr3:") &&
        !B.startsWith("ovr3:g:") &&
        s(B, W);
    return L;
  }
  return {
    iniciar: H,
    gravar: Y,
    verificar: G,
    descarregar: E,
    estado: m,
    usarDesteAparelho: F,
    descartarConflitos: q,
    montarBackup: N,
    restaurar: j,
    assinar(I) {
      return (h.add(I), I(m()), () => h.delete(I));
    },
    _interno: {
      pend: () => u,
      etags: () => c,
      visao: p,
    },
  };
}

if (typeof window < "u" && !window.storage) {
  let e = criarNuvem();
  window.__nuvem = e;
  let t = e.iniciar(),
    r = (a) => vaiParaNuvem(a);
  window.storage = {
    async get(a) {
      r(a) && (await t);
      let o = localStorage.getItem(a);
      if (o === null) throw new Error("chave ausente");
      return {
        key: a,
        value: o,
      };
    },
    async set(a, o) {
      return (
        r(a)
          ? (await t, e.gravar(a, String(o)))
          : localStorage.setItem(a, String(o)),
        {
          key: a,
          value: o,
        }
      );
    },
    async delete(a) {
      return (
        r(a) ? (await t, e.gravar(a, null)) : localStorage.removeItem(a),
        {
          key: a,
          deleted: true,
        }
      );
    },
    async list(a = "") {
      a.startsWith("ovr3:g:") || (await t);
      let o = [];
      for (let i = 0; i < localStorage.length; i++) {
        let s = localStorage.key(i);
        s && s.startsWith(a) && o.push(s);
      }
      return {
        keys: o,
        prefix: a,
      };
    },
  };
  let n = () => {
    document.visibilityState === "visible" && e.verificar();
  };
  t.then(() => {
    (document.addEventListener("visibilitychange", n),
      window.addEventListener("online", () => e.descarregar()),
      setInterval(n, 180000));
  });
}
