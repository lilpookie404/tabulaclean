# TabulaClean Phase 1 React Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TabulaClean React, TypeScript, and Vite product shell, connect it to FastAPI health and production serving, and package the frontend and backend together without implementing Phase 2 spreadsheet features.

**Architecture:** A React Router SPA owns product routes while existing FastAPI, compatibility, WebSocket, and legacy workbench routes retain precedence. Vite proxies backend routes during development; in production, a FastAPI 404 middleware serves safe compiled files or the SPA entry point only for browser navigation.

**Tech Stack:** React 19, TypeScript 6, Vite 8, React Router 7, Vitest, React Testing Library, CSS, FastAPI, pytest, Docker multi-stage builds

---

## File Map

### Frontend Tooling

- Create `frontend/package.json` for scripts and pinned dependency ranges.
- Create `frontend/package-lock.json` with npm.
- Create `frontend/index.html` as the Vite entry document.
- Create `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, and
  `frontend/tsconfig.node.json` for strict browser and tooling type checks.
- Create `frontend/vite.config.ts` for React, tests, and development proxies.
- Create `frontend/eslint.config.js` for TypeScript, hooks, and refresh rules.

### Frontend Application

- Create `frontend/src/main.tsx` as the browser entry point.
- Create `frontend/src/app/router.tsx` as the single route table.
- Create `frontend/src/app/AppShell.tsx` as the shared routed layout.
- Create `frontend/src/components/Header.tsx` for desktop and mobile navigation.
- Create `frontend/src/components/PageContainer.tsx` for page width and spacing.
- Create `frontend/src/components/ProductIntro.tsx` for the expressive opening.
- Create `frontend/src/components/WorkspacePreview.tsx` for the inactive
  Clean My File workflow.
- Create `frontend/src/components/ProductPrinciples.tsx` for the light
  story-driven feature section.
- Create `frontend/src/components/PhaseBoundaryCallout.tsx` for the pale-mint
  closing section.
- Create `frontend/src/components/PlaceholderCard.tsx` and
  `frontend/src/components/StatusCard.tsx` for shared content states.
- Create `frontend/src/components/BackendStatus.tsx` for service status and
  retry behavior.
- Create `frontend/src/components/CustomCursor.tsx` for progressive desktop
  cursor enhancement.
- Create `frontend/src/hooks/useBackendHealth.ts` for the health request state.
- Create `frontend/src/pages/*.tsx` for the four product routes, route errors,
  and frontend 404 behavior.
- Create `frontend/src/styles/global.css` for the approved responsive visual
  system.
- Create `frontend/src/test/setup.ts` for DOM test matchers and cleanup.

### Backend Integration

- Create `server/frontend.py` to isolate safe SPA fallback behavior.
- Modify `server/app.py` to remove the old root template route and install the
  frontend middleware after preserving existing routes.
- Modify `tests/test_env.py` for SPA serving, deep-link, asset, missing-build,
  and route-precedence coverage.

### Delivery And Documentation

- Modify `Dockerfile` for Node and Python build stages.
- Modify `.dockerignore` and `.gitignore` for frontend and visual-companion
  artifacts.
- Modify `README.md`, `docs/PROJECT_DIRECTION.md`, and `tests/test_docs.py` for
  Phase 1 run and build instructions.

---

### Task 1: Scaffold The Frontend Toolchain

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/package-lock.json`
- Create: `frontend/index.html`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/eslint.config.js`
- Create: `frontend/src/vite-env.d.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/App.test.tsx`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/styles/global.css`
- Modify: `.gitignore`

- [ ] **Step 1: Confirm the backend baseline before frontend changes**

Run:

```bash
python3 -m pytest -q
```

Expected: the existing Python suite passes before Phase 1 changes.

- [ ] **Step 2: Add frontend and visual-preview ignore rules**

Append these entries to `.gitignore`:

```gitignore
frontend/coverage/
frontend/.eslintcache
.superpowers/
```

Run:

```bash
git check-ignore -v .superpowers/brainstorm/12582-1781356273/content/tabulaclean-reference-synthesis-v2.html
```

Expected: `.gitignore` reports the new `.superpowers/` rule.

- [ ] **Step 3: Create the package manifest**

Create `frontend/package.json`:

```json
{
  "name": "tabulaclean-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json",
    "build": "npm run typecheck && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "npm run lint && npm run test && npm run build"
  },
  "dependencies": {
    "@fontsource/dm-sans": "^5.2.8",
    "@fontsource/playfair-display": "^5.2.8",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-router-dom": "^7.17.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^25.9.3",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.2",
    "eslint": "^10.5.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.6.0",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "typescript-eslint": "^8.61.0",
    "vite": "^8.0.16",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 4: Create strict TypeScript configuration**

Create `frontend/tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Create `frontend/tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

Create `frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

Create `frontend/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 5: Configure Vite, tests, backend proxies, and linting**

Create `frontend/vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.TABULACLEAN_BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": backendTarget,
      "/health": backendTarget,
      "/play": backendTarget,
      "/static": backendTarget,
      "/docs": backendTarget,
      "/redoc": backendTarget,
      "/openapi.json": backendTarget,
      "/metadata": backendTarget,
      "/schema": backendTarget,
      "/state": backendTarget,
      "/reset": backendTarget,
      "/step": backendTarget,
      "/mcp": backendTarget,
      "/ws": {
        target: backendTarget.replace(/^http/, "ws"),
        ws: true
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true
  }
});
```

Create `frontend/eslint.config.js`:

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": ["warn", { "allowConstantExport": true }]
    }
  }
);
```

- [ ] **Step 6: Write the initial failing smoke test**

Create `frontend/src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the TabulaClean identity", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "TabulaClean" })).toBeInTheDocument();
  });
});
```

Create `frontend/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Install dependencies and verify the smoke test fails**

Run:

```bash
cd frontend
npm install
npm test -- --run src/App.test.tsx
```

Expected: FAIL because `src/App.tsx` does not exist.

- [ ] **Step 8: Add the minimal Vite application**

Create `frontend/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="TabulaClean is an AI-assisted spreadsheet cleaning workspace."
    />
    <title>TabulaClean</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `frontend/src/App.tsx`:

```tsx
export default function App() {
  return <h1>TabulaClean</h1>;
}
```

Create `frontend/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/600-italic.css";
import App from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create `frontend/src/styles/global.css`:

```css
:root {
  font-family: "DM Sans", system-ui, sans-serif;
  color: #17372f;
  background: #f4f1e8;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}
```

- [ ] **Step 9: Run all frontend scaffold checks**

Run:

```bash
cd frontend
npm run lint
npm test
npm run build
```

Expected: lint, one smoke test, TypeScript, and Vite build all pass.

- [ ] **Step 10: Commit the scaffold**

```bash
git add .gitignore frontend
git commit -m "build: scaffold TabulaClean React frontend"
```

---

### Task 2: Add Product Routes And The Shared App Shell

**Files:**
- Create: `frontend/src/app/router.tsx`
- Create: `frontend/src/app/AppShell.tsx`
- Create: `frontend/src/components/Header.tsx`
- Create: `frontend/src/components/PageContainer.tsx`
- Create: `frontend/src/components/PlaceholderCard.tsx`
- Create: `frontend/src/components/RouteTitle.tsx`
- Create: `frontend/src/pages/CleanMyFilePage.tsx`
- Create: `frontend/src/pages/ReviewChangesPage.tsx`
- Create: `frontend/src/pages/ModelEvaluationPage.tsx`
- Create: `frontend/src/pages/FailureCasesPage.tsx`
- Create: `frontend/src/pages/NotFoundPage.tsx`
- Create: `frontend/src/pages/RouteErrorPage.tsx`
- Create: `frontend/src/app/router.test.tsx`
- Modify: `frontend/src/App.tsx`
- Delete: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write failing route tests**

Create `frontend/src/app/router.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { appRoutes } from "./router";

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("TabulaClean routes", () => {
  it("renders the Clean My File route at the root", () => {
    renderRoute("/");
    expect(screen.getByRole("heading", { name: "Clean My File" })).toBeInTheDocument();
  });

  it("navigates between product routes", async () => {
    renderRoute("/");
    fireEvent.click(screen.getByRole("link", { name: "Review Changes" }));
    expect(await screen.findByRole("heading", { name: "Review Changes" })).toBeInTheDocument();
  });

  it("renders a friendly frontend 404", () => {
    renderRoute("/not-a-real-page");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("updates the browser title", async () => {
    renderRoute("/model-evaluation");
    await waitFor(() => {
      expect(document.title).toBe("Model Evaluation | TabulaClean");
    });
  });
});
```

- [ ] **Step 2: Run the route tests to verify they fail**

Run:

```bash
cd frontend
npm test -- --run src/app/router.test.tsx
```

Expected: FAIL because `app/router.tsx` and route components do not exist.

- [ ] **Step 3: Add shared layout components**

Create `frontend/src/components/PageContainer.tsx`:

```tsx
import type { PropsWithChildren } from "react";

type PageContainerProps = PropsWithChildren<{ className?: string }>;

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return <div className={`page-container ${className}`.trim()}>{children}</div>;
}
```

Create `frontend/src/components/PlaceholderCard.tsx`:

```tsx
type PlaceholderCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: {
    href: string;
    label: string;
  };
};

export function PlaceholderCard({
  eyebrow,
  title,
  description,
  action
}: PlaceholderCardProps) {
  return (
    <section className="placeholder-card">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <a className="button button-dark" href={action.href}>
          {action.label}
        </a>
      ) : null}
    </section>
  );
}
```

Create `frontend/src/components/Header.tsx`:

```tsx
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Clean My File", end: true },
  { to: "/review-changes", label: "Review Changes" },
  { to: "/model-evaluation", label: "Model Evaluation" },
  { to: "/failure-cases", label: "Failure Cases" }
];

function NavigationLinks() {
  return (
    <>
      {links.map((link) => (
        <NavLink
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          end={link.end}
          key={link.to}
          to={link.to}
        >
          {link.label}
        </NavLink>
      ))}
    </>
  );
}

export function Header() {
  return (
    <header className="site-header">
      <NavLink className="brand" to="/">
        TabulaClean
      </NavLink>
      <nav aria-label="Primary navigation" className="desktop-nav">
        <NavigationLinks />
      </nav>
      <details className="mobile-nav">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          <NavigationLinks />
        </nav>
      </details>
    </header>
  );
}
```

Create `frontend/src/components/RouteTitle.tsx`:

```tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/": "Clean My File",
  "/review-changes": "Review Changes",
  "/model-evaluation": "Model Evaluation",
  "/failure-cases": "Failure Cases"
};

export function RouteTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${titles[pathname] ?? "Page Not Found"} | TabulaClean`;
  }, [pathname]);

  return null;
}
```

Create `frontend/src/app/AppShell.tsx`:

```tsx
import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import { RouteTitle } from "../components/RouteTitle";

export function AppShell() {
  return (
    <>
      <RouteTitle />
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Add route pages**

Create `frontend/src/pages/CleanMyFilePage.tsx`:

```tsx
import { PageContainer } from "../components/PageContainer";
import { PlaceholderCard } from "../components/PlaceholderCard";

export function CleanMyFilePage() {
  return (
    <PageContainer>
      <h1>Clean My File</h1>
      <PlaceholderCard
        eyebrow="Phase 1 foundation"
        title="Your guided cleaning workspace is taking shape"
        description="CSV and Excel upload sessions arrive in Phase 2. This phase establishes the product shell and backend connection."
      />
    </PageContainer>
  );
}
```

Create `frontend/src/pages/ReviewChangesPage.tsx`:

```tsx
import { PageContainer } from "../components/PageContainer";
import { PlaceholderCard } from "../components/PlaceholderCard";

export function ReviewChangesPage() {
  return (
    <PageContainer>
      <h1>Review Changes</h1>
      <PlaceholderCard
        eyebrow="Human review"
        title="Understand every suggested fix"
        description="Future cleaning sessions will show before-and-after values and pause risky changes for explicit approval."
      />
    </PageContainer>
  );
}
```

Create `frontend/src/pages/ModelEvaluationPage.tsx`:

```tsx
import { PageContainer } from "../components/PageContainer";
import { PlaceholderCard } from "../components/PlaceholderCard";

export function ModelEvaluationPage() {
  return (
    <PageContainer>
      <h1>Model Evaluation</h1>
      <PlaceholderCard
        eyebrow="Advanced workspace"
        title="Compare cleaning behavior in a controlled environment"
        description="The existing deterministic evaluation tools remain available as an advanced layer behind the product experience."
        action={{ href: "/play", label: "Open evaluation workspace" }}
      />
    </PageContainer>
  );
}
```

Create `frontend/src/pages/FailureCasesPage.tsx`:

```tsx
import { PageContainer } from "../components/PageContainer";
import { PlaceholderCard } from "../components/PlaceholderCard";

export function FailureCasesPage() {
  return (
    <PageContainer>
      <h1>Failure Cases</h1>
      <PlaceholderCard
        eyebrow="Future analysis"
        title="Learn where cleaning suggestions need improvement"
        description="Failure-case storage is intentionally outside Phase 1. This page reserves the future product workflow without collecting data."
      />
    </PageContainer>
  );
}
```

Create `frontend/src/pages/NotFoundPage.tsx`:

```tsx
import { Link } from "react-router-dom";
import { PageContainer } from "../components/PageContainer";

export function NotFoundPage() {
  return (
    <PageContainer>
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page you requested is not part of the TabulaClean workspace.</p>
      <Link className="button button-dark" to="/">
        Return to Clean My File
      </Link>
    </PageContainer>
  );
}
```

Create `frontend/src/pages/RouteErrorPage.tsx`:

```tsx
import { Link, useRouteError } from "react-router-dom";
import { PageContainer } from "../components/PageContainer";

export function RouteErrorPage() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "The page could not be displayed.";

  return (
    <PageContainer>
      <p className="eyebrow">Something went wrong</p>
      <h1>We could not open this page</h1>
      <p>{message}</p>
      <Link className="button button-dark" to="/">
        Return home
      </Link>
    </PageContainer>
  );
}
```

- [ ] **Step 5: Add the route table and application router**

Create `frontend/src/app/router.tsx`:

```tsx
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { AppShell } from "./AppShell";
import { CleanMyFilePage } from "../pages/CleanMyFilePage";
import { FailureCasesPage } from "../pages/FailureCasesPage";
import { ModelEvaluationPage } from "../pages/ModelEvaluationPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ReviewChangesPage } from "../pages/ReviewChangesPage";
import { RouteErrorPage } from "../pages/RouteErrorPage";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <CleanMyFilePage /> },
      { path: "review-changes", element: <ReviewChangesPage /> },
      { path: "model-evaluation", element: <ModelEvaluationPage /> },
      { path: "failure-cases", element: <FailureCasesPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
];

export const appRouter = createBrowserRouter(appRoutes);
```

Replace `frontend/src/App.tsx` with:

```tsx
import { RouterProvider } from "react-router-dom";
import { appRouter } from "./app/router";

export default function App() {
  return <RouterProvider router={appRouter} />;
}
```

Delete `frontend/src/App.test.tsx`; its identity coverage is superseded by the
route tests.

- [ ] **Step 6: Run route tests and frontend checks**

Run:

```bash
cd frontend
npm test -- --run src/app/router.test.tsx
npm run lint
npm run typecheck
```

Expected: all route tests, lint, and type checks pass.

- [ ] **Step 7: Commit routing**

```bash
git add frontend/src
git commit -m "feat: add TabulaClean application routes"
```

---

### Task 3: Build The Approved Product Shell

**Files:**
- Create: `frontend/src/components/ProductIntro.tsx`
- Create: `frontend/src/components/WorkspacePreview.tsx`
- Create: `frontend/src/components/ProductPrinciples.tsx`
- Create: `frontend/src/components/PhaseBoundaryCallout.tsx`
- Create: `frontend/src/components/StatusCard.tsx`
- Create: `frontend/src/components/CustomCursor.tsx`
- Create: `frontend/src/components/CustomCursor.test.tsx`
- Create: `frontend/src/pages/CleanMyFilePage.test.tsx`
- Modify: `frontend/src/pages/CleanMyFilePage.tsx`
- Modify: `frontend/src/app/AppShell.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write failing home-page and cursor tests**

Create `frontend/src/pages/CleanMyFilePage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CleanMyFilePage } from "./CleanMyFilePage";

describe("CleanMyFilePage", () => {
  it("presents the product workflow without claiming uploads work", () => {
    render(<CleanMyFilePage />);
    expect(screen.getByRole("heading", { name: /Messy data, made clear/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Useful features, told like a story/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Playful motion, never at the cost of clarity/i })).toBeInTheDocument();
    expect(screen.getByText("Upload controls arrive in Phase 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/choose file/i)).not.toBeInTheDocument();
  });
});
```

Create `frontend/src/components/CustomCursor.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomCursor } from "./CustomCursor";

function mockMedia(matches: Record<string, boolean>) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

afterEach(() => {
  document.body.classList.remove("custom-cursor-enabled");
  vi.unstubAllGlobals();
});

describe("CustomCursor", () => {
  it("renders only for fine pointers without reduced motion", () => {
    mockMedia({
      "(pointer: fine)": true,
      "(prefers-reduced-motion: reduce)": false
    });
    render(<CustomCursor />);
    expect(screen.getByTestId("custom-cursor")).toBeInTheDocument();
    expect(document.body).toHaveClass("custom-cursor-enabled");
  });

  it("does not render for reduced-motion users", () => {
    mockMedia({
      "(pointer: fine)": true,
      "(prefers-reduced-motion: reduce)": true
    });
    render(<CustomCursor />);
    expect(screen.queryByTestId("custom-cursor")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
cd frontend
npm test -- --run src/pages/CleanMyFilePage.test.tsx src/components/CustomCursor.test.tsx
```

Expected: FAIL because the approved shell components do not exist.

- [ ] **Step 3: Add the product introduction and status card**

Create `frontend/src/components/ProductIntro.tsx`:

```tsx
export function ProductIntro() {
  return (
    <>
      <section className="hero" data-cursor-tone="coral">
        <div className="hero-content">
          <p className="eyebrow">AI-assisted spreadsheet cleaning</p>
          <h1>
            Messy data,
            <br />
            <em>made clear.</em>
          </h1>
          <div className="hero-footer">
            <p>
              Spot spreadsheet issues, review suggested fixes, approve risky
              changes, and validate what comes out.
            </p>
            <a className="text-link" href="#workspace">
              Explore the workspace
            </a>
          </div>
        </div>
        <div aria-hidden="true" className="orbit" />
      </section>
      <div aria-hidden="true" className="workflow-marquee">
        <span>
          Preview issues - Review changes - Validate data - Download clean files -
          Preview issues - Review changes - Validate data - Download clean files -
        </span>
      </div>
    </>
  );
}
```

Create `frontend/src/components/StatusCard.tsx`:

```tsx
type StatusCardProps = {
  number: string;
  title: string;
  description: string;
};

export function StatusCard({ number, title, description }: StatusCardProps) {
  return (
    <article className="status-card">
      <span>{number}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </article>
  );
}
```

- [ ] **Step 4: Add the inactive workspace preview**

Create `frontend/src/components/WorkspacePreview.tsx`:

```tsx
import { StatusCard } from "./StatusCard";

const steps = [
  { number: "01", title: "Preview", description: "Understand detected issues" },
  { number: "02", title: "Review", description: "Check suggested fixes" },
  { number: "03", title: "Validate", description: "Confirm data quality" },
  { number: "04", title: "Download", description: "Keep the clean result" }
];

export function WorkspacePreview() {
  return (
    <section className="workspace-section" data-cursor-tone="forest" id="workspace">
      <div className="section-heading">
        <h2>
          Expressive outside.
          <br />
          Focused inside.
        </h2>
        <p>
          The workspace stays quiet, legible, and trustworthy while TabulaClean
          guides each decision.
        </p>
      </div>
      <div className="workspace-frame">
        <aside aria-label="Workflow preview" className="workspace-sidebar">
          <span className="workspace-brand">TabulaClean</span>
          <span className="workspace-link active">Clean My File</span>
          <span className="workspace-link">Review Changes</span>
          <span className="workspace-link">Model Evaluation</span>
          <span className="workspace-link">Failure Cases</span>
          <p>Advanced evaluation stays available without dominating the product.</p>
        </aside>
        <div className="workspace-main">
          <p className="eyebrow">New cleaning session</p>
          <h3>Start with your spreadsheet</h3>
          <div aria-disabled="true" className="upload-placeholder">
            <span aria-hidden="true">+</span>
            <strong>CSV and Excel workspace</strong>
            <p>Upload controls arrive in Phase 2</p>
          </div>
          <div className="status-grid">
            {steps.map((step) => (
              <StatusCard key={step.number} {...step} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Add the approved light feature and closing sections**

Create `frontend/src/components/ProductPrinciples.tsx`:

```tsx
const principles = [
  {
    number: "01",
    title: "Plain-English issue previews",
    description:
      "Explain what is wrong without asking people to understand schemas or technical cleaning terminology."
  },
  {
    number: "02",
    title: "Human review where it matters",
    description:
      "Safe fixes can move quickly. Risky changes pause for explicit approval with clear before-and-after context."
  },
  {
    number: "03",
    title: "Evaluation stays behind the product",
    description:
      "Model comparison tools remain accessible as an advanced layer instead of defining the main journey."
  }
];

export function ProductPrinciples() {
  return (
    <section className="principles-section" data-cursor-tone="coral">
      <p className="eyebrow">Product principles</p>
      <h2>
        Useful features,
        <br />
        told like a story.
      </h2>
      <div className="principles-list">
        {principles.map((principle) => (
          <article className="principle" key={principle.number}>
            <span>{principle.number}</span>
            <h3>{principle.title}</h3>
            <p>{principle.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

Create `frontend/src/components/PhaseBoundaryCallout.tsx`:

```tsx
export function PhaseBoundaryCallout() {
  return (
    <section className="phase-callout" data-cursor-tone="coral">
      <h2>Playful motion, never at the cost of clarity.</h2>
      <a className="button button-coral" href="#workspace">
        Explore the workspace
      </a>
    </section>
  );
}
```

- [ ] **Step 6: Compose the complete root experience**

Replace `frontend/src/pages/CleanMyFilePage.tsx` with:

```tsx
import { PhaseBoundaryCallout } from "../components/PhaseBoundaryCallout";
import { ProductIntro } from "../components/ProductIntro";
import { ProductPrinciples } from "../components/ProductPrinciples";
import { WorkspacePreview } from "../components/WorkspacePreview";

export function CleanMyFilePage() {
  return (
    <>
      <ProductIntro />
      <WorkspacePreview />
      <ProductPrinciples />
      <PhaseBoundaryCallout />
    </>
  );
}
```

- [ ] **Step 7: Add the progressive custom cursor**

Create `frontend/src/components/CustomCursor.tsx`:

```tsx
import { useEffect, useState } from "react";

const interactiveSelector =
  "a, button, input, textarea, select, [role='button'], [contenteditable='true']";

export function CustomCursor() {
  const [enabled] = useState(
    () =>
      window.matchMedia("(pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const cursor = document.querySelector<HTMLElement>("[data-testid='custom-cursor']");
    if (!cursor) {
      return;
    }

    document.body.classList.add("custom-cursor-enabled");

    const move = (event: PointerEvent) => {
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      const target = event.target instanceof Element ? event.target : null;
      const section = target?.closest<HTMLElement>("[data-cursor-tone]");
      cursor.dataset.tone = section?.dataset.cursorTone ?? "coral";
      cursor.dataset.hidden = target?.closest(interactiveSelector) ? "true" : "false";
    };

    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      document.body.classList.remove("custom-cursor-enabled");
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return <span aria-hidden="true" className="custom-cursor" data-testid="custom-cursor" />;
}
```

Modify `frontend/src/app/AppShell.tsx`:

```tsx
import { Outlet } from "react-router-dom";
import { CustomCursor } from "../components/CustomCursor";
import { Header } from "../components/Header";
import { RouteTitle } from "../components/RouteTitle";

export function AppShell() {
  return (
    <>
      <RouteTitle />
      <CustomCursor />
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  );
}
```

- [ ] **Step 8: Implement the approved visual system**

Replace `frontend/src/styles/global.css` with:

```css
:root {
  --forest: #17372f;
  --cream: #f4f1e8;
  --paper: #fbfaf5;
  --mint: #b9f5cf;
  --mint-soft: #dff7e8;
  --lime: #d8ff5f;
  --coral: #ff7557;
  --line: rgb(23 55 47 / 18%);
  --muted: rgb(23 55 47 / 68%);
  font-family: "DM Sans", system-ui, sans-serif;
  color: var(--forest);
  background: var(--cream);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: var(--cream);
}

button,
a,
input,
textarea,
select {
  font: inherit;
}

a {
  color: inherit;
}

:focus-visible {
  outline: 3px solid var(--coral);
  outline-offset: 4px;
}

.site-header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 1rem 4vw;
  border-bottom: 1px solid var(--line);
  background: rgb(244 241 232 / 86%);
  backdrop-filter: blur(14px);
}

.brand,
.workspace-brand {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.45rem;
  font-weight: 600;
  text-decoration: none;
}

.desktop-nav {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  padding-block: 0.35rem;
  border-bottom: 2px solid transparent;
  font-size: 0.85rem;
  text-decoration: none;
}

.nav-link.active {
  border-color: var(--coral);
  font-weight: 700;
}

.mobile-nav {
  display: none;
}

.page-container {
  width: min(1120px, calc(100% - 2rem));
  min-height: 100vh;
  margin-inline: auto;
  padding: 9rem 0 5rem;
}

.page-container > h1 {
  max-width: 900px;
  margin: 0 0 2.5rem;
  font-size: clamp(3.5rem, 8vw, 7rem);
  line-height: 0.92;
  letter-spacing: -0.055em;
}

.eyebrow {
  margin: 0 0 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero {
  position: relative;
  display: grid;
  min-height: 100vh;
  align-items: center;
  overflow: hidden;
  padding: 8.5rem 5vw 4rem;
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero h1 {
  max-width: 1100px;
  margin: 1.25rem 0;
  font-size: clamp(4rem, 9.5vw, 9rem);
  font-weight: 600;
  line-height: 0.84;
  letter-spacing: -0.065em;
}

.hero h1 em {
  color: var(--coral);
  font-family: "Playfair Display", Georgia, serif;
  font-weight: 600;
}

.hero-footer,
.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
}

.hero-footer p {
  max-width: 34rem;
  font-size: 1.1rem;
  line-height: 1.6;
}

.text-link {
  flex: none;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.orbit {
  position: absolute;
  top: 28%;
  right: 8vw;
  width: 11.5rem;
  height: 11.5rem;
  border: 1px solid var(--line);
  border-radius: 50%;
  animation: orbit-spin 16s linear infinite;
}

.orbit::before,
.orbit::after {
  position: absolute;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 0.55rem;
  background: var(--lime);
  content: "";
}

.orbit::before {
  top: 1.5rem;
  left: 0.4rem;
}

.orbit::after {
  right: 0.2rem;
  bottom: 1.8rem;
  background: var(--coral);
}

.workflow-marquee {
  overflow: hidden;
  padding-block: 0.8rem;
  border-block: 1px solid var(--line);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}

.workflow-marquee span {
  display: inline-block;
  animation: marquee 24s linear infinite;
}

.workspace-section {
  min-height: 100vh;
  padding: 6.5rem 5vw;
  background: var(--mint);
}

.section-heading {
  margin-bottom: 2.5rem;
}

.section-heading h2 {
  margin: 0;
  font-size: clamp(3rem, 6vw, 5.5rem);
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.section-heading p {
  max-width: 25rem;
  line-height: 1.6;
}

.workspace-frame {
  display: grid;
  grid-template-columns: 15rem 1fr;
  min-height: 36rem;
  overflow: hidden;
  border: 2px solid var(--forest);
  border-radius: 1.75rem;
  background: var(--paper);
  box-shadow: 1rem 1rem 0 var(--forest);
}

.workspace-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1.5rem 1.1rem;
  border-right: 1px solid var(--line);
}

.workspace-brand {
  margin-bottom: 1.25rem;
}

.workspace-link {
  padding: 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.82rem;
}

.workspace-link.active {
  background: var(--lime);
  font-weight: 700;
}

.workspace-sidebar p {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.5;
}

.workspace-main {
  padding: clamp(1.5rem, 4vw, 2.5rem);
}

.workspace-main h3 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
  letter-spacing: -0.04em;
}

.principles-section {
  padding: 7rem 5vw;
  background: var(--paper);
}

.principles-section > h2,
.phase-callout h2 {
  margin: 0;
  font-size: clamp(3rem, 6vw, 5.5rem);
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.principles-list {
  margin-top: 3.5rem;
  border-top: 1px solid var(--line);
}

.principle {
  display: grid;
  grid-template-columns: 5rem 1fr 1fr;
  gap: 2rem;
  align-items: center;
  padding: 2rem 0;
  border-bottom: 1px solid var(--line);
}

.principle > span {
  color: var(--coral);
  font-weight: 700;
}

.principle h3 {
  margin: 0;
  font-size: 1.7rem;
}

.principle p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.phase-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 5rem 5vw;
  background: var(--mint-soft);
}

.phase-callout h2 {
  max-width: 55rem;
}

.button-coral {
  flex: none;
  background: var(--coral);
  color: var(--forest);
  font-weight: 700;
}

.upload-placeholder {
  display: grid;
  min-height: 16rem;
  margin-top: 2rem;
  place-items: center;
  align-content: center;
  border: 1.5px dashed rgb(23 55 47 / 45%);
  border-radius: 1.4rem;
  background: linear-gradient(135deg, #fff, #f2efe5);
  text-align: center;
}

.upload-placeholder > span {
  display: grid;
  width: 3.7rem;
  height: 3.7rem;
  margin-bottom: 0.9rem;
  place-items: center;
  border-radius: 1rem;
  background: var(--coral);
  color: white;
  font-size: 1.8rem;
}

.upload-placeholder strong {
  font-size: 1.2rem;
}

.upload-placeholder p {
  margin: 0.5rem 0 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-top: 1rem;
}

.status-card,
.placeholder-card {
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: white;
}

.status-card {
  padding: 1rem;
}

.status-card span,
.status-card strong {
  display: block;
}

.status-card span {
  margin-bottom: 0.45rem;
  color: var(--coral);
  font-size: 0.72rem;
  font-weight: 700;
}

.status-card p {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.75rem;
}

.placeholder-card {
  max-width: 50rem;
  padding: clamp(1.5rem, 4vw, 3rem);
  box-shadow: 0.75rem 0.75rem 0 var(--mint);
}

.placeholder-card h2 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: -0.045em;
}

.placeholder-card > p:not(.eyebrow) {
  max-width: 40rem;
  color: var(--muted);
  line-height: 1.65;
}

.button {
  display: inline-flex;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 999px;
  text-decoration: none;
}

.button-dark {
  background: var(--forest);
  color: white;
}

.custom-cursor {
  position: fixed;
  top: -0.7rem;
  left: -0.7rem;
  z-index: 100;
  width: 1.4rem;
  height: 1.4rem;
  pointer-events: none;
  border-radius: 50%;
  background: var(--coral);
  mix-blend-mode: multiply;
  transition: opacity 120ms ease, background 180ms ease;
  will-change: transform;
}

.custom-cursor[data-tone="forest"] {
  background: var(--forest);
}

.custom-cursor[data-hidden="true"] {
  opacity: 0;
}

.custom-cursor-enabled {
  cursor: none;
}

.custom-cursor-enabled a,
.custom-cursor-enabled button,
.custom-cursor-enabled input,
.custom-cursor-enabled textarea,
.custom-cursor-enabled select {
  cursor: pointer;
}

@keyframes orbit-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes marquee {
  to {
    transform: translateX(-50%);
  }
}

@media (max-width: 800px) {
  .desktop-nav {
    display: none;
  }

  .mobile-nav {
    display: block;
  }

  .mobile-nav summary {
    cursor: pointer;
    font-weight: 700;
  }

  .mobile-nav nav {
    position: absolute;
    top: calc(100% + 1px);
    right: 0;
    display: grid;
    min-width: 14rem;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--line);
    background: var(--paper);
  }

  .orbit {
    display: none;
  }

  .hero-footer,
  .section-heading,
  .phase-callout {
    align-items: start;
    flex-direction: column;
  }

  .workspace-frame {
    grid-template-columns: 1fr;
    box-shadow: 0.5rem 0.5rem 0 var(--forest);
  }

  .workspace-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .workspace-sidebar .workspace-link:not(.active),
  .workspace-sidebar p {
    display: none;
  }

  .status-grid {
    grid-template-columns: 1fr 1fr;
  }

  .principle {
    grid-template-columns: 3rem 1fr;
  }

  .principle p {
    grid-column: 2;
  }
}

@media (max-width: 480px) {
  .status-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }

  .custom-cursor {
    display: none;
  }
}
```

- [ ] **Step 9: Run focused and full frontend checks**

Run:

```bash
cd frontend
npm test -- --run src/pages/CleanMyFilePage.test.tsx src/components/CustomCursor.test.tsx
npm run check
```

Expected: all frontend tests, lint, type checks, and production build pass.

- [ ] **Step 10: Commit the product shell**

```bash
git add frontend/src
git commit -m "feat: build TabulaClean product shell"
```

---

### Task 4: Add Resilient Backend Health State

**Files:**
- Create: `frontend/src/hooks/useBackendHealth.ts`
- Create: `frontend/src/components/BackendStatus.tsx`
- Create: `frontend/src/components/BackendStatus.test.tsx`
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write failing health-state tests**

Create `frontend/src/components/BackendStatus.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendStatus } from "./BackendStatus";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BackendStatus", () => {
  it("shows connected after a healthy response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "healthy" })
      })
    );
    render(<BackendStatus />);
    expect(screen.getByText("Checking")).toBeInTheDocument();
    expect(await screen.findByText("Connected")).toBeInTheDocument();
  });

  it("stays navigable and offers retry after failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "healthy" })
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<BackendStatus />);
    expect(await screen.findByText("Unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry connection" }));
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the health tests to verify they fail**

Run:

```bash
cd frontend
npm test -- --run src/components/BackendStatus.test.tsx
```

Expected: FAIL because `BackendStatus` does not exist.

- [ ] **Step 3: Implement the health hook**

Create `frontend/src/hooks/useBackendHealth.ts`:

```ts
import { useCallback, useEffect, useState } from "react";

export type BackendHealthState = "checking" | "connected" | "unavailable";

export function useBackendHealth() {
  const [state, setState] = useState<BackendHealthState>("checking");

  const check = useCallback(async () => {
    setState("checking");
    try {
      const response = await fetch("/health", {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error(`Health request failed with ${response.status}`);
      }
      const payload: unknown = await response.json();
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("status" in payload) ||
        payload.status !== "healthy"
      ) {
        throw new Error("Health response was not healthy");
      }
      setState("connected");
    } catch {
      setState("unavailable");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void check();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [check]);

  return { state, retry: check };
}
```

- [ ] **Step 4: Implement the status component and mount it in the header**

Create `frontend/src/components/BackendStatus.tsx`:

```tsx
import { useBackendHealth } from "../hooks/useBackendHealth";

const labels = {
  checking: "Checking",
  connected: "Connected",
  unavailable: "Unavailable"
};

export function BackendStatus() {
  const { state, retry } = useBackendHealth();

  return (
    <div aria-live="polite" className={`backend-status ${state}`}>
      <span aria-hidden="true" className="status-dot" />
      <span>{labels[state]}</span>
      {state === "unavailable" ? (
        <button onClick={() => void retry()} type="button">
          Retry connection
        </button>
      ) : null}
    </div>
  );
}
```

Replace `frontend/src/components/Header.tsx` with:

```tsx
import { NavLink } from "react-router-dom";
import { BackendStatus } from "./BackendStatus";

const links = [
  { to: "/", label: "Clean My File", end: true },
  { to: "/review-changes", label: "Review Changes" },
  { to: "/model-evaluation", label: "Model Evaluation" },
  { to: "/failure-cases", label: "Failure Cases" }
];

function NavigationLinks() {
  return (
    <>
      {links.map((link) => (
        <NavLink
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          end={link.end}
          key={link.to}
          to={link.to}
        >
          {link.label}
        </NavLink>
      ))}
    </>
  );
}

export function Header() {
  return (
    <header className="site-header">
      <NavLink className="brand" to="/">
        TabulaClean
      </NavLink>
      <nav aria-label="Primary navigation" className="desktop-nav">
        <NavigationLinks />
      </nav>
      <BackendStatus />
      <details className="mobile-nav">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          <NavigationLinks />
        </nav>
      </details>
    </header>
  );
}
```

Append to `frontend/src/styles/global.css`:

```css
.backend-status {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--paper);
  font-size: 0.72rem;
  font-weight: 700;
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #d89c22;
}

.backend-status.connected .status-dot {
  background: #258353;
}

.backend-status.unavailable .status-dot {
  background: var(--coral);
}

.backend-status button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
  text-decoration: underline;
}

@media (max-width: 800px) {
  .backend-status {
    margin-left: auto;
  }
}
```

- [ ] **Step 5: Run health tests and the frontend suite**

Run:

```bash
cd frontend
npm test -- --run src/components/BackendStatus.test.tsx
npm run check
```

Expected: health success, failure, retry, and all existing frontend checks pass.

- [ ] **Step 6: Commit health integration**

```bash
git add frontend/src
git commit -m "feat: show backend health in product shell"
```

---

### Task 5: Serve The Compiled SPA From FastAPI

**Files:**
- Create: `server/frontend.py`
- Modify: `server/app.py`
- Modify: `tests/test_env.py`

- [ ] **Step 1: Replace the old root-page test with failing SPA tests**

In `tests/test_env.py`, import `Path` and `server.frontend`, then replace
`test_root_page_has_core_links` with:

```python
from pathlib import Path

import server.frontend as frontend


def _write_frontend_build(dist_dir: Path) -> None:
    assets_dir = dist_dir / "assets"
    assets_dir.mkdir(parents=True)
    (dist_dir / "index.html").write_text(
        "<!doctype html><html><body>TabulaClean React shell</body></html>",
        encoding="utf-8",
    )
    (assets_dir / "app.js").write_text("console.log('TabulaClean')", encoding="utf-8")


def test_fastapi_serves_compiled_spa_root_and_deep_links(tmp_path, monkeypatch) -> None:
    _write_frontend_build(tmp_path)
    monkeypatch.setattr(frontend, "FRONTEND_DIST_DIR", tmp_path)
    client = TestClient(app)

    root = client.get("/", headers={"accept": "text/html"})
    deep_link = client.get("/review-changes", headers={"accept": "text/html"})

    assert root.status_code == 200
    assert deep_link.status_code == 200
    assert "TabulaClean React shell" in root.text
    assert "TabulaClean React shell" in deep_link.text


def test_fastapi_serves_compiled_frontend_assets(tmp_path, monkeypatch) -> None:
    _write_frontend_build(tmp_path)
    monkeypatch.setattr(frontend, "FRONTEND_DIST_DIR", tmp_path)
    response = TestClient(app).get("/assets/app.js")

    assert response.status_code == 200
    assert "TabulaClean" in response.text


def test_frontend_fallback_preserves_backend_errors(tmp_path, monkeypatch) -> None:
    _write_frontend_build(tmp_path)
    monkeypatch.setattr(frontend, "FRONTEND_DIST_DIR", tmp_path)
    client = TestClient(app)

    assert client.get("/api/missing", headers={"accept": "text/html"}).status_code == 404
    assert client.get("/reset", headers={"accept": "text/html"}).status_code == 405
    assert client.get("/health").json() == {"status": "healthy"}


def test_frontend_route_reports_missing_build(tmp_path, monkeypatch) -> None:
    missing_dist = tmp_path / "missing"
    monkeypatch.setattr(frontend, "FRONTEND_DIST_DIR", missing_dist)
    response = TestClient(app).get("/", headers={"accept": "text/html"})

    assert response.status_code == 503
    assert response.json()["detail"] == "TabulaClean frontend build is unavailable. Run npm run build in frontend/."
```

- [ ] **Step 2: Run focused backend tests to verify they fail**

Run:

```bash
python3 -m pytest tests/test_env.py::test_fastapi_serves_compiled_spa_root_and_deep_links tests/test_env.py::test_fastapi_serves_compiled_frontend_assets tests/test_env.py::test_frontend_fallback_preserves_backend_errors tests/test_env.py::test_frontend_route_reports_missing_build -q
```

Expected: FAIL because `server.frontend` does not exist and `/` still serves the
legacy template.

- [ ] **Step 3: Implement isolated frontend fallback middleware**

Create `server/frontend.py`:

```python
"""Production serving for the compiled TabulaClean frontend."""

from __future__ import annotations

from pathlib import Path
from typing import Awaitable, Callable
from urllib.parse import unquote

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response


FRONTEND_DIST_DIR = Path(__file__).resolve().parents[1] / "frontend" / "dist"
RESERVED_FIRST_SEGMENTS = {
    "api",
    "docs",
    "health",
    "mcp",
    "metadata",
    "openapi.json",
    "play",
    "redoc",
    "reset",
    "schema",
    "state",
    "static",
    "step",
    "ws",
}
MISSING_BUILD_MESSAGE = (
    "TabulaClean frontend build is unavailable. Run npm run build in frontend/."
)


def _is_reserved_path(path: str) -> bool:
    first_segment = path.lstrip("/").split("/", 1)[0]
    return first_segment in RESERVED_FIRST_SEGMENTS


def _safe_frontend_file(path: str) -> Path | None:
    relative_path = unquote(path).lstrip("/")
    if not relative_path:
        return None

    dist_dir = FRONTEND_DIST_DIR.resolve()
    candidate = (dist_dir / relative_path).resolve()
    try:
        candidate.relative_to(dist_dir)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def install_frontend(app: FastAPI) -> None:
    async def frontend_fallback(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)

        if request.method != "GET" or response.status_code != 404:
            return response
        if _is_reserved_path(request.url.path):
            return response

        static_file = _safe_frontend_file(request.url.path)
        if static_file is not None:
            return FileResponse(static_file)

        accepts_html = "text/html" in request.headers.get("accept", "")
        has_file_suffix = bool(Path(request.url.path).suffix)
        if not accepts_html or has_file_suffix:
            return response

        index_file = FRONTEND_DIST_DIR / "index.html"
        if not index_file.is_file():
            return JSONResponse(
                status_code=503,
                content={"detail": MISSING_BUILD_MESSAGE},
            )
        return FileResponse(index_file)

    app.middleware("http")(frontend_fallback)
```

- [ ] **Step 4: Install the middleware without changing preserved routes**

In `server/app.py`:

1. Import `install_frontend` from `.frontend`.
2. Remove the explicit `@app.get("/")` handler and its `index()` function.
3. Keep `TEMPLATES_DIR` because `/play` still uses it.
4. Call `install_frontend(app)` after the `/play` and `/play/api/*` route
   definitions and before `main()`.

The final bottom section must contain:

```python
install_frontend(app)


def main(host: str = "0.0.0.0", port: int = 8000) -> None:
    import uvicorn

    uvicorn.run(app, host=host, port=port)
```

- [ ] **Step 5: Run focused and full backend tests**

Run:

```bash
python3 -m pytest tests/test_env.py::test_fastapi_serves_compiled_spa_root_and_deep_links tests/test_env.py::test_fastapi_serves_compiled_frontend_assets tests/test_env.py::test_frontend_fallback_preserves_backend_errors tests/test_env.py::test_frontend_route_reports_missing_build -q
python3 -m pytest -q
```

Expected: focused SPA tests and the complete existing Python suite pass,
including `/play`, WebSocket, schema, state, grader, and inference tests.

- [ ] **Step 6: Commit FastAPI integration**

```bash
git add server/app.py server/frontend.py tests/test_env.py
git commit -m "feat: serve React frontend from FastAPI"
```

---

### Task 6: Build Frontend And Backend In One Docker Image

**Files:**
- Modify: `Dockerfile`
- Modify: `.dockerignore`

- [ ] **Step 1: Expand Docker context exclusions**

Add these entries to `.dockerignore`:

```dockerignore
.superpowers
frontend/node_modules
frontend/dist
frontend/coverage
frontend/.eslintcache
test-results
failure-logs
uploads
uploaded_files
user_uploads
exports
*.local.log
*.failure.log
```

- [ ] **Step 2: Replace the Dockerfile with a multi-stage build**

Replace `Dockerfile` with:

```dockerfile
FROM node:22.16.0-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app.py inference.py openenv.yaml /app/
COPY server /app/server
COPY tabular_cleaning_env /app/tabular_cleaning_env
COPY tasks /app/tasks
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Verify the local frontend build and Docker build**

Run:

```bash
cd frontend
npm ci
npm run build
cd ..
docker build -t tabulaclean:phase-1 .
```

Expected: npm uses the lockfile, Vite emits `frontend/dist`, and Docker
completes both build stages without requiring secrets.

- [ ] **Step 4: Smoke-test the combined container**

Run:

```bash
docker run --rm -d --name tabulaclean-phase-1 -p 8000:8000 tabulaclean:phase-1
curl --fail http://localhost:8000/health
curl --fail -H "Accept: text/html" http://localhost:8000/
curl --fail http://localhost:8000/play
docker stop tabulaclean-phase-1
```

Expected:

- `/health` returns `{"status":"healthy"}`.
- `/` contains the compiled TabulaClean application document.
- `/play` still returns the legacy evaluation workbench.

- [ ] **Step 5: Confirm generated artifacts remain ignored**

Run:

```bash
git status --short
git check-ignore -v frontend/dist/index.html frontend/node_modules .superpowers
```

Expected: build output, dependencies, and visual-companion files are ignored;
only Docker source changes appear in status.

- [ ] **Step 6: Commit Docker delivery**

```bash
git add Dockerfile .dockerignore
git commit -m "build: package frontend and backend together"
```

---

### Task 7: Document Phase 1 Workflows

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_DIRECTION.md`
- Modify: `tests/test_docs.py`

- [ ] **Step 1: Add failing documentation expectations**

Extend `test_readme_contains_core_commands` in `tests/test_docs.py`:

```python
    assert "frontend" in readme
    assert "npm ci" in readme
    assert "npm run dev" in readme
    assert "npm run build" in readme
    assert "docker build -t tabulaclean" in readme
    assert "Phase 2" in readme
```

Add:

```python
def test_project_direction_marks_phase_one_foundation_complete() -> None:
    direction = Path("docs/PROJECT_DIRECTION.md").read_text(encoding="utf-8")
    assert "React, TypeScript, and Vite foundation" in direction
    assert "Phase 2" in direction
    assert "upload sessions" in direction
```

- [ ] **Step 2: Run documentation tests to verify they fail**

Run:

```bash
python3 -m pytest tests/test_docs.py -q
```

Expected: FAIL because Phase 1 commands and boundaries are not documented yet.

- [ ] **Step 3: Update the README product status and run instructions**

Update the README introduction so it says the React frontend foundation now
exists, while CSV/XLSX upload sessions remain Phase 2.

Replace the Quick Start local setup with these distinct workflows:

````markdown
### Backend only

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements-dev.txt
python3 -m pytest -q
uvicorn server.app:app --host 0.0.0.0 --port 8000
```

Backend-only mode keeps `/health`, `/play`, the evaluation APIs, and all
compatibility routes available. Product frontend routes return an explicit
missing-build response until the React application is built.

### Frontend development

Run FastAPI on port 8000, then start Vite in a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite proxies backend and legacy-workbench routes
to `http://localhost:8000`.

### Production frontend build

```bash
cd frontend
npm ci
npm run build
cd ..
uvicorn server.app:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`. FastAPI serves the compiled React application and
keeps `/play` available as the advanced evaluation workspace.
````

Update Docker commands to:

```bash
docker build -t tabulaclean .
docker run --rm -p 8000:8000 tabulaclean
```

Add a concise note:

```markdown
## Phase 1 Boundary

Phase 1 provides the React product shell, responsive routes, backend health
status, production static serving, and the combined Docker build. Phase 2 will
add real upload sessions and CSV/XLSX handling. The current placeholders do not
upload, parse, clean, store, or download user files.
```

- [ ] **Step 4: Update the project direction phase boundary**

Replace the final Phase Boundaries section in `docs/PROJECT_DIRECTION.md` with:

```markdown
## Phase Boundaries

Phase 0 covered repository preparation, visible product identity,
documentation, static copy, and safer ignore rules.

Phase 1 provides the React, TypeScript, and Vite foundation, product routes,
backend health status, production FastAPI serving, and a combined Docker build.

Phase 2 will add upload sessions and real CSV/XLSX handling. Spreadsheet
parsing, cleaning-session persistence, AI suggestions, downloadable exports,
and failure-case storage remain outside Phase 1.
```

- [ ] **Step 5: Run documentation and full test suites**

Run:

```bash
python3 -m pytest tests/test_docs.py -q
python3 -m pytest -q
cd frontend
npm run check
```

Expected: documentation tests, complete Python tests, and all frontend checks
pass.

- [ ] **Step 6: Commit documentation**

```bash
git add README.md docs/PROJECT_DIRECTION.md tests/test_docs.py
git commit -m "docs: document Phase 1 development workflows"
```

---

### Task 8: Perform Final Phase 1 Verification

**Files:**
- Review all Phase 1 files.
- Modify only files required to fix verification failures.

- [ ] **Step 1: Run clean frontend verification**

Run:

```bash
cd frontend
npm ci
npm run check
cd ..
```

Expected: lint, Vitest, TypeScript, and a clean Vite production build pass.

- [ ] **Step 2: Run the complete backend suite**

Run:

```bash
python3 -m pytest -q
```

Expected: all existing cleaning engine, evaluation, compatibility, inference,
legacy workbench, and new frontend-serving tests pass.

- [ ] **Step 3: Build and smoke-test the production image**

Run:

```bash
docker build -t tabulaclean:phase-1 .
docker run --rm -d --name tabulaclean-phase-1 -p 8000:8000 tabulaclean:phase-1
curl --fail http://localhost:8000/health
curl --fail -H "Accept: text/html" http://localhost:8000/review-changes
curl --fail http://localhost:8000/play/api/config
docker stop tabulaclean-phase-1
```

Expected: the health route, a React deep link, and the preserved evaluation
configuration route all respond successfully.

- [ ] **Step 4: Review the running product in the browser**

Start the built app:

```bash
uvicorn server.app:app --host 127.0.0.1 --port 8000
```

Use the Browser plugin to inspect:

- `/` at desktop and mobile widths
- `/review-changes`
- `/model-evaluation`
- `/failure-cases`
- an unknown frontend path
- `/play`

Verify:

- the approved cream, forest, mint, and coral direction is preserved
- the product introduction flows into the workspace
- the final sections remain light rather than dark
- navigation works with mouse and keyboard
- focus indicators are visible
- the custom cursor appears only with a fine pointer
- reduced-motion mode disables decorative animation
- mobile navigation and workspace cards do not overflow
- placeholders do not claim upload or cleaning behavior exists

- [ ] **Step 5: Audit scope, secrets, and generated files**

Run:

```bash
git diff --check main...HEAD
git status --short
git diff --name-only main...HEAD
rg -n "HF_TOKEN=|API_KEY=|BEGIN (RSA|OPENSSH|PRIVATE) KEY" frontend server Dockerfile README.md docs || true
rg -n "upload|xlsx|csv|failure" frontend/src
```

Expected:

- no whitespace errors
- no staged or tracked generated frontend output
- no secrets or token values
- upload and failure wording appears only in honest Phase 2 placeholders
- benchmark tasks, graders, environment logic, and compatibility routes are
  unchanged except for additive tests and frontend serving

- [ ] **Step 6: Record final verification and commit any necessary fixes**

If verification required source fixes, rerun the affected command and commit
only those fixes:

```bash
git add .gitignore .dockerignore Dockerfile README.md docs/PROJECT_DIRECTION.md \
  frontend server/app.py server/frontend.py tests/test_docs.py tests/test_env.py
git commit -m "fix: complete Phase 1 verification"
```

If no fixes were required, do not create an empty commit.

- [ ] **Step 7: Stop at the Phase 1 boundary**

Confirm that the branch contains no upload-session endpoint, spreadsheet
parser, cleaning-session persistence, AI suggestion endpoint, file download
endpoint, or failure-case storage. Do not begin Phase 2.
