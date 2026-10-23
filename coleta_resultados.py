"""
CALENDÁRIO DE RESULTADOS (balanços trimestrais)
============================================================
Gera public/resultados.json, que o app usa para NÃO ENTRAR num papel
quando o balanço sai dentro da noite (depois do fechamento da compra ou
antes da abertura da venda).

Duas fontes, nesta ordem de prioridade:
  1. dados/resultados_pesquisa.json — datas pesquisadas e conferidas
     (comunicados das empresas e calendários publicados), com o horário
     ("antes" da abertura, "apos" o fechamento, "durante" o pregão, "?").
  2. Yahoo Finance (earningsTimestamp) para os papéis da base que não
     estão na pesquisa. É estimativa: entra marcada como tal, e sem
     horário confiável vira "?" (o app bloqueia os dois lados).

Uso:  python coleta_resultados.py
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import date, datetime, timedelta, timezone

PESQUISA = "dados/resultados_pesquisa.json"
BASE = "public/base_b3.json"
SAIDA = "public/resultados.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
BRT = timezone(timedelta(hours=-3))
JANELA = (-7, 75)  # dias em volta de hoje que entram no arquivo


def http(url, cookie=None):
    h = {"User-Agent": UA, "Accept": "*/*"}
    if cookie:
        h["Cookie"] = cookie
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read(), r.headers


def credenciais_yahoo():
    try:
        hdrs = urllib.request.urlopen(urllib.request.Request("https://fc.yahoo.com", headers={"User-Agent": UA}), timeout=30).headers
    except urllib.error.HTTPError as e:  # fc.yahoo.com costuma responder 404, mas com o cookie
        hdrs = e.headers
    cookie = "; ".join(c.split(";")[0] for c in hdrs.get_all("Set-Cookie") or [])
    if not cookie:
        raise RuntimeError("Yahoo não devolveu cookie")
    crumb, _ = http("https://query1.finance.yahoo.com/v1/test/getcrumb", cookie)
    crumb = crumb.decode().strip()
    if not crumb or "<" in crumb:
        raise RuntimeError("crumb inválido")
    return cookie, crumb


def quando_do_horario(ts):  # guardado para quando houver fonte com horário confiável
    """horário de Brasília → antes / durante / apos; meia-noite = sem horário"""
    t = datetime.fromtimestamp(ts, BRT)
    m = t.hour * 60 + t.minute
    if m == 0:
        return "?"
    if m < 10 * 60:
        return "antes"
    if m >= 16 * 60 + 30:
        return "apos"
    return "durante"


def yahoo(tickers):
    out = {}
    try:
        cookie, crumb = credenciais_yahoo()
    except Exception as e:
        print("!! Yahoo indisponível:", e, flush=True)
        return out
    campos = "earningsTimestamp,earningsTimestampStart,earningsTimestampEnd,isEarningsDateEstimate"
    for i in range(0, len(tickers), 40):
        lote = tickers[i : i + 40]
        q = urllib.parse.urlencode({"symbols": ",".join(t + ".SA" for t in lote), "fields": campos, "crumb": crumb})
        try:
            corpo, _ = http(f"https://query1.finance.yahoo.com/v7/finance/quote?{q}", cookie)
            for r in json.loads(corpo)["quoteResponse"]["result"]:
                ts = r.get("earningsTimestamp") or r.get("earningsTimestampStart")
                if not ts:
                    continue
                est = bool(r.get("isEarningsDateEstimate")) or (
                    r.get("earningsTimestampStart") and r.get("earningsTimestampEnd")
                    and r["earningsTimestampStart"] != r["earningsTimestampEnd"]
                )
                # o horário do Yahoo para a B3 não é confiável (marca 'após o
                # fechamento' até para quem divulga antes da abertura): fica
                # sem horário, e o app bloqueia os dois lados da noite
                out[r["symbol"].replace(".SA", "")] = {
                    "data": datetime.fromtimestamp(ts, BRT).date().isoformat(),
                    "quando": "?",
                    "confianca": "estimada" if est else "yahoo",
                    "fonte": "Yahoo Finance",
                }
        except Exception as e:
            print(f"!! lote {i // 40}: {e}", flush=True)
        time.sleep(1)
    return out


def main():
    hoje = date.today()
    ini, fim = hoje + timedelta(days=JANELA[0]), hoje + timedelta(days=JANELA[1])
    dentro = lambda d: d and ini.isoformat() <= d <= fim.isoformat()
    pesquisa = json.load(open(PESQUISA, encoding="utf-8")) if os.path.exists(PESQUISA) else {"eventos": []}
    eventos = [e for e in pesquisa.get("eventos", []) if e.get("ticker") and dentro(e.get("data"))]
    pesquisados = {e["ticker"] for e in pesquisa.get("eventos", [])}
    base = json.load(open(BASE, encoding="utf-8"))
    tickers = sorted(t for t in base["dados"] if not t.endswith(("11B", "34", "39")) and t not in pesquisados)
    yh = yahoo(tickers)
    n_yahoo = 0
    for t, e in sorted(yh.items()):
        if dentro(e["data"]):
            eventos.append({"ticker": t, **e})
            n_yahoo += 1
    eventos.sort(key=lambda e: (e["data"], e["ticker"]))
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(
            {
                "gerado_em": hoje.isoformat(),
                "temporada": pesquisa.get("temporada"),
                "fontes": ["pesquisa conferida (dados/resultados_pesquisa.json)", "Yahoo Finance (estimativa) para o resto"],
                "eventos": eventos,
            },
            f,
            ensure_ascii=False,
            indent=0,
        )
    print(f"OK: {len(eventos)} eventos ({len(eventos) - n_yahoo} da pesquisa, {n_yahoo} do Yahoo) → {SAIDA}", flush=True)
    if not eventos:
        sys.exit("calendário vazio")


if __name__ == "__main__":
    main()
