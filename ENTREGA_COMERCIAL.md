# PERLLON — Guia de entrega comercial

Este documento organiza a apresentação, o treinamento e o aceite da solução pela empresa. **Não substitui contrato nem revisão jurídica.**

## 1. O que a solução entrega

- Site institucional com home, informações de assistência, catálogo de produtos, navegação e contato.
- Carrinho de orçamento/pedido com quantidades e subtotal.
- Envio do pedido **pelo WhatsApp**, para conclusão e confirmação humana.
- Painel de administração com login: dashboard, busca de produtos, cadastro, edição, ativação/desativação, exclusão confirmada, marcas, categorias, especificações e imagens.
- Gestão de produto destacado, textos, CTA e imagem.
- Gestão da área principal (hero): título, subtítulo, vídeo, poster, botão e destino.
- Banco de dados PostgreSQL com Supabase Auth, Storage e políticas RLS.
- Código JavaScript/Vite versionado no GitHub com testes automatizados.

**Não faz parte do escopo atual:** pagamento integrado, confirmação automática de estoque, integração com frete e transportadora, emissão de nota fiscal e aplicativo móvel nativo.

## 2. Demonstração para o cliente (sem apagar dados reais)

1. Abrir a home e mostrar a versão móvel e desktop.
2. Conferir dados comerciais, localidade, contatos, preços e imagens com o responsável.
3. Abrir o catálogo, adicionar produtos ao carrinho e demonstrar a mensagem do WhatsApp sem efetivar pedido real.
4. Entrar no `/admin.html` com **conta própria do responsável** (não compartilhar senhas).
5. Mostrar dashboard, produtos, cadastro/edição, ativo/inativo, destaque e editor do hero.
6. Demonstrar a exclusão **somente com produto descartável em ambiente de testes**.
7. Pedir que o responsável faça as alterações de teste sozinho; documentar eventuais problemas.

## 3. Pré-requisitos para transferência e aceite

- Nome/identidade da empresa, logo, imagens e vídeos autorizados para uso.
- Revisão factual de localização, WhatsApp, atendimento, descrição dos serviços e produtos.
- Aprovação de política de privacidade adequada ao uso real de dados e WhatsApp.
- Definição e controle de domínio, hospedagem e projeto Supabase: indicar titular de cada conta.
- Criação de usuário administrador da empresa e ativação de proteções de conta.
- Rotina documentada de backup do banco e dos arquivos do Storage, com restauração testada.
- Confirmação do deploy da versão atual no domínio escolhido, com HTTPS.
- Registro de aceite por escrito.

## 4. Acordo comercial — itens para definir por escrito

- Preço total da implantação inicial e condições de pagamento.
- O que inclui a personalização e a configuração inicial.
- Quantas revisões de conteúdo estão incluídas e prazo para solicitá-las.
- Prazo para corrigir defeitos comprovadamente ligados à entrega.
- Quem paga/gerencia domínio, hospedagem, Supabase e serviços de terceiros.
- Valor e limites de manutenção futura: mudanças de layout, novos recursos, catálogo e suporte.
- Propriedade dos materiais da PERLLON e permissão de uso da marca e fotos.
- Licença de uso do sistema para a PERLLON, **sem exclusividade sobre componentes genéricos do código**, se essa for a intenção acertada pelas partes.
- Permissão para incluir capturas não confidenciais no portfólio do desenvolvedor.

Como o desenvolvedor é menor de idade, envolver responsável legal no acordo e no recebimento.

## 5. Uso como template para outros clientes

Criar um projeto independente, com **outro repositório, banco e Storage**, nunca reutilizando contas e dados de uma loja para outra. Substituir identidade visual, marca, contatos, SEO, políticas, imagens e conteúdo. Revisar adaptações do catálogo e do checkout ao setor da nova empresa.

## 6. Onde fica o botão Excluir

Depois que o commit atual estiver implantado: `/admin.html` → **Produtos** → **Editar** um produto existente → descer até o rodapé do formulário, abaixo da seção **Imagens** → **Excluir produto** (ao lado de Cancelar e Salvar produto). A exclusão solicita confirmação e é irreversível; para apenas ocultar um produto, usar **Inativo**.

## 7. Estado da validação técnica em 11/10/2026

- GitHub Actions: 84 testes aprovados, build aprovado e auditoria npm sem vulnerabilidades detectadas.
- Supabase consultado em modo somente leitura: 8 produtos ativos, 1 destaque ativo, 1 hero ativo.
- A verificação da publicação pela Cloudflare e das configurações de Auth/recuperação de senha requer conferência fora do GitHub.
