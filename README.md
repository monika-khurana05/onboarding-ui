# cpx-country-onboarding-ui

Production-grade enterprise UI for **CPX Country Onboarding**.

## What This UI Covers

- End-to-end onboarding flow:
1. Snapshot creation
2. Snapshot versioning
3. FSM/config preview generation
4. Repository pack validation before commit
- Enterprise shell:
  - MUI AppBar + Drawer layout
  - Environment badge derived from API URL (`DEV/UAT/PROD`)
  - Global error snackbar
  - Root error boundary

## Routes

- `/` Dashboard
- `/snapshots/new` Create Snapshot Wizard
- `/snapshots/:snapshotId` Snapshot Details
- `/generate/preview` Preview Generation
- `/jobs` Jobs placeholder (Phase 3 PR automation)
- `/settings` Settings/About

## Stack

- React 18 + TypeScript
- Vite
- Material UI + MUI Icons
- TanStack React Query
- React Router
- React Hook Form + Zod
- Monaco Editor (`@monaco-editor/react`) for advanced JSON mode
- ESLint + Prettier
- Vitest + Testing Library

## Backend Endpoints Integrated

- `GET /health`
- `GET /repo-defaults`
- `POST /snapshots`
- `GET /snapshots/{snapshotId}?version=`
- `POST /snapshots/{snapshotId}/versions`
- `POST /generate/preview`
- `GET /repos/{repoSlug}/packs?ref=main` (optional)

## Environment Variables

Create a `.env` file using `.env.example`:

```env
VITE_API_BASE_URL=
VITE_AUTH_TOKEN=
```

- `VITE_API_BASE_URL`: required to call backend APIs.
- `VITE_AUTH_TOKEN`: optional bearer token.

If backend requires no auth, leave `VITE_AUTH_TOKEN` blank.
Environment badge is auto-derived from `VITE_API_BASE_URL` (`DEV`, `UAT`, `PROD`).

## Run

```bash
npm install
npm run dev
```

## Build and Quality

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Notes

- Forms are strongly validated with Zod and show actionable errors.
- Loading/empty/error/retry states are implemented on all main backend interactions.
- UI is keyboard accessible and uses semantic labels and navigation primitives.
