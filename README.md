# Nail Agenda

Sistema de agendamento e gestão para manicures, pedicures e nail designers.

O projeto possui duas áreas:

- **Painel da equipe:** visão geral, agenda diária e semanal, pedidos do portal, clientes, catálogo de serviços, profissionais, bloqueios, pagamentos e relatórios.
- **Portal da cliente:** escolha do serviço e da profissional, consulta de horários livres, agendamento, remarcação e cancelamento por link seguro.

O catálogo de demonstração inclui manicure, pedicure, esmaltação em gel, alongamento em fibra, manutenção, reparo, spa dos pés e nail art. O sistema também oferece tema claro e escuro com preferência salva no navegador.

## Tecnologias

- Next.js 16, React 19, TypeScript e Tailwind CSS 4
- Drizzle ORM e PostgreSQL no Neon
- NextAuth com credenciais e JWT
- Vitest e Playwright
- PGlite para desenvolvimento e testes locais sem acessar o banco de produção

## Configuração local

```bash
npm install
copy .env.local.example .env.local
```

Para começar sem usar o Neon, configure no `.env.local`:

```dotenv
DATABASE_URL="pglite:./.data/dev"
AUTH_SECRET="gere-um-segredo-forte"
APP_URL="http://localhost:3000"
ADMIN_EMAIL="admin@nailagenda.com"
ADMIN_PASSWORD="uma-senha-com-10-ou-mais-caracteres"
```

Depois execute:

```bash
npm run db:migrate
npm run db:seed
npm run db:seed-admin
npm run dev
```

A aplicação fica disponível em `http://localhost:3000`, e o portal público em `http://localhost:3000/agendar`.

## Banco Neon

Use no `DATABASE_URL` a connection string copiada do painel do Neon. Nunca coloque a senha no código, no Git ou em mensagens públicas. Se uma credencial for exposta, redefina a senha antes de utilizá-la.

Para preparar um banco vazio:

```bash
npm run db:migrate
npm run db:seed
npm run db:seed-admin
```

O seed é idempotente: registros com os mesmos identificadores não são duplicados.

## Perfis

| Perfil | Acesso |
| --- | --- |
| `admin` | Todas as telas, cadastros, pagamentos e relatórios |
| `receptionist` | Agenda, clientes, bloqueios e caixa; catálogo somente para leitura |
| `professional` | A própria agenda e os próprios atendimentos |

## Comandos

```bash
npm run dev             # desenvolvimento
npm run build           # build de produção
npm run lint            # análise de código
npm run typecheck       # verificação TypeScript
npm test                # testes unitários e de integração
npm run test:e2e        # testes completos no navegador
npm run db:migrate      # aplica migrations
npm run db:seed         # catálogo e dados de demonstração
npm run db:seed-admin   # cria ou atualiza a administradora
npm run db:create-user  # cria outros usuários
```

## Regras da agenda

- Atendimento de segunda a sábado, das 08:00 às 19:00.
- Cada profissional possui dias, jornada, intervalo, serviços e comissão próprios.
- Bloqueios podem valer para todo o estúdio ou somente para uma profissional.
- O sistema impede horários sobrepostos para a profissional e para a cliente.
- Serviços podem ter tempo de preparação adicional entre atendimentos.
- Apenas atendimentos concluídos e ainda não cobrados aparecem no caixa.
