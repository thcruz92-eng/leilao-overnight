# -*- coding: utf-8 -*-
"""
COLETA COTAHIST — B3  (v2)
====================================================================
Baixa o arquivo oficial de cotações históricas da B3, faz o parse do
layout de posição fixa (245 bytes por registro) e mantém a base
consolidada em public/base_b3.json (lida pelo app).

REGRA DEFINIDA: o COTAHIST é a fonte de verdade. Todo dado histórico
que ele traz SOBRESCREVE o que já estiver na base.

Modos de uso:
    python coleta_cotahist.py                 # últimos dias úteis (hoje incluído)
    python coleta_cotahist.py --data 04/09/2026
    python coleta_cotahist.py --ano 2026      # ano inteiro (carga inicial)
    python coleta_cotahist.py --verificar     # só audita a base publicada

Ajustes finos:
    --anos-manter 4     descarta pregões mais antigos que isso
    --vol-min 1         volume financeiro mediano mínimo, em R$ milhões,
                        para o ativo entrar na base publicada

--------------------------------------------------------------------
O QUE MUDOU NA v2 (e por quê)
--------------------------------------------------------------------
O pregão de 04/09/2026 (sexta) ficou de fora da base por dois dias.
O log provou o encadeamento:

  1. Às 00h08 de sábado a B3 ainda não tinha publicado o arquivo.
     Erro real: HTTP 404. Nada quebrado — só publicação atrasada.
  2. A verificação disse "as próximas janelas vão tentar de novo" e
     deixou o workflow VERDE. Só que as janelas de manhã rodavam de
     segunda a sexta. Sábado e domingo não havia mais nenhuma
     tentativa. A base congelou até segunda.

Correções:
  a) A decisão de vermelho/verde saiu do "que horas são" e passou a
     ser "quantas horas já se passaram desde o prazo de publicação
     daquele pregão" (HORAS_TOLERANCIA). Isso funciona igual em
     qualquer dia da semana.
  b) Falha de download não derruba mais a execução. Quem decide se a
     coisa está boa ou ruim é UM lugar só: o modo --verificar.
  c) A lista de feriados vive aqui e só aqui. O workflow chama
     --verificar em vez de repetir a lista dentro do YAML (eram duas
     listas que podiam divergir — e divergiam: a do YAML não tinha
     2027).
  d) 404 é reportado como "ainda não publicado", não como erro de
     rede. São problemas diferentes e pedem reações diferentes.
  e) A base só é reescrita quando o CONTEÚDO muda. Antes o carimbo
     gerado_em mudava sozinho a cada execução e gerava um commit de
     12,7 MB mesmo sem dado novo.
  f) O TLS é verificado de verdade primeiro; a desativação vira
     último recurso e aparece no log.
"""

import argparse
import io
import json
import os
import ssl
import sys
import time
import zipfile
from datetime import date, datetime, time as hora_do_dia, timedelta
from statistics import median
from zoneinfo import ZoneInfo

import urllib.error
import urllib.request

BASE_URL = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist"
DIR_SAIDA = "public"
JSON_OUT = os.path.join(DIR_SAIDA, "base_b3.json")
CSV_OUT = os.path.join(DIR_SAIDA, "base_b3.csv")

# CODBDI: 02 = lote padrão | 12 = fundos imobiliários
# TPMERC: 010 = mercado à vista
CODBDI_ACEITOS = {"02", "12"}
TPMERC_ACEITOS = {"010"}

TZ_BR = ZoneInfo("America/Sao_Paulo")

# A B3 publica o COTAHIST do dia perto das 22h. Antes das 23h o pregão
# esperado ainda é o anterior — senão a coleta das 22h cobraria um
# arquivo que a B3 nem gerou. Mesmo limiar usado no app.
HORA_PUBLICACAO = 23

# Quantas horas depois desse prazo a base atrasada deixa de ser
# "aguardando a B3" e vira "problema que precisa de e-mail".
# 8h = alarme às 07h da manhã seguinte ao pregão, todo dia da semana.
HORAS_TOLERANCIA = 8

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


