import { createBrowserRouter, type RouteObject } from "react-router-dom";
import CleanMyFilePage from "../pages/CleanMyFilePage";
import FailureCasesPage from "../pages/FailureCasesPage";
import ModelEvaluationPage from "../pages/ModelEvaluationPage";
import NotFoundPage from "../pages/NotFoundPage";
import ReviewChangesPage from "../pages/ReviewChangesPage";
import AppShell from "./AppShell";
import RouteErrorShell from "./RouteErrorShell";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorShell />,
    children: [
      {
        index: true,
        element: <CleanMyFilePage />
      },
      {
        path: "review-changes",
        element: <ReviewChangesPage />
      },
      {
        path: "model-evaluation",
        element: <ModelEvaluationPage />
      },
      {
        path: "failure-cases",
        element: <FailureCasesPage />
      },
      {
        path: "*",
        element: <NotFoundPage />
      }
    ]
  }
];

export const appRouter = createBrowserRouter(appRoutes);
