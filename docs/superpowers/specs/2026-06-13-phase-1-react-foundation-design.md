# TabulaClean Phase 1 React Foundation Design

## Objective

Create the React, TypeScript, and Vite foundation for TabulaClean and connect it
cleanly to the existing FastAPI application.

Phase 1 delivers an expressive product introduction that flows into a calm,
focused application shell. It establishes frontend routing, reusable layout
components, production static serving, and a combined Docker build without
implementing spreadsheet upload or cleaning workflows.

## Scope

Phase 1 will:

- Add a `frontend/` application using React, TypeScript, and Vite.
- Make TabulaClean the visible product identity throughout the new frontend.
- Add product routes for cleaning, reviewing changes, model evaluation, and
  failure cases.
- Implement the approved visual direction: expressive editorial storytelling
  leading into a quieter workspace.
- Add reusable layout, navigation, status, and placeholder components.
- Check the existing backend health endpoint and display connection status.
- Configure FastAPI to serve the compiled SPA in production.
- Preserve existing backend, legacy workbench, compatibility, benchmark, and
  evaluation behavior.
- Add a multi-stage Docker build for the frontend and backend.
- Document local frontend, backend-only, and Docker workflows.
- Add focused frontend and backend tests for the new integration.

Phase 1 will not:

- Add upload-session APIs.
- Parse, clean, store, validate, or export CSV or XLSX files.
- Add AI suggestion endpoints.
- Store failure cases.
- Present placeholder interactions as functional product capabilities.
- Delete or rename benchmark tasks, graders, task IDs, cleaning actions,
  environment packages, compatibility endpoints, or the legacy workbench.
- Expose tokens, secrets, or environment credentials to the frontend.
- Start Phase 2 work.

## Product Experience

The approved direction combines the strongest qualities of the visual
references without copying their layouts:

- oversized editorial typography and strong section rhythm
- warm cream, forest green, pale mint, and coral colors
- restrained motion and playful details on the product introduction
- a quiet, highly legible workspace for data-related tasks
- rounded controls and cards without making the interface feel like a demo

The root experience begins with a short product introduction and naturally
flows into the Clean My File workspace placeholder. It is not a separate
marketing site.

The visual hierarchy must keep the core workflow clear:

1. preview spreadsheet issues
2. review suggested changes
3. approve risky changes
4. validate the cleaned data
5. download the result

These steps explain product direction only. Upload and cleaning controls remain
inactive and are clearly marked as arriving in Phase 2.

## Routes And Ownership

### React Routes

- `/` - product introduction and Clean My File workspace placeholder
- `/review-changes` - placeholder for reviewing suggested changes
- `/model-evaluation` - advanced/internal model evaluation entry point
- `/failure-cases` - placeholder for future failure analysis
- any unknown React path - friendly in-app not-found page

### Preserved Server Routes

FastAPI continues to own `/health`, `/play`, `/play/api/*`, WebSocket routes,
metadata, schema, state, compatibility routes, and all other existing backend
endpoints. Existing route paths and response contracts remain unchanged unless
a copy-sensitive test must be updated for the new root application.

The `/api/*` namespace is reserved for future product APIs. Phase 1 does not add
upload or cleaning endpoints beneath it.

### Route Precedence

FastAPI registers existing backend and legacy routes before the frontend
fallback. The fallback:

- handles browser `GET` requests only
- serves real compiled assets directly
- returns `index.html` for valid client-side deep links
- never converts API, WebSocket, validation, or method errors into React HTML
- does not intercept preserved server routes

If the production frontend build is missing, frontend routes return an explicit
server-side error explaining that the React application has not been built.
They must not silently fall back to the previous landing page.

## Frontend Architecture

The frontend uses React Router and small, single-purpose components.

Core components:

- `AppShell` provides the shared application frame.
- `Header` contains TabulaClean branding and primary navigation.
- `PageContainer` applies consistent content width and spacing.
- `ProductIntro` implements the expressive opening section.
- `WorkspacePreview` presents the inactive Clean My File workflow preview.
- `StatusCard` displays connection and page status.
- `PlaceholderCard` communicates future functionality honestly.
- `BackendStatus` owns the health-check presentation and retry action.
- `CustomCursor` provides the optional section-aware desktop cursor.
- `NotFoundPage` handles unknown frontend routes.

Each route lives in its own page component. Shared components must not contain
benchmark-specific or route-specific business logic.

Styling uses plain scoped application CSS and shared CSS custom properties.
Phase 1 does not introduce a component framework or utility-CSS system. Fonts
and other required visual assets are bundled with the frontend rather than
depending on third-party runtime requests.

## Responsive And Accessible Behavior

The interface supports desktop and mobile layouts from the start:

