# Leilão Overnight v10 — B3

App de decisão para o leilão de fechamento, agora **sem download manual de dados**.

## Como os dados chegam

| | Fonte | Quando | O que faz |
|---|---|---|---|
| **Histórico** | COTAHIST (arquivo oficial da B3) | automático, 20h de todo dia útil | fonte de verdade — sobrescreve tudo |
| **Dia em andamento** | Yahoo Finance, via função no Netlify | quando você clica em **● cotação de agora** | retrato do pregão no instante do clique |

Regra fixa: o COTAHIST manda. O que a cotação ao vivo gravar durante o dia é
provisório e será sobrescrito pelo arquivo oficial na coleta da noite.

---

# PASSO 0 — Descompactar

Você baixou o arquivo **`leilao-overnight-v10.zip`**.

1. Clique com o botão direito nele → **Extrair tudo** (Windows) ou duplo clique (Mac).
2. Isso cria uma pasta chamada **`leilao-overnight-v10`**.
3. Abra essa pasta. Dentro dela você deve ver exatamente isto:

```
leilao-overnight-v10/
├── .github/
│   └── workflows/
│       └── coleta-diaria.yml
├── netlify/
│   └── functions/
│       └── cotacao.js
├── public/
│   └── base_b3.json
├── src/
│   ├── App.jsx
│   └── main.jsx
├── .gitignore
├── coleta_cotahist.py
├── index.html
├── netlify.toml
├── package.json
├── package-lock.json
├── README.md
└── vite.config.js
```

> **A pasta `.github` pode estar invisível.** Nomes começando com ponto ficam
> ocultos por padrão. No Windows: aba **Exibir** → marque **Itens ocultos**.
> No Mac: `Cmd + Shift + .` no Finder. Você vai precisar dela no passo 1.3.

Sempre que este README disser "a pasta do projeto", é a pasta
**`leilao-overnight-v10`** que você acabou de extrair.

---

# PARTE 1 — GitHub

Feito uma vez só. É o que faz a base se atualizar sozinha todo dia.

## 1.1 Criar o repositório

1. Entre em https://github.com e faça login.
2. Botão **+** no canto superior direito → **New repository**.
3. **Repository name**: `leilao-overnight`
4. Marque **Private** (a base fica só sua).
5. **Não marque** nenhuma das caixas de "Initialize this repository".
6. **Create repository**.

Você cai numa tela com o título *"Quick setup — if you've done this kind of thing before"*.
Deixe essa aba aberta, vamos usá-la no próximo passo.

## 1.2 Subir os arquivos

Nessa mesma tela, clique no link **uploading an existing file**
(está no meio do texto *"…or create a new file"* / *"…uploading an existing file"*).

Na tela de upload:

1. Abra a pasta **`leilao-overnight-v10`** no seu explorador de arquivos.
2. Selecione **tudo que está dentro dela** (`Ctrl + A` no Windows, `Cmd + A` no Mac)
   — arquivos soltos e as pastas `netlify`, `public`, `src`.
3. Arraste a seleção para a área tracejada do GitHub que diz
   *"Drag files here to add them to your repository"*.
4. Espere os arquivos aparecerem listados.
5. Role até o fim e clique em **Commit changes**.

> ⚠ **A pasta `.github` provavelmente NÃO vai subir por aqui.** O navegador ignora
> pastas ocultas no arrastar-e-soltar. É por isso que existe o passo 1.3.
> Se ela subiu (você vê `.github` na lista de arquivos do repositório), pule para o 1.4.

## 1.3 Criar o arquivo de agendamento à mão

Este arquivo é o que agenda a coleta diária. Sem ele, nada roda sozinho.

1. Na página inicial do repositório, clique em **Add file** → **Create new file**.
2. No campo do nome do arquivo (ao lado do nome do repositório), digite **exatamente**:

   ```
   .github/workflows/coleta-diaria.yml
   ```

   Conforme você digita as barras, o GitHub cria as pastas sozinho.
3. Abra o arquivo **`coleta-diaria.yml`** da sua pasta local
   (`leilao-overnight-v10/.github/workflows/coleta-diaria.yml`) num editor de
   texto — Bloco de Notas serve.
4. Selecione tudo (`Ctrl + A`), copie (`Ctrl + C`) e cole na caixa de texto grande
   do GitHub.
5. Role até o fim e clique em **Commit changes** → **Commit changes** de novo.

## 1.4 Liberar a permissão de escrita do robô

Sem isso a coleta roda, baixa os dados, e **falha na hora de salvar** — sem erro visível.

1. No repositório: aba **Settings** (engrenagem, na barra superior).
2. Menu lateral esquerdo: **Actions** → **General**.
3. Role até a seção **Workflow permissions**.
4. Marque **Read and write permissions**.
5. **Save**.

## 1.5 Carga inicial do histórico

A coleta automática só pega o pregão do dia. O histórico você puxa agora, uma vez.

1. Aba **Actions** (barra superior do repositório).
2. Menu lateral esquerdo: clique em **Coleta diária COTAHIST**.
3. À direita aparece o botão **Run workflow** — clique nele.
4. Abre uma caixinha com dois campos. No campo **"Ano inteiro (ex: 2026)"**,
   digite `2023`.
5. Clique no botão verde **Run workflow**.
6. Espere. Em alguns segundos aparece uma linha na lista com bolinha amarela
   (rodando) que vira verde (pronto). Leva de 2 a 4 minutos.

**Repita os passos 3 a 6 para `2024`, depois `2025`, depois `2026`** — um de cada
vez, esperando o anterior ficar verde. Rodar dois em paralelo faz um sobrescrever o outro.

