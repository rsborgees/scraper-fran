# Solução: Roupas Repetidas no Easypanel

O problema de enviar roupas repetidas ocorre por dois motivos possíveis:

1. **Volume mal configurado:** O Easypanel não está salvando o arquivo `history.json`.
2. **Histórico Local não enviada:** Mesmo com o volume, o servidor começa "do zero". Se você já enviou roupas pelo seu computador, o servidor não sabe disso e vai enviar de novo.

## Passo 1: Descobrir o Caminho Correto

Eu adicionei um log especial que vai te dizer EXATAMENTE onde montar o volume.

1. Faça o deploy da nova versão.
2. Abra os **Logs** do app no Easypanel.
3. Procure por uma mensagem assim (bem no começo):
   ```
   📂 CONFIGURAÇÃO DE PERSISTÊNCIA (EASYPANEL)
   Para salvar o histórico, crie um VOLUME montado em:
   👉 /caminho/do/app/data  <-- USE ESSE CAMINHO!
   ```
4. Se o seu Volume estiver configurado com um caminho diferente, **corrija** nas configurações do Easypanel (Aba "Mounts").

## Passo 2: Sincronizar seu Histórico Local (Importante!)

Para evitar que o servidor reenvie roupas que **você já enviou do seu PC**, você precisa subir o seu histórico atual para lá.

Eu criei uma ferramenta nova para isso. Após o deploy estar rodando:

1. Tenha certeza que o arquivo `d:\scrapping\data\history.json` no seu PC está atualizado.
2. Use o comando abaixo no **PowerShell**:

```powershell
Invoke-RestMethod -Uri "https://scraper-scraperv2.ncmzbc.easypanel.host/import-history" -Method Post -ContentType "application/json" -InFile "d:\scrapping\data\history.json"
```

Isso vai "ensinar" ao servidor tudo que já foi enviado, parando as duplicatas imediatamente.

## Resumo
1. **Confira os logs** para ver se o caminho do volume está certo.
2. **Envie seu histórico** local para o servidor usando o comando acima.
