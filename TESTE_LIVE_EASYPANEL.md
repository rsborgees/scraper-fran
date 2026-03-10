# Como Testar o Scraper da Live no Easypanel

## Método 1: Endpoint de Teste (RECOMENDADO) 🎯

Criei um endpoint específico para testar a Live que retorna logs detalhados:

```powershell
curl -X POST https://scraper-scraperv2.vlusgm.easypanel.host/test-live
```

### O que esse endpoint faz:
1. ✅ Verifica quantos itens Live existem no Drive
2. ✅ Tenta processar 1 item usando o nameScanner
3. ✅ Retorna logs detalhados de cada etapa
4. ✅ Mostra exatamente onde está falhando

### Exemplo de resposta:
```json
{
  "ok": true,
  "message": "Teste concluído",
  "captured": 1,
  "stats": {"found": 1, "errors": 0},
  "logs": [
    "🧪 TESTE LIVE SCRAPER - INICIANDO...",
    "Ambiente: linux, HEADLESS: true",
    "📂 Verificando itens Live no Drive...",
    "✅ Encontrados 6 itens Live no Drive",
    "   1. \"macaquinho bermuda bynature preto\" (searchByName: true)",
    "🔍 Testando scraper com 1 item...",
    "✅ Resultado:",
    "   Capturados: 1",
    "   Produto:",
    "      ID: 230700",
    "      Nome: Macaquinho Bermuda ByNature",
    "      Preço: R$ 299.9"
  ]
}
```

### Se der erro:
```json
{
  "ok": false,
  "message": "Mensagem de erro",
  "logs": ["... logs detalhados ..."]
}
```

---

## Método 2: Orchestrator Completo

Executa todos os scrapers (incluindo Live):

```powershell
curl -X POST https://scraper-scraperv2.vlusgm.easypanel.host/run-manual
```

Depois, verifique os logs no painel do Easypanel procurando por:
```
[LIVE] DRIVE-FIRST: Processando X candidatos
[LIVE] Stats Drive: X capturados
```

---

## Método 3: SSH (Se tiver acesso)

```bash
# Conectar ao container
ssh usuario@servidor

# Entrar no diretório
cd /app

# Executar teste diagnóstico
node test_live_name_scanner_easypanel.js

# OU teste de integração
node test_live_drive_integration.js
```

---

## Próximos Passos

1. **Execute o teste**: `curl -X POST https://scraper-scraperv2.vlusgm.easypanel.host/test-live`

2. **Analise os logs**:
   - Se `captured: 0` → Algo falhou, veja os logs
   - Se `captured: 1` → Funcionou! 🎉

3. **Me envie os logs** se falhar, para eu identificar o problema específico

4. **Depois de funcionar**, execute o orchestrator completo para processar todos os 6 itens

---

## Troubleshooting

### Se retornar "Nenhum item Live no Drive"
- Problema: Drive não está configurado ou não tem itens Live
- Solução: Verificar `GOOGLE_DRIVE_FOLDER_ID` no .env

### Se retornar "Timeout" ou "Navigation failed"
- Problema: Chromium não consegue acessar o site
- Solução: Pode precisar de mais timeouts ou proxy

### Se retornar "Campo de busca não encontrado"
- Problema: Estrutura do site mudou
- Solução: Atualizar seletores no nameScanner.js

### Se capturar mas preço = 0
- Problema: Seletores de preço não funcionam
- Solução: Atualizar seletores de preço no parseProductLive
