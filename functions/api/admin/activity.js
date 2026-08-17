import { requireModerator, canModeratePlace } from '../../_lib/auth.js';
import { ensureModerationSchema } from '../../_lib/moderation.js';

export async function onRequestGet({ request, env }) {
  const { response, actor } = await requireModerator(request, env);
  if (response) return response;
  await ensureModerationSchema(env);

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get('limit') || 40);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, requested)) : 40;

  const out = await env.DB.prepare(`
    SELECT me.id,me.place_id,me.action,me.reviewer_handle,me.note,
           me.previous_status,me.new_status,me.created_at,
           p.name,p.country_code,p.region,p.city,p.market_slug
    FROM moderation_events me
    JOIN places p ON p.id=me.place_id
    ORDER BY me.created_at DESC
    LIMIT 250
  `).all();

  const all = out.results || [];
  const events = (actor.role === 'super_admin' ? all : all.filter(e => canModeratePlace(actor, e))).slice(0, limit);
  return Response.json({
    success:true,
    actor:{handle:actor.handle,display_name:actor.displayName || actor.handle,role:actor.role},
    events
  });
}
