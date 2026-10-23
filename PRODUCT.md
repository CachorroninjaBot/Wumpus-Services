# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Administradores de servidores Discord configuram os módulos do Wumpus. A equipe
de suporte usa a dashboard para acompanhar e responder tickets e analisar
formulários.

## Product Purpose

O Wumpus reúne ferramentas de operação e proteção para servidores Discord. A
dashboard deve ajudar a configurar essas ferramentas e operar o suporte sem
exigir que a pessoa conheça detalhes técnicos de bots.

## Positioning

Configurar atendimento, formulários e os módulos do servidor sem precisar
entender de bots.

## Operating Context

O administrador seleciona um servidor Discord, configura módulos na web e
publica alterações que o bot executa conectado ao Discord. A equipe de suporte
acompanha tickets e submissões pela dashboard.

## Capabilities and Constraints

- A interface e as mensagens do produto são em português.
- O produto depende de um servidor Discord e da conexão do bot para executar
  ações reais.
- Configurações e ações que afetam o Discord precisam mostrar seu estado e
  resultado; a interface não deve apresentar simulações locais como operações
  já realizadas.
- A configuração de tickets e formulários precisa acomodar os limites reais da
  plataforma Discord.

## Brand Commitments

- Preservar o nome Wumpus.
- Manter a integração com Discord.
- Usar português na experiência do produto.

## Evidence on Hand

- Repositório com o bot Discord, dashboard e planos em `docs/`.
- Não há depoimentos, métricas públicas ou outros ativos de prova aprovados no
  repositório; não criar essas alegações.

## Product Principles

- Guiar configurações com linguagem clara e prévias do resultado.
- Mostrar o estado real entre dashboard, fila e bot.
- Dar à equipe uma visão rápida da próxima ação necessária.
- Validar limites e permissões antes de publicar mudanças.

## Accessibility & Inclusion

- Manter a interface operável por teclado, com foco visível, rótulos claros e
  contraste legível.
