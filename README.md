# Multi-Store Scraper System

Sistema automatizado de scraping para 5 lojas de moda com agendamento diário e integração webhook.

## Quick Start

### **1. Instalação**
```bash
npm install
```

### **2. Executar Scraper Manualmente**
```bash
node index.js
```

### **3. Dashboard Web (Iniciar & Monitorar)**
```bash
npm start
# Acesse: http://localhost:3000
```

### **4. Agendamento Automático (7h AM)**
```bash
npm run scheduler
```

### **5. Teste Imediato (sem aguardar 7h)**
```bash
npm run scheduler:test
```

---

## Sistema

- **Total de Produtos**: 120
- **Lojas**: FARM (84), Dress To (18), KJU (6), Live (6), ZZMall (6)
- **Agendamento**: Diário às 7h da manhã (horário de Brasília)
- **Webhook**: POST automático dos dados coletados

---

## Estrutura

```
scrapping/
├── index.js              # Execução única do scraper
├── server.js             # Dashboard web (porta 3000)
├── cronScheduler.js      # Agendador diário + webhook
├── orchestrator.js       # Coordenação de todos scrapers
├── imageDownloader.js    # Download de imagens (Playwright)
├── scrapers/
│   ├── farm/            # Scraper FARM (84 produtos)
│   ├── dressto/         # Scraper Dress To (18 produtos)
│   ├── kju/             # Scraper KJU (6 produtos)
│   ├── live/            # Scraper Live (6 produtos)
│   └── zzmall/          # Scraper ZZMall (6 produtos)
└── public/
    └── index.html       # Interface do dashboard
```

---

## Comandos

| Comando | O que faz |
|---------|-----------|
| `npm start` | Inicia dashboard web em http://localhost:3000 |
| `npm run scheduler` | Ativa agendamento diário (7h AM) |
| `npm run scheduler:test` | Executa scraping imediato + webhook |
| `node index.js` | Executa scraping único (sem webhook) |

---

## Webhook Configuration

**Endpoint:**
```
POST https://n8n-francalheira.vlusgm.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa
```

**Payload:**
```json
{
  "timestamp": "2025-12-29T07:00:00.000Z",
  "totalProducts": 120,
  "products": [...],
  "summary": {
    "farm": 84,
    "dressto": 18,
    "kju": 6,
    "live": 6,
    "zzmall": 6
  }
}
```

---

## Deploy (Manter Rodando 24/7)

### **Opção 1: PM2 (Recomendado)**

```bash
# Instalar PM2
npm install -g pm2

# Iniciar scheduler
pm2 start cronScheduler.js --name scraper

# Auto-start no boot
pm2 startup
pm2 save

# Monitorar
pm2 logs scraper
pm2 status
```

### **Opção 2: Docker**

```bash
docker build -t scraper .
docker run -d --restart always scraper
```

---

## Features

**Scraping Automático**: 5 lojas, 120 produtos/dia  
**Download de Imagens**: 1 imagem por produto (Playwright)  
**Regras de Preço**: FARM (promo real), Outras (preço original)  
**Agendamento**: Execução diária às 7h AM  
**Webhook**: POST automático dos dados  
**Dashboard**: Interface web para monitoramento  
**Logs**: Console em tempo real com código de cores  

---

## Tecnologias

- **Node.js**
- **Playwright** (Browser automation)
- **Express** (Web server)
- **node-cron** (Scheduler)
- **axios** (HTTP client)

---

## Documentação Completa

- [Scheduler Guide](file:///.gemini/antigravity/brain/.../scheduler_guide.md)
- [Dashboard Walkthrough](file:///.gemini/antigravity/brain/.../scraper_dashboard_walkthrough.md)

---

## Performance

- **Tempo médio**: ~15-20 minutos para 120 produtos
- **Concurrent scrapers**: Sim (5 lojas em paralelo)
- **Error handling**: Retry automático + log detalhado
- **Images**: Download em paralelo com scraping

---

## Troubleshooting

**Webhook não responde?**
```bash
npm run scheduler:test  # Testa imediatamente
```

**Scraper não agenda?**
```bash
pm2 logs scraper  # Verifica logs
```

**Imagens não baixam?**
- Verifique permissões da pasta `downloads/`
- Rode em modo teste para ver erros específicos

---

## Status

**Pronto para Produção**

Sistema completo e testado, pronto para deploy 24/7.
