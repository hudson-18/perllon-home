# PERLLON — Estado da entrega comercial (11/10/2026)

## Código publicado na branch principal
- Os testes automatizados passaram: **84/84** no GitHub Actions.
- O build de produção passou.
- `npm audit --audit-level=high` passou, sem vulnerabilidades detectadas no lockfile atual.
- Foi corrigido o ambiente do teste de imagens do catálogo.
- A tela **Admin → Produtos → Editar** inclui a ação **Excluir produto**, que exige confirmação e tenta limpar imagens do Storage.
- Não houve exclusão de produtos reais durante o desenvolvimento destas correções.

## Operação já relatada e conferida
- O administrador confirmou que consegue entrar, cadastrar e editar produtos, alterar destaque e hero no ambiente publicado.
- A consulta somente leitura ao Supabase em 11/10 confirmou **8 produtos ativos**, **1 destaque ativo** e **1 hero ativo**.

## Antes de oferecer como entrega definitiva ao cliente
- [ ] Confirmar que a hospedagem Cloudflare Pages fez deploy da `main` atual e verificar `/admin.html` no endereço publicado (GitHub verde **não** comprova deploy da Cloudflare).
- [ ] Testar a ação Excluir em produto **descartável** numa instância de teste, inclusive limpeza de Storage. Nunca usar um dos oito produtos reais para esse teste.
- [ ] Ativar *Leaked Password Protection* nas configurações de Supabase Auth e validar políticas de senhas e MFA com as contas administrativas.
- [ ] Configurar e testar recuperação de senha somente depois de revisar URLs de redirecionamento no Supabase.
- [ ] Escolher domínio definitivo com a empresa; corrigir canonical, OG, sitemap e referências antes de divulgá-lo.
- [ ] Revisar política de privacidade com o responsável, incluindo o tratamento de dados e WhatsApp.
- [ ] Conferir direitos de uso das imagens, vídeos, marca, conteúdo, preços, prazos, contatos e endereços.
- [ ] Preparar e testar exportação de backup do banco e de imagens do Storage.
- [ ] Formalizar o escopo da venda, titularidade/licença do código reutilizável, domínio, hospedagem, suporte e manutenção com responsável legal.

## Escopo comercial preciso
O site oferece catálogo editável, destaques e hero editáveis, carrinho e preparação de pedidos via WhatsApp. **Não** processa pagamento online no próprio website e não confirma estoque automaticamente. Alterações de catálogo e preços precisam ser geridas pelo responsável pela loja.

## Reutilização como template
Antes de adaptar a outro cliente, copie o projeto em repositório e Supabase próprios, remova dados e marca PERLLON, centralize configurações de negócio (contatos, SEO, identidade visual e páginas institucionais), e nunca compartilhe credenciais entre empresas.
