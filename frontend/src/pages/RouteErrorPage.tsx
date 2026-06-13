import { Link, useRouteError } from "react-router-dom";
import PageContainer from "../components/PageContainer";

export default function RouteErrorPage() {
  useRouteError();

  return (
    <PageContainer>
      <h1>We could not open this page</h1>
      <p>
        Something went wrong while opening this page. Please return to Clean My
        File and try again.
      </p>
      <Link className="button button-dark" to="/">
        Return to Clean My File
      </Link>
    </PageContainer>
  );
}
