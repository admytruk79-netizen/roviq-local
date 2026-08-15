(() => {
  const originalFetch = window.fetch.bind(window);
  window.__roviqPlaces = [];
  window.fetch = async (...args) => {
    const res = await originalFetch(...args);
    try {
      const url = String(args[0] instanceof Request ? args[0].url : args[0]);
      if (url.includes('/api/places') && !url.includes('/view') && (args[1]?.method || 'GET').toUpperCase() === 'GET') {
        const data = await res.clone().json();
        if (data?.success && Array.isArray(data.places)) window.__roviqPlaces = data.places;
      }
    } catch {}
    return res;
  };
})();
