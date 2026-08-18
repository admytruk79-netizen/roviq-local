import { authenticateModerator, unauthorized } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const actor = await authenticateModerator(request, env);
  if (!actor) return unauthorized('Not signed in.');
  return Response.json({
    success: true,
    contributor: {
      id: actor.contributorId,
      handle: actor.handle,
      displayName: actor.displayName || actor.handle,
      role: actor.role
    }
  });
}
