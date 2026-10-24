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
Como a consulta MCP atual da ShardPay lista assinaturas recorrentes, compradores
Vitalício precisam ser verificados na loja e incluídos em
`WUMPUS_LIFETIME_DISCORD_IDS` (IDs Discord separados por vírgula). O Vitalício
recebe os mesmos limites do Escala.

## Rodar

```bash
npm install
SHARDPAY_API_KEY=sua_chave npm run dev
```

A chave nunca entra no repositório. Sem ela o painel mostra a vitrine salva dos quatro planos.

## Sessões e administração

O login da dashboard depende de `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`,
`WUMPUS_OWNER_ID` e `WUMPUS_SESSION_SECRET`. Gere um segredo de sessão próprio
para cada ambiente (`openssl rand -base64 48`) e configure-o no gerenciador de
secrets do deploy. Ele precisa ter pelo menos 32 bytes e não deve ser igual à
chave OAuth, token do bot ou chave ShardPay. A administração também exige MFA
ativado na conta Discord do proprietário. Na web, as sessões ficam em cookie
`HttpOnly`; na Activity, uma sessão assinada fica somente em memória no cliente.
Ambas podem ser revogadas na aba Segurança. Ao abrir `/entrar`, uma sessão web
válida é restaurada automaticamente; ela dura até 30 dias, com expiração após
14 dias sem atividade. Use `?reconectar=1` para iniciar uma nova autorização Discord.
Se o dono não encontrar servidores, a tela de preparação mostra o estado do
heartbeat e registra uma entrada `[owner-guild-diagnostics]` nos logs do servidor.

As contas, sessões, auditoria e concessões manuais são salvas no arquivo definido por
`WUMPUS_MEMBERS_PATH` (padrão `data/wumpus-dashboard-members.json`). O bot
precisa ler o mesmo arquivo para aplicar concessões e revogações; o sync de
licenças ocorre no ciclo do bot. O snapshot dos servidores autorizados também
fica nessa sessão no servidor, não no cookie do navegador. Use volume persistente
acessível pelos dois processos. Se a dashboard rodar em várias instâncias, migre
esse estado para um banco de dados compartilhado para evitar gravações concorrentes
no arquivo.

## Discord Activity

A dashboard web e a Activity usam as mesmas rotas e componentes. Configure
`DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` com a mesma aplicação Discord já
usada pelo bot e pelo login web. A Activity usa OAuth com PKCE; permissões,
assinatura e acesso aos servidores continuam validados pelo backend.
Os comandos globais são atualizados preservando o comando Entry Point (Launch)
criado pelo Discord; não o remova ao registrar os slash commands.

No Discord Developer Portal, abra a aplicação do Wumpus:

1. Em **OAuth2 > Redirects**, mantenha a URL de callback web configurada em
   `DISCORD_REDIRECT_URI` e adicione `https://127.0.0.1` como URI de Activity.
2. Em **Activities > Settings**, habilite **Enable Activities** e os clientes
   em que deseja oferecer a Activity (Desktop, Web e Mobile).
3. Em **Activities > URL Mappings**, configure o prefixo `/` para o domínio
   público da dashboard, sem `https://` (por exemplo,
   `wumpus-dashboard.shardweb.app`).
4. Em **Installation**, habilite **User Install** e **Guild Install**. Use o
   comando de entrada **Launch** criado ao habilitar Activities para iniciar e
   testar a dashboard.
5. Para testes não distribuídos, inicie a Activity com uma conta que pertença
   à equipe proprietária da aplicação. Para disponibilizá-la a outros usuários,
   conclua o processo de distribuição exigido pelo Discord.

Se o iframe ainda falhar com `X-Frame-Options: DENY`, remova esse cabeçalho na
hospedagem, CDN ou proxy reverso: o servidor da aplicação não o configura e um
servidor de origem não consegue anular um cabeçalho `DENY` inserido depois pelo
proxy. Mantenha a proteção de incorporação pela diretiva `frame-ancestors` da
CSP. A dashboard não carrega mais Google Fonts remotamente, evitando bloqueios
de estilos impostos pelo proxy do Discord.

Checkout público: https://shardpay.app/pt-br/store/hubexpress
