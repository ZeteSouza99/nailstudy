# Convenções do projeto

- Interface, mensagens e comentários em português do Brasil.
- Regras de negócio puras ficam em `src/lib` (agenda em `scheduling.ts`, portal em `booking.ts`, permissões em `permissions.ts`) e têm testes unitários ao lado (`*.test.ts`).
- Acesso a banco só em `src/server/**` e `src/db/**`, com `import "server-only"` nos módulos usados pelo app.
- `"use server"` (`src/app/actions.ts`, `src/app/public-actions.ts`) contém só mutações. Cada action:
  1. envolve o corpo em `runAction`;
  2. checa o perfil com `requireActionUser(permissão)`;
  3. valida com `parseInput(schema, input)`;
  4. chama a camada `src/server`;
  5. chama `refreshApp()`.
- Leituras são feitas nas páginas (Server Components) via `src/server/queries.ts` e `portal-queries.ts`, sempre limitadas por período ou paginação.
- Erros para a pessoa usuária: lance `UserError`. Qualquer outro erro vira mensagem genérica e log estruturado.
- Formulários usam `useFormAction(schema, action)` com o mesmo schema Zod de `src/lib/validation.ts` que o servidor usa.
- Operações com várias escritas usam `atomic([...])` de `@/db` (batch no Neon, transação no PGlite).
- Sobreposição de horários é garantida pelas restrições `EXCLUDE` do banco além da validação em código; ao mudar as regras de agenda, mantenha `validateAppointment` como fonte única.
- Schema: edite `src/db/schema.ts` e rode `npm run db:generate`. Nunca use `drizzle-kit push`. Mudanças que removem colunas seguem expandir → migrar dados → contrair.
- Drizzle: em selects de tabela única, subconsultas correlacionadas precisam ser aninhadas (`sql\`${subquery}\``) para manter o qualificador da tabela.
- Antes de concluir, rode `npm run lint`, `npm run typecheck` e `npm test`. Para fluxos de tela, `npm run test:e2e`.
