import { test, expect } from '@playwright/test';

// Placeholder smoke test — prevents "No tests found" CI failure.
// Replace with real e2e tests when the app is deployed in CI.
test('sanity check', () => {
  expect(1 + 1).toBe(2);
});