def log(msg="", erro=False):
    print(msg, file=sys.stderr if erro else sys.stdout, flush=True)


# ------------------------------------------------------------------
# Calendário
# ------------------------------------------------------------------
def hoje_br() -> date:
    """Data-calendário em Brasília — o runner do GitHub roda em UTC."""
    return datetime.now(TZ_BR).date()


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


def ultimo_pregao_esperado(agora: datetime = None) -> date:
    """O pregão mais recente que a B3 já deveria ter publicado."""
    agora = agora or datetime.now(TZ_BR)
    d = agora.date() if agora.hour >= HORA_PUBLICACAO else agora.date() - timedelta(days=1)
    while not eh_pregao(d):
        d -= timedelta(days=1)
    return d


def limite_do_alarme(esperado: date) -> datetime:
    """A partir de que instante uma base parada nesse pregão deixa de
    ser espera normal e vira falha.

    Independe do dia da semana — foi exatamente essa dependência que
    deixou a sexta 04/09 sem rede de segurança no fim de semana."""
    prazo = datetime.combine(esperado, hora_do_dia(HORA_PUBLICACAO), tzinfo=TZ_BR)
    return prazo + timedelta(hours=HORAS_TOLERANCIA)


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
class NaoPublicado(Exception):
    """404: o arquivo daquele pregão ainda não existe no servidor da B3.
    Não é falha de rede nem bloqueio — é só esperar."""


