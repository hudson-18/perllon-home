# PERLLON — Production Checklist

Checklist final para publicar o projeto. Itens marcados `[x]` já foram
verificados; `[ ]` exigem ação (principalmente do responsável pelo deploy).

## Funcional (site público)
- [x] Home renderiza (hero, spotlight, serviços, catálogo, diferenciais, sobre, localização, CTA, footer)
- [x] Catálogo carrega os 7 produtos canônicos do Supabase (com fallback estático)
- [x] Spotlight → iPhone 17 (ativo)
- [x] Carrinho: adicionar / quantidade / remover / subtotal / estado vazio
- [x] Modal de identificação (nome) + `Enter`/`Escape`/backdrop + focus
- [x] Checkout gera mensagem de WhatsApp com dados reais (sem afirmar disponibilidade confirmada)
- [x] Imagens de produto carregam (bucket público)
- [x] Motion presente; `prefers-reduced-motion` respeitado

## Admin
- [x] `/admin.html` carrega (segundo entry point Vite)
- [x] Login/logout/sessão (Supabase Auth)
- [x] CRUD de produto, marcas, categorias, especificações, imagens, spotlight
- [x] Proteção real por RLS (não só "esconder" no frontend)
- [ ] Verificar login/catálogo/upload no ambiente de produção (após deploy)

## Segurança
- [x] RLS habilitado em todas as tabelas (deny por padrão)
- [x] Anon não escreve produtos/audit/storage (testado: INSERT 401, UPDATE/DELETE 0 rows)
- [x] Audit logs append-only (só INSERT staff + SELECT admin)
- [x] Sem secrets no código/dist; `.env.local`/`.env.production` fora do Git
- [x] `npm audit` = 0 vulnerabilidades
- [x] XSS: dados dinâmicos escapados antes de `innerHTML`
- [ ] Configurar headers definitivos no host (CSP, X-Content-Type-Options, Referrer-Policy) — `public/_headers` preparado

## SEO / Metadata
- [x] `title`, `meta description`, `canonical`, `theme-color`
- [x] Open Graph (title/description/type/locale/url/image)
- [x] Twitter card
- [x] JSON-LD `ElectronicsStore` (Organization/LocalBusiness) — sem rating/review inventado
- [x] `robots.txt` (permite site público, `Disallow: /admin.html`)
- [x] `sitemap.xml` (somente páginas públicas; placeholder de domínio)
- [ ] Trocar o placeholder `perllon.com.br` pelo domínio real no canonical/OG/sitemap quando o domínio existir

## Assets / Performance
- [x] Favicon SVG + `apple-touch-icon`
- [x] `og-image.png` estável em `public/`
- [x] Hero: `loading="eager"`, `poster`, vídeo WebM→MP4 com fallback
- [x] Imagens de produto/catálogo: `loading="lazy"`
- [x] Fontes com `preconnect`
- [ ] Opcional: converter assets para WebP/AVIF (não reencodar os cinematográficos sem autorização)

## Rotas / 404
- [x] `404.html` personalizada (identidade PERLLON, volta à home)
- [x] `privacidade.html` (marcada como "em revisão jurídica")
- [x] `_headers` (segurança) — honrado por Netlify e Cloudflare Pages; sem `_redirects` catch-all (causava loop no Cloudflare)
- [ ] Para Vercel, adicionar `vercel.json` equivalente (headers/rewrites)

## Build
- [x] `npm run build` limpo (index.html + admin.html + assets + OG/robots/sitemap/404)
- [x] `node --check` OK em todos os módulos JS

## Deploy (ação manual necessária)
- [ ] Escolher host ($0): Vercel ou Netlify (recomendado)
- [ ] Criar projeto no host e conectar o repositório Git
- [ ] Definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no host
- [ ] Publicar e confirmar HTTPS + domínio provisório
- [ ] Testar site público + admin em produção
- [ ] (Futuro) conectar domínio real + atualizar canonical/OG/sitemap

## Supabase (já provisionado)
- [x] Migrations 0001–0013 aplicadas
- [x] 7 produtos canônicos + Spotlight iPhone 17
- [x] Bucket `product-images` público; escrita staff-only
- [x] Admin real (`Administrador`) preservado