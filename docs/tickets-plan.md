# Tickets completos — especificação

> Escrito no fim de uma sessão longa de trabalho no Wumpus. Serve para o próximo
> chat começar sem redescobrir as regras da plataforma na marra.
>
> **Leia a seção "Restrições da plataforma" antes de escrever código.** Cada
> item ali já causou um bug real neste projeto.

## Objetivo

Transformar o módulo de atendimento num sistema de tickets de verdade, no nível
do ticket.bot: painel publicável, canal privado por ticket, claim, prioridade,
SLA, transcript e feedback.

## Estado atual (implementado)

| Item | Situação |
|---|---|
| Painel de tickets (Components V2) | ✅ pronto, com botão "Abrir atendimento" |
| Select de departamento | ✅ funcionando (confirmado em uso real) |
| Canal privado por ticket | ✅ autor + `staffRoleIds` + bot, categoria e nome por `namingPattern` |
| Claim | ✅ idempotente |
| Prioridade | ✅ botão por nível no canal (`setTicketPriority`), validada contra os 4 níveis da dashboard |
| SLA | ✅ `slaState` (pureza em `tickets-sla.ts`); o alerta NUNCA muda o ticket; reagendado a 24h; `breach` pinga `escalationRoleId` dentro do canal |
| Auto-close | ✅ `closeAfterHours` (vencimento) e `autoCloseInactiveHours` (inatividade) rodam no ciclo de 5 min junto do SLA |
| Transcript | ✅ Com retenção ilimitada, envia o `channel_id` à API externa `haiz-transcript.shardweb.app`, que gera um link e lê o canal no momento do fechamento; o bot publica o link no canal configurado. Se a API falhar, exporta `buildTranscript` local como `.txt`. Com retenção configurada, usa somente o `.txt` local. Não foi informado endpoint para apagar páginas externas já geradas. |
| Reabrir | ✅ botão na DM de feedback (`reopenEnabled`); cria canal novo com link do transcript externo ou anexo local do atendimento anterior; o original fica fechado (métricas intactas) |
| Métricas por staff | ✅ `tickets-metrics.ts`: 1ª resposta (`firstResponseAt` = 1ª mensagem do atendente), resolução, CSAT, carga — no `/performance`, no plantão do `/stats` e no digest semanal |
| Tickets na dashboard | ✅ lê tickets persistidos pelo bot; claim, resposta, prioridade e encerramento atravessam a outbox; a tela consulta o estado atualizado |
| Canal de saída (painel → bot) | ✅ construído e processado a cada 20s |
| Tipos de atendimento configuráveis | ✅ até 25 opções por painel, com emoji, descrição, categoria Discord, cargos próprios/herdados e boas-vindas |
| Formulário de abertura | ✅ até 5 perguntas obrigatórias por tipo; respostas aparecem no canal e no histórico da dashboard |
| Modelos de configuração | ✅ suporte geral, loja e comunidade; aplicam configurações editáveis antes da publicação |
| Personalização do painel | ✅ título, descrição, rodapé, cor, estilo do botão, menu suspenso ou até 5 botões diretos; opções com emoji e descrição; prévia do painel e do menu |
| Vários painéis | ✅ `ticketPanels` normalizado em `ticket-panels.ts`; cada painel tem canal, tipos e textos próprios; o plano limita 1 / 5 / 25. Botões antigos continuam resolvendo pelo slug legado |
| Console operacional | ✅ fila com vistas (minhas, sem responsável, SLA, aguardando usuário), busca na conversa, contexto do solicitante, respostas prontas e métricas por tipo |
| Modo fórum | ✅ painel apontado para um canal de fórum cria cada atendimento como tópico (post) do fórum; o painel é publicado como post e atualizado no lugar |
| Versões e rollback | ✅ `configVersions` no store: snapshot do estado anterior (rajadas de 5 min colapsam) e "Restaurar" que salva o estado atual antes de voltar |
| Bloqueio e horário | ✅ `blacklistedUserIds` recusa a abertura com mensagem; `businessHours*` avisa quem abre fora do horário e entra no rodapé do painel (UTC) |
| Saúde do bot | ✅ cartão "Bot no Discord" no painel: online/offline, ping e permissões essenciais para abrir e organizar tickets |

