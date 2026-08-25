import Link from "next/link";

export default function NotFound() {
  return <main className="simple-state"><p className="eyebrow">404</p><h1>Essa área não existe.</h1><Link className="primary-button" href="/wumpus">Voltar ao Wumpus <span>→</span></Link></main>;
}
