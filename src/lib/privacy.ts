const USER_SCOPED_STORAGE_KEYS = [
  'jood.onboarding.done',
  'jood.prefs',
  'jood.security.prefs',
  'jood.notif.prefs',
  'jood-fired-reminders',
  // Removed integration UI used to store API keys in localStorage.
  'jood.integrations',
] as const;

/** Clear browser state that must not carry from one signed-in user to another. */
export async function clearPrivateClientState() {
  for (const key of USER_SCOPED_STORAGE_KEYS) localStorage.removeItem(key);

  if ('caches' in window) {
    try {
      const names = await caches.keys();
      await Promise.all(names
        .filter(name => name === 'supabase-api' || name.startsWith('jood-user-'))
        .map(name => caches.delete(name)));
    } catch (error) {
      console.warn('Could not clear private browser caches during sign out.', error);
    }
  }
}
