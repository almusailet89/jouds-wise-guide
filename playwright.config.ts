// Playwright config — no @playwright/test import to avoid missing-package error
// when the runner uses `npx playwright` without a local install.
export default {
  testDir: './e2e',
  testMatch: ['**/*.spec.ts'],
  use: {
    headless: true,
  },
};
