export function isAdminAuthed(request, env) {
  return Boolean(env.ADMIN_PASSCODE) && request.headers.get('X-Admin-Passcode') === env.ADMIN_PASSCODE;
}

export function unauthorized() {
  return Response.json({ success: false, error: 'unauthorized' }, { status: 401 });
}
