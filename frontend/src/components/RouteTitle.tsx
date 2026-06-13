import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const routeTitles: Record<string, string> = {
  "/": "Clean My File | TabulaClean",
  "/review-changes": "Review Changes | TabulaClean",
  "/model-evaluation": "Model Evaluation | TabulaClean",
  "/failure-cases": "Failure Cases | TabulaClean"
};

export default function RouteTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title =
      routeTitles[pathname] ?? "Page Not Found | TabulaClean";
  }, [pathname]);

  return null;
}
