import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/config")({
  component: ConfigLayout,
});

function ConfigLayout() {
  return <Outlet />;
}
