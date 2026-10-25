# Sistema visual implementado

A identidade em produção segue a direção aprovada **Caderno de passagem**: uma superfície clara de leitura, tinta verde-petróleo para navegação e ação, e coral para revisão/alerta. A folha é apenas uma paleta; não há textura de papel na interface. A estrutura vem de cartões, linhas finas, grupos rotulados e listas de leitura previsível. A implementação é uma dashboard web em português para configuração de módulos Wumpus e operação de suporte conectado a servidores Discord.

## Tokens

Os valores abaixo vêm de `src/styles.css`. Utilitários Tailwind e algumas classes de componente adicionam dimensões locais, indicadas quando relevantes.

| Papel | Claro | Escuro |
|---|---|---|
| Fundo / tinta principal | `#F5F2EA` / `#24332F` | `#151D19` / `#F1EFE8` |
| Cartão | `#FFFFFF` | `#1D2722` |
| Popover | `#FFFFFF` | `#26322C` |
| Primária / hover / texto | `#28655B` / `#20564D` / `#FFFFFF` | `#75B5A5` / `#8BC6B5` / `#153B33` |
| Secundária / texto | `#E4EBE5` / `#24332F` | `#2A3931` / `#F1EFE8` |
| Muted / texto | `#EEEAE0` / `#59675F` | `#222E28` / `#B5BEB7` |
| Acento / texto | `#D66B3D` / `#FFFFFF` | `#E58C64` / `#2B1912` |
| Destrutivo | `#B94343` | `#F0817C` |
| Borda / campo / foco | `rgba(36,51,47,.13)` / `.20` / `#28655B` | `rgba(241,239,232,.12)` / `.18` / `#75B5A5` |
| OK / aviso / informação | `#28655B` / `#94560C` / `#3F6474` | `#75B5A5` / `#E8AE69` / `#8EB8C5` |

A prévia Discord tem paleta própria: superfície profunda `#1E1F22`, superfície `#313338`, cabeçalho `#2B2D31`, texto `#DBDEE1`, texto secundário `#949BA4`, rótulo `#B5BAC1` e azul Discord `#5865F2` nos botões primários. As prévias reproduzem o contraste escuro do Discord, sem misturar essa paleta com a primária Wumpus.

- **Tipografia:** `DM Sans`, com fallback `ui-sans-serif, system-ui, sans-serif`; mono `IBM Plex Mono`, `ui-monospace, "SF Mono", Menlo, monospace`. Corpo base 14 px, entrelinha 1.5. Escala CSS: legenda 12 px, corpo 14 px, título 20 px e display 32 px. Cabeçalhos usam tracking negativo; números que precisam alinhar podem usar `.font-mono-num` com algarismos tabulares.
- **Espaçamento:** escala explícita: 4, 8, 12, 16, 24 e 32 px. Há espaçamentos locais em componentes (ex.: shell e Discord) além dessa escala.
- **Raios:** 8 px para controles e 12 px para contêineres da aplicação. A prévia Discord mantém raios próprios: 16 px na janela, 12 px na mensagem Components V2, 8 px em embed e 4 px nos controles.
- **Bordas e elevação:** cartões comuns usam apenas um contorno fino com `var(--color-border)`; `.shadow-border` é um alias legado para a superfície plana sem sombra. A única elevação reutilizável é `.shadow-popover`, com `0 1px 2px rgba(36,51,47,.06), 0 0 0 1px rgba(36,51,47,.09)` no tema claro e uma sombra equivalente no escuro. Botões primários não recebem sombra própria.
- **Texto auxiliar:** interfaces de operação usam no mínimo 12 px. Tamanhos menores ficam restritos às prévias que reproduzem a densidade visual do Discord.

## Hierarquia e controles

O shell mantém identidade e contexto do servidor em primeiro plano. Em telas largas, uma coluna de ícones de servidores fica à esquerda da navegação fixa de 17 rem; os ícones mostram o servidor selecionado, aceitam arrastar para reordenar e também podem ser movidos com Alt+setas. Em telas menores que `lg`, essa coluna é removida para liberar espaço; a troca de servidor permanece no seletor do cabeçalho e no menu de navegação. A navegação apresenta o servidor ativo, rotas agrupadas e identidade do usuário. O avatar do perfil usa a imagem recebida do Discord, com fallback por iniciais. A barra superior contém o título da rota, estado de sincronização quando aplicável, controle de tema e convite para outro servidor. A preferência de tema (claro, escuro ou sistema) é persistida por conta neste navegador. O conteúdo ocupa a área principal. Rotas ativas recebem fundo secundário, e não dependem apenas de ícone.

