export async function onRequestGet({ env }) {
  return Response.json({
    success: true,
    commit: env.GIT_COMMIT || 'unknown',
    build_time: env.BUILD_TIME || 'unknown',
    environment: env.ENVIRONMENT || 'production'
  });
}
