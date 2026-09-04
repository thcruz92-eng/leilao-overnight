# -*- coding: utf-8 -*-
"""
COLETA COTAHIST — B3
====================================================================
Baixa o arquivo oficial de cotações históricas da B3, faz o parse do
layout de posição fixa (245 bytes por registro) e mantém a base
consolidada em public/base_b3.json (lida pelo app).

REGRA DEFINIDA: o COTAHIST é a fonte de verdade. Todo dado histórico
que ele traz SOBRESCREVE o que já estiver na base.

Modos de uso:
    python coleta_cotahist.py                 # últimos dias úteis (hoje incluído)
    python coleta_cotahist.py --data 25/08/2026
    python coleta_cotahist.py --ano 2026      # ano inteiro (carga inicial)
    python coleta_cotahist.py --ano 2024 --ano 2025 --ano 2026

Ajustes finos:
    --anos-manter 4     descarta pregões mais antigos que isso
    --vol-min 1         volume financeiro mediano mínimo, em R$ milhões,
                        para o ativo entrar na base publicada
"""

import argparse
import io
import json
import os
import ssl
import sys
import time
import zipfile
from datetime import date, datetime, timedelta
from statistics import median
from zoneinfo import ZoneInfo

import urllib.request

BASE_URL = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist"
DIR_SAIDA = "public"
JSON_OUT = os.path.join(DIR_SAIDA, "base_b3.json")
CSV_OUT = os.path.join(DIR_SAIDA, "base_b3.csv")

# CODBDI: 02 = lote padrão | 12 = fundos imobiliários
# TPMERC: 010 = mercado à vista
CODBDI_ACEITOS = {"02", "12"}
TPMERC_ACEITOS = {"010"}


# ------------------------------------------------------------------
# Parse do layout de posição fixa (registro tipo 01, 245 bytes)
# ------------------------------------------------------------------
def _num(linha, ini, fim, decimais=2):
    """Campos numéricos vêm sem separador decimal: 0000000001234 = 12,34"""
    bruto = linha[ini - 1:fim].strip()
    if not bruto:
        return 0.0
    try:
        return int(bruto) / (10 ** decimais)
    except ValueError:
        return 0.0


def parse_cotahist(conteudo: bytes):
    registros = []
    for linha_bytes in conteudo.split(b"\n"):
        if len(linha_bytes) < 245:
            continue
        linha = linha_bytes.decode("latin-1")

        if linha[0:2] != "01":                  # ignora header (00) e trailer (99)
            continue
        if linha[10:12] not in CODBDI_ACEITOS:
            continue
        if linha[24:27] not in TPMERC_ACEITOS:
            continue

        ticker = linha[12:24].strip()
        if not ticker:
            continue

        fechamento = _num(linha, 109, 121)      # PREULT
        if fechamento <= 0:                     # papel sem negócio no dia
            continue

        d = linha[2:10]                         # AAAAMMDD
        registros.append({
            "ativo": ticker,
            "iso": f"{d[0:4]}-{d[4:6]}-{d[6:8]}",
            "abertura": _num(linha, 57, 69),    # PREABE
            "maxima": _num(linha, 70, 82),      # PREMAX
            "minima": _num(linha, 83, 95),      # PREMIN
            "fechamento": fechamento,
            # VOLTOT = volume FINANCEIRO em R$ (16 int + 2 dec)
            "volume": _num(linha, 171, 188),
            # QUATOT = quantidade de papéis negociados (inteiro)
            "quantidade": int(linha[152:170].strip() or 0),
        })
    return registros


# ------------------------------------------------------------------
# Download
# ------------------------------------------------------------------
def _baixar(url: str) -> bytes:
    ctx = ssl.create_default_context()
    # A cadeia SSL da B3 às vezes falha em runners Linux
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=300) as r:
        return r.read()


def _extrair_txt(dados_zip: bytes) -> bytes:
    with zipfile.ZipFile(io.BytesIO(dados_zip)) as z:
        return z.read(z.namelist()[0])


def buscar_dia(d: date, tentativas: int = 3):
    """Uma queda momentânea da B3 não pode custar o pregão inteiro: antes,
    uma única falha de rede no dia que importa era definitiva para aquela
    execução."""
    url = f"{BASE_URL}/COTAHIST_D{d.strftime('%d%m%Y')}.ZIP"
    print(f"  -> {url}")
    ultimo_erro = None
    for i in range(tentativas):
        try:
            return parse_cotahist(_extrair_txt(_baixar(url)))
        except Exception as e:
            ultimo_erro = e
            if i < tentativas - 1:
                espera = 5 * (i + 1)
                print(f"     tentativa {i + 1} falhou ({e}); repetindo em {espera}s",
                      file=sys.stderr)
                time.sleep(espera)
    raise ultimo_erro


def buscar_ano(ano: int):
    url = f"{BASE_URL}/COTAHIST_A{ano}.ZIP"
    print(f"  -> {url}")
    return parse_cotahist(_extrair_txt(_baixar(url)))


