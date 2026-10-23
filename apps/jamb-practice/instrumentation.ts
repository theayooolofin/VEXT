// Runs once when the server starts. With IN_PROCESS_CRON=true (single-server
// hosting), reminders and housekeeping run on timers inside the app; both are
// idempotent, so running them often is safe.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.IN_PROCESS_CRON !== 'true') return;
  const { runReminders, runHousekeeping } = await import('./src/lib/jobs');
  const { getSettings } = await import('./src/lib/settingsRepo');
  const { logServer } = await import('./src/lib/events');
  let lastHousekeeping = 0;
  const tick = async () => {
    try {
      await runReminders(await getSettings());
      if (Date.now() - lastHousekeeping > 55 * 60_000) {
        lastHousekeeping = Date.now();
        await runHousekeeping();
      }
    } catch (e) {
      logServer('error', 'scheduled job failed', { message: (e as Error).message });
    }
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 10 * 60_000).unref();
}
