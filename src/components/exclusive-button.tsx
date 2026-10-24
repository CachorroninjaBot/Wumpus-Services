import { Link } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExclusiveButton() {
  return (
    <Button asChild size="sm" variant="outline" title="Ver opções de assinatura para acessar este recurso">
      <Link to="/app/settings" hash="assinatura">
        <LockKeyhole aria-hidden="true" className="size-4" />
        Exclusivo
      </Link>
    </Button>
  );
}
