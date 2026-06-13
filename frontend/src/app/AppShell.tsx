import { Outlet } from "react-router-dom";
import CustomCursor from "../components/CustomCursor";
import Header from "../components/Header";
import RouteTitle from "../components/RouteTitle";

export default function AppShell() {
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
