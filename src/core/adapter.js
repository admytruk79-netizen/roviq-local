// ROVIQ Core integration boundary.
// Local remains independently deployable. Replace these local implementations
// with authenticated ROVIQ Core calls as Core services come online.

export class RoviqCoreAdapter {
  constructor(env = {}) {
    this.env = env;
    this.mode = env.ROVIQ_CORE_URL ? 'remote' : 'local';
  }

  async identity(context = {}) {
    return { mode: this.mode, actorId: context.actorId || null, roles: context.roles || ['visitor'] };
  }

  async entitlements(context = {}) {
    return { mode: this.mode, tier: context.tier || 'free', features: context.features || [] };
  }

  async partner(place = {}) {
    return { mode: this.mode, partnerId: place.partner_id || null, networkType: place.network_type || null };
  }

  async trust(place = {}) {
    return { mode: this.mode, trustLevel: place.trust_level || 'standard', driversPick: Number(place.is_drivers_pick) === 1 };
  }

  async emit(event, payload = {}) {
    // Local no-op until the shared Core event service is enabled.
    // The stable method prevents Local callers from depending on Core transport.
    return { accepted: true, mode: this.mode, event, payload };
  }
}

export function createCoreAdapter(env) {
  return new RoviqCoreAdapter(env);
}
