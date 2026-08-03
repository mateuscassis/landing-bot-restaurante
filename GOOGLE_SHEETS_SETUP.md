# Google Sheets Setup

## 1) Criar planilha e script
1. Crie uma planilha no Google Sheets.
2. Abra `Extensoes > Apps Script`.
3. Cole o conteudo de `scripts/google-apps-script.gs`.
4. Salve.

## 2) Popular com os dados atuais
1. No Apps Script, execute a funcao `seedFromJson` uma vez.
2. Confira se a aba `players` foi preenchida.

## 3) Publicar Web App
1. Clique em `Deploy > New deployment`.
2. Tipo: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone`.
5. Deploy e copie a URL final do Web App.

## 4) Configurar frontend
1. Crie um arquivo `.env` na raiz com:

```
VITE_SHEETS_API_URL=COLE_AQUI_A_URL_DO_WEB_APP
```

2. Rode o projeto localmente para testar.
3. Na Vercel, adicione a mesma variavel de ambiente `VITE_SHEETS_API_URL`.

## 5) Validar
1. Abra o site.
2. No bloco de cadastro, deve aparecer `Sincronizado com Google Sheets`.
3. Edite um jogador, atualize a pagina e confira se manteve.
4. Abra a planilha e confira se os dados mudaram.
5. Verifique se existe a coluna `role` com valores `linha` ou `goleiro`.

## Migracao da coluna role
- Se sua planilha foi criada antes do campo de funcao, nao precisa recriar do zero.
- A primeira gravacao apos atualizar o Apps Script ja passa a escrever a coluna `role`.
- Registros antigos sem funcao sao tratados como `linha` automaticamente.

## Observacao
- Sem autenticaÃ§Ã£o de usuario, qualquer pessoa com acesso ao site pode editar.
- Em edicoes simultaneas, vale a ultima gravacao (last write wins).

## WhatsApp webhook (opcional)
1. Configure o Apps Script atualizado deste repositorio e publique novamente o Web App.
2. (Opcional, recomendado) No Apps Script, defina a propriedade de script `WEBHOOK_SECRET` em `Project Settings > Script properties`.
3. No servidor webhook, configure as variaveis de ambiente:

```
WHATSAPP_VERIFY_TOKEN=fut_terca_token_123
SHEETS_API_URL=URL_DO_SEU_WEB_APP_DO_APPS_SCRIPT
SHEETS_WEBHOOK_SECRET=mesmo_valor_da_WEBHOOK_SECRET\nWHATSAPP_PHONE_NUMBER_ID=SEU_PHONE_NUMBER_ID\nWHATSAPP_ACCESS_TOKEN=SEU_ACCESS_TOKEN
```

4. Formato de mensagem aceito no WhatsApp:
   - `gol NomeDoJogador`
   - `gol NomeDoJogador assist NomeDoAssistente`

