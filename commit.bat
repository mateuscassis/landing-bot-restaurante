@echo off
cd /d C:\Users\MateusCuelAssis\landing-bot-restaurante
git add .
git commit -m "feat: cards FIFA redesign, dark theme e rankings completos

- Cards FIFA no estilo real (clip-path octagonal, gradiente gold/silver/bronze)
- OVR e stats em escala 0-99 (x10, max 99)
- Tier do card baseado no OVR: >=75 gold, 51-74 silver, <=50 bronze
- Todos os jogadores exibidos nos rankings de artilharia, assistencias e titulos
- Cards menores para caber todos na tela (mobile responsivo)
- Weekly player selection com cores de tier por OVR
- Tema escuro completo em toda a aplicacao
- Paleta: fundo #0d0f14, accent dourado #f5c842
- Navbar, cards, tabelas, formularios e inputs em dark mode
- Mobile menu dropdown dark com blur

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push
