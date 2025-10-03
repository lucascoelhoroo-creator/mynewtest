# Arquitetura do Protótipo AB Jump

O objetivo do protótipo é demonstrar um fluxo completo de roteamento de checkout entre múltiplas
lojas Shopify, mantendo transparência sobre origem/destino e aderindo às políticas de pagamentos.
A implementação utiliza uma arquitetura híbrida inspirada em Edge + Functions, mas simplificada em
um único servidor Express para fins de prova de conceito.

## Visão Geral

```
Site A (Origem) -> CDN/Edge (Simulado) -> FaaS/Backend -> Shopify Checkout (Site B)
```

1. **Interceptação Edge (`/api/edge/intercept`)**
   - Recebe intenção de compra com `product_x_id`, `quantity` e canal.
   - Aplica mapeamentos declarados entre Site A e Site B.
   - Cria (ou simula) um checkout oficial via Shopify Admin API no Site B correspondente.
   - Retorna `checkoutUrl`, registrando qual servidor Jump AB foi selecionado.

2. **Checkout Oficial Shopify**
   - Todo pagamento ocorre no `webUrl` retornado pela Shopify (`Shop Pay` ou checkout nativo).
   - O protótipo inclui atributos customizados no checkout para rastrear `sessionId` e loja origem.

3. **Webhooks do Site B**
   - `/api/webhooks/*` recebem notificações de checkout, pedido criado, pago ou falho.
   - Atualizam sessões internas e alimentam o dashboard.

4. **Dashboard e Monitoramento**
   - `/api/dashboard/metrics` e `/api/dashboard/events` expõem um funil simplificado com
     informações sobre servidor selecionado, origem e destino.

## Persistência

- Dados são armazenados em `data/config.json` (gerado automaticamente com defaults). Em produção,
  recomenda-se utilizar banco de dados gerenciado e criptografia de segredos.

## Worker de Referência (Cloudflare)

- O diretório `cloudflare/` contém `worker.js`, que atua como camada edge mínima para encaminhar
  o `POST /intercept` para o backend Express preservando o payload original e adicionando CORS.
- O arquivo `wrangler.toml` define o entry-point (`main = "cloudflare/worker.js"`) e um `WORKER_ID`
  usado para identificar o servidor Jump AB nos eventos.
- Defina o secret `BACKEND_INTERCEPT_URL` no Worker apontando para o endpoint público do backend.
  Isso resolve o erro de deploy `Missing entry-point to Worker script or to assets directory`
  observado no log da Cloudflare.
- Em produção, substitua o proxy por lógica nativa no Worker (ex.: carregar mapeamentos de KV,
  chamar Shopify diretamente e registrar eventos em serviços gerenciados).

## Controles de Segurança e Ética

- Logs incluem apenas IDs e metadados (sem dados sensíveis).
- Não há alteração de `Referer`, `User-Agent` ou uso de proxies.
- Tokens Admin API são opcionais no protótipo; quando ausentes, a chamada à Shopify é simulada.
- Cadastro explícito dos servidores Jump AB permite rastrear responsabilidade operacional.

## Próximas Evoluções

- Desdobrar o roteamento para edge real (Cloudflare Workers, Fastly Compute, etc.).
- Adicionar autenticação (OAuth Shopify + sessão) para proteger a UI administrativa.
- Implementar HMAC para webhooks e enfileiramento de notificações.
- Cobertura de testes automatizados (unitários e de integração).
