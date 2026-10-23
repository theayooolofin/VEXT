import { env } from '../env';
import { createFakeProvider } from './fake';
import { createPaystackProvider } from './paystack';
import type { PaymentProvider } from './provider';

const g = globalThis as unknown as { __jpProvider?: PaymentProvider };

/** False until a Paystack secret key is configured; checkout stays closed meanwhile. */
export function paymentsReady(): boolean {
  const e = env();
  return e.PAYMENT_PROVIDER === 'fake' || Boolean(e.PAYSTACK_SECRET_KEY);
}

export function getPaymentProvider(): PaymentProvider {
  if (g.__jpProvider) return g.__jpProvider;
  const e = env();
  g.__jpProvider =
    e.PAYMENT_PROVIDER === 'fake'
      ? createFakeProvider(e.BASE_PATH)
      : createPaystackProvider(e.PAYSTACK_SECRET_KEY ?? '');
  return g.__jpProvider;
}

/** Tests only. */
export function setPaymentProviderForTests(p: PaymentProvider | undefined) {
  g.__jpProvider = p;
}
