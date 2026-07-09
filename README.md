# d7d — dashboard

A client-only personal dashboard **PWA**: bookmarks, notes, and a search-first
command surface — with **no backend, no accounts, no tracking**. Everything lives
in your browser (IndexedDB); your data moves between devices via manual
**export / import**.

Built with **React + Vite + TypeScript**, **Dexie** (IndexedDB), **Zustand**,
and **vite-plugin-pwa**. Styling is plain CSS with a design-token system
(light / dark / accent / density).

## Features

- **Bookmarks** — grouped, collapsible category list; tags; DuckDuckGo favicons (cached offline); reorder.
- **Notes** — colour-coded sticky notes; pin; masonry grid; quick colour swap; copy-to-clipboard.
- **Search** — `@category`, `#tag`, and free-text filtering across both panels, with recent-search history and autocomplete.
- **Bulk actions** — multi-select to set category / add tags / delete.
- **Category & tag management** — rename and delete (with reassign or delete-items).
- **Clocks & weather** — multi-location, timezone-correct clocks + Open-Meteo weather (keyless, cache-first).
- **Options** — theme, accent, density, favicon toggle, open-links, weather settings.
- **Own your data** — one-file JSON export; import with a diff preview (Amend / Replace).
- **Offline-first PWA** — installable; works with no network after first load.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build → dist/
npm run preview    # preview the production build locally
```

## Deploy (Cloudflare Pages)

One-time setup:

```bash
npx wrangler login            # authenticate with your Cloudflare account
```

Then, any time:

```bash
npm run deploy                # builds, then uploads dist/ to Cloudflare Pages
```

The first deploy creates a Pages project named **`d7d`** (change `--project-name`
in `package.json` to use a different name). Subsequent deploys update it. The site
is served at `https://d7d.pages.dev` (or your custom domain).

> Notes: `public/_redirects` provides the SPA fallback. Data durability is the
> browser's responsibility — on iOS, **Add to Home Screen** and **export regularly**
> (see the in-app Options → Data & Backup).

## Data & privacy

No servers, no analytics. The only outbound requests are **favicons**
(DuckDuckGo, toggleable) and **weather** (Open-Meteo, when you add locations) —
both optional and cache-first. Favicons and weather responses are cached by the
service worker for offline use; your bookmarks, notes, and settings never leave
the device except in an export file you create.
