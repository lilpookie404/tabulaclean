import { Link, useRouteError } from "react-router-dom";
import PageContainer from "../components/PageContainer";

export default function RouteErrorPage() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : "An unexpected routing error occurred.";

  return (
    <PageContainer>
      <h1>We could not open this page</h1>
      <p>{message}</p>
      <Link className="button button-dark" to="/">
        Return to Clean My File
      </Link>
    </PageContainer>
  );
}
