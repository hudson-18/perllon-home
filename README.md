# PERLLON — Admin + Catalog System

Sistema de administração de catálogo da PERLLON (Assistência Especializada Apple, Natal/RN).

## Stack

- **Banco:** PostgreSQL (Supabase) — fonte de verdade do catálogo
- **Auth:** Supabase Auth
- **Autorização:** Row Level Security (RLS) — nunca só no frontend
- **Storage:** Supabase Storage (`product-images`)
- **Frontend público:** Vanilla HTML/CSS/JS + Vite (`index.html`)
- **Painel admin:** Vanilla JS SPA (`admin.html` → `/src/admin/`)
- **Cliente:** `@supabase/supabase-js` (única dependência runtime)

## Estrutura

```
perllon-home/
├── index.html                 → site público (preservado)
├── admin.html                 → painel administrativo
├── .env.example               → modelo de variáveis (NÃO contém segredos)
├── supabase/migrations/       → schema + RLS + seed (001–011)
└── src/
    ├── main.js                → site público (catálogo + carrinho + WhatsApp)
    ├── lib/
    │   ├── supabase.js        → cliente + config (só `anon` key)
    │   ├── catalog.js         → leitura pública + normalização + validação de preço
    │   ├── admin.js           → CRUD autenticado + auditoria
    │   └── storage.js         → upload seguro de imagens
    └── admin/
        ├── main.js            → SPA admin (login, dashboard, produtos, destaque)
        └── admin.css
```

## Configuração local

1. Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

2. Preencha com os valores do seu projeto Supabase (Dashboard → Settings → API):

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...  # a chave "anon" pública APENAS
```

> ⚠️ **NUNCA** coloque a `service_role` key, senha do banco ou qualquer
> segredo no frontend. Somente a chave `anon` (que o RLS já protege).

3. Instale e rode:

```bash
npm install
npm run dev          # site em http://localhost:3000  (admin em http://localhost:3000/admin.html)
```

O site público funciona **sem** backend configurado (usa o `public/data/products.json`
como fallback do protótipo). Quando `VITE_SUPABASE_*` estão configurados, ele passa
a consumir o banco automaticamente.

## Aplicar as migrations

Use a Supabase CLI (ou o SQL Editor do dashboard):

```bash
supabase db push          # aplica supabase/migrations/ em ordem
```

As migrations criam: `roles`, `profiles`, `brands`, `categories`, `products`,
`product_specifications`, `product_specs_json`, `product_images`, `spotlight`,
`audit_logs`, o bucket `product-images` e todas as políticas RLS. O seed migra os
7 produtos canônicos e marca o iPhone 17 como destaque.

## Criar o primeiro administrador

1. Crie o usuário no Dashboard → Authentication → Users (ou via API).
2. Descubra o `id` dos roles:

```sql
select id, slug from public.roles;
```

3. Vincule o perfil ao role `admin`:

```sql
insert into public.profiles (id, role_id, full_name)
values ('<auth-user-uuid>', '<role-admin-id>', 'Administrador');
```

Acesse `http://localhost:3000/admin.html`.

## Roles

| Role | Permissões |
|------|-----------|
| `admin` | Tudo: produtos, imagens, destaque, auditoria, gerenciamento de usuários |
| `editor` | Gerencia catálogo, imagens e destaque (sem gerenciar usuários) |
| `viewer` | Somente leitura do painel |

## Preço e moeda

Valores monetários são armazenados como **centavos inteiros** (`price_cents`,
`installment_cents`). Nunca usamos floating point para dinheiro. O preço exibido
no site é re-lido do banco no momento da finalização — o cliente NUNCA é fonte
de verdade de preço.

## Build de produção

```bash
npm run build      # gera dist/ com index.html e admin.html
```

## Segurança (resumo)

- RLS habilitado em todas as tabelas (deny por padrão; grant explícito).
- Público lê somente produtos `active`.
- Escrita restrita a `admin`/`editor`; logs de auditoria são append-only.
- Upload restrito a JPG/PNG/WebP/AVIF, máx 8 MB, sem SVG arbitrário.

## Produção / Deploy

### Variáveis de ambiente
No host, defina exatamente as mesmas variáveis (valores públicos):

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   # anon key APENAS
```

Nunca definir `service_role`, senha de banco ou JWT secret no frontend.

### Build e preview
```bash
npm run build      # gera dist/ (index.html, admin.html, 404.html, privacidade.html, OG, robots, sitemap)
npm run preview    # serve dist/ localmente p/ verificar o build final
```

### Hospedagem (recomendada: $0)
- **Vercel** ou **Netlify** — deploy automático via Git, HTTPS, env vars, redirects.
- **Cloudflare Pages** — alternativa gratuita com edge caching.
- `public/_headers` e `public/_redirects` já contêm headers de segurança e o
  mapeamento `/admin → admin.html` para Netlify. Para Vercel, use `vercel.json`
  (headers + rewrites equivalentes).

O `?motion=preview` é **apenas para desenvolvimento local** (restrito a
localhost). Em produção o motion roda normalmente e respeita
`prefers-reduced-motion`.

### Domínio
O domínio real (`perllon.com.br` é o placeholder usado no sitemap/canonical)
ainda não foi comprado. Quando for:
1. Conectar o domínio no host (DNS CNAME/A).
2. Atualizar `canonical`, `og:url` e o `<loc>` do `sitemap.xml`.
3. Confirmar HTTPS e redirecionamento HTTP→HTTPS.

### Backup / recuperação
No free tier do Supabase não há backup automático garantido. A estratégia é:
- **Migrations versionadas** em `supabase/migrations/` (`0001`–`0013`) → o schema
  é reproduzível: `supabase db push` recria todo o banco.
- **Export manual** de dados (quando necessário): `supabase db dump` ou via
  `pg_dump` pela connection string do dashboard.
- **Assets** (imagens de produto) ficam no Storage; o catálogo canônico está no
  seed `0011_seed_catalog.sql`.
- Para rollback de código: o deploy via Git permite reverter o commit/PR.

## Troubleshooting

- **Site sem catálogo:** verifique se `VITE_SUPABASE_*` estão definidos e as
  migrations aplicadas (`supabase migration list`).
- **Imagens quebradas:** bucket `product-images` deve estar `public = true`
  (migration `0013`) e o objeto deve existir no Storage.
- **Admin "não configurado":** `.env.local` ausente ou com placeholders.
- **Login falha:** o usuário precisa existir em Auth + ter `profiles.role_id`
  válido.