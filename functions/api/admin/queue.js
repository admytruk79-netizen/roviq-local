import { requireModerator, canModeratePlace } from '../../_lib/auth.js';
import { ensureModerationSchema } from '../../_lib/moderation.js';

function marketKey(item) {
  return item.market_slug || [item.city, item.region, item.country_code].filter(Boolean).join(' · ') || 'unassigned';
}

export async function onRequestGet({ request, env }) {
  const { response, actor } = await requireModerator(request, env);
  if (response) return response;
  await ensureModerationSchema(env);

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

  const marketCounts = new Map();
  for (const item of [...places, ...advisories]) {
    const key = marketKey(item);
    marketCounts.set(key, (marketCounts.get(key) || 0) + 1);
  }

  const unreadOut = await env.DB.prepare(`
    SELECT mn.*,
           p.country_code AS place_country_code,p.region AS place_region,p.city AS place_city,p.market_slug AS place_market_slug
    FROM moderation_notifications mn
    LEFT JOIN places p ON p.id=mn.place_id
    WHERE mn.status='unread'
    ORDER BY mn.created_at DESC
    LIMIT 200
  `).all();
  const unreadAll = unreadOut.results || [];
  const unread = actor.role === 'super_admin' ? unreadAll : unreadAll.filter(n => canModeratePlace(actor, {
    country_code:n.place_country_code,
    region:n.place_region,
    city:n.place_city || n.city,
    market_slug:n.place_market_slug || n.market_slug
  }));

  return Response.json({
    success: true,
    actor: { handle: actor.handle, display_name: actor.displayName || actor.handle, role: actor.role, assignments: actor.assignments || [] },
    places,
    advisories,
    advisories_available: advisoriesAvailable,
    counts: { places: places.length, advisories: advisories.length, total: places.length + advisories.length, unread: unread.length },
    markets: [...marketCounts.entries()].map(([market,count]) => ({ market, count })).sort((a,b) => b.count-a.count || a.market.localeCompare(b.market)),
    notifications: unread.slice(0,50)
  });
}
