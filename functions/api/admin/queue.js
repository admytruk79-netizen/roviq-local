import { isAdminAuthed, unauthorized } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!isAdminAuthed(request, env)) {
    return unauthorized();
  }

  const { results } = await env.DB.prepare(
    "SELECT * FROM places WHERE status = 'pending' ORDER BY created_at ASC"
  ).all();

  return Response.json(results);
}
