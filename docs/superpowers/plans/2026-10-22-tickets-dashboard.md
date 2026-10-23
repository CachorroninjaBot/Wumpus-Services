# Dashboard de tickets reais — plano de implementação

**Objetivo:** concluir a pendência documentada em `docs/tickets-plan.md` e corrigir divergências verificadas na auditoria do fluxo de tickets.

**Arquitetura:** server functions autenticadas leem as coleções persistidas pelo bot e enfileiram ações. O processo do bot executa ações de Discord e grava o resultado na outbox. A dashboard acompanha o snapshot real e o status da operação.

**Restrições:** `createServerFn`; `requireGuildAccess`; Discord somente no processo do bot; canal/cargo por resolução configurada; nenhuma alteração em Components V2.

## Arquivos

- `src/lib/wumpus/runtime.server.ts`: contratos e leitura server-only das coleções do bot.
- `src/lib/wumpus/runtime-store.ts`: leitura autenticada, validação, outbox e status.
- `src/bot/outbox.ts`, `src/bot/outbox-send.ts`: liquidação e execução de ações de ticket.
- `src/bot/tickets.ts`: resposta atribuída ao atendente e duas correções de cobertura da especificação.
- `src/routes/app/tickets.tsx`: fila real e ações com estado/status do bot.
- `src/bot/outbox.test.ts`: regressões da liquidação das ações.
- `docs/tickets-plan.md`: estado atualizado após implementação.

## Execução

- [x] Contrato serializável e funções server autenticadas; limite de 500 tickets e mensagens por ticket.
- [x] Ações claim, reply, prioridade e close executadas pelo bot; reply registra identidade e atividade do atendente.
- [x] Dashboard remove simulação local e ações sem suporte no bot; mostra nome do autor e link do canal.
- [x] Auditoria encontrou e corrigiu auto-close desabilitado junto do SLA desligado e botões ausentes para prioridades low/normal.
- [x] `npm run typecheck` passou.
- [x] `npm test` passou: 137/137.
- [x] ESLint nos arquivos alterados passou; lint global segue com erros anteriores em `forms.ts`, `protect.tsx` e `settings.tsx`.
- [x] `git diff --check` passou após correção de newline.

## Limite operacional

O fluxo real no Discord requer bot online e sessão/permissões ativas. Não foi executado teste humano no servidor Discord nesta sessão.
