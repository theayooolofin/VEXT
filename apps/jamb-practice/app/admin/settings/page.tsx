import { ActionForm, AdminShell } from '@/components/AdminShell';
import { money, one, requireAdmin, type SP } from '@/lib/adminPage';
import { currentOffer } from '@/lib/checkout';
import { foundingPlacesLeft } from '@/lib/rules';
import { SETTING_KINDS, SETTING_LABELS, type SettingKey } from '@/lib/settings';
import { getSettings } from '@/lib/settingsRepo';
import { toLagosLocalInput } from '@/lib/time';

export default async function AdminSettings({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const settings = await getSettings();
  const offer = await currentOffer(settings);
  const left = foundingPlacesLeft(settings, offer.paid, new Date());

  return (
    <AdminShell current="/admin/settings" title="Settings" msg={one(sp.msg)} csrf={csrf}>
      <p className="alert">
        Price right now: <strong>{money(offer.priceKobo)}</strong> ({offer.founding ? 'founding price' : 'standard price'}). Founding places left:{' '}
        <strong>{left}</strong> of {settings.founding_cap}. Paid orders so far: {offer.paid}.
      </p>
      <ActionForm action="settings-save" csrf={csrf} back="/admin/settings" inline={false}>
        {(Object.keys(SETTING_LABELS) as SettingKey[]).map((key) => {
          const kind = SETTING_KINDS[key];
          const value = settings[key];
          const id = `s-${key}`;
          if (kind === 'boolean')
            return (
              <div className="field" key={key}>
                <label className="check">
                  <input type="checkbox" name={key} defaultChecked={Boolean(value)} /> {SETTING_LABELS[key]}
                </label>
              </div>
            );
          const defaultValue =
            kind === 'naira' ? String((value as number) / 100) : kind === 'datetime' ? toLagosLocalInput(new Date(String(value))) : String(value);
          return (
            <div className="field" key={key}>
              <label htmlFor={id}>{SETTING_LABELS[key]}</label>
              {key === 'nudge_template' ? (
                <textarea id={id} name={key} className="input" defaultValue={defaultValue} maxLength={500} />
              ) : (
                <input
                  id={id}
                  name={key}
                  className="input"
                  defaultValue={defaultValue}
                  type={kind === 'datetime' ? 'datetime-local' : kind === 'number' || kind === 'naira' ? 'number' : 'text'}
                  step={kind === 'naira' ? '0.01' : undefined}
                />
              )}
            </div>
          );
        })}
        <button className="btn" type="submit">
          Save settings
        </button>
      </ActionForm>
    </AdminShell>
  );
}
