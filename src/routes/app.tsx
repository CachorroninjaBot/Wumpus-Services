import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardShell } from "@/components/shell";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  );
}
