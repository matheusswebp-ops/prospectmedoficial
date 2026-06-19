# ProspectMed — CLAUDE.md
*Gerado pelo IdeaForge Squad (Sherlock) em 2026-06-15*

> Leia este arquivo antes de escrever qualquer código. Ele contém tudo que você precisa para construir este produto do zero ao fim.

---

## 1. Visão Geral do Produto

**ProspectMed** é um SaaS de prospecção comercial automatizada voltado para agências e freelancers que vendem criação de sites para profissionais de saúde no Brasil. O sistema executa um ciclo diário de busca, qualificação e abordagem de leads sem exigir trabalho manual repetitivo do usuário.

**Usuário-alvo:** Agência digital ou profissional autônomo que vende websites para médicos, dentistas, fisioterapeutas e outros profissionais de saúde. Usuário único no MVP, arquitetura preparada para multi-usuário (RLS no Supabase desde o início).

**O que o sistema faz, em ordem de execução:**

1. Usuário informa cidade e especialidade médica desejada
2. Sistema dispara busca no Google Maps via Outscraper API (endpoint `/maps/search-v3`), coletando nome, telefone, endereço, website, place_id e foto
3. Cada lead com website passa pela Google PageSpeed Insights API (strategy=mobile) para obter score de performance
4. Sistema filtra duplicatas comparando `google_maps_place_id` e `telefone` contra leads já cadastrados do usuário (extensões `pg_trgm` + `unaccent`)
5. Exatamente 12 leads qualificados (sem duplicata, com dados completos) são inseridos no CRM Kanban na coluna inicial ("Novo Lead")
6. Para cada lead, o sistema gera uma landing page HTML personalizada com dados reais do profissional (nome, especialidade, cidade, foto via Unsplash), faz deploy via Vercel API em subdomínio wildcard (`[slug].dominio.com`) e salva a URL no campo `landing_page_url` do lead
7. Usuário visualiza os leads no CRM Kanban, abre o card do lead, vê preview da landing page e clica no botão WhatsApp
8. Botão abre `wa.me/55TELEFONE?text=MENSAGEM_CODIFICADA` com mensagem pré-preenchida contendo nome do profissional e link da landing page
9. Usuário move o card para "Abordado" manualmente após enviar a mensagem

**Limite diário:** 12 leads por ciclo de prospecção. O campo `leads_hoje` no modelo `User` é zerado diariamente via cron (reset_at). Não é possível iniciar nova prospecção até o dia seguinte ou até resetar manualmente (apenas admin pode forçar reset).

**Restrições obrigatórias de compliance — implementar sem exceção:**

- Landing pages geradas devem ter `<meta name="robots" content="noindex, nofollow">` em todas as páginas
- Templates HTML não podem conter depoimentos de pacientes, superlativos ("melhor", "número 1", "referência"), afirmações sobre resultados de tratamento, ou comparações com outros profissionais (regulamentação CFM/CRO)
- Todo deploy de landing page via Vercel API deve incluir header `X-Robots-Tag: noindex` via configuração `headers` no payload de deployment
- Landing pages são explicitamente "demos comerciais" — isso deve estar visível no rodapé de cada template: "Esta é uma demonstração de site. Não representa o profissional real."
- Wildcard DNS (`*.dominio.com`) requer domínio próprio configurado na Vercel — a funcionalidade de landing pages não opera em subdomínios `.vercel.app`

**Fluxo assíncrono:** A prospecção roda em background via BullMQ + Upstash Redis. O frontend exibe progresso em tempo real via polling a cada 3 segundos no endpoint `/api/prospeccao/status/[jobId]`. O worker roda em Railway separado do frontend Vercel.

**Limites de APIs externas a respeitar no código:**

- Outscraper: 25 req/mês no free tier — 1 request por prospecção (busca retorna múltiplos resultados em uma chamada)
- PageSpeed: delay obrigatório de 2500ms entre cada chamada para evitar throttle (429)
- Vercel API: máximo 100 deploys/dia no Hobby plan — 12 deploys/prospecção deixa margem segura
- Unsplash: 50 req/hora — cachear URLs de fotos por especialidade no Supabase para não repetir chamada

---

## 2. Setup Inicial

Execute os passos abaixo em ordem antes de criar qualquer arquivo de feature. Não pule etapas.

### 2.1 Contas e serviços — criar antes de começar

Criar contas e coletar credenciais nas seguintes plataformas:

- **Supabase:** Novo projeto em `supabase.com`. Anotar: `Project URL`, `anon key`, `service_role key`, `database password`
- **Vercel:** Conta existente ou nova em `vercel.com`. Criar um projeto vazio. Gerar Personal Access Token em Settings → Tokens. Anotar: `token`, `team_id` (se organização), nome do projeto
- **Outscraper:** Criar conta em `outscraper.com`. Acessar API Keys. Anotar a chave
- **Unsplash:** Criar app em `unsplash.com/developers`. Anotar `Access Key`
- **Google Cloud:** Criar projeto, ativar "PageSpeed Insights API", gerar API Key em Credentials. Anotar chave
- **Upstash Redis:** Criar database em `upstash.com`. Anotar `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`
- **Railway:** Conta em `railway.app` — será usada depois para deploy do worker. Não configurar agora
- **Domínio próprio:** Necessário para wildcard DNS. Configurar no painel do provedor DNS um registro `*.seudominio.com` apontando para `cname.vercel-dns.com`. Adicionar domínio wildcard no projeto Vercel em Settings → Domains

### 2.2 Bootstrap do projeto

```bash
npx create-next-app@14 prospectmed \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd prospectmed
```

### 2.3 Instalação de dependências

```bash
# UI e componentes
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card badge dialog sheet tabs select input label textarea toast sonner

# Drag and drop para Kanban
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Fila de jobs
npm install bullmq ioredis

# Upstash
npm install @upstash/redis

# Formulários e validação
npm install react-hook-form @hookform/resolvers zod

# HTTP e scraping
npm install axios cheerio

# Processamento de imagem
npm install sharp

# Utilitários
npm install date-fns clsx tailwind-merge lucide-react

# Dev
npm install -D @types/node @types/react @types/react-dom tsx
```

### 2.4 Arquivo `.env.local` completo

