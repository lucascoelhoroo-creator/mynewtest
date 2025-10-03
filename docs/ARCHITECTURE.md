# Arquitetura do Protótipo AB Jump

O objetivo do protótipo é demonstrar um fluxo completo de roteamento de checkout entre múltiplas
lojas Shopify com consentimento explícito do cliente. A implementação utiliza uma arquitetura
híbrida inspirada em Edge + Functions, mas simplificada em um único servidor Express para fins de
prova de conceito.

## Visão Geral

```
Site A (Origem) -> CDN/Edge (Simulado) -> FaaS/Backend -> Shopify Checkout (Site B)
```

1. **Interceptação Edge (`/api/edge/intercept`)**
   - Recebe intenção de compra com `product_x_id`, `quantity`, região, idioma e canal.
   - Avalia políticas declarativas e mapeamentos de produto.
   - Cria (ou simula) um checkout oficial via Shopify Admin API no Site B correspondente.
   - Registra consentimento a ser apresentado ao cliente e retorna `checkoutUrl` para exibição.

2. **Consentimento**
   - UI exibe a mensagem configurada; somente após consentimento o usuário é redirecionado para
     `checkoutUrl`.
   - `/api/edge/consent/:sessionId` grava a resposta do cliente para auditoria.

3. **Checkout Oficial Shopify**
   - Todo pagamento ocorre no `webUrl` retornado pela Shopify (`Shop Pay` ou checkout nativo).
   - O protótipo inclui atributos customizados no checkout para rastrear `sessionId` e loja origem.

4. **Webhooks do Site B**
   - `/api/webhooks/*` recebem notificações de checkout, pedido criado, pago ou falho.
   - Atualizam sessões internas e alimentam o dashboard.

5. **Dashboard e Monitoramento**
   - `/api/dashboard/metrics` e `/api/dashboard/events` expõem um funil simplificado:
     iniciado → consentido → redirecionado → pago → falhas.

## Persistência

- Dados são armazenados em `data/config.json` (gerado automaticamente com defaults). Em produção,
  recomenda-se utilizar banco de dados gerenciado e criptografia de segredos.

## Controles de Segurança e Ética

- Mensagem de consentimento é obrigatória e configurável.
- Logs incluem apenas IDs e metadados (sem dados sensíveis).
- Não há alteração de `Referer`, `User-Agent` ou uso de proxies.
- Tokens Admin API são opcionais no protótipo; quando ausentes, a chamada à Shopify é simulada.

## Próximas Evoluções

- Desdobrar o roteamento para edge real (Cloudflare Workers, Fastly Compute, etc.).
- Adicionar autenticação (OAuth Shopify + sessão) para proteger a UI administrativa.
- Implementar HMAC para webhooks e enfileiramento de notificações.
- Cobertura de testes automatizados (unitários e de integração).
