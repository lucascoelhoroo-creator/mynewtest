# Checklist de Conformidade – AB Jump

Este checklist apoia a validação contínua do protótipo de roteamento de checkout transparente
entre lojas Shopify. Marque cada item antes de promover a solução para ambientes de teste ou
produção.

## Shopify Payments & Termos de Serviço

- [ ] **Checkout oficial obrigatório:** Todas as URLs de pagamento apontam para `*.myshopify.com` ou
      domínio verificado do Site B utilizando Shopify Checkout/Shop Pay.
- [ ] **Sem mascaramento de origem:** O redirecionamento mantém `Referer` e não manipula `User-Agent`.
- [ ] **Mesma organização:** Há acordo contratual que comprove que Site A e Site B pertencem à mesma
      holding/entidade autorizada pela Shopify.
- [ ] **Política de devolução e suporte unificados:** Documentação do Site A informa claramente que o
      atendimento será realizado pela loja destino.

## PCI DSS (Escopo reduzido)

- [ ] Nenhum formulário customizado coleta PAN/CVV ou dados sensíveis.
- [ ] Logs e `data/config.json` não armazenam dados de cartão, apenas IDs técnicos e eventos.
- [ ] Checklist operacional garante que somente workers Jump AB autorizados estejam ativos.
- [ ] Revisão de código confirma que todo pagamento ocorre fora do protótipo (Shopify Checkout).

## LGPD/GDPR

- [ ] Base legal e finalidade descritas na política de privacidade para compartilhar dados entre lojas.
- [ ] Aviso transparente de redirecionamento configurado nas lojas de origem.
- [ ] Dados minimizados: apenas IDs, sessão e contexto (sem dados sensíveis) persistidos.
- [ ] Processo claro de suporte ao consumidor após redirecionamento documentado.

## Segurança Operacional

- [ ] Tokens Admin API são armazenados de forma segura (secret manager) fora deste protótipo.
- [ ] Monitoramento de eventos ativos para falhas, chargebacks e revisões manuais.
- [ ] Webhooks autenticados/verificados (HMAC) antes de produção.

## Limitações conhecidas do protótipo

- Persistência local em arquivo (`data/config.json`) – substituir por banco seguro em produção.
- Nenhuma autenticação/OAuth real implementada; a interface está aberta enquanto o servidor estiver
  acessível.
- Webhooks não validam HMAC neste protótipo.
- Integração com Shopify Admin API está simulada quando o token não é informado.
- Não há testes automatizados; fluxos devem ser validados manualmente.

---

> **Importante:** se algum item acima não puder ser marcado, interrompa o rollout e envolva
> stakeholders de segurança, jurídico e compliance antes de continuar.
