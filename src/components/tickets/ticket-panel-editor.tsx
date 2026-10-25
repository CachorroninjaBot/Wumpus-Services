import { useState } from "react";
import { WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { DiscordPanel, DiscordModalPreview } from "@/components/discord-panel";
import { ExclusiveButton } from "@/components/exclusive-button";
import { asList, asString, planAllows } from "@/lib/wumpus/engine";
import { useActiveGuild, useModule, useWumpus } from "@/lib/wumpus/store";
import { cn } from "@/lib/utils";
import type { TicketDepartmentConfig } from "@/lib/wumpus/types";

// Placeholder: full extraction of the panel form lives here.
// The main tickets page still owns the state for now; this component
// will be wired in a follow-up to reduce tickets.tsx size.
export function TicketPanelEditor() {
  return null;
}