Build: `npm run typecheck && npm test`. Os testes de tudo novo estão em
`src/bot/tickets-sla.test.ts` (28 testes) — matemática pura, sem Discord.

## Restrições da plataforma

Estas são as que importam. Todas foram descobertas quebrando algo.

### 1. O painel NÃO fala com o Discord

`scripts/start.mjs` faz `spawn` — o bot roda em **processo separado** e é o único
com conexão ao gateway. A ponte é `data/wumpus-runtime.json`.

Qualquer coisa que o painel precise causar no Discord passa pelo **canal de
saída** (`outbox`): o painel enfileira, o bot processa e grava o resultado.

O `publishPanel` antigo só escrevia no estado local — dizia "publicado" e nada
chegava ao canal. Não repetir esse padrão.

### 2. Components V2 não aceita `content` nem `embeds`

Uma mensagem com `flags: IS_COMPONENTS_V2` rejeita `content` (erro 400,
`MESSAGE_CANNOT_USE_LEGACY_FIELDS_WITH_COMPONENTS_V2`). Texto vai **dentro** do
container, como text display (type 10).

Menções dentro de text display **notificam normalmente** — dá para pingar staff
por lá.

A soma dos caracteres de **todos** os text displays tem teto de 4000. O corte
precisa considerar o total, não cada bloco (`buildPanelPayload` já faz isso).

### 3. Config referencia canal por NOME, não por ID

`resolve.ts` traduz `"ch_atendimento"` → canal real do servidor. A config é por
GRUPO e um grupo cobre vários servidores, então ID fixo não serve.

Use `resolveChannel(guild, ref)` / `resolveRole(guild, ref)`. Nunca
`guild.channels.cache.get("ch_atendimento")` — o cache indexa por snowflake.

### 4. Módulos de servidor são `createServerFn`

Só `createServerFn` atravessa do servidor para o cliente. Uma função comum que
importe `*.server.*` quebra o bundle do cliente.

### 5. Banco de dados: `guild.id` primeiro

O bot guarda por servidor. `moduleConfig(guildId, "tickets")` lê o runtime.

## Arquitetura do que foi construído

- **`tickets-sla.ts`** — matemática pura (nada de Discord, nada de disco):
  `slaState`, `autoCloseCandidate`, `buildTranscript`, `slaNotice`. Toda regra
  de decisão fica aqui e é testável direto.
- **`tickets-metrics.ts`** — agregação pura por atendente (`aggregateStaffReport`)
  + leitor do store (`ticketStaffReport`) + linhas prontas para Discord
  (`reportLines`).
- **`ticket-panels.ts`** — normalizador puro de painéis/tipos: `ticketPanels` novo
  ou campos legados viram a mesma `TicketPanel[]`; `findTicketType` aceita id,
  nome e slug legado, então botões já publicados continuam funcionando.
- **`preflight.ts`** — validação pura antes de publicar (canal, tipos, textos).
- **`panel-publish.ts`** — publicação idempotente por `guildId + key`; em canal de
  fórum localiza o post salvo para editar no lugar.
- **`business-hours.ts`** — janela de atendimento pura em UTC (suporta horário que
  atravessa a meia-noite) e textos do aviso/rodapé.
- **`tickets.ts`** — efeitos: `checkSla` (SLA + auto-close num ciclo só),
  `setTicketPriority`, `reopenClosedTicket`, `closeTicket(guild, id, actor, log,
  reason)`. `recordTicketMessage` grava `firstResponseAt` (1ª mensagem de quem
  assumiu) e `lastActivityAt` (qualquer um — autor ou staff).
- **`commands.ts`** — `/performance [dias]`, com meta do módulo Equipe.
- Dashboard de tickets lê `data/tickets.json` e `data/ticket_messages.json` por `createServerFn` com `requireGuildAccess`; ações passam pela outbox para o processo do bot.
- Semântica de SLA é a MESMA da dashboard (`engine.ts` → `ticketSla`):
  `warning` = meta estourada, `breach` = 2x a meta; respondido dentro da meta
  não volta a estourar por idade. O alerta marca "já avisei" em `counters`
  (`sla:{guild}:{ticket}:{estado}`, reavisa a 24h) — nunca mais mude o ticket
  para calmar um alerta.

