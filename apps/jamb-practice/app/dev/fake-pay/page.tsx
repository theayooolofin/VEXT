import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { fakeGet } from '@/lib/payments/fake';
import { nairaFromKobo } from '@/lib/rules';

// Stand-in for the Paystack checkout page when PAYMENT_PROVIDER=fake.
export default async function FakePay({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (env().PAYMENT_PROVIDER !== 'fake') notFound();
  const reference = (await searchParams).reference ?? '';
  const tx = fakeGet(reference);
  if (!tx) notFound();
  const action = `${env().BASE_PATH}/api/dev/fake-pay`;
  return (
    <main id="main">
      <div className="wrap">
        <h1>Test payment</h1>
        <p className="alert">This is the test payment page. No money moves.</p>
        <p>
          Reference {reference}: {nairaFromKobo(tx.amountKobo)}
        </p>
        <div className="stack">
          <form method="post" action={action}>
            <input type="hidden" name="reference" value={reference} />
            <input type="hidden" name="outcome" value="success" />
            <input type="hidden" name="webhook" value="1" />
            <button className="btn btn-block" type="submit">
              Pay successfully
            </button>
          </form>
          <form method="post" action={action}>
            <input type="hidden" name="reference" value={reference} />
            <input type="hidden" name="outcome" value="failed" />
            <button className="btn btn-secondary btn-block" type="submit">
              Fail the payment
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
