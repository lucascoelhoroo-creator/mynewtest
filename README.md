# AB Jump – Shopify Payments Checkout Routing Prototype

Este repositório contém um protótipo funcional de roteamento transparente de checkout
para ambientes multi-loja na Shopify. O fluxo foi desenhado para demonstrar práticas de
transparência operacional, conformidade com Shopify Payments, PCI DSS (escopo reduzido) e
regulamentos de privacidade (LGPD/GDPR).

## Componentes

- **Backend Express** (simulando Edge + Functions/FaaS):
  - `/api/edge/intercept` – recebe intenção de compra do Site A, aplica mapeamentos e retorna a
    URL oficial de checkout da Shopify.
  - `/api/onboarding/*` – onboarding guiado para conectar lojas, mapear produtos, cadastrar
    servidores de Jump AB e gerar links de checkout de teste.
  - `/api/webhooks/*` – handlers de checkout/order que atualizam sessões e registram eventos.
  - `/api/dashboard/*` – métricas e logs para auditoria e monitoramento.
- **Frontend minimalista** (HTML/JS/CSS) servindo onboarding completo, cadastro de servidores
  Edge/Functions, geração de links de teste e dashboard de acompanhamento.
- **Persistência local** (`data/config.json`) apenas para o protótipo.

> ⚠️ O sistema nunca coleta nem processa dados sensíveis de pagamento. Toda a cobrança ocorre
> exclusivamente no checkout oficial da Shopify (Shop Pay ou checkout padrão).

## Executando o protótipo

```bash
npm install
npm start
```

A aplicação ficará disponível em `http://localhost:3000`.

### Fluxo sugerido para teste

1. **Conectar lojas**: cadastre domínios de Site A e Site B (tokens Admin API são opcionais e
   usados apenas quando quiser acionar a Shopify Admin API real).
2. **Mapear produtos**: defina pares Produto X (Site A) → Produto Y/Variante (Site B) com IDs
   Globais da Shopify e lojas correspondentes.
3. **Cadastrar servidores Jump AB**: informe endpoints das funções/edges responsáveis pelo
   roteamento (veja a seção "Publicando um Worker na Cloudflare" para um exemplo pronto).
4. **Gerar link de teste**: ao conectar lojas e mapeamentos, use a seção “Gerar link de teste”
   para criar um checkout real/simulado para validação.
5. **Simular interceptação**: use o formulário “Simular Interceptação Edge” para enviar
   `product_x_id` e contexto. O protótipo retorna a URL de checkout e registra o evento.
6. **Webhooks**: envie requisições de teste para `/api/webhooks/order-paid` para simular
   confirmações de pagamento e observe o dashboard ser atualizado.

## Conformidade e salvaguardas inclusas

- **Transparência** – Logs completos das decisões de roteamento, origem/destino e servidor
  utilizado para auditoria.
- **Privacidade** – Dados mínimos são armazenados (IDs, contexto técnico). Nenhum dado
  sensível é salvo; base legal depende da implementação real (não inclusa aqui).
- **PCI DSS** – Pagamentos ocorrem apenas no checkout oficial; qualquer tentativa de coletar
  cartões diretamente requer redesign e certificação (fora do escopo).
- **Políticas Shopify** – O protótipo evita mascarar origem, proxies ou técnicas anti-fraude.
  A documentação e a UI reforçam que apenas lojas da mesma organização devem ser conectadas.
- **Auditoria** – Eventos de roteamento e webhooks são gravados para consulta.
- **Feature flags** – Configuração pode ser estendida para exigir servidores registrados antes
  de liberar produção.

## Próximos passos sugeridos

- Reescrever o roteamento para um ambiente Edge real (Workers/Lambda@Edge) e Functions
  serverless em produção.
- Persistir dados em storage seguro (ex.: PostgreSQL, Firestore) com autenticação/OAuth real.
- Adicionar autenticação para a UI do onboarding (OAuth Shopify + sessão).
- Implementar notificações assíncronas para o Site A após pagamento (webhooks de saída ou
  eventos em fila).
- Incluir testes automatizados e validação de payloads com Zod/TypeScript.


## Publicando um Worker na Cloudflare (Jump AB)

O log de implantação da Cloudflare indica `Missing entry-point to Worker script or to assets directory`.
Para que o deploy automático via GitHub funcione é necessário fornecer tanto o arquivo do
Worker quanto a configuração `wrangler.toml`. O repositório agora inclui um exemplo funcional
que encapsula o endpoint `/api/edge/intercept` do backend Express:

1. Ajuste o secret `BACKEND_INTERCEPT_URL` do Worker para apontar para o endereço público do
   backend (ou do ambiente onde o intercept real está hospedado):

   ```bash
   wrangler secret put BACKEND_INTERCEPT_URL
   # cole a URL como https://seu-dominio.com/api/edge/intercept
   ```

2. Opcionalmente personalize o identificador do Worker em `wrangler.toml` (`WORKER_ID`). Esse
   valor aparecerá no dashboard e nos eventos de roteamento.

3. Faça o deploy manual ou deixe o GitHub Actions/Cloudflare Pages executar `npx wrangler deploy`.
   Como o arquivo `wrangler.toml` agora aponta para `cloudflare/worker.js`, o erro de entry-point
   deixa de ocorrer.

O script `cloudflare/worker.js` aceita `POST` com JSON, encaminha para o backend e preserva o
payload/resposta, adicionando CORS básico e um `GET` de saúde. Em produção você pode evoluir o
Worker para executar toda a lógica de roteamento diretamente no edge ou consultar configurações
via KV/Durable Objects.

---

Este protótipo é apenas uma demonstração técnica e não substitui revisão jurídica/comercial.
Sempre valide políticas contratuais, termos de uso da Shopify e legislações locais antes de
colocar qualquer solução semelhante em produção.