Grupos de configuração são distintos das pastas visuais da coluna de servidores: eles organizam servidores que compartilham configurações. A criação usa uma janela focada para nome e seleção de comunidades; grupos e servidores integrantes podem ser reordenados. Canais e cargos continuam mapeados separadamente por servidor.

Os controles usam rótulos em português, dimensões de toque confortáveis (itens de navegação com mínimo de 40 px, ações principais com mínimo de 44 px nos estados de entrada), foco visível e feedback de hover. A troca de tema circula entre claro, sistema e escuro. Status de sincronização usam texto explícito junto a ponto colorido; falha também pode aparecer como alerta. A área de trabalho deve preservar a ordem de leitura: identificação, contexto, escolha/ação e resultado.

`PageHeader` reúne título, descrição e ações da página. `Section` padroniza título, descrição e divisória; `SettingRow` organiza preferências em listas; `Notice` usa três tons semânticos: informação, aviso e erro. A fila de tickets da Visão geral tem cabeçalho fixo durante a rolagem. A fila de Atendimento inicia no modo confortável e permite alternar para uma lista compacta. Controles menos frequentes da Base de conhecimento ficam recolhidos em “Como o bot responde”.

## Responsivo e acessibilidade

A partir do breakpoint `lg`, a navegação aparece como barra lateral e a coluna de servidores fica visível; abaixo disso, ambas são substituídas por botão de menu, painel lateral (Sheet) e seletor de servidor no cabeçalho. O painel fecha ao navegar ou trocar servidor. Título e conteúdo podem truncar em larguras estreitas; a descrição da rota e o convite ficam ocultos em telas menores. A área de conteúdo mantém margens confortáveis em containers estreitos, enquanto listas podem rolar dentro da navegação.

Na landing page, apenas Tickets usa uma prévia visual do Discord; os demais módulos são apresentados em texto. O estado de saúde do bot aparece junto ao rodapé para não interromper a leitura dos planos e perguntas frequentes.

A base define `:focus-visible` com contorno de 2 px e offset de 2 px, rótulo associado ao seletor de servidor, `aria-current="page"` na rota atual, nomes acessíveis para botões icon-only e ícones decorativos ocultos da árvore acessível. O indicador da rota ativa e o estado de sincronização usam entradas curtas para tornar mudanças de estado perceptíveis sem atrasar a operação; seções expansíveis revelam o conteúdo suavemente e o gráfico de atividade atualiza em 320 ms. O painel lateral já usa deslizamento ao abrir, e botões compartilhados dão feedback leve ao toque. O shell usa uma única coluna de servidores apenas quando há pelo menos dois servidores e oferece a ação de adicionar servidor em um único lugar por breakpoint. `prefers-reduced-motion` reduz animações e transições. A seleção de texto e o caret seguem a cor primária. Cor de estado é acompanhada de texto, conforme a direção. O Product brief pede operação por teclado, foco visível, rótulos claros e contraste legível; este documento descreve os suportes visíveis no shell e CSS, não uma auditoria completa de contraste de cada página.

## Prévia do Discord

`DiscordPanel`, `DiscordModalPreview` e `DiscordFormPreview` são convenções visuais embutidas para mostrar a aparência aproximada de painel, formulário e modal. A prévia de painel alterna entre Components V2 e embed; a de formulário separa escolhas e perguntas. A lista de campos da prévia limita selects e campos de texto aos cinco primeiros; opções mostram até quatro valores. O modal mostra até cinco perguntas. Esses cortes são limites de apresentação do componente.

As prévias têm `aria-hidden="true"` e os botões nelas são elementos de apresentação, não controles operáveis. Portanto, são uma referência visual para edição, não uma captura em tempo real do cliente Discord, validação de permissões, publicação nem confirmação de ação remota. O produto depende do servidor e da conexão do bot; mudanças que afetam Discord devem mostrar estado e resultado reais e respeitar limites da plataforma. Não se deve inferir paridade completa de recursos com Ticket Tool/Tickets ou autenticação delegada de equipe: capacidades reais e limites seguem o produto implementado e seus contratos.

## Limites de produto

O Wumpus ajuda administradores a configurar seus módulos e a equipe de suporte a acompanhar tickets e submissões. A experiência deve evitar exigir conhecimento técnico de bots, mas executar ações reais depende do servidor Discord e do bot conectado. Configurações não devem ser descritas como concluídas só por terem sido pré-visualizadas localmente. Este sistema visual documenta o shell e as convenções dos componentes inspecionados; páginas e comportamentos específicos podem adicionar regras próprias.
