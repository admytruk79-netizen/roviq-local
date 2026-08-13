export async function onRequestGet({ params, env }) {
  const place = await env.DB.prepare('SELECT * FROM places WHERE id = ?').bind(params.id).first();
  if (!place) {
    return Response.json({ success: false, error: 'not found' }, { status: 404 });
  }
  return Response.json({ success: true, place });
}
