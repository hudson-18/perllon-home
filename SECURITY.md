# PERLLON — Security

## Divulgação de vulnerabilidades

Se você encontrar uma vulnerabilidade de segurança neste projeto, por favor
não a divulgue publicamente. Entre em contato diretamente:

- E-mail: perllonassistencia@gmail.com

Inclua uma descrição clara do problema, os passos para reproduzir e o impacto
potencial. Faremos o possível para responder e corrigir.

## Escopo

- Site público (frontend estático + integração Supabase)
- Painel administrativo (`/admin.html`)
- Infraestrutura Supabase (PostgreSQL, Auth, RLS, Storage)

Fora de escopo: infraestrutura de terceiros não controlada pelo projeto
(WhatsApp, Google Maps embutido, hosting externo).

## Modelo de ameaças (resumo)

| Ameaça | Mitigação |
|--------|-----------|
| Escrita anônima no catálogo | RLS: deny por padrão; escrita só staff |
| Manipulação de preço pelo cliente | Preço re-lido do banco no checkout; centavos inteiros |
| Escalação de privilégio | `profiles` UPDATE só admin; roles sem escrita |
| IDOR/BOLA | RLS filtra por `auth.uid()` + role |
| XSS stored | Dados do banco escapados antes de `innerHTML` |
| Upload malicioso | MIME allowlist (JPG/PNG/WebP/AVIF), máx 8 MB, sem SVG |
| Vazamento de secrets | Sem service_role no frontend; `.env` fora do Git |
| SQL injection | PostgREST parametrizado (sem SQL concatenado) |
| Tamper de audit log | Append-only (sem UPDATE/DELETE via RLS) |

Veja a Mission 005-C.7 para o red-team completo e o relatório por vetor.

## Boas práticas mantidas

- `service_role` key **nunca** entra no bundle do navegador.
- Autorização no banco (RLS), nunca só no frontend.
- Valores monetários em centavos inteiros (sem floating point).
- `prefers-reduced-motion` respeitado; o `?motion=preview` é restrito a
  localhost (não existe em produção).