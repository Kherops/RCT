# End-to-end testing

This repository uses Playwright for browser and desktop UI automation.

## Why Playwright instead of Maestro

Maestro can drive browser content with `openLink` and web selectors, but its model remains mobile-first. For this repository, Playwright is a better fit because:

- `apps/web` is a Next.js application rendered in the browser.
- `apps/desktop` is an Electron shell around the same web UI.
- Playwright supports both Chromium browser automation and Electron window automation in one test stack.

## Install

From the repository root:

```bash
npm install
npx playwright install --with-deps chromium
```

## Run the tests

Browser E2E only:

```bash
npm run test:e2e:web
```

Desktop smoke only:

```bash
npm run test:e2e:desktop
```

All E2E tests:

```bash
npm run test:e2e
```

## Current coverage

- Web:
  - `/en/login` renders
  - navigation from login to signup
  - signup client-side password mismatch validation
- Desktop:
  - Electron launches
  - the app window loads the login page

## Notes

- Playwright starts the Next.js dev server automatically on `http://127.0.0.1:3000`.
- If you want to hit a real backend during E2E, set `NEXT_PUBLIC_API_URL` before running the tests.
- The current suite is smoke-level coverage. Authentication against the real API is not included yet.
