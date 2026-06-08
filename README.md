# World Cup Party Watch

Frontend-only Single Page Application for FIFA World Cup 2026 party watch planning, optimized for GitHub Pages.

## Stack and Architecture

- Vite + React + TypeScript
- Hash-based routing with React Router (`HashRouter`) for static hosting safety
- Typed domain layer (`types/`, `services/`, `hooks/`) and presentation layer (`components/`, `pages/`)
- LocalStorage persistence for favorite matches

Why this stack:
- Fast local DX and production builds (Vite)
- Type-safe scalability (TypeScript strict mode)
- Static deployment compatibility and predictable routing on GitHub Pages

## Project Structure

```text
wc-calendar/
├─ .github/
│  └─ workflows/
│     └─ deploy-pages.yml
├─ .vscode/
│  └─ extensions.json
├─ public/
│  └─ data/
│     └─ calendar.json
├─ src/
│  ├─ assets/
│  ├─ components/
│  │  ├─ FiltersBar.tsx
│  │  ├─ MatchCard.tsx
│  │  └─ TopNav.tsx
│  ├─ hooks/
│  │  ├─ useCalendarData.ts
│  │  ├─ useFavorites.ts
│  │  └─ useTimezone.ts
│  ├─ pages/
│  │  ├─ CalendarPage.tsx
│  │  └─ FavoritesPage.tsx
│  ├─ services/
│  │  ├─ calendarService.ts
│  │  └─ storageService.ts
│  ├─ styles/
│  │  ├─ app.css
│  │  ├─ base.css
│  │  ├─ components.css
│  │  └─ tokens.css
│  ├─ types/
│  │  └─ calendar.ts
│  ├─ utils/
│  │  └─ date.ts
│  ├─ App.tsx
│  ├─ index.css
│  └─ main.tsx
├─ eslint.config.js
├─ package.json
├─ tsconfig.app.json
├─ tsconfig.json
├─ tsconfig.node.json
└─ vite.config.ts
```

## Routing Strategy (GitHub Pages Safe)

- Uses `HashRouter` so direct navigation and refresh never return `404` on static hosting.
- Routes:
  - `#/` all matches
  - `#/favorites` favorites-only view

## Build and Deployment

### Scripts

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "build:ci": "npm run typecheck && vite build",
  "typecheck": "tsc -b",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier . --write",
  "format:check": "prettier . --check",
  "preview": "vite preview"
}
```

### GitHub Actions Workflow

File: `.github/workflows/deploy-pages.yml`

- Builds on push to `main`
- Detects correct `VITE_BASE_PATH` for user pages vs project pages
- Uploads `dist/` as Pages artifact
- Deploys with `actions/deploy-pages`

## Bootstrap Instructions

1. Install dependencies.

```bash
npm install
```

2. Run local development server.

```bash
npm run dev
```

3. Validate quality gates.

```bash
npm run typecheck
npm run lint
npm run build
```

4. Push to `main` to deploy to GitHub Pages.

5. In repository settings, ensure Pages source is configured to GitHub Actions.

## Feature Workflow and Conventions

- New page: add in `src/pages/`, register route in `src/App.tsx`, lazy-load it.
- New reusable UI: add in `src/components/` with typed props.
- Data access logic: keep in `src/services/`.
- State and side-effects: keep in `src/hooks/`.
- Domain models: keep in `src/types/`.

Naming:
- Components and pages: PascalCase (`MatchCard.tsx`)
- Hooks: camelCase with `use` prefix (`useFavorites.ts`)
- Services and utils: camelCase (`calendarService.ts`)

## Performance and Optimization

- Route-level code splitting with `React.lazy` and `Suspense`.
- Vendor chunk separation in `vite.config.ts`.
- Static JSON loaded on demand from `public/data/calendar.json`.
- CSS organized into token/base/component layers for predictable cascade and lean styles.

## Future Extension Path

Planned social features (watch-party events/invites) can be added with:

1. New domain model in `src/types/`.
2. New local service in `src/services/` (or external API adapter later).
3. New page in `src/pages/` plus route.
4. Optional sync layer without changing current calendar/favorites architecture.
