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
    mapping_provider: 'stadia-maplibre-leaflet',
    admin_configured: Boolean(env.ADMIN_PASSCODE)
  };

  // Mapping uses Stadia Maps vector tiles rendered via MapLibre GL, mounted
  // inside Leaflet as the outer map/marker API. Database availability is the
  // only required backend health dependency here.
  const healthy = checks.database;

  return Response.json(
    {
      success: healthy,
      service: 'roviq-local2',
      checks,
      ...(databaseError ? { database_error: databaseError } : {})
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'cache-control': 'no-store' }
    }
  );
}
