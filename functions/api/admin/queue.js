import { isAdminAuthed, unauthorized } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!isAdminAuthed(request, env)) return unauthorized();

  const placesOut = await env.DB.prepare(
    "SELECT * FROM places WHERE status = 'pending' ORDER BY created_at ASC"
  ).all();

  let advisories = [];
  let advisoriesAvailable = true;
  try {
    const advisoryOut = await env.DB.prepare(
      "SELECT * FROM journey_advisories WHERE status = 'pending' ORDER BY created_at ASC"
    ).all();
    advisories = advisoryOut.results || [];
  } catch {
    advisoriesAvailable = false;
  }

  return Response.json({
    success: true,
    places: placesOut.results || [],
    advisories,
    advisories_available: advisoriesAvailable,
    counts: {
      places: (placesOut.results || []).length,
      advisories: advisories.length,
      total: (placesOut.results || []).length + advisories.length
    }
  });
}
