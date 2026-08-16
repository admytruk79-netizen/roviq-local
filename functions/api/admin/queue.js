import { requireModerator, canModeratePlace } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { response, actor } = await requireModerator(request, env);
  if (response) return response;

  const placesOut = await env.DB.prepare(
    "SELECT * FROM places WHERE status = 'pending' ORDER BY created_at ASC"
  ).all();
  const allPlaces = placesOut.results || [];
  const places = actor.role === 'super_admin' ? allPlaces : allPlaces.filter(p => canModeratePlace(actor, p));

  let advisories = [];
  let advisoriesAvailable = true;
  try {
    const advisoryOut = await env.DB.prepare(
      "SELECT * FROM journey_advisories WHERE status = 'pending' ORDER BY created_at ASC"
    ).all();
    const allAdvisories = advisoryOut.results || [];
    advisories = actor.role === 'super_admin' ? allAdvisories : allAdvisories.filter(a => canModeratePlace(actor, a));
  } catch {
    advisoriesAvailable = false;
  }

  return Response.json({
    success: true,
    actor: { handle: actor.handle, display_name: actor.displayName || actor.handle, role: actor.role, assignments: actor.assignments || [] },
    places,
    advisories,
    advisories_available: advisoriesAvailable,
    counts: { places: places.length, advisories: advisories.length, total: places.length + advisories.length }
  });
}
