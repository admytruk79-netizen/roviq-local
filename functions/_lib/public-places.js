// Only editorial and display fields may cross the public catalog boundary.
export const PUBLIC_FIELDS = ['id','name','category','category_key','description','why_stop','editorial_reason','recommended_for','local_tip','lat','lng','address','country_code','country','region','city','locality','postal_code','market_slug','photo_url','hours','timezone','is_drivers_pick','trust_level','verified_at','updated_at','arrival_video_url','virtual_image_url'];
export async function publicColumns(db) {
  const {results} = await db.prepare('PRAGMA table_info(places)').all();
  const names = new Set((results || []).map(c => c.name));
  if (!names.has('status') || !names.has('is_hidden')) throw new Error('Catalog schema unavailable');
  return PUBLIC_FIELDS.filter(name => names.has(name)).join(', ');
}
