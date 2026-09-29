# Erika Queiroz · Nail Designer

Sistema de agendamento e gestão para manicures, pedicures e nail designers.

O projeto possui duas áreas:

- **Painel administrativo:** visão geral, agenda diária e semanal, pedidos do portal, clientes, catálogo de serviços, horários do estúdio, bloqueios, pagamentos e relatórios.
- **Portal da cliente:** escolha do serviço e do horário, agendamento com Erika Queiroz, remarcação e cancelamento por link seguro.

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
ADMIN_USERNAME="Erika"
ADMIN_NAME="Erika"
ADMIN_PASSWORD="uma-senha-com-8-ou-mais-caracteres"
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

## Acesso administrativo

O sistema possui uma única conta administrativa, com acesso a todas as telas. O login aceita o usuário configurado em `ADMIN_USERNAME` (padrão: `Erika`), sem diferenciar maiúsculas de minúsculas, ou o e-mail cadastrado. Profissionais são cadastros operacionais da agenda e não possuem login próprio. Execute `db:seed-admin` novamente para atualizar usuário, nome, e-mail ou senha da administradora existente. A senha é fornecida por `ADMIN_PASSWORD` e armazenada no banco somente como hash bcrypt.

A identidade visual usa a logo em `public/erika-nails.png`. As paletas `brand`, `ink` e `gold` ficam em `src/app/globals.css` e atendem aos temas claro e escuro. O ícone do site é gerado a partir do monograma dessa mesma imagem.

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
```

## Regras da agenda

- Atendimento de segunda a sábado, das 08:00 às 19:00.
- Erika Queiroz é a única profissional. Dias, jornada e intervalo são configurados em **Meu estúdio**; todo novo serviço fica vinculado a ela automaticamente.
- Os bloqueios valem sempre para a agenda inteira do estúdio.
- O sistema impede horários sobrepostos para a profissional e para a cliente.
- Serviços podem ter tempo de preparação adicional entre atendimentos.
- Apenas atendimentos concluídos e ainda não cobrados aparecem no caixa.

A migration `0008_single_professional` arquiva os outros cadastros sem excluir atendimentos ou recibos. Os IDs históricos permanecem no banco; as consultas os tratam como parte da agenda única de Erika, inclusive ao calcular disponibilidade e relatórios. A API atribui Erika no servidor, mesmo quando recebe um identificador antigo de profissional.

## Notificações no celular da administradora

Novos agendamentos feitos pelo portal enviam Web Push aos dispositivos que a
administradora ativou. O aviso mostra o nome da cliente, a data e o horário do
agendamento (por exemplo, `Maria Silva · 02/09/2026 às 10:00.`), inclusive na tela
bloqueada conforme os ajustes do aparelho. Ao tocar, abre `/agenda/pendentes`,
que exige login para consultar o pedido completo. Não é necessário
publicar um aplicativo nas lojas ou manter o painel aberto.

### Configurar o envio

1. Publique o site com HTTPS.
2. Gere um par de chaves com `npx web-push generate-vapid-keys`.
3. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no ambiente
   do servidor. O assunto deve ser um contato real, como `mailto:admin@seu-dominio.com`.
   A chave privada é secreta; mantenha o mesmo par nas próximas publicações.
4. Execute `npm run db:migrate` para criar a tabela de dispositivos. Na Vercel,
   o comando de build já aplica as migrations.
5. Entre no painel, toque no sino, ative as notificações e use **Enviar teste**.

A chave pública é obtida do servidor em tempo de execução. Não é necessário
configurar variáveis `NEXT_PUBLIC_` para este recurso. Sem configuração válida,
os agendamentos continuam funcionando e o painel informa que o envio está indisponível.

### iPhone e iPad

Requer iOS/iPadOS 16.4 ou posterior. No Safari, use **Compartilhar → Adicionar à
Tela de Início**. Abra o sistema pelo ícone criado, entre como administradora e
toque no sino para ativar. A autorização deve partir desse toque; uma aba comum
do Safari não recebe esses avisos. O painel mostra as instruções de instalação.

### Android e outros dispositivos

Use um navegador atualizado com suporte a Web Push, como Chrome no Android.
É possível adicionar o sistema à tela inicial; a instalação não é obrigatória
no Chrome Android. Ative separadamente em cada aparelho desejado. O envio aceita
os provedores da Apple, Google/FCM e Mozilla.

As inscrições ficam no banco e continuam após sair da conta. Ative somente em
dispositivos de confiança e use **Desativar neste dispositivo** antes de deixar
de utilizá-lo. Inscrições recusadas pelo provedor com HTTP 404/410 são removidas.
Trocar as chaves VAPID exige desativar e ativar novamente nos aparelhos.

O envio ocorre depois de salvar a reserva, usando `after` do Next.js. Falhas de
push não cancelam o agendamento. Não há fila persistente de retentativas nesta
versão: falhas temporárias são registradas nos logs. A entrega também depende
da conexão, das permissões e dos ajustes de Foco/bateria do aparelho. O aviso
fica disponível no provedor por até uma hora. Remarcações e agendamentos criados
pela própria administradora não disparam o aviso de **novo agendamento**.

Para validar em aparelhos reais, use uma publicação HTTPS, ative e envie um teste
em cada plataforma; depois feche o painel, faça uma reserva pelo portal em outro
navegador e confirme o recebimento e a abertura dos pedidos ao tocar no aviso.
Os testes automatizados simulam o provedor de push e não substituem essa verificação.
