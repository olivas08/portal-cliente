# Portal do Cliente — Operon

Aplicação real (não mock) do Portal do Cliente para PME industrial, construída com
Next.js App Router + Server Actions, Prisma e Auth.js. Permite a clientes acompanhar
encomendas, gerar documentos (PDF) e trocar requerimentos com a fábrica; e a uma conta
de administração gerir estados de encomendas e responder a requerimentos.

## Stack

- **Next.js 16** (App Router, Server Actions, TypeScript strict)
- **Prisma 6** + **PostgreSQL** (Supabase)
- **Auth.js v5** (credentials, bcrypt, JWT sessions, middleware por role)
- **Tailwind CSS v4** + **lucide-react**
- **jsPDF** (guia de remessa, certificado de conformidade, fatura pro-forma)

## Arranque local

1. Instalar dependências:
   ```bash
   npm install
   ```

2. Criar `.env` a partir de `.env.example` e preencher com as connection strings do
   Supabase (Project Settings → Database → Connection string):
   - `DATABASE_URL` — Transaction pooler (porta 6543)
   - `DIRECT_URL` — Direct connection (porta 5432)
   - `AUTH_SECRET` — gerar com `npx auth secret`
   - `RESEND_API_KEY` / `EMAIL_FROM` — opcional; sem chave, os emails
     (reposição de password, notificação de estado de encomenda) ficam
     apenas registados na consola
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — necessário para o
     upload de anexos nas encomendas (ver secção "Anexos" abaixo)

3. Aplicar o schema e semear dados de demonstração:
   ```bash
   npm run db:migrate      # cria as tabelas (primeira migration)
   npm run db:seed         # insere empresas, utilizadores, encomendas e requerimentos
   ```

4. Correr em desenvolvimento:
   ```bash
   npm run dev
   ```

## Contas de demonstração

| Papel   | Email                        | Palavra-passe |
|---------|------------------------------|---------------|
| Admin   | admin@fabrica-demo.pt        | admin2026     |
| Cliente | compras@motapecas.pt         | mota2026      |
| Cliente | geral@metalsantos.pt         | santos2026    |
| Cliente | encomendas@plasticosnorte.pt | pn2026        |

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` / `npm start` — build e execução de produção
- `npm run db:migrate` — Prisma migrate dev
- `npm run db:push` — sincroniza o schema sem migration (dev rápido)
- `npm run db:seed` — semeia a base de dados
- `npm run db:studio` — Prisma Studio (UI da BD)

## Estrutura

```
src/
  app/
    login/                  # página de login (client)
    dashboard/              # área do cliente (encomendas + requerimentos)
    admin/                  # área de administração (gestão + respostas)
    api/auth/[...nextauth]/ # handler Auth.js
  actions/                  # server actions (orders, requests, auth)
  components/               # UI (nav, badges, tabelas, PDF, formulários)
  lib/                      # prisma, data-access, tipos, geração de PDF
  auth.ts / auth.config.ts  # configuração Auth.js (config edge-safe partilhada)
  proxy.ts                  # middleware de proteção de rotas por role
prisma/
  schema.prisma             # modelo de dados
  seed.ts                   # dados de demonstração
```

## Anexos (upload de ficheiros nas encomendas)

Os anexos ad-hoc (fichas técnicas, fotos, certificados extra) são guardados no
Supabase Storage, no mesmo projeto da base de dados:

1. No dashboard do Supabase, ir a **Storage** e criar um bucket **privado**
   chamado `order-documents`.
2. Em **Project Settings → API**, copiar o `Project URL` e a `service_role
   key` (⚠️ nunca expor esta chave no browser) para `SUPABASE_URL` e
   `SUPABASE_SERVICE_ROLE_KEY` no `.env`.

Sem estas variáveis definidas, o resto da aplicação funciona normalmente — o
upload de anexos apenas mostra uma mensagem de erro a indicar que o
armazenamento ainda não está configurado.

## Deploy (Vercel + Supabase)

1. Criar projeto na Vercel a partir deste repositório.
2. Definir as variáveis de ambiente (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`,
   `AUTH_TRUST_HOST`, `RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`).
3. O `postinstall` corre `prisma generate` automaticamente.
4. Aplicar migrations em produção com `npx prisma migrate deploy` (via CI ou localmente contra a BD de produção).
