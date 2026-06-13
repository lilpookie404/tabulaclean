import { NavLink } from "react-router-dom";
import BackendStatus from "./BackendStatus";
import PageContainer from "./PageContainer";

const navigationItems = [
  { to: "/", label: "Clean My File", end: true },
  { to: "/review-changes", label: "Review Changes" },
  { to: "/model-evaluation", label: "Model Evaluation" },
  { to: "/failure-cases", label: "Failure Cases" }
];

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link active" : "nav-link";
}

function NavigationLinks() {
  return navigationItems.map(({ to, label, end }) => (
    <NavLink
      className={navLinkClassName}
      end={end}
      key={to}
      to={to}
    >
      {label}
    </NavLink>
  ));
}

export default function Header() {
  return (
    <header className="site-header">
      <PageContainer className="header-content">
        <NavLink className="brand" to="/">
          TabulaClean
        </NavLink>
        <nav aria-label="Primary navigation" className="desktop-navigation">
          <NavigationLinks />
        </nav>
        <BackendStatus />
        <details className="mobile-navigation">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            <NavigationLinks />
          </nav>
        </details>
      </PageContainer>
    </header>
  );
}
