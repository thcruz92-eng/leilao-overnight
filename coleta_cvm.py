"""
COLETA DE FUNDAMENTOS — CVM (dados abertos)
============================================================
Baixa os balanços trimestrais (ITR) e anuais (DFP) das companhias
abertas e o cadastro de tickers (FCA), e grava um resumo compacto em
dados/cvm/fundamentos.json.

Para cada balanço guarda a DATA DE ENTREGA à CVM (DT_RECEB). É ela que
diz quando o número ficou público: uma análise histórica só pode usar
um balanço a partir dessa data, nunca a partir da data de referência.

Uso:  python coleta_cvm.py                 (anos padrão)
      python coleta_cvm.py --de 2020 --ate 2026
"""
import argparse, csv, io, json, os, sys, urllib.request, zipfile
from datetime import date

BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC"
SAIDA = "dados/cvm/fundamentos.json"

# contas usadas (plano de contas padrão da CVM; bancos e seguradoras usam
# outros códigos e ficam com parte dos campos vazia)
CONTAS = {
    "BPA": {"1": "ativoTotal", "1.01.01": "caixa", "1.01.02": "aplicacoes"},
    "BPP": {"2.01.04": "dividaCP", "2.02.01": "dividaLP", "2.03": "patrimonio"},
    "DRE": {"3.01": "receita", "3.03": "lucroBruto", "3.05": "ebit", "3.11": "lucroLiquido"},
}


def baixar(url):
    print("baixando", url, flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "leilao-overnight/coleta-cvm"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def ler_csv(z, nome):
    with z.open(nome) as f:
        txt = io.TextIOWrapper(f, encoding="latin-1", newline="")
        yield from csv.DictReader(txt, delimiter=";")


def num(v):
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def processar_doc(tipo, ano, empresas):
    """tipo = 'ITR' ou 'DFP'"""
    url = f"{BASE}/{tipo}/DADOS/{tipo.lower()}_cia_aberta_{ano}.zip"
    try:
        z = zipfile.ZipFile(io.BytesIO(baixar(url)))
    except Exception as e:
        print(f"  !! {tipo} {ano}: {e}", flush=True)
        return
    nomes = z.namelist()
    print(f"  {len(nomes)} arquivos: {', '.join(sorted(nomes))[:400]}", flush=True)
    pref = f"{tipo.lower()}_cia_aberta"
    # índice: data de entrega de cada versão
    entrega = {}
    idx = f"{pref}_{ano}.csv"
    if idx in nomes:
        for r in ler_csv(z, idx):
            entrega[(r["CNPJ_CIA"], r["DT_REFER"], r["VERSAO"])] = r.get("DT_RECEB")
    # demonstrações consolidadas (se a empresa não tiver, cai na individual)
    for dem, contas in CONTAS.items():
        for escopo in ("con", "ind"):
            arq = f"{pref}_{dem}_{escopo}_{ano}.csv"
            if arq not in nomes:
                continue
            for r in ler_csv(z, arq):
                if r.get("ORDEM_EXERC", "").startswith("PEN"):
                    continue  # só o exercício corrente
                campo = contas.get(r["CD_CONTA"])
                if not campo:
                    continue
                cnpj, ref, ver = r["CNPJ_CIA"], r["DT_REFER"], r["VERSAO"]
                emp = empresas.setdefault(cnpj, {"nome": r.get("DENOM_CIA"), "cvm": r.get("CD_CVM"), "docs": {}})
                chave = f"{tipo}|{ref}|{ver}"
                doc = emp["docs"].setdefault(chave, {"tipo": tipo, "ref": ref, "versao": int(ver or 1), "entrega": entrega.get((cnpj, ref, ver)), "con": escopo == "con"})
                if doc.get("con") and escopo == "ind":
                    continue  # já tem o consolidado
                escala = 1000.0 if r.get("ESCALA_MOEDA", "").upper().startswith("MIL") else 1.0
                v = num(r.get("VL_CONTA"))
                if v is None:
                    continue
                if dem == "DRE":
                    # ITR traz o trimestre e o acumulado do ano; guarda os dois pelo período
                    per = f"{r.get('DT_INI_EXERC')}:{r.get('DT_FIM_EXERC')}"
                    doc.setdefault("dre", {}).setdefault(per, {})[campo] = v * escala
                else:
                    doc[campo] = v * escala
    # composição do capital (quantidade de ações)
    for arq in nomes:
        if "composicao_capital" in arq:
            for r in ler_csv(z, arq):
                cnpj, ref, ver = r["CNPJ_CIA"], r["DT_REFER"], r["VERSAO"]
                emp = empresas.setdefault(cnpj, {"nome": r.get("DENOM_CIA"), "cvm": r.get("CD_CVM"), "docs": {}})
                doc = emp["docs"].setdefault(f"{tipo}|{ref}|{ver}", {"tipo": tipo, "ref": ref, "versao": int(ver or 1), "entrega": entrega.get((cnpj, ref, ver))})
                for k, v in r.items():
                    if k.startswith("QT_ACAO"):
                        doc[k] = num(v)


def processar_tickers(ano, tickers):
    url = f"{BASE}/FCA/DADOS/fca_cia_aberta_{ano}.zip"
    try:
        z = zipfile.ZipFile(io.BytesIO(baixar(url)))
    except Exception as e:
        print(f"  !! FCA {ano}: {e}", flush=True)
        return
    for arq in z.namelist():
        if "valor_mobiliario" in arq:
            for r in ler_csv(z, arq):
                cod = (r.get("Codigo_Negociacao") or "").strip().upper()
                if cod:
                    tickers.setdefault(r["CNPJ_Companhia"], set()).add(cod)


def main():
    ap = argparse.ArgumentParser()
    hoje = date.today().year
    ap.add_argument("--de", type=int, default=2020)
    ap.add_argument("--ate", type=int, default=hoje)
    a = ap.parse_args()
    empresas, tickers = {}, {}
    for ano in range(a.de, a.ate + 1):
        processar_doc("ITR", ano, empresas)
        processar_doc("DFP", ano, empresas)
    for ano in range(max(a.de, a.ate - 3), a.ate + 1):
        processar_tickers(ano, tickers)
    for cnpj, emp in empresas.items():
        emp["tickers"] = sorted(tickers.get(cnpj, []))
        emp["docs"] = sorted(emp["docs"].values(), key=lambda d: (d["ref"], d["tipo"], d["versao"]))
    com_ticker = {k: v for k, v in empresas.items() if v["tickers"]}
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump({"gerado_em": date.today().isoformat(), "fonte": BASE, "empresas": com_ticker}, f, ensure_ascii=False, separators=(",", ":"))
    docs = sum(len(v["docs"]) for v in com_ticker.values())
    print(f"OK: {len(com_ticker)} empresas com ticker, {docs} documentos → {SAIDA}", flush=True)
    if not com_ticker:
        sys.exit("nenhuma empresa coletada")


if __name__ == "__main__":
    main()
