# Segurança — especificação

> Referência: **GS Defender** (GamerSafer) — verificação de membro, anti-nuke,
> proteção de raid. A meta é cobrir o mesmo terreno com a arquitetura que já
> temos.

## Objetivo

Impedir raid e nuke de verdade, com resposta automática e alerta visível para a
equipe. Não só detectar e logar.

## Problema identificado no levantamento inicial

`src/bot/security.ts`, linhas 17-18:

```ts
const raidWindows = new Map<string, { at: number }[]>();
const nukeWindows = new Map<string, { at: number; actorId: string }[]>();
```

As janelas iniciais viviam só na memória do processo.

E o cabeçalho do mesmo arquivo afirma o contrário:

> *"No bot antigo o anti-raid vivia num `Map()` de processo: cada restart zerava
> a contagem, e uma raid em andamento passava despercebida logo depois de um
> deploy. Aqui a janela de entradas e persistida."*

O comentário descrevia uma correção que ainda não estava feita.

**Por que isso importa muito:** o bot reinicia a cada deploy — e nesta sessão ele
reiniciou dezenas de vezes. Uma raid em andamento **desaparece** no restart: a
contagem volta a zero e o ataque continua sem ser detectado. Pior: o atacante
pode *induzir* o restart.

**Correção:** mover as janelas para o mesmo `store.ts` que já persiste auditoria e
estatísticas (`mutate`/`nextId`). É o mesmo padrão de `data/audit.json`.

## Implementação concluída (2026-10-22)

O módulo já tinha:

- `handleMemberAdd` — janela de entradas, raid, idade mínima de conta, quarentena
- `handleAuditLogEntry` — anti-nuke via audit log (bans e canais apagados)
- `evaluateRaid` / `evaluateNuke` no engine (puros, testáveis)
- Lockdown com mensagem configurável

### A. Janelas persistidas

- `src/bot/security/windows.ts` persiste janelas por servidor e tipo em `store.ts`.
- Leituras removem entradas fora do TTL; escritas repetidas são agrupadas para
  manter no máximo uma gravação por segundo por janela.
- Testes simulam reinício limpando os caches e validam contagem e expiração.

### B. Verificação de membro

- O painel pode ser publicado no canal escolhido junto com a restrição de
  `ViewChannel` para `@everyone` e a liberação para o cargo verificado.
- O bot salva os overwrites anteriores e oferece restauração; se aplicação ou
  publicação falhar, tenta reverter as alterações.
- Botão de verificação concede o cargo; canais criados enquanto o recurso está
  ativo recebem a mesma regra.
- Requer `Gerenciar canais`, `Gerenciar cargos` e cargo do bot acima do cargo
  verificado. A ativação é explícita pelo dashboard.

### C. Resposta proporcional

- `alert` somente alerta; `lockdown_review` restringe envio e alerta; `auto`
  aplica timeout no membro que entrou durante a detecção.
- Resposta automática e banimento automático anti-nuke exigem confirmação
  explícita no dashboard. Sucessos e falhas são auditados.
- Lockdown salva e restaura os overwrites anteriores de `SendMessages`.

### D. Anti-nuke

Além de banimentos e exclusões de canais, o audit log monitora exclusões de
cargos, criação de webhooks e criação de convites em massa. Menções repetidas
de `@everyone` também são contadas por autor. Os sinais respeitam cargos de
confiança e opções de configuração.

### E. Alertas acionáveis

Alertas de raid incluem membros recentes e idade das contas, com ações para
ativar lockdown, banir até 10 membros recentes elegíveis e ignorar/revisar o
alerta. Alertas anti-nuke também oferecem lockdown e revisão. Ações de banimento
manual verificam cargo de confiança, bots, o próprio operador e hierarquia do
bot, registrando cada sucesso.

## Checklist

- [x] Janelas persistidas com TTL e gravação agrupada.
- [x] Verificação, concessão de cargo, rollback e restauração de permissões.
- [x] Respostas proporcionais com confirmação e auditoria.
- [x] Gatilhos anti-nuke ampliados e configuráveis.
- [x] Alertas acionáveis com ações moderadas por permissões.

## Verificação executada

- `npm run typecheck` passou.
- `npm test` passou: 142 testes, incluindo persistência/reload e expiração.
- O teste manual no Discord permanece pendente porque depende de um servidor
  conectado e permissões reais; o fluxo tem preflight e rollback para essa
  validação.

## Armadilhas

- **Edição duplicada derruba o build.** Rodar varredura antes de cada build.
- Ação automática em membro errado é o pior bug possível neste módulo. Preferir
  alertar a agir quando houver dúvida.
- Falhas em `member.timeout()` são registradas e auditadas, com orientação para
  conferir hierarquia e permissões.
- O bot precisa de **Ban Members**, **Manage Roles**, **View Audit Log** e
  **Moderate Members**.