```env
# Supabase — supabase.com → projeto → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google PageSpeed Insights — console.cloud.google.com → Credentials → API Key
GOOGLE_PAGESPEED_API_KEY=AIza...

# Outscraper — outscraper.com → API Keys (NUNCA expor no frontend)
OUTSCRAPER_API_KEY=...

# Unsplash — unsplash.com/developers → seu app → Access Key
UNSPLASH_ACCESS_KEY=...

# Pexels (fallback de Unsplash) — pexels.com/api
PEXELS_API_KEY=...

# Vercel API — vercel.com → Settings → Tokens
VERCEL_API_TOKEN=...
VERCEL_TEAM_ID=team_...       # Deixar vazio se conta pessoal
VERCEL_PROJECT_ID=prj_...     # ID do projeto de landing pages na Vercel
LANDING_BASE_DOMAIN=seudominio.com  # Domínio wildcard configurado

# Upstash Redis — upstash.com → database → REST API
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Redis direto (para BullMQ no worker Railway)
REDIS_URL=rediss://default:SENHA@HOST:PORT

# Criptografia de API keys dos usuários
APP_ENCRYPTION_KEY=...        # 32 bytes hex, gerar com: openssl rand -hex 32

# Cron
CRON_SECRET=...               # openssl rand -hex 16

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 2.5 Supabase CLI — setup e migrations

```bash
npm install -g supabase
supabase login
supabase init
supabase link --project-ref SEU_PROJECT_REF
supabase migration new init_schema
```

### 2.6 Schema SQL completo — executar na ordem

```sql
-- 1. Extensões (rodar primeiro)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Função utilitária para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Enums
CREATE TYPE lead_status AS ENUM (
  'novo', 'em_crm', 'descartado', 'ja_cliente',
  'expirado', 'duplicata_suspeita', 'dado_invalido'
);
CREATE TYPE pagespeed_classificacao AS ENUM (
  'sem_site', 'site_ruim', 'site_medio', 'site_bom'
);
CREATE TYPE batch_status AS ENUM (
  'idle', 'running', 'filtering', 'scoring',
  'delivering', 'completed', 'partial', 'failed'
);
CREATE TYPE landing_status AS ENUM (
  'nao_gerada', 'gerando', 'publicada', 'erro'
);

