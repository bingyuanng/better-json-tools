# Better JSON Tools (Chrome extension)

Chrome (Manifest V3) extension that (now) uses **React + Tailwind + shadcn-style UI**:

- Auto-prettifies JSON when a page is JSON (URL ends with `.json` or `Content-Type` is JSON).
- Provides a collapsible viewer with search (highlight + next/prev), raw/pretty toggle, copy raw, copy value, and sort keys toggle.
- Opens a dedicated **Paste JSON** tab when you click the extension button.

## Load unpacked

1. Install dependencies: `npm install`
2. Build the extension: `npm run build`
3. Open Chrome and go to `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select this folder: `better-json-tools/dist`

## How it works

- A content script runs on all pages but activates only when JSON is detected.
- When active, it replaces the document body with a local **React viewer UI** (no network calls).
- The toolbar button opens the paste tab (built `viewer.html`) for pasting JSON.

## Notes / limitations (v1)

- Auto-prettify avoids pages with typical app UI elements (`input`, `textarea`, `canvas`, `video`, etc.) to reduce accidental takeovers.
- Icons are not wired yet (Chrome will show a default puzzle-piece icon when pinned).

