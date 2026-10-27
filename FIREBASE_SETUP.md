# Placar ao vivo (Firebase)

O chaveamento e a partida em andamento ficam no Firebase Realtime Database. Assim, quem abrir o app no celular vê o mesmo placar e o mesmo cronômetro. As estatísticas da temporada continuam no Google Sheets: quando uma partida é encerrada, os gols e assistências dela são somados lá.

O plano gratuito (Spark) sobra para o nosso uso.

## 1) Criar o banco
1. Entre em https://console.firebase.google.com e crie um projeto (pode desligar o Google Analytics).
2. No menu, abra `Build > Realtime Database` e clique em `Create Database`.
3. Escolha a região `us-central1` e comece em `locked mode`.
4. Na aba `Rules`, cole as regras abaixo e publique:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "fut-terca": {
      "live": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Assim como a planilha, qualquer pessoa com o link do app consegue editar o placar.

## 2) Pegar a configuração
1. Em `Project settings > General`, adicione um app Web (ícone `</>`). Não precisa de Hosting.
2. Copie `apiKey`, `projectId` e `databaseURL`. A `databaseURL` também aparece no topo da página do Realtime Database.

## 3) Configurar o app
Preencha `src/live/firebaseConfig.js` e faça o commit:

```js
export const firebaseConfig = {
  databaseURL: "https://SEU-PROJETO-default-rtdb.firebaseio.com",
  apiKey: "...",
  projectId: "SEU-PROJETO",
};
```

Esses valores não são segredo: o Firebase manda eles para todo navegador que abre o app. Quem protege o banco são as regras do passo 1. Por isso não é preciso configurar nada na Vercel; o próximo deploy já usa o arquivo.

Para testar com outro banco sem mexer no arquivo, as variáveis `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_API_KEY` e `VITE_FIREBASE_PROJECT_ID` no `.env` têm prioridade sobre ele.

## 4) Conferir
1. Abra o app em dois celulares (ou duas abas).
2. Em `Times`, confirme os times e comece uma partida.
3. A tela da partida deve abrir nos dois, com o selo "ao vivo" no canto. Marque um gol em um e veja aparecer no outro.

Sem o Firebase configurado, o app funciona em modo local: o placar fica salvo só no navegador, e abas do mesmo navegador ficam sincronizadas.
