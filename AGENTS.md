# AGENTS.md

Guidance for code agents working on Authenticator - 2FA.

## Project Context

- This is a browser extension built with Svelte 5, TypeScript, Vite, Tailwind CSS, and daisyUI.
- Product name: `Authenticator - 2FA`.
- Extension `short_name`: `Authenticator`.
- Homepage metadata: `https://github.com/VastBlast/authenticator-2fa`.

## Development Rules

- Keep changes focused and consistent with existing project patterns.
- Keep shared logic testable, especially auth/import/storage/reorder/localization behavior.
- Add or update Vitest coverage for meaningful logic changes.
- Validate with relevant local commands before finishing:
  - `npm run check`
  - `npm run test`
  - `npm run build`

## UI And UX

- Use Tailwind and daisyUI consistently.
- Take product UX inspiration from Google Authenticator: simple account list, clear codes, minimal friction, and calm security-focused interactions. Do not copy brand assets or imply affiliation.
- The UI must work in small extension windows without clipping, overlap, or hidden controls.
- Build direct usable workflows, not marketing or explainer screens.
- Keep add/import/export/settings flows simple and avoid duplicate paths for the same user task.
- Preserve accessibility for mouse, keyboard, and touch interactions.

## Extension Review

- Keep permissions minimal and justify any new permission through actual behavior.
- Keep CSP tight. Do not introduce remote code or unnecessary network access.
- Avoid named third-party browser references in user-facing copy unless explicitly requested.
- Exported manifests should localize name, short name, description, action title, and command descriptions via `_locales`.
- Exported manifests should include `default_locale: "en"` and the GitHub `homepage_url`.

## Localization

- Runtime translations live in `src/lib/i18n/messages.ts`.
- Manifest translations live in `public/_locales/*/messages.json`.
- Every supported runtime language should have every `MessageKey`.
- Keep `appName` as `Authenticator - 2FA` and `extensionShortName` as `Authenticator` unless explicitly requested otherwise.

## Storage And Serialization

- The vault starts unprotected by default; password protection is optional.
- Do not pass Svelte state proxies into extension storage or crypto serialization.
- Persist plain structured-clone-safe objects.
- Keep tests that exercise structured-clone storage behavior.

## Build Checks

- For manifest, background, or content-script changes, inspect generated `dist/*/manifest.json` and relevant assets after `npm run build`.
- Content scripts injected as files should remain self-contained unless the build is explicitly configured otherwise.
