'use client';

import { A as Link } from '@/components/A';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { api, track } from '@/client/api';

type Errors = Partial<Record<'firstName' | 'phone' | 'classLevel' | 'email' | 'consent' | 'form', string>>;

const FIELD_FOR: Record<string, keyof Errors> = {
  NAME_INVALID: 'firstName',
  PHONE_INVALID: 'phone',
  PHONE_EXISTS: 'phone',
  CONSENT_REQUIRED: 'consent',
};

export function SignupForm({ consentText, whatsappUrl, next }: { consentText: string; whatsappUrl: string; next: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [exists, setExists] = useState(false);
  const started = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  function onFirstInput() {
    if (!started.current) {
      started.current = true;
      track('signup_started');
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      firstName: String(f.get('firstName') ?? ''),
      phone: String(f.get('phone') ?? ''),
      classLevel: String(f.get('classLevel') ?? ''),
      email: String(f.get('email') ?? ''),
      guardianConsent: f.get('consent') === 'on',
    };
    const local: Errors = {};
    if (body.firstName.trim().length < 2) local.firstName = 'Enter your first name (2 to 40 letters).';
    if (!body.phone.trim()) local.phone = 'Enter a Nigerian phone number like 0803 123 4567.';
    if (!body.classLevel) local.classLevel = 'Choose your class.';
    if (!body.guardianConsent) local.consent = 'Tick the box to confirm you agree before you continue.';
    setErrors(local);
    setExists(false);
    if (Object.keys(local).length) {
      focusFirstError(local);
      return;
    }
    setBusy(true);
    const r = await api<{ recoveryCode: string }>('/api/signup', { body });
    if (r.ok) {
      try {
        sessionStorage.setItem('jp_rc', r.data.recoveryCode);
        sessionStorage.setItem('jp_next', next);
      } catch {
        /* the done page explains how to get a new code */
      }
      router.push('/start/done');
      router.refresh();
      return;
    }
    setBusy(false);
    const field = FIELD_FOR[r.code] ?? 'form';
    const errs = { [field]: r.message };
    setErrors(errs);
    setExists(r.code === 'PHONE_EXISTS');
    track('error_shown', { code: r.code });
    focusFirstError(errs);
  }

  function focusFirstError(errs: Errors) {
    const order: (keyof Errors)[] = ['firstName', 'phone', 'classLevel', 'email', 'consent', 'form'];
    const first = order.find((k) => errs[k]);
    if (first && first !== 'form') form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  const describe = (k: keyof Errors) => (errors[k] ? `${k}-error` : undefined);

  return (
    <form ref={form} onSubmit={submit} onInput={onFirstInput} noValidate>
      {errors.form && (
        <p className="alert alert-error" role="alert">
          {errors.form}
        </p>
      )}
      <div className="field">
        <label htmlFor="firstName">First name</label>
        <input id="firstName" name="firstName" className="input" autoComplete="given-name" maxLength={40} aria-invalid={Boolean(errors.firstName)} aria-describedby={describe('firstName')} />
        {errors.firstName && (
          <p id="firstName-error" className="field-error" role="alert">
            {errors.firstName}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="phone">Phone number</label>
        <p className="hint" id="phone-hint">
          You use this with your recovery code to sign back in.
        </p>
        <input
          id="phone"
          name="phone"
          className="input"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="0803 123 4567"
          maxLength={20}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={['phone-hint', describe('phone')].filter(Boolean).join(' ')}
        />
        {errors.phone && (
          <div id="phone-error" className="field-error" role="alert">
            <p style={{ margin: 0 }}>{errors.phone}</p>
            {exists && (
              <p style={{ margin: '6px 0 0' }}>
                <Link href="/recover">Sign back in</Link> or <a href={whatsappUrl}>message support on WhatsApp</a>.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor="classLevel">Class</label>
        <select id="classLevel" name="classLevel" className="input" defaultValue="" aria-invalid={Boolean(errors.classLevel)} aria-describedby={describe('classLevel')}>
          <option value="" disabled>
            Choose one
          </option>
          <option value="ss3">SS3</option>
          <option value="ss2_or_below">SS2 or below</option>
          <option value="graduate">Finished secondary school</option>
          <option value="other">Other</option>
        </select>
        {errors.classLevel && (
          <p id="classLevel-error" className="field-error" role="alert">
            {errors.classLevel}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="email">Email (optional)</label>
        <p className="hint" id="email-hint">
          Only used for your payment receipt.
        </p>
        <input id="email" name="email" className="input" type="email" inputMode="email" autoComplete="email" maxLength={200} aria-describedby="email-hint" />
      </div>
      <div className="field">
        <label className="check">
          <input type="checkbox" name="consent" aria-invalid={Boolean(errors.consent)} aria-describedby={describe('consent')} />
          <span>
            {consentText.replace('Privacy Policy.', '')}
            <Link href="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        {errors.consent && (
          <p id="consent-error" className="field-error" role="alert">
            {errors.consent}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-block" disabled={busy}>
        {busy ? 'Saving...' : 'Save my result and start Day 1'}
      </button>
    </form>
  );
}
