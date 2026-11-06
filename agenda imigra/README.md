# Agenda do Imigra

Agenda pessoal de gravações e publicações, feita com Next.js App Router, Drizzle ORM e PostgreSQL. Sem login e sem dados de demonstração.

## O banco se cria sozinho

O aplicativo cria as tabelas automaticamente na primeira vez que abre (não é preciso rodar migrações). Basta apontar a variável `DATABASE_URL` para qualquer PostgreSQL acessível (Render, Supabase, Neon, etc.). O `src/db/schema.ts` continua sendo a fonte oficial do esquema para o Drizzle.

## Executar localmente

1. Configure `DATABASE_URL` no arquivo `.env`.
2. `npm install` e `npm run dev`.

## Publicar no Render (passo a passo)

1. Coloque os arquivos deste projeto em um repositório no **GitHub** (como fizemos no outro aplicativo).
2. No **Render** (render.com), clique em **New → Web Service** e conecte o repositório.
3. Crie um **PostgreSQL** no Render: menu **New → PostgreSQL** (plano gratuito) e espere o banco ficar ativo.
4. No Web Service, preencha:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Environment:** adicione `DATABASE_URL` com a string de conexão **interna** do PostgreSQL do Render (aberta em **Connect → Internal Database URL**).
5. Clique em **Deploy**. As tabelas são criadas automaticamente na primeira carga da página.

Observações:
- O PostgreSQL gratuito do Render é um **teste de 90 dias** e depois é excluído. Use a tela **Exportar e backup** para baixar um backup JSON do seu aplicativo com frequência (idealmente uma vez por mês).
- A Web Service gratuita desliga após 15 minutos sem uso; a primeira página depois disso pode demorar alguns segundos.
- O app **não tem autenticação**: quem tiver o endereço acessa seus dados. Mantenha o endereço fora do alcance público ou proteja com um serviço externo de acesso.

## Publicar no Netlify (alternativa)

Use **Netlify** para o site e o **Supabase** (ou outro PostgreSQL) para o banco. Configure `DATABASE_URL` como variável de ambiente do servidor (nunca `NEXT_PUBLIC_*`). Para o Supabase, use a string de conexão do modo sessão encontrada em Settings → Database.

## Dados e backup

Em **Exportar e backup**, baixe CSVs de gravações, publicações, histórico completo e um backup JSON de tudo. As datas do painel usam o fuso `America/Asuncion` (Ciudad del Este); os horários são os que você informa.
