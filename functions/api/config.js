export async function onRequestGet({ env }) {
  return Response.json({ mapboxToken: env.MAPBOX_TOKEN || null });
}
