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

## Observacao
- Sem autenticação de usuario, qualquer pessoa com acesso ao site pode editar.
- Em edicoes simultaneas, vale a ultima gravacao (last write wins).