# ------------------------------------------------------------------
# Base consolidada
# ------------------------------------------------------------------
CAMPOS = ["iso", "abertura", "maxima", "minima", "fechamento",
          "volume", "quantidade"]


def carregar_base():
    """Lê a base publicada de volta para o formato interno."""
    if not os.path.exists(JSON_OUT):
        return {}
    with open(JSON_OUT, encoding="utf-8") as f:
        bruto = json.load(f)
    base = {}
    for ativo, linhas in bruto.get("dados", {}).items():
        for l in linhas:
            reg = dict(zip(CAMPOS, l))
            reg["ativo"] = ativo
            base[(ativo, reg["iso"])] = reg
    return base


def salvar_base(base: dict, anos_manter=None, vol_min_mm=0.0):
    os.makedirs(DIR_SAIDA, exist_ok=True)

    # ---- corte por antiguidade ----
    if anos_manter:
        limite = (date.today() - timedelta(days=int(anos_manter * 365.25))).isoformat()
        base = {k: v for k, v in base.items() if v["iso"] >= limite}

    por_ativo = {}
    for (ativo, _iso), reg in base.items():
        por_ativo.setdefault(ativo, []).append(reg)

    # ---- corte por liquidez (mediana dos últimos 60 pregões) ----
    descartados = 0
    if vol_min_mm > 0:
        alvo = vol_min_mm * 1e6
        filtrado = {}
        for ativo, linhas in por_ativo.items():
            linhas.sort(key=lambda r: r["iso"])
            recentes = [r["volume"] for r in linhas[-60:]]
            if recentes and median(recentes) >= alvo:
                filtrado[ativo] = linhas
            else:
                descartados += 1
        por_ativo = filtrado

    for linhas in por_ativo.values():
        linhas.sort(key=lambda r: r["iso"])

    total = sum(len(v) for v in por_ativo.values())
    ultimo = max((l[-1]["iso"] for l in por_ativo.values()), default=None)

    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump({
            "gerado_em": datetime.now().isoformat(timespec="seconds"),
            "fonte": "COTAHIST / B3",
            "campos": CAMPOS,
            "ultimo_pregao": ultimo,
            "total_registros": total,
            "total_ativos": len(por_ativo),
            "dados": {a: [[r[c] for c in CAMPOS] for r in linhas]
                      for a, linhas in por_ativo.items()},
        }, f, ensure_ascii=False, separators=(",", ":"))

    # CSV no formato que o app já lê no upload manual (rota de emergência)
    def br(v):
        return f"{v:.2f}".replace(".", ",")

    with open(CSV_OUT, "w", encoding="utf-8") as f:
        f.write("Ativo;Data;Abertura;Máxima;Mínima;Fechamento;"
                "VolumeFinanceiro;Quantidade\n")
        for ativo in sorted(por_ativo):
            for r in por_ativo[ativo]:
                y, m, d = r["iso"].split("-")
                f.write(f"{ativo};{d}/{m}/{y};{br(r['abertura'])};"
                        f"{br(r['maxima'])};{br(r['minima'])};"
                        f"{br(r['fechamento'])};{br(r['volume'])};"
                        f"{r['quantidade']}\n")

    tam = os.path.getsize(JSON_OUT) / 1e6
    print(f"\nBase publicada: {total:,} registros / {len(por_ativo):,} ativos"
          .replace(",", "."))
    if descartados:
        print(f"  {descartados} ativos fora do corte de liquidez")
    print(f"  último pregão: {ultimo}")
    print(f"  base_b3.json: {tam:.1f} MB")


TZ_BR = ZoneInfo("America/Sao_Paulo")


def hoje_br() -> date:
    """Data-calendário em Brasília — o runner do GitHub roda em UTC."""
    return datetime.now(TZ_BR).date()


# Feriados da B3 — sem isso o script tenta baixar arquivo que não existe,
# enche o log de erro e mascara a falha de verdade no meio do ruído.
FERIADOS_B3 = {
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-04-21",
    "2026-05-01", "2026-06-04", "2026-09-07", "2026-10-12", "2026-11-02",
    "2026-11-15", "2026-11-20", "2026-12-24", "2026-12-25", "2026-12-31",
    "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-26", "2027-04-21",
    "2027-05-01", "2027-05-27", "2027-09-07", "2027-10-12", "2027-11-02",
    "2027-11-15", "2027-11-20", "2027-12-24", "2027-12-25", "2027-12-31",
}


def eh_pregao(d: date) -> bool:
    return d.weekday() < 5 and d.isoformat() not in FERIADOS_B3


def dias_uteis_recentes(n: int, ate: date = None):
    """Os n pregões mais recentes, do mais novo para o mais antigo,
    INCLUINDO hoje. Feriado da B3 é pulado."""
    d = ate or hoje_br()
    out = []
    while len(out) < n:
        if eh_pregao(d):
            out.append(d)
        d -= timedelta(days=1)
    return out


