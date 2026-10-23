# Código-fonte do app

O site publica `../public/app.js`, que é gerado a partir daqui. O Netlify
não compila nada: o `app.js` já vai pronto no repositório.

```bash
cd app
npm install      # uma vez
npm run build    # gera ../public/app.js
npm run dev      # recompila a cada alteração
```

Depois de alterar o código, rode `npm run build` e faça commit dos dois:
`app/src/...` e `public/app.js`.

## Arquivos

| arquivo | o que tem |
|---|---|
| `src/main.jsx` | ponto de entrada |
| `src/App.jsx` | componente principal: estado, abas e telas |
| `src/componentes.jsx` | componentes reaproveitados (calendário, gráficos de mês a mês, fichas…) |
| `src/tema.js` | cores, formatação e estilos compartilhados |
| `src/estrategias.js` | indicadores, estratégias, MIX e backtests |
| `src/dados.js` | base oficial, cotação ao vivo, CSV, calendário de pregões |
| `src/acompanhamento.js` | cálculos dos itens acompanhados |
| `src/swing.js` | regra do SWING: sinais, operações, alvo/stop e histórico |
| `src/swing.jsx` | tela SWING |
| `src/cesta.jsx` | vigências da cesta do Overnight padrão |
| `src/ordens.jsx` | OPERAR: ordens do leilão de fechamento, uma linha por papel |
| `src/resultados.js` | calendário de resultados e a regra de não entrar na véspera de balanço |
| `src/calendario.jsx` | OPERAR: resultados nos próximos dias, com correção manual |
| `src/navegacao.jsx` | cabeçalho, abas e sub-abas |
| `src/graficos.jsx` | peças dos gráficos (eixos, tooltip, hastes, imagem) |
| `src/relatorios.js` | exportações (Excel, CSV, PNG) |
| `src/nuvem.js` | sincronização entre aparelhos (`window.storage`) |

O código foi reconstruído a partir do `app.js` compilado (out/2026), porque o
fonte original não estava no repositório. Os nomes das funções e componentes
foram dados na reconstrução; dentro das funções ainda há variáveis com nomes
curtos herdados da compilação.
