import type { Payment, UserSubscription } from "../drizzle/schema";

/**
 * Disparado quando um pagamento é aprovado (via webhook MercadoPago ou XGate).
 * Use aqui a lógica de negócio: conceder acesso a um recurso, disparar email
 * de confirmação, liberar download, etc.
 *
 * O `payment.resourceType` e `payment.resourceId` identificam o recurso
 * pago (ex: "item" + id). Isto é específico do seu produto.
 */
export async function onPaymentApproved(payment: Payment): Promise<void> {
  console.log(
    `[hooks] payment approved: id=${payment.id} userId=${payment.userId} resource=${payment.resourceType}:${payment.resourceId} amount=${payment.amount}`
  );
  // TODO: adicionar lógica de negócio aqui
}

/**
 * Disparado quando uma assinatura recorrente muda de status.
 * Útil para: ativar/desativar acesso premium, notificar usuário, etc.
 */
export async function onSubscriptionChanged(
  subscription: UserSubscription
): Promise<void> {
  console.log(
    `[hooks] subscription changed: id=${subscription.id} userId=${subscription.userId} status=${subscription.status}`
  );
  // TODO: adicionar lógica de negócio aqui
}
