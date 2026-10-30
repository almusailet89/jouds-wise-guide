// Older releases cached private Supabase responses without session isolation.
// Keep this upgrade hook until those releases are no longer supported.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('supabase-api'));
});