-- 4. Users (extensão de auth.users via trigger)
CREATE TABLE public.users (
  id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 text UNIQUE NOT NULL,
  nome                  text,
  outscraper_api_key    text,  -- criptografado com pgcrypto
  vercel_api_token      text,  -- criptografado com pgcrypto
  vercel_team_id        text,
  subdominio_base       text,
  leads_hoje            int NOT NULL DEFAULT 0,
  leads_reset_at        date NOT NULL DEFAULT CURRENT_DATE,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. KanbanStages
CREATE TABLE public.kanban_stage (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  cor         text NOT NULL DEFAULT '#6B7280',
  ordem       int NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stage_user_ordem ON kanban_stage(user_id, ordem);

-- 6. Prospect Batches
CREATE TABLE public.prospeccao_batch (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cidade            text NOT NULL,
  especialidade     text NOT NULL,
  status            batch_status NOT NULL DEFAULT 'idle',
  total_encontrados int DEFAULT 0,
  total_novos       int DEFAULT 0,
  total_duplicados  int DEFAULT 0,
  job_id            text,
  erro_mensagem     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);
CREATE INDEX idx_batch_user ON prospeccao_batch(user_id);
CREATE INDEX idx_batch_status ON prospeccao_batch(user_id, status);

-- 7. Leads
CREATE TABLE public.leads (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  batch_id                    uuid REFERENCES public.prospeccao_batch(id) ON DELETE SET NULL,
  nome                        text NOT NULL,
  nome_slug                   text NOT NULL,
  especialidade               text NOT NULL,
  telefone                    text,
  telefone_e164               text,
  cidade                      text NOT NULL,
  endereco                    text,
  website_url                 text,
  google_maps_place_id        text,
  pagespeed_score             int,
  pagespeed_classificacao     pagespeed_classificacao,
  score_total                 int NOT NULL DEFAULT 0,
  foto_url                    text,
  status_kanban               text NOT NULL DEFAULT 'Novo',
  landing_page_url            text,
  landing_page_vercel_id      text,
  landing_page_status         landing_status NOT NULL DEFAULT 'nao_gerada',
  status                      lead_status NOT NULL DEFAULT 'novo',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_leads_place_user
  ON leads(google_maps_place_id, user_id)
  WHERE google_maps_place_id IS NOT NULL;

CREATE UNIQUE INDEX idx_leads_phone_user
  ON leads(telefone_e164, user_id)
  WHERE telefone_e164 IS NOT NULL;

CREATE INDEX idx_leads_user_kanban ON leads(user_id, status_kanban);
CREATE INDEX idx_leads_user_created ON leads(user_id, created_at DESC);
CREATE INDEX idx_leads_especialidade ON leads(user_id, especialidade);
CREATE INDEX idx_leads_cidade ON leads(user_id, cidade);
CREATE INDEX idx_leads_nome_trgm ON leads USING gin(nome_slug gin_trgm_ops);

CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Kanban Activity
CREATE TABLE public.kanban_activity (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id           uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  estagio_anterior  text NOT NULL,
  estagio_novo      text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_lead ON kanban_activity(lead_id, created_at DESC);

-- 9. Lead Notes (append-only)
CREATE TABLE public.lead_note (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conteudo    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_note_lead ON lead_note(lead_id, created_at DESC);

-- 10. Landing Page Templates
CREATE TABLE public.landing_page_template (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            text NOT NULL,
  especialidades  text[] NOT NULL DEFAULT '{}',
  html_template   text NOT NULL,
  css_inline      text,
  preview_url     text,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 11. RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccao_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own" ON public.users FOR ALL USING (auth.uid() = id);
CREATE POLICY "leads_own" ON public.leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "stages_own" ON public.kanban_stage FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "batches_own" ON public.prospeccao_batch FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "activities_own" ON public.kanban_activity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "notes_select" ON public.lead_note FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notes_insert" ON public.lead_note FOR INSERT WITH CHECK (user_id = auth.uid());
-- Sem UPDATE/DELETE em lead_note — append-only por design
CREATE POLICY "templates_read" ON public.landing_page_template FOR SELECT USING (auth.role() = 'authenticated' AND ativo = true);
```

Rodar migration:

```bash
supabase db push
```

### 2.7 Seed — 7 estágios Kanban padrão

Executar via server action no primeiro login do usuário (não via seed.sql global, pois requer `user_id`):

```sql
INSERT INTO kanban_stage (user_id, nome, cor, ordem, is_default) VALUES
  ($1, 'Novo',           '#6B7280', 1, true),
  ($1, 'Site no ar',     '#3B82F6', 2, false),
  ($1, 'Abordado',       '#F59E0B', 3, false),
  ($1, 'Respondeu',      '#8B5CF6', 4, false),
  ($1, 'Em negociação',  '#EC4899', 5, false),
  ($1, 'Fechado',        '#10B981', 6, false),
  ($1, 'Sem interesse',  '#EF4444', 7, false);
```

### 2.8 Primeiros arquivos a criar (antes de qualquer feature)

**`src/lib/supabase/client.ts`:**
```typescript
import { createBrowserClient } from '@supabase/ssr'
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

**`src/lib/supabase/server.ts`** — seguir documentação oficial `@supabase/ssr` para Next.js 14 App Router com `cookies()`.

**`src/middleware.ts`** — proteger rotas `/(app)/*`, redirecionar para `/login` se sem sessão. Usar `updateSession` do `@supabase/ssr`.

**`src/lib/queue/client.ts`:**
```typescript
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
export const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
export const prospeccaoQueue = new Queue('prospeccao', { connection })
export const pagespeedQueue = new Queue('pagespeed', { connection })
export const deployLpQueue = new Queue('deploy-lp', { connection })
```

**Gerar tipos TypeScript do Supabase:**
```bash
supabase gen types typescript --project-id SEU_REF > src/types/database.ts
```

### 2.9 Configuração wildcard na Vercel

1. Settings → Domains → Add → `*.seudominio.com.br`
2. Configurar registro CNAME no DNS do domínio apontando para `cname.vercel-dns.com`
3. Verificar: `dig CNAME qualquercoisa.seudominio.com.br` deve retornar `cname.vercel-dns.com`

---

## 3. Fluxo Principal do Usuário

Implementar exatamente este fluxo, na ordem descrita.

### Passo 1 — Acesso (não autenticado)

Rota `/` → middleware detecta sem sessão → redireciona para `/login`.

**`/login`:** form email + senha, chama `supabase.auth.signInWithPassword()`, redireciona para `/dashboard` após sucesso.

**`/register`:** campos nome + email + senha + confirmar senha, validação Zod no cliente, chama `supabase.auth.signUp()` + server action que insere linha em `public.users` e cria os 7 estágios padrão do Kanban via SQL acima.

### Passo 2 — Configuração inicial (primeiro acesso)

Se `outscraper_api_key` ou `vercel_api_token` estiver vazio: exibir banner no dashboard "Configure suas integrações → [Configurações]".

**`/configuracoes`:** formulário por seção: Outscraper (API Key), Vercel (token + team_id + subdomínio base), WhatsApp (template de mensagem editável). Salvar via server action, mascarar chaves salvas com `••••••`. Botão "Testar conexão Outscraper" que faz 1 request de validação.

### Passo 3 — Dashboard

**`/dashboard`** exibe:
- Card "Leads hoje": valor de `users.leads_hoje`
- Botão "Começar prospecção diária" — desabilitado se `leads_hoje >= 12`
- Últimos 3 batches com status (pending/running/done/failed)
- Atalho "Ver CRM →"

### Passo 4 — Iniciar prospecção

Clique em "Começar prospecção diária" → abre `Sheet` com formulário:
- `Select` de especialidade (20 opções: médico clínico geral, dentista, fisioterapeuta, psicólogo, nutricionista, oftalmologista, dermatologista, pediatra, ortopedista, cardiologista, etc.)
- `Input` de cidade (texto livre)
- Botão "Iniciar"

Ao submeter: server action cria `ProspeccaoBatch` com `status='idle'`, enfileira job BullMQ, retorna `batchId`. Frontend fecha Sheet e exibe painel de progresso inline.

### Passo 5 — Progresso em tempo real

Painel inline no dashboard:
- Status atual textual: "Buscando no Google Maps..." / "Avaliando sites (X/12)..." / "Concluído!"
- Barra de progresso 0–100%
- Contador de leads encontrados

Implementação: polling a cada 3s em `GET /api/prospeccao/status/[batchId]`. Parar polling quando `status === 'completed'` ou `'failed'`. Se `failed`: exibir `erro_mensagem` do batch. Se `completed`: botão "Ver leads no CRM →".

**Worker `worker/prospectar.worker.ts` — sequência do job:**
1. Atualizar batch `status = 'running'`
2. Buscar `outscraper_api_key` do usuário (descriptografar)
3. Chamar Outscraper: `GET /maps/search-v3?query=${especialidade} em ${cidade}&limit=40`
4. Para cada resultado: checar dedup por `place_id`, depois por `telefone_e164`
5. Filtrar blacklist de domínios (redes sociais, diretórios médicos)
6. Para leads com site: enfileirar job `pagespeed` com delay de 3s entre calls
7. Calcular score total por lead
8. Selecionar top 12 por score
9. `INSERT INTO leads ... ON CONFLICT DO NOTHING`
10. Criar registro na coluna "Novo" do Kanban
11. Enfileirar job `deploy-lp` para cada lead
12. Atualizar batch: `status = 'completed'`, `total_novos`, `total_duplicados`
13. Incrementar `users.leads_hoje`

### Passo 6 — CRM Kanban

**`/crm`:** board com 7 colunas, uma por `kanban_stage` ordenado por `ordem`.

Cards exibem: foto (40×40), nome, especialidade, cidade, `ScoreBadge` (verde ≥70, amarelo 40–69, vermelho <40), botão WhatsApp rápido.

Drag-and-drop com `@dnd-kit`: `onDragEnd` → se destino é "Fechado" ou "Sem interesse" → `ConfirmModal` → se confirmado → `PATCH /api/leads/[id]/kanban` + insert em `kanban_activity` → optimistic update com rollback em caso de erro.

Supabase Realtime subscription nos leads do usuário para atualização entre abas.

### Passo 7 — Detalhe do lead

Clique no nome do card → `Sheet` lateral com:
- Todos os dados do lead
- Score PageSpeed com barra visual
- Site original (link clicável)
- Status da landing page + link se `status='publicada'`
- Botão WhatsApp (desabilitado se landing page não publicada ou telefone inválido)
- Histórico de movimentações (tabela `kanban_activity`)
- Notas (textarea + "Adicionar nota" → append-only)

### Passo 8 — Disparo WhatsApp

Ao clicar no botão WhatsApp:

1. Abrir `WhatsAppPreviewModal` com mensagem renderizada:
   ```
   Oi {NOME}, tudo bem?
   
   Montei um site profissional pro seu consultório de {ESPECIALIDADE} — já tá no ar pra você dar uma olhada:
   👉 {LINK}
   
   O que achou? Posso ajustar qualquer detalhe pra ficar do seu jeito.
   ```
2. Botão "Enviar via WhatsApp" → `window.open(waLink, '_blank')` onde `waLink = https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`
3. Após abrir: `ConfirmSentModal` "Você enviou a mensagem?"
4. "Sim" → `PATCH /api/leads/[id]/kanban` movendo para "Abordado" + `INSERT INTO kanban_activity` + toast de confirmação
5. "Não" → fechar modal sem alterar status

### Passo 9 — Reset diário automático

Cron job (Railway ou Vercel Cron): `0 9 * * *` (UTC) = 6h BRT

```
POST /api/cron/reset-leads-diario
Authorization: Bearer {CRON_SECRET}
```

Ação: `UPDATE public.users SET leads_hoje = 0, leads_reset_at = CURRENT_DATE`

---

## 4. Módulos e Funcionalidades

### 4.1 Módulo de Autenticação e Onboarding

Supabase Auth (email + senha). Trigger automático em `auth.users` cria linha em `public.users`. Na primeira sessão, verificar se API keys estão preenchidas; se não, redirecionar para `/configuracoes` com banner.

API keys (`outscraper_api_key`, `vercel_api_token`) são armazenadas criptografadas com `pgcrypto`:

```sql
CREATE OR REPLACE FUNCTION encrypt_api_key(plain_text text)
RETURNS text AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(plain_text, current_setting('app.encryption_key')),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Configurar `app.encryption_key` no Supabase Dashboard → Database → Configuration.

### 4.2 Motor de Prospecção

**Trigger:** form cidade + especialidade → `POST /api/prospeccao/iniciar` → cria batch → enfileira job BullMQ.

**Fluxo do worker:**

```
idle → running → filtering → scoring → delivering → completed
                                                   ↘ partial (se ≥6 mas <12)
                                                   ↘ failed (se <6 ou erro crítico)
```

**Scoring:**

| Condição | Pontos |
|---|---|
| `site` ausente/nulo | 10 |
| HEAD request falha (URL morta) | 9 |
| PageSpeed score < 50 | 8 |
| PageSpeed score 50–75 | 4 |
| PageSpeed score > 75 | descarta |
| `reviews_count` < 10 | +2 bônus |

**Blacklist de domínios** (classificar como "sem site próprio"):
- `instagram.com`, `facebook.com`, `linktr.ee`
- `doctoralia.com.br`, `boaconsulta.com`
- `classificados.*`, `yellowpages.*`

**Deduplicação:**
1. Por `place_id + user_id` (UNIQUE INDEX — mais confiável)
2. Fallback: `telefone_e164 + especialidade + user_id`
3. Fuzzy por nome: `similarity(nome_slug, $1) > 0.85 AND user_id = $2` via `pg_trgm`
4. `INSERT ... ON CONFLICT DO NOTHING` — race condition safe

**Normalização de telefone:**
```typescript
function normalizarTelefone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return null;
  return '55' + digits;
}
```

### 4.3 Avaliador de Sites

Arquivo: `src/lib/site-evaluator.ts`

```typescript
type SiteEvaluation = {
  status: 'sem_site' | 'site_ruim' | 'site_medio' | 'site_bom';
  pagespeed_score: number | null;
  foto_url: string | null;
}
```

**Fluxo:**
1. URL nula → `sem_site`
2. Domínio na blacklist → `sem_site`
3. Checar cache Upstash `site-eval:{md5(url)}` (TTL 7 dias)
4. HEAD request com timeout 5s
5. 301/308 → seguir redirect uma vez; 302 → `site_ruim`
6. Chamar PageSpeed API (mobile): `GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={url}&strategy=mobile`
7. `score = categories.performance.score × 100`
8. <50 → `site_ruim`, 50–75 → `site_medio`, >75 → `site_bom`
9. Extrair foto via cheerio: `og:image` → `twitter:image` → `img[alt*=nome]` (mín 200×200px)
10. Salvar no cache Upstash

**Regra de parking pages:** se HTML contém `"domain for sale"`, `"Compre este domínio"`, `"Parked"`, `"GoDaddy"` → forçar `site_ruim` independente do score.

**Nunca lançar exceção** neste módulo — retornar `score: 0` em qualquer erro e continuar o pipeline.

### 4.4 Gerador de Landing Pages

Arquivo: `src/lib/landing-generator.ts`

**Template único** (`templates/base/index.html`) com 8 seções:
1. **Hero** — foto, nome, especialidade, botão CTA WhatsApp
2. **Sobre** — parágrafo com `{{NOME}}` e `{{ESPECIALIDADE}}`
3. **Especialidades** — array fixo por especialidade em JSON
4. **Diferenciais** — 3 cards com ícones SVG inline
5. **Depoimentos** — 3 cards com aviso `(Exemplo — a ser substituído pelo profissional)` em destaque
6. **Localização** — `<iframe src="https://maps.google.com/maps?q={{MAPS_QUERY}}&output=embed">`
7. **Galeria** — 6 fotos Unsplash por especialidade com lazy loading
8. **CTA Final** — botão WhatsApp duplicado

**Tokens obrigatórios:**
```
{{NOME}}, {{ESPECIALIDADE}}, {{CIDADE}}, {{TELEFONE_DISPLAY}},
{{TELEFONE_E164}}, {{COR_PRIMARIA}}, {{COR_SECUNDARIA}},
{{FOTO_URL}}, {{MAPS_QUERY}}, {{SLUG_TRATAMENTO}}, {{ANO_ATUAL}}
```

**Paleta de cores** (`src/lib/specialty-colors.json`):
```json
{
  "cardiologia": { "primaria": "#C0392B", "secundaria": "#E74C3C" },
  "pediatria":   { "primaria": "#27AE60", "secundaria": "#2ECC71" },
  "dermatologia":{ "primaria": "#8E44AD", "secundaria": "#9B59B6" },
  "odontologia": { "primaria": "#2980B9", "secundaria": "#3498DB" },
  "psicologia":  { "primaria": "#E67E22", "secundaria": "#F39C12" },
  "nutricao":    { "primaria": "#16A085", "secundaria": "#1ABC9C" },
  "default":     { "primaria": "#2C3E50", "secundaria": "#34495E" }
}
```

**Fallback de foto (em ordem):**
1. `lead.foto_url` (extraída do site do profissional pelo avaliador)
2. Unsplash: `GET /search/photos?query=${especialidade}+doctor+portrait&per_page=1`
3. Pexels: `GET /v1/search?query=${especialidade}+doctor&per_page=1`
4. Avatar SVG gerado com iniciais do nome + cor primária

**Proxy de fotos:** nunca referenciar URLs externas direto no HTML. Fazer download → upload no Supabase Storage bucket `fotos-leads` → usar URL pública do Supabase.

**Geração de slug:**
```typescript
function generateSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^(dr|dra|prof)\.?\s+/i, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
}
```

**Validação pré-deploy:**
```typescript
const tokens = html.match(/\{\{[A-Z_]+\}\}/g);
if (tokens?.length) throw new Error(`Tokens não substituídos: ${tokens.join(', ')}`);
```

**Compliance obrigatório no template:**
- `<meta name="robots" content="noindex, nofollow">` no `<head>`
- Rodapé: `"Esta é uma demonstração de site. Não representa o profissional real."`
- Sem depoimentos reais, sem preços, sem superlativos

**Deploy via Vercel API:**
```typescript
POST https://api.vercel.com/v13/deployments
Authorization: Bearer {VERCEL_TOKEN}
{
  "name": "{slug}-{cidade}",
  "files": [{ "file": "index.html", "data": "{base64_html}", "encoding": "base64" }],
  "projectSettings": { "framework": null },
  "target": "production"
}
```

Salvar `url` e `id` do response em `leads.landing_page_url` e `leads.landing_page_vercel_id`.

### 4.5 CRM Kanban

**`KanbanBoard.tsx`:** `DndContext` do dnd-kit, busca leads via `useQuery` (tanstack), agrupa por `status_kanban`.

**`KanbanColumn.tsx`:** `useDroppable`, exibe nome + contador, renderiza `LeadCard` em `SortableContext`.

**`LeadCard.tsx`:** `useSortable`, exibe foto, nome, especialidade, cidade, `ScoreBadge`, botão WhatsApp rápido.

**`onDragEnd`:** identificar destino → se terminal ("Fechado"/"Sem interesse") → `ConfirmModal` → `PATCH /api/leads/[id]/kanban` + optimistic update com rollback.

**Realtime:**
```typescript
useEffect(() => {
  const channel = supabase.channel('crm-leads')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads',
        filter: `user_id=eq.${uid}` }, payload => { /* atualizar estado */ })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

**Filtros:** por especialidade, cidade, data — via query Supabase com `.eq()`. Busca por nome: client-side.

**Modal de detalhe:** todos os dados + `kanban_activity` cronológico + notas append-only.

### 4.6 Disparo WhatsApp

Arquivo: `src/lib/whatsapp/gerar-link.ts`

```typescript
export function gerarLinkWhatsApp(telefone: string, mensagem: string): string {
  const digits = telefone.replace(/\D/g, '');
  const comDDI = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${comDDI}?text=${encodeURIComponent(mensagem)}`;
}
```

**`WhatsAppButton.tsx`:** desabilitado se `landing_page_status !== 'publicada'` ou `telefone_e164` inválido. Abre `WhatsAppPreviewModal`.

**`WhatsAppPreviewModal`:** preview da mensagem, botão "Enviar via WhatsApp" → `window.open(link, '_blank')` (dentro do handler do clique — sem setTimeout). Se popup bloqueado (`window.open` retorna `null`): exibir link clicável como fallback.

---

## 5. Integrações Externas

| Serviço | SDK/Pacote | Quando Aciona | Limite Free | Fallback |
|---------|-----------|---------------|-------------|----------|
| Outscraper | `fetch` nativo | Clique "Iniciar prospecção" | 25 req/mês (trial) | Google Places API |
| Google PageSpeed | `fetch` nativo | Para cada lead com URL | 25k req/dia | Cache 30d + score=0 |
| Vercel API | `fetch` nativo | Ao criar lead qualificado | 100 deploys/dia | Netlify API |
| Unsplash | `fetch` nativo | Ao gerar landing page | 50 req/hora | Pexels API |
| Pexels | `fetch` nativo | Fallback Unsplash | 200 req/hora | Avatar SVG |
| Supabase | `@supabase/ssr` | Toda operação de dados | 500MB / 50k MAU | — |
| BullMQ | `bullmq` npm | Processos assíncronos | — (self-hosted) | — |
| Upstash Redis | `@upstash/redis` | Cache + filas BullMQ | 10k cmd/dia | Railway Redis |
| wa.me | URL nativo | Botão WhatsApp | Ilimitado | — |

### 5.1 Outscraper

```typescript
const response = await fetch(
  `https://api.app.outscraper.com/maps/search-v3?` +
  `query=${encodeURIComponent(`${especialidade} em ${cidade}`)}&language=pt&limit=40`,
  {
    headers: { 'X-API-KEY': userApiKey },
    signal: AbortSignal.timeout(30000)
  }
);
// Response: { data: [[...places]] } — extrair data[0]
```

Erros: `401` → `OUTSCRAPER_INVALID_KEY`, `429` → `OUTSCRAPER_RATE_LIMIT`, timeout → marcar batch como `failed`.

### 5.2 Google PageSpeed

```typescript
const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
  `?url=${encodeURIComponent(siteUrl)}&strategy=mobile&key=${PAGESPEED_API_KEY}`;
// Extrair: data.lighthouseResult.categories.performance.score * 100
// Delay OBRIGATÓRIO de 3000ms entre calls (implementar no BullMQ limiter)
// Cache Upstash: chave `pagespeed:{md5(url)}`, TTL 7 dias
// Em qualquer erro: retornar score=0, não lançar exceção
```

### 5.3 Vercel Deploy

```typescript
await fetch('https://api.vercel.com/v13/deployments', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: slug,
    files: [{ file: 'index.html', data: Buffer.from(html).toString('base64'), encoding: 'base64' }],
    projectSettings: { framework: null },
    target: 'production'
  }),
  signal: AbortSignal.timeout(60000)
});
// Rate limit BullMQ: { max: 10, duration: 3600000 } na queue deploy-lp
```

### 5.4 Unsplash / Pexels

```typescript
// Unsplash
const res = await fetch(
  `https://api.unsplash.com/search/photos?query=${especialidade}+doctor+portrait&per_page=1&orientation=portrait`,
  { headers: { 'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
);
// extrair results[0].urls.regular

// Pexels (fallback)
const res = await fetch(
  `https://api.pexels.com/v1/search?query=${especialidade}+doctor&per_page=1`,
  { headers: { 'Authorization': PEXELS_API_KEY } }
);
// extrair photos[0].src.large

// Cache: `unsplash:{md5(especialidade)}`, TTL 24h
// Após buscar: salvar no Supabase Storage, usar URL pública
```

### 5.5 BullMQ + Upstash Redis

```typescript
// worker/index.ts
const worker = new Worker('prospeccao', async (job) => {
  // pipeline completo
}, {
  connection: new IORedis(process.env.REDIS_URL!),
  concurrency: 2,
  limiter: { max: 5, duration: 60000 }
});
worker.on('failed', (job, err) => {
  // atualizar batch status='failed', salvar erro_mensagem
});
```

Worker roda como processo separado no **Railway** — não na Vercel. `worker/index.ts` é o entry point.

---

## 6. Modelo de Dados

Ver SQL completo na Seção 2.6. Resumo das entidades:

### Entidades Principais

**`users`** — extensão de `auth.users`. Campos: `id`, `email`, `nome`, `outscraper_api_key` (enc), `vercel_api_token` (enc), `vercel_team_id`, `subdominio_base`, `leads_hoje`, `leads_reset_at`.

**`leads`** — entidade central. Campos críticos: `google_maps_place_id` (dedup primário), `telefone_e164` (dedup secundário), `nome_slug` (dedup fuzzy via pg_trgm), `score_total` (ordenação), `status_kanban` (posição no board), `landing_page_status`, `pagespeed_score`, `pagespeed_classificacao`.

**`prospeccao_batch`** — log de cada execução. Estados: `idle → running → filtering → scoring → delivering → completed/partial/failed`.

**`kanban_stage`** — 7 colunas por usuário (seed no primeiro login). Ordem fixa no MVP.

**`kanban_activity`** — log imutável de movimentações. Insert-only — sem UPDATE, sem DELETE.

**`lead_note`** — notas append-only. RLS bloqueia UPDATE e DELETE por design.

**`landing_page_template`** — templates HTML globais (sem `user_id`). Gerenciados pelo admin.

### Índices Críticos

```sql
-- Deduplicação
UNIQUE (google_maps_place_id, user_id) WHERE google_maps_place_id IS NOT NULL
UNIQUE (telefone_e164, user_id) WHERE telefone_e164 IS NOT NULL
-- Performance
(user_id, status_kanban)
(user_id, created_at DESC)
(user_id, especialidade)
-- Fuzzy search
GIN index usando gin_trgm_ops em nome_slug
```

### RLS

Todas as tabelas com `user_id` têm policy: `FOR ALL USING (auth.uid() = user_id)`. Worker usa `SUPABASE_SERVICE_ROLE_KEY` que bypassa RLS — nunca expor no frontend.

---

## 7. Arquitetura Técnica

### Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend + API Routes | Next.js App Router | 14.2+ |
| Linguagem | TypeScript | 5+ |
| Estilo | Tailwind CSS + shadcn/ui | 3+ |
| Banco | Supabase (PostgreSQL) | 15 |
| Auth | Supabase Auth | — |
| Fila | BullMQ + Upstash Redis | 5+ |
| Worker | Node.js em Railway | 20 LTS |
| Deploy frontend | Vercel Hobby | — |
| Deploy landing pages | Vercel API | — |
| Storage | Supabase Storage | — |
| Drag-and-drop | @dnd-kit/core + sortable | — |
| Forms | react-hook-form + zod | — |
| HTML parsing | cheerio | — |
| Imagens | sharp | — |

### Estrutura de Pastas

```
prospectmed/
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # providers: QueryClient, Toaster
│   │   ├── page.tsx                    # redirect → /dashboard
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   └── (app)/
│   │       ├── layout.tsx              # sidebar + topbar + auth guard
│   │       ├── dashboard/page.tsx
│   │       ├── prospeccao/
│   │       │   ├── page.tsx            # form cidade + especialidade
│   │       │   └── [batchId]/page.tsx  # progresso live
│   │       ├── crm/
│   │       │   ├── page.tsx            # KanbanBoard
│   │       │   └── [leadId]/page.tsx   # detalhe do lead
│   │       ├── landing-pages/
│   │       │   ├── page.tsx            # lista com status
│   │       │   └── [leadId]/page.tsx   # preview + link
│   │       └── configuracoes/page.tsx  # API keys + template WhatsApp
│   │
│   ├── api/
│   │   ├── auth/[...supabase]/route.ts
│   │   ├── prospeccao/
│   │   │   ├── iniciar/route.ts        # POST → enfileira → retorna batchId
│   │   │   └── status/[batchId]/route.ts # GET polling
│   │   ├── leads/
│   │   │   ├── route.ts                # GET com filtros
│   │   │   ├── [id]/route.ts           # GET / PATCH
│   │   │   ├── [id]/kanban/route.ts    # PATCH estágio
│   │   │   └── [id]/landing-page/route.ts # POST → enfileira deploy
│   │   ├── cron/
│   │   │   └── reset-leads-diario/route.ts # POST com CRON_SECRET
│   │   └── webhooks/vercel/route.ts    # recebe status de deploy
│   │
│   ├── components/
│   │   ├── ui/                         # shadcn components
│   │   ├── kanban/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   └── LeadCard.tsx
│   │   ├── leads/
│   │   │   ├── WhatsAppButton.tsx
│   │   │   ├── WhatsAppPreviewModal.tsx
│   │   │   └── ScoreBadge.tsx
│   │   ├── prospeccao/
│   │   │   └── ProgressoLive.tsx
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       └── Topbar.tsx
│   │
│   ├── lib/
│   │   ├── supabase/client.ts
│   │   ├── supabase/server.ts
│   │   ├── queue/client.ts
│   │   ├── outscraper/client.ts
│   │   ├── pagespeed/client.ts
│   │   ├── vercel-deploy/
│   │   │   ├── client.ts
│   │   │   └── gerar-html.ts
│   │   ├── stock-photos/client.ts      # Unsplash + Pexels
│   │   ├── dedup/checar.ts
│   │   ├── whatsapp/gerar-link.ts
│   │   ├── scoring/calcular.ts
│   │   └── specialty-colors.json
│   │
│   ├── types/
│   │   └── database.ts                 # gerado pelo Supabase CLI
│   │
│   └── middleware.ts                   # protege /(app)/*
│
├── worker/
│   ├── index.ts                        # entry point Railway
│   ├── prospectar.worker.ts
│   ├── pagespeed.worker.ts
│   └── deploy-lp.worker.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema_inicial.sql
│   │   ├── 002_extensoes.sql
│   │   └── 003_rls_policies.sql
│   └── seed.sql
│
└── templates/
    └── base/
        ├── index.html                  # template com tokens {{VAR}}
        └── preview.png
```

### Decisões Críticas ANTES de Codar

1. **Wildcard DNS:** sem domínio próprio (`*.seudominio.com.br`), landing pages ficam em `.vercel.app` e perdem credibilidade. Configurar antes de começar Fase 4.

2. **Worker Railway:** o BullMQ worker **não pode** rodar na Vercel (serverless sem processo persistente). Railway é obrigatório. Configurar na Fase 2.

3. **RLS primeiro:** configurar todas as policies antes de qualquer insert. Alterar depois com dados existentes é perigoso.

4. **Criptografia de API keys:** `outscraper_api_key` e `vercel_api_token` dos usuários devem ser criptografadas com `pgcrypto` antes de salvar. Nunca expor no client bundle.

5. **Outscraper não é gratuito para uso real:** 25 req/mês no trial. Custo real mínimo ~$3/mês. Documentar isso para o usuário na tela de configurações.

6. **Fotos proxy:** nunca referenciar URLs do Unsplash diretamente no HTML. Fazer upload para Supabase Storage primeiro.

---

## 8. Roadmap de Implementação

### Fase 1 — Fundação (2–3 dias)

**Critério de conclusão:** login funciona, rotas protegidas redirecionam, configurações salvam API keys mascaradas, RLS verificado com dois usuários distintos no SQL Editor.

**Sequência:**
1. Bootstrap Next.js + instalar todas as dependências
2. Criar projeto Supabase + executar migrations na ordem (extensões → schema → RLS)
3. Implementar `src/lib/supabase/client.ts` e `src/lib/supabase/server.ts`
4. Implementar `src/middleware.ts` (proteção de rotas)
5. Implementar `(auth)/login/page.tsx` e `(auth)/register/page.tsx`
6. Server action de onboarding: inserir em `public.users` + criar 7 estágios Kanban
7. Implementar `(app)/layout.tsx` com sidebar e auth guard
8. Implementar `(app)/configuracoes/page.tsx`: form de API keys + criptografia
9. Configurar `src/lib/queue/client.ts` (BullMQ + Upstash Redis)

### Fase 2 — Motor de Prospecção (3–4 dias)

**Critério de conclusão:** usuário inicia prospecção, vê progresso, leads aparecem no banco com `score_total` calculado e estágio Kanban criado. Verificar no Supabase dashboard.

**Sequência:**
1. `src/lib/outscraper/client.ts` — wrapper + normalização de response
2. `src/lib/dedup/checar.ts` — normalização telefone + lookup por place_id e telefone
3. `src/lib/scoring/calcular.ts` — algoritmo 0–100
4. `worker/prospectar.worker.ts` — pipeline completo (busca → dedup → score → INSERT)
5. `worker/pagespeed.worker.ts` — avaliação de sites com delay 3s + cache
6. `worker/index.ts` — registrar workers, graceful shutdown
7. `POST /api/prospeccao/iniciar/route.ts` — criar batch + enfileirar job
8. `GET /api/prospeccao/status/[batchId]/route.ts` — polling de status
9. `prospeccao/page.tsx` — form cidade + especialidade
10. `prospeccao/[batchId]/page.tsx` + `ProgressoLive.tsx` — polling + barra de progresso
11. Deploy worker no Railway com health check

### Fase 3 — CRM Kanban (2–3 dias)

**Critério de conclusão:** drag-and-drop persiste após reload, botão WhatsApp abre mensagem correta, histórico aparece no detalhe do lead.

**Sequência:**
1. `GET /api/leads/route.ts` — com filtros por estágio, especialidade, cidade
2. `PATCH /api/leads/[id]/kanban/route.ts` — transação: atualiza estágio + insert atividade
3. `KanbanBoard.tsx` — DndContext + busca via useQuery
4. `KanbanColumn.tsx` — useDroppable + SortableContext
5. `LeadCard.tsx` — useSortable + campos do card + ScoreBadge
6. `src/lib/whatsapp/gerar-link.ts` — URL wa.me com encodeURIComponent
7. `WhatsAppButton.tsx` + `WhatsAppPreviewModal.tsx`
8. Modal de detalhe do lead com histórico e notas
9. Filtros no topo do board
10. Supabase Realtime subscription

### Fase 4 — Landing Pages (2–3 dias)

**Critério de conclusão:** clique "Gerar Landing Page" → deploy completa → URL clicável → abrindo a URL, nome, especialidade e botão WhatsApp do profissional estão corretos; inspecionando HTML, `noindex` está presente, nenhum token `{{}}` visível.

**Sequência:**
1. Criar `templates/base/index.html` com todos os tokens e compliance CFM/CRO
2. `src/lib/specialty-colors.json` com paleta por especialidade
3. `src/lib/vercel-deploy/gerar-html.ts` — substituição + validação de tokens residuais
4. `src/lib/stock-photos/client.ts` — Unsplash + Pexels fallback + proxy Supabase Storage
5. `worker/deploy-lp.worker.ts` — buscar foto + gerar HTML + Vercel API + salvar URL
6. `POST /api/leads/[id]/landing-page/route.ts` — enfileirar deploy job
7. `POST /api/webhooks/vercel/route.ts` — atualizar status após deploy confirmar
8. `landing-pages/page.tsx` — lista com badges de status
9. `landing-pages/[leadId]/page.tsx` — preview iframe + link + botão regenerar
10. Configurar BullMQ limiter: `{ max: 10, duration: 3600000 }` na queue deploy-lp

### Fase 5 — Polimento e QA (1–2 dias)

**Critério de conclusão (= MVP completo):** ciclo completo funciona sem intervenção manual no banco. Qualquer erro de API exibe toast ao usuário. Dashboard mostra métricas corretas.

**Sequência:**
1. `dashboard/page.tsx` — 4 cards: leads hoje, taxa de resposta, LPs ativas, score médio
2. Tratamento de erros: todas as API routes retornam `{ error: string, code: string }`; frontend exibe `toast.error()` em qualquer resposta não-2xx
3. `POST /api/cron/reset-leads-diario/route.ts` com validação de `CRON_SECRET`
4. Configurar cron no Railway: `0 9 * * *` (UTC)
5. QA do ciclo completo manualmente (passos 1–9 do Fluxo Principal)
6. Testar em Safari (popup blocker) e mobile

---

## 9. Riscos de Implementação

### Alta Severidade (bloqueadores — resolver antes de codar a feature)

**R01 — Outscraper free tier insuficiente**
O free trial do Outscraper permite apenas 25 requisições/mês — menos de 3 dias de uso no ritmo de 12 leads/dia. O produto **não é gratuito para uso real**.
Mitigação: Documentar custo mínimo (~$3/mês) na tela de configurações. Exibir contador de uso mensal. Não apresentar como "zero cost" no MVP.

**R02 — LGPD: landing pages com dados sem autorização**
Hospedar página com nome, foto e telefone de profissional sem consentimento pode configurar tratamento indevido de dados pessoais (art. 11 LGPD). Multa de até R$50M.
Mitigação: `noindex, nofollow` obrigatório em todas as landing pages. URL enviada apenas via WhatsApp direto (link privado). Aviso na UI: "Não compartilhe este link publicamente." Landing pages expiram após 30 dias e são deletadas via Vercel API automaticamente.

**R03 — Regulamentação CFM/CRO: publicidade médica**
Resolução CFM 1974/2011 (e equivalentes do CFO, CFP, CFN etc.) proíbe superlativos, comparações, afirmações de resultado e depoimentos sem autorização explícita.
Mitigação: Template sem as palavras "melhor", "referência", "nº 1", "resultados garantidos". Seção de depoimentos comentada no HTML padrão com aviso explícito. Adicionar comentário no template: `<!-- COMPLIANCE CFM 1974/2011: não adicionar superlativos nem depoimentos com resultados específicos -->`.

**R04 — Wildcard DNS requer domínio próprio**
Sem `*.seudominio.com.br` configurado, URLs ficam em `.vercel.app` — destrói credibilidade da demo para o profissional de saúde.
Mitigação: Documentar como requisito inegociável de setup. Criar guia passo a passo nas configurações. Botão "Verificar DNS" que faz lookup antes de habilitar geração de LPs.

**R05 — Worker BullMQ não pode rodar na Vercel**
Vercel é serverless com timeout máximo de 60s (Hobby) ou 300s (Pro). Workers BullMQ precisam de processo persistente. Se tentar rodar em API Route, o worker vai morrer e jobs ficarão presos na fila.
Mitigação: Worker obrigatoriamente no Railway. `process.on('SIGTERM', ...)` para graceful shutdown. Health check endpoint `GET /health`. Railway configurado para reiniciar em crash.

**R06 — PageSpeed throttle em rajadas**
Chamadas consecutivas à PageSpeed API sem delay causam 429 em lote, invalidando scores de múltiplos leads silenciosamente.
Mitigação: Delay fixo de 3000ms entre cada call (não configurável). BullMQ limiter: `{ max: 1, duration: 3000 }` na queue pagespeed. Em 429: retry exponencial (6s, 12s, 24s), máx 3 tentativas. Falha após 3 tentativas → `site_score = null`, continuar pipeline.

**R07 — Vercel API rate limit: 12 deploys/hora**
Gerar 12 LPs simultaneamente esgota o limite em menos de 1 hora.
Mitigação: BullMQ limiter: `{ max: 10, duration: 3600000 }` na queue deploy-lp. Exibir posição na fila na UI.

**R08 — Telefone compartilhado entre profissionais da mesma clínica**
Deduplicação por telefone bloqueia segundo profissional da mesma clínica.
Mitigação: Priorizar `place_id` para dedup. Telefone como fallback apenas quando sem `place_id`. Quando sem `place_id`: dedup = `telefone + especialidade + user_id` (especialidade diferente permite segundo profissional).

**R09 — CORS com fotos externas**
Referenciar URLs do Unsplash diretamente no HTML causa CORS em alguns browsers e expõe a API key.
Mitigação: **Sempre** fazer download da foto → upload Supabase Storage → usar URL pública do Supabase no template.

### Média Severidade

**R10 — Popup blocker bloqueia wa.me**
`window.open()` fora de evento de clique direto é bloqueado.
Mitigação: `window.open()` deve ser chamado dentro do handler do clique no botão de confirmação, não em setTimeout nem Promise.then. Se retornar `null`: exibir link clicável como fallback.

**R11 — Token não substituído na landing page**
Template com `{{FOTO_URL}}` literal exposto ao profissional.
Mitigação: Validação obrigatória com regex antes do deploy. Se encontrar tokens residuais: lançar Error, marcar LP como `erro`, salvar os tokens problemáticos em `erro_mensagem`.

**R12 — Race condition em jobs paralelos**
Dois workers tentando inserir o mesmo lead simultaneamente.
Mitigação: `INSERT ... ON CONFLICT DO NOTHING` em todas as inserções de leads. UNIQUE INDEX garante idempotência.

**R13 — Parking pages com score PageSpeed alto**
Páginas de placeholder (GoDaddy, HostGator) têm HTML mínimo → score 95+ → lead descartado incorretamente.
Mitigação: Após fetch do HTML via cheerio, checar presença de strings: `"domain for sale"`, `"Compre este domínio"`, `"Parked"`, `"GoDaddy"`. Se detectado: forçar `site_ruim` + flag `site_parking = true`.

### Baixa Severidade

**R14 — Colisão de subdomínio**
Dois leads com mesmo nome e cidade geram o mesmo slug.
Mitigação: Sufixo de timestamp base-36 no slug: `${slugify(nome)}-${slugify(cidade)}-${Date.now().toString(36)}`.

**R15 — Caracteres especiais quebram slug**
Nomes como "D'Ávila & Associados" geram slugs inválidos para URLs.
Mitigação: Função `slugify` robusta: `normalize('NFD')` → remover diacríticos → remover `[^a-z0-9\s-]` → substituir espaços por hífens → limitar a 50 chars. Usar em todos os pontos de geração de slug.
