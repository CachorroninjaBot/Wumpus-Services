# Auditoria de campos do dashboard

Escopo conferido antes de encerrar o plano de dashboard: chaves de `src/lib/wumpus/defaults.ts` comparadas com leitores em `src/bot/` e com as telas em `src/routes/app/`. Uma chave presente em `src/core/module-defaults.ts`, num default ou apenas na simulação local não conta como implementação do bot.

## Campos publicados que o bot ainda não lê

| Módulo | Campos | Observação |
|---|---|---|
| `servers` | `announceJoinChannelId`, `joinMessage`, `announceLeaveChannelId`, `leaveMessage`, `maintenanceMode`, `maintenanceMessage` | Boas-vindas/manutenção só afetam a simulação local em `store.ts`; o bot não aplica a configuração. |
| `tickets` | `panelFormat` | O bot publica Components V2 independentemente do valor. |
| `forms` | `panelFormat` | O bot publica Components V2 independentemente do valor. |
| `moderation` | `publicLogging` | Não há leitor no bot. |
| `security` | `autoBanRepeatOffenders`, `whitelistRoleIds` | Não há leitor no bot. Revisar junto do plano de segurança. |
| `logs` | `compactMode`, `mentionRoleId` | Não há leitor no bot. Revisar junto do plano de logs. |
| `staff` | `pingOnClaim`, `autoArchiveDays` | Não há leitor no bot. |
| `knowledge` | `autoSuggest` | Há controle na tela, mas nenhum consumidor no bot. |
| `statistics` | `anonymizeUsers` | Não há leitor no bot. |
| `roles` | `allowAiDrafts` | Não há leitor no bot. |

A checagem foi feita em `src/bot/` com busca de cada chave e inspeção do caminho de configuração. Os itens marcados acima não foram removidos nesta etapa porque alguns pertencem aos planos subsequentes (`logs` e `security`) e a remoção mudaria a configuração persistida dos servidores. Antes de expor novamente um desses controles, implementar e verificar seu consumidor ou removê-lo com migração explícita.

## Estado conectado durante este plano

- Tickets, mensagens, SLA, prioridade, feedback e estado aberto/encerrado: coleções persistidas do bot, consultadas por funções de servidor autenticadas.
- Atividade de 7 dias no dashboard: coleções `statistics`, `audit` e `moderation` do bot; abertura de ticket agora incrementa `statistics.tickets`.
- Configuração: erros de validação/acesso agora aparecem no overview com próximo passo; o painel deixa de registrar a falha apenas no console.
- Publicação: falhas de permissão indicam o canal e as permissões esperadas.
