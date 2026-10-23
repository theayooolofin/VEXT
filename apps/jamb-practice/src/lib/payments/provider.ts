export type VerifyStatus = 'success' | 'failed' | 'pending' | 'abandoned';

export type VerifyResult = {
  status: VerifyStatus;
  amountKobo: number;
  currency: string;
  /** The reference the provider reports, which must equal ours. */
  reference: string;
  providerReference: string;
  paidAt?: Date;
  /** Already redacted: safe to store in orders.verify_payload. */
  raw: unknown;
};

export type ParsedWebhook = {
  valid: boolean;
  eventKey: string;
  type: string;
  reference?: string;
  /** Redacted copy of the body for payment_events.payload. */
  redacted?: unknown;
};

export interface PaymentProvider {
  name: string;
  initialize(input: {
    reference: string;
    amountKobo: number;
    currency: 'NGN';
    email: string;
    callbackUrl: string;
    metadata: Record<string, string>;
  }): Promise<{ authorizationUrl: string; providerReference?: string }>;
  verify(reference: string): Promise<VerifyResult>;
  parseWebhook(rawBody: string, headers: Headers): ParsedWebhook;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
