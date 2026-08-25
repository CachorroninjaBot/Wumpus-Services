"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="simple-state"><p className="eyebrow">WUMPUS CONTROL</p><h1>Não foi possível carregar esta área.</h1><button className="primary-button" onClick={() => reset()}>Tentar novamente <span>↻</span></button></main>;
}
