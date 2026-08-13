import { isAdminAuthed, unauthorized } from '../../../_lib/auth.js';

export async function onRequestPatch({ request, params, env }) {
  if (!isAdminAuthed(request, env)) {
    return unauthorized();
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'invalid JSON body' }, { status: 400 });
  }

  if (!['approved', 'rejected'].includes(body.status)) {
    return Response.json({ success: false, error: "status must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const result = await env.DB.prepare(
    "UPDATE places SET status = ? WHERE id = ? AND status = 'pending'"
  ).bind(body.status, params.id).run();

  if (result.meta.changes === 0) {
    return Response.json({ success: false, error: 'not found or not pending' }, { status: 404 });
  }
  return Response.json({ success: true, status: body.status });
}
