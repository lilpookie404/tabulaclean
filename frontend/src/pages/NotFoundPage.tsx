import { Link } from "react-router-dom";
import PageContainer from "../components/PageContainer";

export default function NotFoundPage() {
  return (
    <PageContainer>
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page you requested does not exist in this workspace.</p>
      <Link className="button button-dark" to="/">
        Return to Clean My File
      </Link>
    </PageContainer>
  );
}
