@echo off
cd /d C:\Users\MateusCuelAssis\landing-bot-restaurante
git add .
git commit -m "feat: sorteio equilibrado, tabela de stats separada e UX mobile

- Times de 4 jogadores (goleiros excluídos do sorteio)
- Algoritmo de sorteio com otimização por trocas (OVR + posições + pares)
- Tabela de OVR separada da tabela de Estatísticas da temporada
- Botões rápidos +/- para gols, assistências e títulos (mobile-friendly)
- Barra de pesquisa e ordenação na tabela de estatísticas
- Layout responsivo para mobile na tabela de stats

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push
