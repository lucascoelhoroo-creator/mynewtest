# AB Jump – Shopify Payments Checkout Routing Prototype

Este repositório contém um protótipo funcional de roteamento transparente de checkout
para ambientes multi-loja na Shopify. O fluxo foi desenhado para demonstrar práticas de
transparência, consentimento expresso do consumidor e conformidade com Shopify Payments,
PCI DSS (escopo reduzido) e regulamentos de privacidade (LGPD/GDPR).

## Componentes

- **Backend Express** (simulando Edge + Functions/FaaS):
  - `/api/edge/intercept` – recebe intenção de compra do Site A, aplica políticas, registra
    consentimento e retorna a URL oficial de checkout da Shopify.
  - `/api/onboarding/*` – onboarding guiado para conectar lojas, mapear produtos e definir
    políticas de roteamento.
  - `/api/webhooks/*` – handlers de checkout/order que atualizam sessões e registram eventos.
  - `/api/dashboard/*` – métricas e logs para auditoria e monitoramento.
- **Frontend minimalista** (HTML/JS/CSS) servindo onboarding, configuração de consentimento e
  dashboard de acompanhamento.
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
3. **Criar políticas**: configure critérios de roteamento (região, idioma, canal).
4. **Consentimento**: personalize mensagem e CTAs obrigatórios.
5. **Simular interceptação**: use o formulário “Simular Interceptação Edge” para enviar
   `product_x_id` e contexto. O protótipo retorna a URL de checkout e registra o evento.
6. **Webhooks**: envie requisições de teste para `/api/webhooks/order-paid` para simular
   confirmações de pagamento e observe o dashboard ser atualizado.

## Conformidade e salvaguardas inclusas

- **Transparência** – Consentimento explícito antes de redirecionar para outra loja,
  com texto configurável e logs de apresentação/aceite.
- **Privacidade** – Dados mínimos são armazenados (IDs, contexto, consentimento). Nenhum dado
  sensível é salvo; base legal depende da implementação real (não inclusa aqui).
- **PCI DSS** – Pagamentos ocorrem apenas no checkout oficial; qualquer tentativa de coletar
  cartões diretamente requer redesign e certificação (fora do escopo).
- **Políticas Shopify** – O protótipo evita mascarar origem, proxies ou técnicas anti-fraude.
  A documentação e a UI reforçam que apenas lojas da mesma organização devem ser conectadas.
- **Auditoria** – Eventos de roteamento, consentimento e webhooks são gravados para consulta.
- **Feature flags** – Campo `consent.enabled` impede o roteamento sem mensagem configurada.

## Próximos passos sugeridos

- Reescrever o roteamento para um ambiente Edge real (Workers/Lambda@Edge) e Functions
  serverless em produção.
- Persistir dados em storage seguro (ex.: PostgreSQL, Firestore) com autenticação/OAuth real.
- Adicionar autenticação para a UI do onboarding (OAuth Shopify + sessão).
- Implementar notificações assíncronas para o Site A após pagamento (webhooks de saída ou
  eventos em fila).
- Incluir testes automatizados e validação de payloads com Zod/TypeScript.

---

Este protótipo é apenas uma demonstração técnica e não substitui revisão jurídica/comercial.
Sempre valide políticas contratuais, termos de uso da Shopify e legislações locais antes de
colocar qualquer solução semelhante em produção.
