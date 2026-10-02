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
| Transcript | ✅ `buildTranscript`: cabeçalho (quem abriu/assumiu/encerrou, motivo) + mensagens reais como `.txt` anexado; teto de 500 mensagens, mantendo as últimas |
| Reabrir | ✅ botão na DM de feedback (`reopenEnabled`); cria canal novo com o transcript do anterior anexado; o original fica fechado (métricas intactas) |
| Métricas por staff | ✅ `tickets-metrics.ts`: 1ª resposta (`firstResponseAt` = 1ª mensagem do atendente), resolução, CSAT, carga — no `/performance`, no plantão do `/stats` e no digest semanal |
| Tickets na dashboard | ⚠️ usa o ESTADO LOCAL (localStorage) para claim/responder/encerrar. Os números reais do bot aparecem em `/performance` e `/stats` |
| Canal de saída (painel → bot) | ✅ construído e processado a cada 20s |

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
- **`tickets.ts`** — efeitos: `checkSla` (SLA + auto-close num ciclo só),
  `setTicketPriority`, `reopenClosedTicket`, `closeTicket(guild, id, actor, log,
  reason)`. `recordTicketMessage` grava `firstResponseAt` (1ª mensagem de quem
  assumiu) e `lastActivityAt` (qualquer um — autor ou staff).
- **`commands.ts`** — `/performance [dias]`, com meta do módulo Equipe.
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
- `npm run build` roda typecheck E testes. Um teste falhando **não** para o
  deploy, mas erro de tipo aparece no log.
- Build leva ~40s. Vários restarts seguidos colidem ("graceful restart already
  in progress"). Esperar.

## Pendências fora do escopo de tickets

- **Cookie `httpOnly`**: o token de sessão fica no `localStorage`, legível por
  XSS. Está registrado em `session-token.ts`. Diferente do bug original (que era
  o usuário editar o próprio estado), mas ainda é limite.
- **Login real nunca testado** ponta a ponta.
- **`ephemeral` depreciado**: ~15 chamadas no bot.
