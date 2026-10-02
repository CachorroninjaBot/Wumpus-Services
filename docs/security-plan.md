# Segurança — especificação

> Referência: **GS Defender** (GamerSafer) — verificação de membro, anti-nuke,
> proteção de raid. A meta é cobrir o mesmo terreno com a arquitetura que já
> temos.

## Objetivo

Impedir raid e nuke de verdade, com resposta automática e alerta visível para a
equipe. Não só detectar e logar.

## 🔴 Bug crítico encontrado ao escrever este plano

`src/bot/security.ts`, linhas 17-18:

```ts
const raidWindows = new Map<string, { at: number }[]>();
const nukeWindows = new Map<string, { at: number; actorId: string }[]>();
```

**Nunca são persistidos.** Vivem só na memória do processo.

E o cabeçalho do mesmo arquivo afirma o contrário:

> *"No bot antigo o anti-raid vivia num `Map()` de processo: cada restart zerava
> a contagem, e uma raid em andamento passava despercebida logo depois de um
> deploy. Aqui a janela de entradas e persistida."*

O comentário descreve uma correção **que não foi feita**. O código é exatamente o
que ele diz ter substituído.

**Por que isso importa muito:** o bot reinicia a cada deploy — e nesta sessão ele
reiniciou dezenas de vezes. Uma raid em andamento **desaparece** no restart: a
contagem volta a zero e o ataque continua sem ser detectado. Pior: o atacante
pode *induzir* o restart.

**Correção:** mover as janelas para o mesmo `store.ts` que já persiste auditoria e
estatísticas (`mutate`/`nextId`). É o mesmo padrão de `data/audit.json`.

## Estado atual (verificado)

`security.ts` já tem:

- `handleMemberAdd` — janela de entradas, raid, idade mínima de conta, quarentena
- `handleAuditLogEntry` — anti-nuke via audit log (bans e canais apagados)
- `evaluateRaid` / `evaluateNuke` no engine (puros, testáveis)
- Lockdown com mensagem configurável

Config em `moduleDefaults.security`: `alertChannelId`, `alertStaffRoleIds`,
`response`, `raidMode`, `raidJoinThreshold`, `raidWindowSeconds`,
`minAccountAgeHours`, `quarantineNewMembers`, `nukeActionThreshold`,
`nukeWindowSeconds`, `timeoutMinutes`, `trustedRoleIds`, `lockdownMessage`,
`lockdown`.

Base sólida. O que falta é **persistência** e **resposta**.

## O que construir

### A. Persistir as janelas (crítico — fazer primeiro)

Sem isso, todo o resto é frágil. Guardar em `store.ts` com TTL, podando na
leitura. A janela é curta (30-60s), então o custo é baixo.

Cuidado: `store.ts` grava em disco. Uma janela de raid com entradas a cada
milissegundo poderia gerar escrita demais. **Agrupar**: gravar no máximo 1×/s.

### B. Verificação de membro (GameSafer faz, nós não)

O fluxo do GS Defender: membro novo cai num estado sem acesso, prova que é
humano (botão/captcha), ganha o cargo.

Já temos `quarantineNewMembers` + `timeoutMinutes`, que é metade disso. Falta:

1. Canal de verificação com painel e botão
2. Cargo "verificado" concedido ao clicar
3. Sem o cargo, o membro não vê os outros canais (permissão `@everyone` deny)

O item 3 é o que dá a proteção real — hoje o membro em quarentena ainda lê tudo.

### C. Resposta proporcional

`response: "lockdown_review"` é a única opção. Precisa de níveis:

| Modo | Comportamento |
|---|---|
| `alert` | só avisa a equipe |
| `lockdown_review` | fecha o servidor e avisa (atual) |
| `auto` | age sozinho: timeout/kick em quem entra durante a raid |

`auto` é arriscado. Se entrar, exigir confirmação explícita no painel e registrar
cada ação automática na auditoria.

### D. Anti-nuke mais amplo

Hoje vigia bans e canais apagados. O padrão de conta comprometida inclui:
- cargos apagados em massa
- webhooks criados em massa (exfiltração)
- convites criados em massa
- `@everyone` com menção repetida

### E. Alertas acionáveis

O alerta precisa dizer **o que fazer**. Um embed com "RAID DETECTADA" e nada mais
é inútil às 3h da manhã.

Incluir: quem está entrando, há quanto tempo a conta existe, e **botões** —
"Ativar lockdown", "Banir os últimos N", "Ignorar".

## Arquitetura sugerida

```
src/bot/security/
├── index.ts        # handlers (o que já existe)
├── windows.ts      # janelas persistidas (NOVO — crítico)
├── verify.ts       # fluxo de verificação
├── respond.ts      # níveis de resposta
└── rules.ts        # padrões de nuke (puro, testável)
```

## Como testar

1. Testar `evaluateRaid`/`evaluateNuke` com fixtures (já existem testes)
2. Testar a **persistência**: gravar janela, recriar o módulo, ler de volta
3. Testar que a janela expira
4. **Humano no Discord**: entrar com conta nova, ver se é barrado
5. Testar restart: `npm run start`, derrubar, subir — a janela sobrevive?

## Armadilhas

- **Edição duplicada derruba o build.** Rodar varredura antes de cada build.
- Ação automática em membro errado é o pior bug possível neste módulo. Preferir
  alertar a agir quando houver dúvida.
- `member.timeout()` falha em silêncio se o bot não tiver cargo acima do alvo.
  Registrar a falha, não engolir.
- O bot precisa de **Ban Members**, **Manage Roles**, **View Audit Log** e
  **Moderate Members**.
