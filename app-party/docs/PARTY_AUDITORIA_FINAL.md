# PARTY - Auditoria final de produto e seguranca

## RLS e permissoes

- Eventos publicos podem ser vistos por usuarios autenticados.
- Eventos privados ficam restritos ao organizador, amigos confirmados e participantes autorizados pelas policies.
- Ingressos sao visiveis apenas para comprador ou organizador do evento.
- Validacao de ingresso por scanner exige que o usuario autenticado seja organizador do evento.
- Chat/posts do evento exigem participante com ingresso valido ou organizador.
- Moderacao do chat e posts fica limitada ao organizador.
- Tokens de push ficam em `dispositivos_push`, com RLS de dono, nao em `perfis`, porque `perfis` tem leitura autenticada ampla.
- Dados comerciais em `empresas` podem ser lidos por usuarios autenticados, mas criados/alterados apenas pelo dono do perfil empresa.

## Idade e classificacao

- Criacao de evento aceita apenas classificacoes `0, 10, 12, 14, 16, 18`.
- Compra de ingresso usa `data_nascimento` do perfil para bloquear eventos acima da idade permitida.
- Evento sem data futura ou cancelado nao libera compra.
- A validacao de idade acontece no cliente e precisa ser reforcada com funcao/trigger no banco antes de producao real.

## Ingressos e fraude

- Cada ingresso gera `codigo` e payload de QR unicos, com indices unicos no banco.
- Scanner aceita QR ou codigo de backup e muda status de `pago` para `usado`.
- Ingresso usado nao pode ser revalidado.
- Compra mock nao deve ser tratada como pagamento real; Stripe/webhook deve ser o responsavel por confirmar `pago` em producao.
- Para producao, mover geracao de QR/codigo para Edge Function ou backend confiavel.

## Privacidade de eventos

- Feed, mapa, busca e perfil publico dependem das policies de eventos/participantes.
- Eventos privados de amigos so aparecem quando a amizade esta `aceita`.
- Localizacao de amigos so aparece quando `compartilhando = true` e existe amizade confirmada.
- Chat e posts arquivados de eventos encerrados respeitam visibilidade: publico, organizador, amigo do organizador ou participante.

## Validacoes implementadas

- Evento: titulo, descricao, categoria, data futura, coordenadas, capacidade, idade e preco.
- Perfil: nome, username, data de nascimento, idioma preferido e redes sociais.
- Empresa: nome fantasia, descricao, endereco e tipo de local.
- Chat/posts: tamanho de mensagem, post com texto ou imagem e moderação por organizador.
- Suporte humano: assunto e mensagem com limites antes de inserir `tickets_suporte`.

## Riscos restantes antes de producao

- Chaves Groq, Azure e Cloudinary ainda estao como `EXPO_PUBLIC`; para producao, mover chamadas sensiveis para backend/Edge Functions.
- Push real exige EAS projectId e development/release build; Expo Go no Android nao cobre push remoto.
- Pagamento real deve depender de webhook de Stripe, nao do app cliente.
- Geocoding/busca de localizacao devem ter rate limit no backend.
- RLS deve ser testada com usuarios diferentes em uma suite de testes SQL.

## Por que alguem abriria o PARTY em vez do Instagram ou WhatsApp?

Porque o PARTY resolve a pergunta operacional do role: onde ir, quem vai, como entrar e o que acontece depois.

Instagram mostra desejo e divulgacao. WhatsApp resolve conversa. O PARTY junta descoberta, prova social, mapa, ingresso, QR, comunidade do evento, historico e suporte em um fluxo unico. A pessoa abre o PARTY quando quer decidir o proximo evento com contexto real: eventos perto, eventos de amigos, privacidade de eventos privados, ingresso valido, chat so para quem participa e memoria pos-evento no perfil do organizador.

Para empresas, o motivo e ainda mais direto: o PARTY nao e so vitrine. Ele vira painel de venda e operacao: participantes, receita, scanner, posts, historico de eventos realizados e relacionamento com quem realmente comprou ou entrou.
