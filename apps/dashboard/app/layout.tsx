import type { Metadata } from "next";
import "./globals.css";
import "./wumpus-v2.css";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Wumpus · Dashboard", template: "%s · Wumpus" },
  description: "Gerencie sua comunidade Discord com clareza."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
