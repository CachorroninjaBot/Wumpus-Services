# Wumpus Services

Repositório privado do produto Wumpus. Ele separa o bot público e a dashboard de clientes do HubOrderBot para reduzir memória e isolar deploys.

## Hospedagem

- **ShardCloud (256 MB):** somente `apps/wumpus`.
- **Dashboard:** `apps/dashboard`, publicada separadamente.
- **PostgreSQL:** compartilhado por bot e dashboard por meio de `DATABASE_URL`.

A configuração `.shardcloud` compila somente `core`, `database` e o bot Wumpus. A dashboard não faz parte dos workspaces instalados pela ShardCloud e, portanto, não consome a memória da aplicação do bot.

## ShardCloud

Conecte este repositório privado e cadastre as variáveis de bot presentes em `.env.example`. A migração do banco é executada antes do bot iniciar.

## Dashboard

Use o `vercel.json` da raiz. Cadastre `DATABASE_URL`, credenciais privadas da dashboard e variáveis OAuth diretamente no provedor; nunca publique valores reais.

Veja os módulos e permissões em `docs/WUMPUS.md`.
