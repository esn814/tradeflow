// Unregister any stale service workers on load
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then(r => r.forEach(s => s.unregister()))
      .catch(() => {});
  });
}
