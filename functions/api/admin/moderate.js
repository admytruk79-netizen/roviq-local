import { requireModerator, canModeratePlace } from '../../_lib/auth.js';
import { ensureModerationSchema, updateContributorOutcome } from '../../_lib/moderation.js';

const ACTIONS = new Set(['approve','reject','request_changes','hide','restore']);

export async function onRequestPost({ request, env }) {
  const { response, actor } = await requireModerator(request, env);
  if (response) return response;
  await ensureModerationSchema(env);

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ success:false, error:'invalid JSON body' }, { status:400 }); }

  const id = Number(body.place_id);
  const action = String(body.action || '');
  const reviewer = actor.handle;
  const note = String(body.note || '').trim().slice(0,1000) || null;
  if (!Number.isInteger(id) || id < 1) return Response.json({ success:false, error:'valid place_id required' }, { status:400 });
  if (!ACTIONS.has(action)) return Response.json({ success:false, error:'invalid action' }, { status:400 });

  const place = await env.DB.prepare('SELECT id,status,submitted_by,market_slug,country_code,region,city,is_hidden FROM places WHERE id=?').bind(id).first();
  if (!place) return Response.json({ success:false, error:'place not found' }, { status:404 });
  if (!canModeratePlace(actor, place)) return Response.json({ success:false, error:'not assigned to this market' }, { status:403 });

  let newStatus = place.status;
  let hidden = Number(place.is_hidden || 0);
  let eventAction = action;
  if (action === 'approve') { newStatus = 'approved'; hidden = 0; eventAction = 'approved'; }
  if (action === 'reject') { newStatus = 'rejected'; eventAction = 'rejected'; }
  if (action === 'request_changes') { newStatus = 'pending'; eventAction = 'changes_requested'; }
  if (action === 'hide') { hidden = 1; eventAction = 'hidden'; }
  if (action === 'restore') { hidden = 0; eventAction = 'restored'; }

  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE places SET status=?, is_hidden=?, moderation_note=?, updated_at=?, verified_at=CASE WHEN ?='approved' THEN ? ELSE verified_at END WHERE id=?`).bind(newStatus, hidden, note, now, newStatus, now, id).run();
  await env.DB.prepare(`INSERT INTO moderation_events(place_id,action,reviewer_handle,note,previous_status,new_status) VALUES(?,?,?,?,?,?)`).bind(id,eventAction,reviewer,note,place.status,newStatus).run();
  await env.DB.prepare(`UPDATE moderation_notifications SET status='read' WHERE place_id=? AND status='unread'`).bind(id).run();

  if (action === 'approve') await updateContributorOutcome(env, place.submitted_by, true);
  if (action === 'reject') await updateContributorOutcome(env, place.submitted_by, false);

  return Response.json({ success:true, place_id:id, action:eventAction, status:newStatus, hidden:Boolean(hidden), reviewer, reviewer_role:actor.role });
}
