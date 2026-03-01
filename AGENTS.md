# Repository Guidelines

## Project Structure & Module Organization
- `manifest.json` and `newtab.html` define the Manifest V3 extension entry points.
- `src/` holds the JavaScript modules (configuration defaults, storage, UI logic, utilities).
- `styles/` contains the main stylesheet for the new tab UI.
- `icons/` holds extension icons.
- `UI/` contains a static HTML/CSS UI reference.
- `scripts/pack.ps1` builds release artifacts; `build/` and `release/` are generated outputs.

## Build, Test, and Development Commands
- Load locally (Chrome/Edge): open `chrome://extensions` or `edge://extensions`, enable Developer Mode, then “Load unpacked” and select the repo root. This uses the live `newtab.html` and `src/` files.
- Package release (Windows PowerShell):
  - `powershell -ExecutionPolicy Bypass -File .\scripts\pack.ps1`
  - Produces `release/uitab-local-clone-v<version>-<timestamp>.zip` and, if Chrome/Edge is installed, a `.crx` plus `.pem` key.

## Coding Style & Naming Conventions
- JavaScript is ES modules with `import`/`export` and semicolons; use 2-space indentation to match existing files.
- Use `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants, and keep DOM IDs/classes in `kebab-case`.
- No automated formatter or linter is configured; follow patterns in `src/*.js` and keep changes consistent.

## Testing Guidelines
- No automated test framework is present.
- Manual smoke checks are expected after changes:
  - Open a new tab, verify search, quick links add/edit/delete, theme toggle, and settings persistence.
  - If weather or storage changes were made, verify refresh and data persistence across reloads.

## Commit & Pull Request Guidelines
- Git history shows short, sentence-style commit messages without prefixes (e.g., “解决了一下已知的问题”). Keep summaries concise and consistent with that style.
- PRs should include:
  - A brief description of behavior changes.
  - Screenshots or a short clip for UI changes.
  - Testing notes (manual steps and browser/version).

## Configuration & Data Notes
- User settings persist under `chrome.storage.local` with a `localStorage` fallback for development.
- Config key: `uitab_local_clone_config`; schema defaults and migrations live in `src/defaults.js`.
