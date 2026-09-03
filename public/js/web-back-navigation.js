(() => {
  const GUARD_KEY = 'roviqGuard';
  let rearming = false;

  function cardOpen() {
    const el = document.querySelector('#rq-card');
    return !!el && !el.hidden;
  }

  function discoverOpen() {
    const el = document.querySelector('#rq-discover-menu');
    return !!el && !el.hidden;
  }

  function isInternalState() {
    const body = document.body;
    return body?.dataset?.navigating === 'true' || cardOpen() || discoverOpen() || body?.dataset?.state === 'wild' || body?.dataset?.state === 'explore';
  }

  function armGuard() {
    if (rearming || history.state?.[GUARD_KEY]) return;
    rearming = true;
    history.pushState({ ...(history.state || {}), [GUARD_KEY]: true }, '', location.href);
    queueMicrotask(() => { rearming = false; });
  }

  function consumeBack() {
    const body = document.body;

    if (body?.dataset?.navigating === 'true') {
      const close = document.querySelector('.rq-nav-close');
      if (close) {
        close.click();
        return true;
      }
    }

    if (cardOpen()) {
      document.querySelector('#rq-card-close')?.click();
      return true;
    }

    if (discoverOpen()) {
      document.querySelector('#rq-discover')?.click();
      return true;
    }

    if (body?.dataset?.state === 'wild' || body?.dataset?.state === 'explore') {
      document.querySelector('#rq-home')?.click();
      return true;
    }

    return false;
  }

  function init() {
    history.replaceState({ ...(history.state || {}), roviqBase: true }, '', location.href);
    armGuard();

    window.addEventListener('popstate', () => {
      if (consumeBack()) {
        setTimeout(armGuard, 0);
        return;
      }

      // No ROVIQ internal state remains: honor the user's intent to leave.
      if (!isInternalState()) history.back();
    });

    const observer = new MutationObserver(() => {
      if (isInternalState()) armGuard();
    });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-state', 'data-navigating', 'hidden'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