def ultimo_pregao_esperado() -> date:
    """O pregão mais recente que a B3 já deveria ter publicado.

    A publicação sai perto das 22h de Brasília. Antes das 23h o esperado
    ainda é o pregão anterior — senão a coleta das 22h cobraria um arquivo
    que a B3 nem gerou. Mesmo limiar usado no app e no workflow."""
    agora = datetime.now(TZ_BR)
    d = agora.date() if agora.hour >= 23 else agora.date() - timedelta(days=1)
    while not eh_pregao(d):
        d -= timedelta(days=1)
    return d


# ------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", help="dd/mm/aaaa — pregão específico")
    ap.add_argument("--ano", type=int, action="append", help="ano inteiro")
    ap.add_argument("--dias", type=int, default=4,
                    help="quantos dias úteis recentes tentar (hoje incluído)")
    ap.add_argument("--anos-manter", type=float, default=4.0)
    ap.add_argument("--vol-min", type=float, default=1.0,
                    help="volume mediano mínimo em R$ milhões")
    args = ap.parse_args()

    base = carregar_base()
    print(f"Base atual: {len(base):,} registros".replace(",", "."))

    novos = []
    try:
        if args.ano:
            for ano in args.ano:
                print(f"\nBaixando ano {ano}...")
                novos += buscar_ano(ano)
        elif args.data:
            d = datetime.strptime(args.data, "%d/%m/%Y").date()
            print(f"\nBaixando pregão de {d.strftime('%d/%m/%Y')}...")
            novos = buscar_dia(d)
        else:
            # Percorre os últimos dias úteis (hoje incluído). Falha em um dia
            # não derruba a execução: feriado, pregão ainda não publicado ou
            # queda momentânea da B3 são casos normais. Isso também recupera
            # sozinho os dias perdidos se alguma execução anterior falhou.
            ok = 0
            baixados, falhados = set(), []
            for d in dias_uteis_recentes(args.dias):
                print(f"\nBaixando pregão de {d.strftime('%d/%m/%Y')}...")
                try:
                    novos += buscar_dia(d)
                    baixados.add(d)
                    ok += 1
                except Exception as e:
                    falhados.append((d, e))
                    print(f"  indisponível ({e}) — seguindo", file=sys.stderr)
            if ok == 0:
                print("\nNenhum pregão pôde ser baixado.", file=sys.stderr)
                print("Antes das ~22h o arquivo do dia ainda não existe.",
                      file=sys.stderr)
                sys.exit(1)

            # ----------------------------------------------------------
            # AQUI ESTAVA O BURACO. Bastava UM pregão qualquer baixar para
            # ok >= 1 e a execução se declarar bem-sucedida. Foi assim que
            # 03/09/2026 se perdeu: os 9 dias antigos rebaixaram sem
            # problema, só o pregão do dia falhou, e o workflow ficou verde
            # publicando base velha. Agora o que vale é o pregão ESPERADO
            # ter chegado, não a contagem de sucessos.
            # ----------------------------------------------------------
            esperado = ultimo_pregao_esperado()
            if esperado not in baixados:
                motivo = next((str(e) for d, e in falhados if d == esperado),
                              "não estava na janela de --dias")
                print(f"\n*** ATENCAO: o pregão esperado ({esperado:%d/%m/%Y}) "
                      f"NÃO entrou nesta coleta. Motivo: {motivo}",
                      file=sys.stderr)
                print("*** A base vai ser publicada com o que veio, mas segue "
                      "atrasada. O passo de verificação do workflow vai falhar "
                      "de propósito para você ser avisado.", file=sys.stderr)
            else:
                print(f"\nPregão esperado ({esperado:%d/%m/%Y}) confirmado na coleta.")
            if falhados:
                lista = ", ".join(f"{d:%d/%m}" for d, _ in falhados)
                print(f"Pregões que não baixaram nesta execução: {lista}",
                      file=sys.stderr)
    except Exception as e:
        print(f"\nFalha no download: {e}", file=sys.stderr)
        sys.exit(1)

    if not novos:
        print("Nenhum registro válido retornado. Base mantida.", file=sys.stderr)
        sys.exit(1)

    # COTAHIST é fonte de verdade: sobrescreve sem perguntar
    sobrescritos = 0
    for r in novos:
        chave = (r["ativo"], r["iso"])
        if chave in base:
            sobrescritos += 1
        base[chave] = r

    print(f"Registros lidos: {len(novos):,}".replace(",", "."))
    print(f"  novos: {len(novos) - sobrescritos:,}".replace(",", "."))
    print(f"  sobrescritos: {sobrescritos:,}".replace(",", "."))
    salvar_base(base, anos_manter=args.anos_manter, vol_min_mm=args.vol_min)


if __name__ == "__main__":
    main()
