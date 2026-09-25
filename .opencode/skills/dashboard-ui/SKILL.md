---
name: Dashboard UI
description: Build or restyle pages in the WhatsApp-bot React dashboard (frontend/). Use for new pages, layout, charts, styling, or mobile-responsiveness work.
---

# Dashboard UI skill

Applies to `frontend/` — the CRA React 18 dashboard for business owners and admins.

## Workflow

1. Read `references/dashboard-map.md` for routes, components, API, and palette.
2. Read `src/components/Layout.js` and the closest existing sibling page first.
   Match its structure — do not invent a new layout system.
3. Reuse `Layout`, `StatCard`, `useIsMobile`, and the shared `api` client.
4. Implement with inline styles following the file's existing tokens.
5. Verify (see Verification).

## Stack (fixed — do not change without asking)

- Create-React-App, React 18, `react-router-dom` v6, `axios`, `recharts`.
- No CSS framework, no new dependencies. Inline `style={{}}` is the convention.
- API: `src/api.js` (axios, `baseURL=/api`, Bearer from `sessionStorage.wa_token`,
  auto-refresh on 401). Call relative paths only (`api.get('/business/stats')`).
  `/api/*` rewrites to the production backend — never hardcode a backend URL.

## Conventions (from the existing pages)

- Every page renders inside `<Layout>`. Sidebar width/collapse is handled there.
- Cards: `{ background:'white', borderRadius:16, padding:24,
  boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }`.
- Palette: bg `#F0F2F5`, ink `#111B21`, muted `#667781`, primary `#075E54`,
  accent `#128C7E`. Status colors inline per banner (red `#C62828` on `#FFF0F0`,
  amber `#856404` on `#FFF8E1`).
- Typography: Inter, page `h1` 24px/800, section labels 13px muted.
- Icons are emoji (💬 📦 ✅ ⚠️). Keep that style unless replacing globally.
- Mobile-first: owners use phones. Use `useIsMobile()` to collapse grids,
  widen tap targets, and reduce padding (see `Layout.js` 72px top offset).
- Data pages follow the `load()` pattern: `loading` / `error` states,
  `useEffect` on mount, retry on failure. Never leave a blank screen on error.
- Charts: `recharts` inside `<ResponsiveContainer>`, muted grid, accent line.
- Dates: `toLocaleDateString('en-KE', …)`. Money: `Ksh 1,500` formatting.
- Auth: role-gated routes live in `App.js` (`ProtectedRoute role="admin"|"business"`).
  Add new routes there and to `Sidebar.js`.

## Verification

- `cd frontend && npm start` → http://localhost:3001, click through the touched
  pages as both roles, plus a 360px-wide viewport.
- `npm run build` must pass with no new warnings.
