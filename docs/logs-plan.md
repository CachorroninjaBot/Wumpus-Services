# Logs hipermega detalhados — especificação

> Referência: **Sapphire** (sapph.xyz) — "make use of 80+ log types", com ignore
> por usuário, cargo e canal.
>
> A meta não é copiar: é ter a mesma cobertura com o visual V2 do Wumpus.

## Objetivo

Todo evento relevante do servidor vira uma mensagem detalhada no canal de logs,
com autor, alvo, antes/depois e link — não uma linha seca.

## Estado atual (verificado)

`src/bot/logs.ts` já tem a espinha: `recordAudit` (histórico em `data/audit.json`)
e `logToChannel` (mensagem no Discord). A auditoria é best-effort — falha de canal
não impede a ação de ter efeito. Isso está certo e deve ser mantido.

Categorias declaradas em `CATEGORY_FLAG`:

| Categoria | Flag | Tem default? |
|---|---|---|
| moderation | `logModeration` | ✅ |
| members | `logMembers` | ✅ |
| messages | `logMessages` | ✅ |
| voice | `logVoice` | ❌ **não existe** |
| roles | `logRoles` | ✅ |
| channels | `logChannels` | ❌ **não existe** |
| bans | `logBans` | ✅ |
| automod | `logAutoMod` | ✅ |

**Bug real encontrado ao escrever este plano:** `logVoice` e `logChannels` são
lidos pelo bot mas **não existem em `moduleDefaults.logs`**. Dependendo do
fallback de `bool()`, logs de voz e de canal **nunca disparam** — em silêncio.
Exatamente o padrão "campo que o bot lê e a UI nunca escreve", invertido.

Conferir também `compactMode` e `retentionDays`: existem no default, mas não
achei quem os leia. Podem ser decoração.

## Cobertura desejada

O audit log do Discord expõe ~60 tipos. Agrupar como o Flavibot faz é o modelo
mais legível:

| Grupo | Eventos |
|---|---|
| **Mensagens** | apagada, editada (antes/depois), bulk delete, fixada, desafixada |
| **Membros** | entrou, saiu, apelido, cargos, avatar, timeout, boost |
| **Moderação** | ban, unban, kick, prune, ação do automod, regra criada/editada |
| **Cargos** | criado, editado (permissões antes/depois), apagado |
| **Canais** | criado, editado, apagado, overwrite criado/editado/apagado, thread |
| **Voz** | entrou, saiu, moveu de canal |
| **Servidor** | settings, emoji, sticker, soundboard, onboarding |
| **Convites** | criado, apagado |
| **Integrações** | webhook criado/editado/apagado, app adicionada/removida |
| **Eventos** | evento agendado, stage |

## Regras de desenho

### 1. Antes/depois é o que dá valor

"canal editado" não diz nada. O que importa:

```
#geral  →  #avisos
slowmode 0s → 30s
```

Usar `entry.changes` do audit log. É a diferença entre um log útil e um ruído.

### 2. Ignore por usuário, cargo e canal

Sapphire tem, e é o que torna 80 tipos usáveis. Sem isso, o bot loga a si mesmo,
loga a equipe, e o canal vira spam — o usuário desliga tudo e perde o recurso.

Já existe `ignoreBotMessages`. Faltam:
- `ignoredUserIds`
- `ignoredRoleIds`
- `ignoredChannelIds`

E a checagem precisa acontecer **antes** de montar o payload, não depois.

### 3. Nunca misturar `content` com V2

`buildLogPayload` já monta o container certo. Não adicionar `content` na chamada
de `send` — foi esse exato erro que impediu candidaturas de serem publicadas
(erro 50035).

### 4. Teto de 4000 caracteres

`buildLogPayload` corta o texto total. Ao adicionar campos de antes/depois, o
volume cresce rápido: um diff de permissões pode ter 30 linhas. **Truncar o diff,
não o log inteiro** — perder o autor é pior que perder as últimas permissões.

### 5. Custo de gateway

Cada tipo de log é um listener. ~60 listeners é aceitável, mas:
- `messageUpdate` dispara muito: ignorar edições idênticas (embed resolve)
- `presenceUpdate` **não** usar — é o evento mais caro do gateway
- Agrupar rajadas: 10 canais apagados em 2s = **1** mensagem, não 10

O agrupamento é o que separa "hipermega detalhado" de "inutilizável".

## Arquitetura sugerida

```
src/bot/logs/
├── index.ts        # recordAudit + logToChannel (o que já existe, movido)
├── categories.ts   # grupo -> flags, rótulos, cores
├── listeners.ts    # registro dos handlers de gateway
├── render.ts       # evento -> payload V2 (puro, testável)
└── diff.ts         # changes do audit log -> linhas antes/depois (puro)
```

`render.ts` e `diff.ts` são **puros** — é onde os testes devem se concentrar.
Foi assim que a fila de saída ficou testável sem discord.js.

## Como testar

1. `npm run typecheck && npm test`
2. Testar `diff.ts` com `changes` reais do audit log (fixtures)
3. Testar `render.ts`: payload não tem `content`, cabe em 4000, ignora certo
4. **Humano no Discord**: apagar uma mensagem, editar um canal, mudar um cargo
5. Conferir `data/audit.json` e o canal de logs

## Armadilhas

- **Edição duplicada derruba o build.** Já aconteceu 5×. Rodar varredura de
  duplicatas antes de cada build.
- O bot precisa das permissões **View Audit Log** e **View Channel** no canal de
  logs. Sem elas, `logToChannel` devolve `false` em silêncio — considerar
  registrar isso no painel.
- `moduleConfig(guild.id, "logs")` lê o runtime. Config nova só chega ao bot
  depois de publicada pelo painel.
