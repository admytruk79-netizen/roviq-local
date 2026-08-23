// ROVIQ Core integration boundary for ROVIQ Local.
// All remote calls terminate at ROVIQ Core; Local never connects actors directly.

export class RoviqCoreAdapter {
  constructor(env = {}) {
    this.env = env;
    this.baseUrl = String(env.ROVIQ_CORE_URL || '').replace(/\/$/, '');
    this.apiKey = env.ROVIQ_CORE_API_KEY || '';
    this.mode = this.baseUrl ? 'remote' : 'local';
  }

  async request(path, options = {}) {
    if (!this.baseUrl) return null;
    const headers = new Headers(options.headers || {});
    headers.set('accept', 'application/json');
    if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    if (this.apiKey) headers.set('authorization', `Bearer ${this.apiKey}`);
    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!response.ok) {
      const error = new Error(`ROVIQ Core request failed: ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async health() {
    if (!this.baseUrl) return { mode: 'local', connected: false };
    try {
      const data = await this.request('/health');
      return { mode: 'remote', connected: true, core: data };
    } catch (error) {
      return { mode: 'remote', connected: false, error: error.message };
    }
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

  async createServiceCase(payload) {
    return this.request('/api/maintenance/cases', { method: 'POST', body: JSON.stringify(payload) });
  }

  async getServiceCase(caseId) {
    return this.request(`/api/maintenance/cases/${encodeURIComponent(caseId)}`);
  }

  async triage(caseId, payload) {
    return this.request(`/api/maintenance/cases/${encodeURIComponent(caseId)}/triage/run`, { method: 'POST', body: JSON.stringify(payload) });
  }

  async getTriage(caseId) {
    return this.request(`/api/maintenance/cases/${encodeURIComponent(caseId)}/triage`);
  }

  async emit(event, payload = {}) {
    if (!this.baseUrl) return { accepted: true, mode: 'local', event, payload };
    return this.request('/api/integrations/events', { method: 'POST', body: JSON.stringify({ eventType: event, payload }) });
  }
}

export function createCoreAdapter(env) {
  return new RoviqCoreAdapter(env);
}
