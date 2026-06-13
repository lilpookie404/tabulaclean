import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import RouteTitle from "../components/RouteTitle";

export default function AppShell() {
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
