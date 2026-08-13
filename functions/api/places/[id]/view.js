export async function onRequestPost({ params, env }) {
  const result = await env.DB.prepare(
    'UPDATE places SET view_count = view_count + 1 WHERE id = ?'
  ).bind(params.id).run();

  if (result.meta.changes === 0) {
    return Response.json({ success: false, error: 'not found' }, { status: 404 });
  }
  return Response.json({ success: true });
}
