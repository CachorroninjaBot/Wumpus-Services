import { createFileRoute } from "@tanstack/react-router";
import { ProtectPage } from "@/components/protect/protect-page";

export const Route = createFileRoute("/app/protect")({ component: ProtectPage });
