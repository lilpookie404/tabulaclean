import Header from "../components/Header";
import RouteTitle from "../components/RouteTitle";
import RouteErrorPage from "../pages/RouteErrorPage";

export default function RouteErrorShell() {
  return (
    <>
      <RouteTitle />
      <Header />
      <main>
        <RouteErrorPage />
      </main>
    </>
  );
}
