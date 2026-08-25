# Wumpus Control

O **Wumpus** é o produto de gestão de comunidades do HubOrder. Um usuário só enxerga no painel os servidores em que:

1. fez login usando Discord;
2. possui a permissão **Gerenciar servidor** ou é dono;
3. o Wumpus está instalado e sincronizado.

Os servidores começam independentes. O cliente pode criar um **grupo por negócio ou operação**, adicionar servidores e configurar módulos uma única vez. Todo servidor do grupo herda essa configuração; em qualquer módulo, ele pode manter a herança, desativar apenas aquele módulo no servidor ou criar uma configuração exclusiva.

## Módulos incluídos

| Área | Módulos |
| --- | --- |
| Operação | Servidores, estatísticas, staff, cargos e permissões, central de automações, integrações e webhooks |
| Proteção | Moderação, AutoMod, anti-raid e anti-nuke, OCR de imagens, logs e auditoria |
| Atendimento | Central de denúncias e apelações, tickets e atendimento, formulários e candidaturas |
| Inteligência | Rascunhos de cargos com Groq e base de conhecimento aprovada |

Os módulos indicados no painel podem ser pausados sem apagar a configuração. A validação acontece no servidor antes de o bot receber uma alteração.

## Segurança por design

- A IA cria rascunhos de cargos e respostas; ela não atribui o cargo Administrator, não altera cargos sozinha e não bane pessoas.
- Anti-raid e anti-nuke registram um incidente, alertam a equipe e só aplicam timeout preventivo quando o administrador escolhe explicitamente timeout_suspect.
- Dono do servidor, o próprio Wumpus e cargos confiáveis não entram em contenção automática.
- Conteúdo normal de mensagens não é gravado nas estatísticas. O AutoMod persiste o motivo e o resultado da ação, não o texto original.
- OCR só é chamado se o módulo estiver ativo. O texto extraído só é salvo quando retainExtractedText estiver habilitado.
- Webhooks devem ter destino incluído na allowlist. Nunca coloque tokens ou segredos no campo de configuração do painel.

## Login do dashboard local

Crie uma aplicação OAuth no portal de desenvolvedores do Discord e use o mesmo Client ID do Wumpus. Para uso somente nesta máquina, configure o Redirect URI exatamente como:

    http://localhost:3000/auth/discord/callback

Preencha no ambiente:

    WUMPUS_OAUTH_CLIENT_ID
    WUMPUS_OAUTH_CLIENT_SECRET
    WUMPUS_OAUTH_REDIRECT_URI
    DASHBOARD_SESSION_SECRET

DASHBOARD_SESSION_SECRET deve ter pelo menos 32 caracteres aleatórios. O navegador guarda apenas um identificador de sessão HTTP-only assinado; os dados de sessão e a lista de servidores ficam no PostgreSQL. O token de acesso do Discord não vai para o navegador e não é gravado pelo HubOrder. O Compose publica dashboard e API somente em `127.0.0.1`, nas portas 3000 e 3001. Abra `http://localhost:3000/wumpus` na mesma máquina que hospeda os containers.

Mantenha `DASHBOARD_COOKIE_SECURE=false` enquanto o painel local usar HTTP. Ao colocar o dashboard atrás de HTTPS, altere-o para `true` antes de disponibilizá-lo fora da máquina.

## Permissões e intents do bot

No portal do Discord, ative os intents privilegiados Server Members Intent e Message Content Intent para o Wumpus. Sem eles, o anti-raid, as métricas de entrada e o AutoMod não recebem os eventos necessários.

Ao convidar o bot, conceda somente o necessário:

- View Audit Log para anti-nuke;
- Manage Messages para AutoMod;
- Moderate Members para timeout preventivo;
- Manage Roles para sincronização e futura aplicação manual de rascunhos;
- Manage Channels para tickets;
- Send Messages, Embed Links e Attach Files para painéis, alertas e transcrições.

O comando /diagnostico avisa se permissões importantes estiverem ausentes.

## Configurações importantes

Abra o grupo no dashboard para configurar a operação compartilhada, ou abra um servidor independente. Os controles comuns usam campos normais; o JSON fica opcional para ajustes avançados. Exemplos:

    Anti-raid: altere raidJoinThreshold, raidWindowSeconds e response.
    AutoMod: ajuste messageLimit, duplicateLimit, blockedTerms e action.
    Tickets: ative o módulo, informe categoryId, staffRoleIds e transcriptChannelId.
    Denúncias: defina staffRoleIds e reviewChannelId.
    Base de conhecimento: publique artigos e, se quiser respostas geradas, habilite useGroq.

Depois de configurar tickets ou candidaturas, abra o módulo no dashboard, escolha o canal do servidor e use **Publicar painel**. O template permite Components V2 ou embed tradicional e é enviado pelo bot em poucos segundos.

Para manter o Discord limpo, os únicos comandos registrados pelo Wumpus são:

    /wumpus
    /diagnostico

## OCR Haiz + Groq

O OCR do Wumpus usa a sua Haiz API como leitura principal. Ela recebe `image_url`, `language` e `preprocess` e devolve texto, linhas e URLs extraídas. Como o endpoint da Haiz autentica pelo cabeçalho `Authorization: Bot <token>`, o Wumpus usa seu próprio token somente na chamada HTTPS para `WUMPUS_HAIZ_OCR_URL`; nunca coloque esse token em configurações do dashboard.

No módulo OCR, use `provider: "haiz"` para somente a leitura especializada, `"groq"` para somente visão, ou `"hybrid"` (padrão) para a Haiz extrair o texto e a Groq comparar a imagem, identificar risco e indicar divergências. O texto só é persistido quando `retainExtractedText` está ligado. `haizRequestsPerMinute` protege o limite por IP da Haiz e tem teto global de 50.

Configure WUMPUS_GROQ_API_KEY para a segunda leitura visual, /cargo-ia e respostas da base de conhecimento. Os modelos padrão são configuráveis com:

    WUMPUS_GROQ_MODEL
    WUMPUS_GROQ_VISION_MODEL

O Wumpus solicita JSON estruturado à Groq e valida esse JSON antes de usá-lo. Se a Groq estiver indisponível, a Haiz continua extraindo o texto; se a Haiz falhar, a Groq funciona como fallback visual. A moderação e os demais módulos continuam operando sem IA.
