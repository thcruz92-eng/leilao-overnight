/**
 * DADOS COMPARTILHADOS DO APP (v30)
 * ============================================================
 * Até o v29 tudo que você lançava (grupos do RESULTADOS, itens,
 * cesta padrão, carteira, benchmarks...) ficava no localStorage
 * do NAVEGADOR. Cada aparelho tinha a sua cópia e um não via o
 * outro. Esta função guarda esses dados no Netlify Blobs (incluso
 * no plano gratuito) e todos os aparelhos leem e gravam no mesmo
 * lugar.
 *
 * Ambiente único: qualquer pessoa que abrir o app vê e altera os
 * mesmos dados. Não há login.
 *
 * Rotas (todas em /.netlify/functions/dados):
 *   GET            -> { dados: { chave: { valor, etag, em } } }
 *   GET ?meta=1    -> { meta:  { chave: etag } }   (leve, para checar mudança)
 *   PUT  {chave, valor, etag}
 *        etag = null   -> só grava se a chave ainda NÃO existir
 *        etag = "..."  -> só grava se ninguém mudou desde aquele etag
 *        200 { ok, etag }  |  409 { conflito, atual: {valor, etag} | null }
 *   DELETE ?chave=...
 *
 * O 409 é o que impede um aparelho desatualizado de apagar o que
 * outro aparelho gravou: o app recebe a versão atual, combina as
 * duas e grava de novo.
 */
import { getStore } from "@netlify/blobs";

const LOJA = "leilao-overnight-dados";
const CHAVE_OK = /^ovr3:[A-Za-z0-9_:.\-]{1,200}$/;
const TETO_BYTES = 4 * 1024 * 1024;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/* etag chega com ou sem aspas/W/ dependendo da rota do Blobs */
const normEtag = (e) => String(e ?? "").replace(/^W\//, "").replace(/"/g, "");

async function lerUm(loja, chave) {
  const r = await loja.getWithMetadata(chave, { type: "text" });
  if (!r) return null;
  return { valor: r.data, etag: r.etag, em: r.metadata?.em ?? null };
}

export default async (req) => {
  const url = new URL(req.url);
  try {
    const loja = getStore({ name: LOJA, consistency: "strong" });
    if (req.method === "GET") {
      const { blobs } = await loja.list();
      if (url.searchParams.get("meta") === "1") {
        return json({ meta: Object.fromEntries(blobs.map((b) => [b.key, normEtag(b.etag)])) });
      }
      const dados = {};
      await Promise.all(blobs.map(async (b) => {
        const r = await lerUm(loja, b.key);
        if (r) dados[b.key] = r;
      }));
      return json({ dados });
    }

    if (req.method === "PUT") {
      const corpo = await req.json().catch(() => null);
      const chave = corpo?.chave;
      const valor = corpo?.valor;
      if (typeof chave !== "string" || !CHAVE_OK.test(chave)) return json({ erro: "chave inválida" }, 400);
      if (typeof valor !== "string") return json({ erro: "valor precisa ser texto" }, 400);
      if (valor.length > TETO_BYTES) return json({ erro: "valor grande demais" }, 413);

      const etag = corpo.etag;
      const opcoes = { metadata: { em: new Date().toISOString() } };
      if (etag === null || etag === undefined) opcoes.onlyIfNew = true;
      else opcoes.onlyIfMatch = String(etag);

      let r = await loja.set(chave, valor, opcoes);
      if (!r.modified) {
        const atual = await lerUm(loja, chave);
        /* Proteção contra diferença de formato do etag: se o que está lá é
           exatamente a versão que o aparelho diz conhecer, a gravação é
           legítima — grava sem condição. */
        if (atual && etag != null && normEtag(atual.etag) === normEtag(etag)) {
          r = await loja.set(chave, valor, { metadata: opcoes.metadata });
        } else {
          return json({ conflito: true, atual }, 409);
        }
      }
      let novoEtag = r.etag;
      if (!novoEtag) novoEtag = (await loja.getMetadata(chave))?.etag ?? "";
      return json({ ok: true, etag: novoEtag });
    }

    if (req.method === "DELETE") {
      const chave = url.searchParams.get("chave") || "";
      if (!CHAVE_OK.test(chave)) return json({ erro: "chave inválida" }, 400);
      await loja.delete(chave);
      return json({ ok: true });
    }

    return json({ erro: "método não suportado" }, 405);
  } catch (e) {
    return json({ erro: e?.message || "falha no armazenamento" }, 500);
  }
};
