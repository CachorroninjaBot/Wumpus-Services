# Wumpus

Painel da comunidade e vitrine dos planos WumPlus. A cobrança e o catálogo vêm da loja Hub Express na ShardPay.

## Planos

| Plano | O que libera |
| --- | --- |
| Essencial | 1 servidor, proteção, tickets e formulários. Sem IA. |
| Pro | 5 servidores, transcrição, knowledge com IA e 500 OCR/mês. |
| Escala | Servidores, IA e OCR sem teto. |
| Vitalício | Pagamento único, mesmo acesso do Escala. |

Os limites de servidor e recursos são revalidados pelo bot na ShardPay a cada
5 minutos. Dashboard e bot precisam compartilhar `data/wumpus-entitlements.json`
(ou o caminho definido em `WUMPUS_LICENSE_PATH`) para aplicar a licença. Uma
instalação nova tem 15 minutos para ser ativada pela conta proprietária.

## Rodar

```bash
npm install
SHARDPAY_API_KEY=sua_chave npm run dev
```

A chave nunca entra no repositório. Sem ela o painel mostra a vitrine salva dos quatro planos.

Checkout público: https://shardpay.app/pt-br/store/hubexpress
