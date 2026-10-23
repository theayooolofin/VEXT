import { z } from 'zod';
import { lagosDateTime } from './time';

// Owner-editable values. Prices, dates and targets live here, not in env vars.
export const settingsSchema = z.object({
  unlock_time_local: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  founding_cap: z.number().int().min(0),
  founding_deadline: z.iso.datetime(),
  founding_price_kobo: z.number().int().min(100),
  standard_price_kobo: z.number().int().min(100),
  show_founding_counter: z.boolean(),
  refund_window_hours: z.number().int().min(0).max(24 * 60),
  gate2_target: z.number().int().min(1),
  gate3_day7_active_pct: z.number().min(0).max(100),
  gate3_day14_finish_pct: z.number().min(0).max(100),
  gate3_refund_max_pct: z.number().min(0).max(100),
  gate4_extra_pct: z.number().min(0).max(100),
  gate4_cac_max_kobo: z.number().int().min(0),
  gate4_min_orders: z.number().int().min(1),
  gate1_interviews_done: z.number().int().min(0),
  gate1_confirmed: z.number().int().min(0),
  support_whatsapp: z.string().regex(/^\d{8,15}$/).or(z.literal('')),
  support_email: z.email().or(z.literal('')),
  nudge_template: z.string().min(1).max(500),
  gate_result_behind_signup: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  unlock_time_local: '18:00',
  founding_cap: 100,
  founding_deadline: lagosDateTime('2026-11-15', '23:59').toISOString(),
  founding_price_kobo: 30000,
  standard_price_kobo: 30000,
  show_founding_counter: false,
  refund_window_hours: 48,
  gate2_target: 50,
  gate3_day7_active_pct: 60,
  gate3_day14_finish_pct: 40,
  gate3_refund_max_pct: 10,
  gate4_extra_pct: 25,
  gate4_cac_max_kobo: 10000,
  gate4_min_orders: 10,
  gate1_interviews_done: 0,
  gate1_confirmed: 0,
  // Empty means "use SUPPORT_WHATSAPP_E164 / SUPPORT_EMAIL from the environment".
  support_whatsapp: '',
  support_email: '',
  nudge_template:
    'Hi {firstName}, Day {day} of your UTME English practice is open. It takes about 10 minutes.',
  gate_result_behind_signup: false,
};

export const SETTING_LABELS: Record<SettingKey, string> = {
  unlock_time_local: 'Lesson unlock time (Lagos, HH:MM)',
  founding_cap: 'Founding places',
  founding_deadline: 'Founding price ends (ISO time, UTC)',
  founding_price_kobo: 'Founding price (kobo)',
  standard_price_kobo: 'Standard price (kobo)',
  show_founding_counter: 'Show founding places taken',
  refund_window_hours: 'Refund window (hours after first paid lesson)',
  gate2_target: 'Gate 2 target (paid orders)',
  gate3_day7_active_pct: 'Gate 3: active on Day 7 (%)',
  gate3_day14_finish_pct: 'Gate 3: finished Day 14 (%)',
  gate3_refund_max_pct: 'Gate 3: maximum refunds (%)',
  gate4_extra_pct: 'Gate 4: add-on or referral (%)',
  gate4_cac_max_kobo: 'Gate 4: maximum cost per paying customer (kobo)',
  gate4_min_orders: 'Gate 4: minimum paid orders in a channel',
  gate1_interviews_done: 'Gate 1: interviews done',
  gate1_confirmed: 'Gate 1: interviews confirming the problem',
  support_whatsapp: 'Support WhatsApp (digits with country code)',
  support_email: 'Support email',
  nudge_template: 'WhatsApp nudge message ({firstName}, {day})',
  gate_result_behind_signup: 'Hide diagnostic result until signup',
};

/** Merges stored rows over the defaults, ignoring any stored value that fails validation. */
export function mergeSettings(rows: { key: string; value: unknown }[]): Settings {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in settingsSchema.shape)) continue;
    const field = settingsSchema.shape[row.key as SettingKey];
    const parsed = field.safeParse(row.value);
    if (parsed.success) out[row.key] = parsed.data;
  }
  return out as Settings;
}