def _abrir(url: str, ctx) -> bytes:
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/zip,*/*",
    })
    with urllib.request.urlopen(req, context=ctx, timeout=300) as r:
        return r.read()


def _baixar(url: str) -> bytes:
    """Tenta com a cadeia de certificados validada. A cadeia da B3 já
    falhou em runner Linux no passado, então existe o plano B — mas
    agora ele aparece no log em vez de ser o padrão silencioso."""
    try:
        return _abrir(url, ssl.create_default_context())
    except urllib.error.HTTPError:
        raise                                   # erro de HTTP não é problema de TLS
    except ssl.SSLError as e:
        log(f"     TLS recusado ({e}); repetindo sem verificar o certificado", erro=True)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return _abrir(url, ctx)


def _extrair_txt(dados_zip: bytes) -> bytes:
    with zipfile.ZipFile(io.BytesIO(dados_zip)) as z:
        return z.read(z.namelist()[0])


def buscar_dia(d: date, tentativas: int = 3):
    """Uma queda momentânea da B3 não pode custar o pregão inteiro.

    404 não entra em retentativa: o arquivo não existe, insistir três
    vezes só atrasa a execução e polui o log."""
    url = f"{BASE_URL}/COTAHIST_D{d.strftime('%d%m%Y')}.ZIP"
    log(f"  -> {url}")
    ultimo_erro = None
    for i in range(tentativas):
        try:
            return parse_cotahist(_extrair_txt(_baixar(url)))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise NaoPublicado("a B3 ainda não publicou este arquivo (HTTP 404)")
            ultimo_erro = e
        except Exception as e:
            ultimo_erro = e
        if i < tentativas - 1:
            espera = 5 * (i + 1)
            log(f"     tentativa {i + 1} falhou ({ultimo_erro}); repetindo em {espera}s",
                erro=True)
            time.sleep(espera)
    raise ultimo_erro


def buscar_ano(ano: int):
    url = f"{BASE_URL}/COTAHIST_A{ano}.ZIP"
    log(f"  -> {url}")
    return parse_cotahist(_extrair_txt(_baixar(url)))


# ------------------------------------------------------------------
# Base consolidada
# ------------------------------------------------------------------
CAMPOS = ["iso", "abertura", "maxima", "minima", "fechamento",
          "volume", "quantidade"]


def ler_json_publicado():
    if not os.path.exists(JSON_OUT):
        return None
    with open(JSON_OUT, encoding="utf-8") as f:
        return json.load(f)


def carregar_base():
    """Lê a base publicada de volta para o formato interno."""
    bruto = ler_json_publicado()
    if not bruto:
        return {}
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

    # Ordem alfabética fixa: sem isso a saída depende da ordem em que os
    # ativos entraram no dicionário, e duas execuções com o mesmo dado
    # podiam gerar arquivos diferentes byte a byte.
    dados = {a: [[r[c] for c in CAMPOS] for r in por_ativo[a]]
             for a in sorted(por_ativo)}

    # ---- o conteúdo mudou mesmo? ----
    # gerado_em muda a cada execução. Se ele fosse o único campo
    # diferente, o git commitaria 12,7 MB por nada, quatro vezes ao dia.
    anterior = ler_json_publicado()
    if anterior and anterior.get("dados") == dados:
        log(f"\nBase inalterada ({total:,} registros / {len(por_ativo):,} ativos)."
            .replace(",", "."))
        log(f"  último pregão: {ultimo}")
        log("  arquivo não reescrito — nada para commitar.")
        return

    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump({
            "gerado_em": datetime.now(TZ_BR).isoformat(timespec="seconds"),
            "fonte": "COTAHIST / B3",
            "campos": CAMPOS,
            "ultimo_pregao": ultimo,
            "total_registros": total,
            "total_ativos": len(por_ativo),
            "dados": dados,
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
    log(f"\nBase publicada: {total:,} registros / {len(por_ativo):,} ativos"
        .replace(",", "."))
    if descartados:
        log(f"  {descartados} ativos fora do corte de liquidez")
    log(f"  último pregão: {ultimo}")
    log(f"  base_b3.json: {tam:.1f} MB")


# ------------------------------------------------------------------
# Verificação — o ÚNICO lugar que decide se a execução é verde ou vermelha
# ------------------------------------------------------------------
def verificar() -> int:
    agora = datetime.now(TZ_BR)
    esperado = ultimo_pregao_esperado(agora)
    limite = limite_do_alarme(esperado)

    try:
        meta = ler_json_publicado()
    except Exception as e:
        log(f"::error::não consegui ler {JSON_OUT} — {e}", erro=True)
        return 1
    if meta is None:
        log(f"::error::{JSON_OUT} não existe.", erro=True)
        return 1

    ultimo = meta.get("ultimo_pregao")
    atrasada = (ultimo is None) or (ultimo < esperado.isoformat())
    estourou = agora > limite

    if not atrasada:
        veredito = "✅ Base em dia."
    elif estourou:
        veredito = (f"🔴 **BASE ATRASADA** — o prazo de tolerância "
                    f"(`{limite:%d/%m %H:%M}`) já passou.")
    else:
        veredito = (f"🟡 Aguardando a B3 publicar. Vira falha depois de "
                    f"`{limite:%d/%m %H:%M}`.")

    resumo = [
        "### Coleta COTAHIST",
        "",
        f"- executada em: `{agora:%d/%m/%Y %H:%M}` (Brasília)",
        f"- último pregão na base: `{ultimo}`",
        f"- último pregão esperado: `{esperado.isoformat()}`",
        f"- carimbo do arquivo: `{meta.get('gerado_em')}`",
        f"- ativos: `{meta.get('total_ativos')}` / registros: `{meta.get('total_registros')}`",
        "",
        veredito,
    ]
    destino = os.environ.get("GITHUB_STEP_SUMMARY")
    if destino:
        with open(destino, "a", encoding="utf-8") as fh:
            fh.write("\n".join(resumo) + "\n")
    log("\n".join(resumo))

    if not atrasada:
        return 0
    if estourou:
        log(f"::error::base parada em {ultimo}, esperado {esperado.isoformat()}. "
            f"Rode 'Run workflow' com o campo 'Pregão específico' preenchido.", erro=True)
        return 1
    log(f"::warning::base ainda em {ultimo} (esperado {esperado.isoformat()}). "
        f"As próximas janelas vão tentar de novo.", erro=True)
    return 0


# ------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", help="dd/mm/aaaa — pregão específico")
    ap.add_argument("--ano", type=int, action="append", help="ano inteiro")
    ap.add_argument("--dias", type=int, default=10,
                    help="quantos dias úteis recentes tentar (hoje incluído)")
    ap.add_argument("--anos-manter", type=float, default=4.0)
    ap.add_argument("--vol-min", type=float, default=1.0,
                    help="volume mediano mínimo em R$ milhões")
    ap.add_argument("--verificar", action="store_true",
                    help="não baixa nada; só audita a base publicada")
    args = ap.parse_args()

    if args.verificar:
        sys.exit(verificar())

    base = carregar_base()
    log(f"Base atual: {len(base):,} registros".replace(",", "."))

    novos = []

    if args.ano:
        # Carga inicial é operação manual: aqui falha tem que doer.
        try:
            for ano in args.ano:
                log(f"\nBaixando ano {ano}...")
                novos += buscar_ano(ano)
        except Exception as e:
            log(f"\nFalha no download do ano: {e}", erro=True)
            sys.exit(1)

    elif args.data:
        d = datetime.strptime(args.data, "%d/%m/%Y").date()
        log(f"\nBaixando pregão de {d.strftime('%d/%m/%Y')}...")
        try:
            novos = buscar_dia(d)
        except Exception as e:
            log(f"\nNão veio: {e}", erro=True)
            sys.exit(1)

    else:
        # Percorre os últimos dias úteis (hoje incluído). Falha em um dia
        # não derruba a execução: feriado, pregão ainda não publicado ou
        # queda momentânea da B3 são casos normais. Isso também recupera
        # sozinho os dias perdidos se alguma execução anterior falhou.
        esperado = ultimo_pregao_esperado()
        baixados, pendentes, quebrados = set(), [], []

        for d in dias_uteis_recentes(args.dias):
            log(f"\nBaixando pregão de {d.strftime('%d/%m/%Y')}...")
            try:
                novos += buscar_dia(d)
                baixados.add(d)
            except NaoPublicado as e:
                pendentes.append(d)
                log(f"  {e} — seguindo", erro=True)
            except Exception as e:
                quebrados.append((d, e))
                log(f"  indisponível ({e}) — seguindo", erro=True)

        log("")
        if esperado in baixados:
            log(f"Pregão esperado ({esperado:%d/%m/%Y}) confirmado na coleta.")
        else:
            log(f"Pregão esperado ({esperado:%d/%m/%Y}) NÃO entrou nesta coleta.",
                erro=True)
        if pendentes:
            log("Ainda não publicados pela B3: "
                + ", ".join(f"{d:%d/%m}" for d in pendentes), erro=True)
        if quebrados:
            log("Falharam por outro motivo: "
                + ", ".join(f"{d:%d/%m} ({e})" for d, e in quebrados), erro=True)

    # Download vazio NÃO é motivo para execução vermelha. Quem julga se a
    # base está boa é o passo --verificar, que olha o resultado e não a
    # sorte de uma requisição. Antes, uma coleta de madrugada com a B3
    # atrasada derrubava o job e enterrava o sinal no meio do ruído.
    if not novos:
        log("\nNenhum registro novo. Base mantida como está.", erro=True)
        sys.exit(0)

    # COTAHIST é fonte de verdade: sobrescreve sem perguntar
    sobrescritos = 0
    for r in novos:
        chave = (r["ativo"], r["iso"])
        if chave in base:
            sobrescritos += 1
        base[chave] = r

    log(f"\nRegistros lidos: {len(novos):,}".replace(",", "."))
    log(f"  novos: {len(novos) - sobrescritos:,}".replace(",", "."))
    log(f"  sobrescritos: {sobrescritos:,}".replace(",", "."))
    salvar_base(base, anos_manter=args.anos_manter, vol_min_mm=args.vol_min)


if __name__ == "__main__":
    main()
