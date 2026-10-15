"""
RESUMO DE FUNDAMENTOS PARA O APP
============================================================
Lê dados/cvm/fundamentos.json (gerado por coleta_cvm.py) e grava
public/fundamentos.json, pequeno o bastante para o app baixar.

Para cada ticker, uma lista de eventos em ordem de entrega à CVM:
  [entrega, lucro12m, receita12m, patrimonio, acoes, lucroTriAA]
  - lucro12m / receita12m: soma dos últimos 4 trimestres (o 4º tri é o
    ano inteiro da DFP menos os 9 meses do ITR de setembro)
  - lucroTriAA: lucro do trimestre contra o mesmo trimestre do ano anterior
O app só usa um evento a partir do pregão SEGUINTE à entrega (os balanços
saem, em geral, depois do fechamento).

Ficam de fora units/ETFs (final 11) e bancos/seguradoras, cujo plano de
contas não traz patrimônio, dívida e lucro nos códigos padrão.
"""
import json, re, statistics
from datetime import date

ENTRADA = "dados/cvm/fundamentos.json"
BASE = "public/base_b3.json"
SAIDA = "public/fundamentos.json"
FIN = re.compile(r"\bBCO\b|BANCO|BANRISUL|ITAU UNIBANCO|BRADESCO|SANTANDER|SEGUR|IRB|PORTO SEGURO|BANESTES|BRB|PAN S\.A|ABC BRASIL|MERCANTIL")


def trimestres(emp):
    """valores de cada trimestre fiscal com a data em que ficaram públicos"""
    q, ytd = {}, {}
    for doc in emp["docs"]:
        if not doc.get("entrega") or "dre" not in doc:
            continue
        for per, vals in doc["dre"].items():
            ini, fim = per.split(":")
            if not ini or not fim:
                continue
            ano, mfim, mini = int(fim[:4]), int(fim[5:7]), int(ini[5:7])
            tri = (mfim - 1) // 3 + 1
            if mfim - mini + 1 == 3:
                k = (ano, tri)
                if k not in q or doc["entrega"] < q[k]["entrega"]:
                    q[k] = dict(vals, entrega=doc["entrega"])
            if mini == 1:
                ytd.setdefault((ano, tri), (vals, doc["entrega"]))
    for (ano, tri), (vals, ent) in ytd.items():
        if tri == 4 and (ano, 3) in ytd and (ano, 4) not in q:
            v9 = ytd[(ano, 3)][0]
            q[(ano, 4)] = {k: vals[k] - v9[k] for k in vals if k in v9 and vals[k] is not None and v9[k] is not None}
            q[(ano, 4)]["entrega"] = ent
    return q


def soma(q, chaves, campo):
    vs = [q[k].get(campo) for k in chaves]
    return sum(vs) if len(chaves) == 4 and all(v is not None for v in vs) else None


def main():
    emp = json.load(open(ENTRADA, encoding="utf-8"))["empresas"]
    base = json.load(open(BASE, encoding="utf-8"))
    ix = {c: i for i, c in enumerate(base.get("campos") or ["iso", "abertura", "maxima", "minima", "fechamento", "volume", "quantidade"])}
    preco_mediano = {t: statistics.median([l[ix["fechamento"]] for l in ls if l[ix["fechamento"]]]) for t, ls in base["dados"].items() if ls}
    saida = {}
    for e in emp.values():
        if FIN.search(e.get("nome") or ""):
            continue
        q = trimestres(e)
        if len(q) < 5:
            continue
        chaves = sorted(q)
        bal = sorted([d for d in e["docs"] if d.get("entrega") and d.get("patrimonio") is not None], key=lambda d: d["entrega"])
        if not bal:
            continue
        # eventos de resultado (lucro/receita 12m e lucro do trimestre contra o ano anterior)
        ev = {}
        for k in chaves:
            ult4 = [x for x in chaves if x <= k][-4:]
            ent = max(q[x]["entrega"] for x in ult4)
            k0 = q.get((k[0] - 1, k[1]), {})
            ll, ll0 = q[k].get("lucroLiquido"), k0.get("lucroLiquido")
            g = (ll - ll0) / abs(ll0) if ll is not None and ll0 else None
            ev[ent] = dict(ll=soma(q, ult4, "lucroLiquido"), rec=soma(q, ult4, "receita"), g=g)
        # eventos de balanço (patrimônio e quantidade de ações)
        evb = {}
        acoes = None
        for d in bal:
            a = (d.get("QT_ACAO_TOTAL_CAP_INTEGR") or 0) - (d.get("QT_ACAO_TOTAL_TESOURO") or 0)
            acoes = a if a > 0 else acoes
            evb[d["entrega"]] = dict(pl=d["patrimonio"], acoes=acoes)
        datas = sorted(set(ev) | set(evb))
        linhas, cur, curb = [], {}, {}
        for dt in datas:
            cur = ev.get(dt, cur); curb = evb.get(dt, curb)
            linhas.append([dt, cur.get("ll"), cur.get("rec"), curb.get("pl"), curb.get("acoes"), None if cur.get("g") is None else round(cur["g"], 4)])
        for t in e["tickers"]:
            if t.endswith("11") or t not in preco_mediano:
                continue
            # algumas companhias informam a quantidade de ações em milhares
            pvps = [preco_mediano[t] * l[4] / l[3] for l in linhas if l[3] and l[3] > 0 and l[4]]
            esc = 1000 if pvps and statistics.median(pvps) < 0.03 else 1
            saida[t] = [[l[0], l[1], l[2], l[3], None if l[4] is None else l[4] * esc, l[5]] for l in linhas]
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump({"gerado_em": date.today().isoformat(), "campos": ["entrega", "lucro12m", "receita12m", "patrimonio", "acoes", "lucroTriAA"], "tickers": saida}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"OK: {len(saida)} tickers → {SAIDA}")


if __name__ == "__main__":
    main()
