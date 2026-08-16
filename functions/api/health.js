export async function onRequestGet({ env }) {
  let database = false;
  let databaseError = null;

  try {
    if (!env.DB) throw new Error('DB binding missing');
    const row = await env.DB.prepare('SELECT 1 AS ok').first();
    database = row?.ok === 1;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : 'database check failed';
  }

  const checks = {
    database,
    mapbox_configured: Boolean(env.MAPBOX_TOKEN),
    admin_configured: Boolean(env.ADMIN_PASSCODE)
  };
  const healthy = checks.database && checks.mapbox_configured;

  return Response.json(
    {
      success: healthy,
      service: 'roviq-local',
      checks,
      ...(databaseError ? { database_error: databaseError } : {})
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'cache-control': 'no-store' }
    }
  );
}