- primary navigation collapses cleanly on narrow screens
- workspace cards and navigation do not require horizontal page scrolling
- semantic landmarks and headings describe the page structure
- all navigation and retry actions are keyboard accessible
- visible focus styles meet the product palette's contrast requirements
- status is communicated with text, not color alone
- page titles update for each route
- decorative motion respects `prefers-reduced-motion`

The custom cursor is progressive enhancement only. It:

- appears only for accurate pointer devices
- changes color between major storytelling sections
- is disabled on touch devices and for reduced-motion users
- does not replace the normal cursor for form controls or future data-grid
  interactions
- never prevents clicking, text selection, or keyboard navigation

## Runtime State And Errors

The only backend-driven frontend state in Phase 1 is service health.

On application startup, `BackendStatus` requests `/health` and moves through:

- `checking`
- `connected`
- `unavailable`

A failed health request does not crash the React tree or disable navigation.
The unavailable state uses plain language and provides a retry action. Route
rendering errors produce a friendly in-app error state.

No placeholder upload, cleaning, review, evaluation, or download result is
represented as live backend data. Existing FastAPI validation and error
responses remain unchanged.

Frontend environment variables use Vite's public-variable rules and must never
contain secrets. Local development uses same-origin relative backend paths
through a Vite proxy, avoiding environment-specific URLs in application code.

## Development And Production Serving

### Local Frontend Development

Vite runs the React development server with hot reload. It proxies required
backend paths, including `/health`, to a separately running FastAPI process.

### Backend-Only Development

FastAPI can run without Node for backend, compatibility, benchmark, and legacy
workbench development. If no compiled React build exists, product frontend
routes report the explicit missing-build response described above.

### Production

Vite emits compiled files to `frontend/dist`. FastAPI serves the generated
assets and SPA entry point. No Node server runs in production.

## Docker Design

The Dockerfile becomes a multi-stage build:

1. A pinned Node stage installs frontend dependencies from the lockfile and
   runs the production build.
2. The existing Python stage installs backend dependencies.
3. The final Python runtime copies backend files and `frontend/dist`.
4. Uvicorn remains the production process and continues listening on the
   Hugging Face Space port.

The final image excludes `node_modules`, frontend caches, tests, local
environments, uploaded spreadsheets, failure logs, and other generated files.
The Docker build does not require secrets.

## Testing And Verification

Frontend verification includes:

- TypeScript compilation
- Vite production build
- ESLint
- route rendering and navigation
- backend health success, failure, and retry states
- not-found and route-error behavior
- reduced-motion and custom-cursor eligibility logic where practical

Frontend component tests use a lightweight Vite-compatible test runner and
React Testing Library.

Backend verification includes:

- the existing Python test suite
- `/health` behavior
- preserved backend and legacy routes
- `/play` and its supporting APIs
- compiled SPA root response
- direct loading of React deep links
- compiled asset responses
- unknown frontend route behavior
- backend/API route precedence over SPA fallback
- explicit behavior when `frontend/dist` is absent

Final verification also includes:

- a full frontend production build
- a combined Docker build when locally feasible
- browser review at desktop and mobile widths
- keyboard navigation and visible focus review
- reduced-motion behavior
- review of `git status` and ignored files

Pre-existing failures are reported separately from Phase 1 regressions.

## Documentation And Repository Hygiene

The README and project-direction documentation will explain:

- how to run FastAPI by itself
- how to run FastAPI and Vite for frontend development
- how to build the React frontend for production serving
- how to build and run the combined Docker image
- which product capabilities remain intentionally deferred to Phase 2

Repository ignore rules will cover `frontend/node_modules`, `frontend/dist`,
Vite caches, frontend coverage and test results, local environment files, and
temporary visual-companion files under `.superpowers/`.

Only source files, package manifests, the package lockfile, tests, and intended
documentation belong in the Phase 1 commit. Generated builds, caches, local
logs, secrets, and temporary spreadsheet files do not.

## Acceptance Criteria

Phase 1 is complete when:

- the React, TypeScript, and Vite frontend exists under `frontend/`
- the approved TabulaClean product shell renders at `/`
- all four product pages are navigable and support direct browser refresh
- placeholder copy does not claim Phase 2 functionality exists
- FastAPI serves the production React build
- existing backend and legacy routes retain precedence and behavior
- `/health` drives a resilient frontend status indicator
- the Docker build includes the compiled frontend
- frontend checks and existing backend tests pass, or any unrelated existing
  failures are clearly documented
- setup and deployment workflows are documented
- no generated artifacts or secrets are staged
- no Phase 2 upload, parsing, cleaning-session, AI, or storage behavior has
  been implemented
