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
    const normalizedPathname =
      pathname === "/" ? pathname : pathname.replace(/\/+$/, "");

    document.title =
      routeTitles[normalizedPathname] ?? "Page Not Found | TabulaClean";
  }, [pathname]);

  return null;
}
