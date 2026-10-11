# PERLLON — Production Checklist

Checklist final para publicar o projeto. Itens marcados `[x]` já foram
verificados; `[ ]` exigem ação (principalmente do responsável pelo deploy).

## Funcional (site público)
- [x] Home renderiza (hero, spotlight, serviços, catálogo, diferenciais, sobre, localização, CTA, footer)
- [x] Catálogo busca os produtos ativos do Supabase (com fallback estático no modo demonstração)
- [x] Spotlight administrável (produto ativo real configurado pelo dono)
- [x] Carrinho: adicionar / quantidade / remover / subtotal / estado vazio
- [x] Modal de identificação (nome) + `Enter`/`Escape`/backdrop + focus
- [x] Checkout gera mensagem de WhatsApp com dados reais (sem afirmar disponibilidade confirmada)
- [x] Imagens de produto carregam (bucket público)
- [x] Motion presente; `prefers-reduced-motion` respeitado

## Admin
- [x] `/admin.html` carrega (segundo entry point Vite)
- [x] Login/logout/sessão (Supabase Auth)
- [x] Cadastro/edição/exclusão de produtos, inclusão de marcas e categorias, especificações, imagens, destaque e hero
- [x] Botão Excluir produto no formulário de edição, com confirmação e limpeza de imagens (código e testes)
- [ ] Verificar exclusão numa instância de teste usando produto descartável
- [x] Proteção real por RLS (não só "esconder" no frontend)
- [x] Login, catálogo, upload, destaque e hero relatados como funcionais pelo desenvolvedor no ambiente publicado
- [ ] Revalidar esses fluxos com o responsável da empresa durante o aceite

## Segurança
- [x] RLS habilitado em todas as tabelas (deny por padrão)
- [x] Anon não escreve produtos/audit/storage (testado: INSERT 401, UPDATE/DELETE 0 rows)
- [x] Audit logs append-only (só INSERT staff + SELECT admin)
- [x] Sem secrets no código/dist; `.env.local`/`.env.production` fora do Git
- [x] `npm audit --audit-level=high` aprovado em CI após correção de source-map-js 1.2.2 (11/10/2026)
- [x] XSS: dados dinâmicos escapados antes de `innerHTML`
- [x] Headers para Netlify/Cloudflare definidos em `public/_headers`; o build injeta somente a origem de `VITE_SUPABASE_URL` na CSP
- [ ] Ativar **Leaked Password Protection** em Authentication → Settings no Supabase (configuração de projeto; não é migration SQL)
- [ ] Definir política de MFA e cadastrar fatores nas contas administrativas antes de torná-lo obrigatório
- [ ] Implementar recuperação de senha somente após configurar e validar Site URL/Redirect URLs e uma rota de redefinição

## SEO / Metadata
- [x] `title`, `meta description`, `canonical`, `theme-color`
- [x] Open Graph (title/description/type/locale/url/image)
- [x] Twitter card
- [x] JSON-LD `ElectronicsStore` (Organization/LocalBusiness) — sem rating/review inventado
- [x] `robots.txt` (permite site público, `Disallow: /admin.html`)
- [x] `sitemap.xml` (somente página inicial pública, no domínio atual Cloudflare Pages)
- [x] Canonical, Open Graph, Twitter image, dados estruturados, robots e sitemap com `perllon-home.pages.dev`
- [ ] Atualizar esses endereços se a empresa comprar domínio próprio no futuro

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
- [x] GitHub Actions na main: 84 testes e build de produção aprovados (11/10/2026)

## Deploy (ação manual necessária)
- [x] Hospedagem Cloudflare Pages usada no projeto, segundo README
- [x] Confirmada a presença do botão Excluir produto no JavaScript publicado pela Cloudflare Pages (11/10/2026)
- [ ] Confirmar a publicação das últimas mudanças de SEO no endereço da Cloudflare Pages
- [x] Cloudflare Pages já publica o site em `https://perllon-home.pages.dev/`
- [x] Integração Supabase da loja e painel confirmada em funcionamento pelo desenvolvedor
- [x] Site publicado com HTTPS em `perllon-home.pages.dev`
- [ ] Testar site público + admin em produção
- [ ] (Opcional futuro) conectar domínio personalizado mediante pedido da empresa

## Supabase (já provisionado)
- [x] Migrations 0001–0015 e troca atômica de especificações aplicadas
- [x] Hardening de Storage, auditoria, helpers SQL e CTA aplicado
- [x] Seed de 7 produtos canônicos + catálogo real confirmado com 8 produtos ativos e destaque administrável em 11/10/2026
- [x] Bucket `product-images` público; escrita staff-only
- [x] Admin real (`Administrador`) preservado