## Como testar

Não dá para testar OAuth nem enviar mensagem no Discord por script. O caminho é:

1. `npm run typecheck && npm test` — tem que passar
2. Verificar no log: `[bot] online`, sem `[bot] saiu com código`
3. **Teste humano no Discord**: clicar o botão, abrir ticket, mudar prioridade,
   encerrar; `/performance`; DM de feedback com o botão "Reabrir"
4. Conferir `data/wumpus-runtime.json` → `outbox` para ver o resultado gravado

## Armadilhas que já causaram 502

- **Edição duplicada**: a ferramenta de edição aplica em dobro quando o
  `old_string` quase casa. Já derrubou o build 5 vezes. **Rodar uma varredura de
  duplicatas antes de cada build** — procurar por `const X`, `export X`,
  `import X` repetidos.
- **Rate limit de edição**: ~8 edições `edit_file` no mesmo turno disparam 429
  HTTP (limite real, não transient). Quando o lote é grande, `rewrite_file` do
  arquivo inteiro ou dividir entre turnos — não insistir no `edit_file`.
- `npm run verify` roda typecheck e testes na validação do GitHub; falhas
  bloqueiam a integração. O deploy executa apenas build, migrações e start.
- Vários restarts seguidos colidem ("graceful restart already in progress").
  Esperar.
- **Snapshot de recursos antes do ready**: `buildGuildResources()` rodava na
  inicialização, com o cache de servidores ainda vazio, e o resultado ficava em
  cache até algum evento de canal/cargo. Em produção o heartbeat publicava
  `guildResources: {}` para sempre — todos os seletores de canal/cargo da
  dashboard ficavam vazios e as permissões apareciam como "concedidas" por serem
  `null`. Agora o snapshot é preguiçoso (`null` = refaz no próximo heartbeat) e
  `GuildCreate/GuildDelete/GuildUnavailable` também marcam sujo.

## Pendências fora do escopo de tickets

- **Cookie `httpOnly`**: o token de sessão fica no `localStorage`, legível por
  XSS. Está registrado em `session-token.ts`. Diferente do bug original (que era
  o usuário editar o próprio estado), mas ainda é limite.
- **Login real nunca testado** ponta a ponta.
- **`ephemeral` depreciado**: ~15 chamadas no bot.

## Automação do canal e IA autônoma (2026-11-27)

- **Controles do canal** (`ticketHeaderComponents`): linha com Assumir/Assumido
  (emojis customizados `naoassumido`/`assumido`), Gerenciar (só o emoji
  `gerenciar`) e Fechar (emoji `close`). O botão **Transferir** saiu da linha
  principal e virou botão do menu Gerenciar. Os selects de adicionar/remover
  pessoa têm prefixos ➕/➖, e o texto do menu não menciona mais o SLA.
- **Auto-assunção e espera automática** (`recordTicketMessage`): quem tem cargo
  de equipe assume o ticket ao digitar pela primeira vez (mesmo efeito do
  `claimTicket`: status `claimed`, aviso no canal); a espera acompanha quem
  falou por último — resposta da equipe ⇒ `waitingOn: "user"`, resposta do
  solicitante ⇒ `waitingOn: "staff"`. Toda mudança de estado sincroniza o
  cabeçalho fixado.
- **IA autônoma** (chaves novas em `lib/wumpus/defaults.ts`):
  - `aiAutoReplyEnabled` — a IA responde o solicitante no canal enquanto
    nenhum atendente assumiu. Prompt restrito à base de treinamento +
    conversa; quando não sabe, responde `ESCALAR` e o bot menciona os cargos
    de atendimento em vez de inventar resposta.
  - `aiAutoPriorityEnabled` — na primeira mensagem do solicitante a IA
    classifica a prioridade (baixa/normal/alta/urgente) e atualiza o ticket.
  - `aiTraining` — pares pergunta/resposta editados na seção "Treinamento da
    IA de atendimento" da dashboard (até 100 pares; validação em
    `runtime-validation.ts` limita pergunta a 200 e resposta a 2.000 chars).
  - Tudo gated por `planAllows(plan, "ai")` + `aiSupportEnabled`, igual ao
    botão "Resposta com IA".