**Como conferir que deu certo:** volte na aba **Code** do repositório, entre na
pasta `public` e clique em `base_b3.json`. Perto do começo do arquivo você vai ver
`"total_ativos"` e `"ultimo_pregao"` preenchidos. Se `total_ativos` estiver `0`,
alguma coisa falhou — veja o log clicando na execução na aba Actions.

## 1.6 Daí em diante

Não precisa fazer nada. A coleta roda sozinha às **20h (horário de Brasília)**,
de segunda a sexta. No dia seguinte você pode conferir na aba **Actions** se
apareceu uma execução verde nova.

---

# PARTE 2 — Netlify

## 2.1 Publicar o site

1. Entre em https://app.netlify.com e faça login (pode usar a conta do GitHub).
2. **Add new site** → **Import an existing project**.
3. Escolha **Deploy with GitHub** e autorize o acesso quando pedir.
4. Na lista de repositórios, escolha **`leilao-overnight`**.
   > Se ele não aparecer, clique em **Configure the Netlify app on GitHub** e
   > dê acesso a esse repositório.
5. A tela seguinte já vem preenchida (o Netlify lê o arquivo `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Clique em **Deploy**.

O primeiro deploy leva uns 2 minutos. No fim, o Netlify mostra o endereço do site,
algo como `https://nome-aleatorio-123.netlify.app`.
Dá para trocar esse nome em **Site configuration** → **Change site name**.

**Daqui pra frente é automático:** quando a coleta noturna salvar a base nova no
GitHub, o Netlify republica o site sozinho.

## 2.2 Testar a cotação ao vivo

Abra no navegador, trocando pelo endereço do seu site:

```
https://SEU-SITE.netlify.app/.netlify/functions/cotacao?tickers=PETR4,VALE3
```

Deve voltar um texto em JSON com `fechamento`, `maxima`, `minima` e `volume`
para cada ativo. Durante o pregão o campo `estadoMercado` mostra `REGULAR`;
fora dele mostra `CLOSED` ou `POST` — isso é normal.

## 2.3 Instalar no tablet

1. Abra o endereço do site no Chrome do tablet.
2. Menu de três pontinhos → **Adicionar à tela inicial**.
3. Ele passa a abrir como aplicativo, sem barra de navegador.

---

# PARTE 3 — Rotina do dia a dia

**Entre 16h30 e 16h45**, na aba **HOJE**:

1. Abra o app.
2. Clique em **● cotação de agora**. Ele puxa o pregão em andamento de todos os
   ativos da base e o indicador verde mostra a hora exata da consulta.
3. Confira a data de referência, marque os ativos e opere.

O botão **↻ sincronizar base** existe caso você queira forçar a leitura do
COTAHIST antes da hora — mas ele já roda sozinho toda vez que o app abre.

---

# Ajustes opcionais

Dois parâmetros controlam o tamanho da base publicada:

- **`--anos-manter 4`** — quantos anos de histórico manter. Mais anos = arquivo
  maior = app demora mais pra abrir no tablet.
- **`--vol-min 1`** — volume financeiro mediano mínimo em R$ milhões (últimos 60
  pregões) para o ativo entrar na base. Subir para `10` corta bastante papel que
  você nunca operaria mesmo.

Para mudar: no GitHub, abra `.github/workflows/coleta-diaria.yml`, clique no
lápis (**Edit**), e na linha que diz

```
            python coleta_cotahist.py
```

acrescente o parâmetro, ficando por exemplo:

```
            python coleta_cotahist.py --vol-min 10
```

Cuidado para manter os espaços do começo da linha — YAML é sensível a isso.
Commit e pronto; vale a partir da próxima execução.

---

# Pontos de atenção

- **O COTAHIST do dia só existe depois do fechamento.** Se a coleta rodar antes
  das ~19h, o download falha. É esperado, não é bug.
- **A API do Yahoo não é oficial.** Se um dia a cotação ao vivo parar de
  responder, o lugar de olhar é `netlify/functions/cotacao.js`. O histórico não
  é afetado.
- **Volume financeiro**: no COTAHIST é o valor real (campo VOLTOT do arquivo).
  Na cotação ao vivo o Yahoo entrega quantidade de papéis, então a função estima
  o financeiro pelo preço médio do dia — suficiente para o teto de 0,1% de
  liquidez, mas é aproximação.
- **O upload manual de CSV continua funcionando** como rota de emergência, mas o
  que ele gravar em datas cobertas pelo COTAHIST será sobrescrito na próxima
  sincronização.
- **O que fica salvo no navegador** agora é só configuração: carteira, benchmarks
  cadastrados, ativos marcados e ordem das colunas. Os preços vêm da rede toda
  vez que o app abre — trocar de aparelho não perde a base, só as configurações.

---

# O que é cada arquivo

| Arquivo | Para que serve |
|---|---|
| `src/App.jsx` | o app em si — abas HOJE, BASE DE DADOS, COMPARAR ESTRATÉGIAS, MÊS A MÊS |
| `src/main.jsx` | ponto de entrada do React |
| `index.html` | página raiz |
| `netlify/functions/cotacao.js` | ponte que busca a cotação ao vivo |
| `coleta_cotahist.py` | baixa e processa o arquivo oficial da B3 |
| `.github/workflows/coleta-diaria.yml` | agenda a coleta para 20h todo dia útil |
| `public/base_b3.json` | a base publicada (vem vazia, a coleta preenche) |
| `netlify.toml` | diz ao Netlify como publicar |
| `package.json` / `package-lock.json` / `vite.config.js` | dependências e build |
| `.gitignore` | evita subir arquivos temporários |
