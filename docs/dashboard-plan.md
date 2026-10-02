# Dashboard criativa — especificação

> Não é "deixar bonito". É fazer a configuração ser compreensível e o estado do
> bot ser visível.

## O problema real

A dashboard de hoje tem **40 campos por módulo** e o usuário não sabe o que
importa. Pior: até pouco tempo, muitos campos **não faziam nada** — o painel
salvava, o bot não lia.

Redesenhar antes de os módulos funcionarem seria maquiar. **Fazer por último é
proposital.**

## Rotas atuais

```
/app/index.tsx       /app/tickets.tsx     /app/forms.tsx
/app/moderation.tsx  /app/protect.tsx     /app/logs.tsx
/app/staff.tsx       /app/stats.tsx       /app/knowledge.tsx
/app/settings.tsx
```

`protect.tsx` é segurança, `settings.tsx` mistura muita coisa.

## Princípios

### 1. Painel por RESULTADO, não por campo

Hoje: "Atendimento → 24 campos".

Deveria ser: **"Quando alguém abre um ticket, o que acontece?"** com 4 decisões:

- Onde o painel aparece
- Quem atende
- Quanto tempo até avisar
- Se pede feedback no fim

O avançado fica atrás de um "Avançado" que a maioria nunca abre.

### 2. Estado vazio que ensina

Tela vazia hoje: "Nenhum atendimento nesta vista."

Deveria ser: o que fazer para ter o primeiro, com botão. O vazio é onde o usuário
novo passa mais tempo.

### 3. Erro que diz o próximo passo

"Falha ao salvar" não ajuda. Precisa dizer **o que fazer**:

> O bot não tem permissão de **Gerenciar Canais** em Aurora. Sem ela, tickets não
> podem ser criados. [Como resolver]

### 4. O painel diz o que o BOT está fazendo

Hoje a dashboard mostra o que **ela** acha. O que importa é o bot: está online?
Em quantos servidores? Última publicação deu certo?

O canal de saída já grava o resultado real das publicações. **Expor isso.**

## Design system

Existe parcialmente (`brand.tsx`, tokens em CSS, `data-theme`). Consolidar:

| Item | Hoje | Deveria |
|---|---|---|
| Cores | espalhadas | 1 arquivo de tokens |
| Tipografia | Outfit | escala definida (não tamanhos soltos) |
| Espaçamento | valores avulsos | escala de 4px |
| Dark mode | só escuro | claro/escuro/sistema |
| Mobile | usável no desktop | navegação própria no mobile |

**Mobile é o maior buraco.** O layout usa `lg:grid-cols-[280px_1fr]` — abaixo de
`lg` a lista e o detalhe empilham, e o detalhe fica abaixo da dobra. Quem
gerencia comunidade usa celular.

## Landing pública

Hoje `/` é a dashboard. Precisa ser uma página separada:

- O que é o Wumpus (em 1 frase)
- Funcionalidades (com imagens reais, não ícones)
- Planos e preços (vêm da ShardPay — `catalog.ts` já tem)
- FAQ
- Status do bot
- Botão de convite

O painel logado vai para `/app`, que já é o caminho.

## Admin

`/admin` existe com senha. Falta:

- **2FA** — senha sozinha não protege acesso a todos os servidores
- Lista de membros da dashboard
- Licenças
- Saúde do bot
- Force-resync (republicar config de um servidor)

## Validação

`zod` está instalado. Toda config que chega ao servidor precisa ser validada lá —
nunca confiar na UI. JSON avançado, se existir, sanitizado.

## Ordem sugerida

1. **Estado do bot visível** — barato, alto impacto, usa o canal de saída que já existe
2. **Tokens + mobile** — o redesign sem isso é cosmético
3. **Módulos por resultado** — reescrever uma tela (tickets) como piloto
4. **Landing** — independente, pode ser em paralelo
5. **Admin + 2FA**
6. **Tema claro**

## Armadilhas

- **Edição duplicada derruba o build.** Rodar varredura antes de cada build.
- A dashboard **não fala com o Discord**. Qualquer ação real passa pelo canal de
  saída (`outbox`). Não criar botão que só muda estado local — foi esse o bug do
  "Publicar painel".
- `hydrate` faz merge de defaults (feito nesta sessão): chave nova de padrão já
  chega a workspace existente. Aproveitar para limpar campos mortos.
- Antes de redesenhar, **listar os campos que o bot não lê**. Redesenhar em cima
  de decoração perpetua o problema.
