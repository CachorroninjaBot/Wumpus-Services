type Service = {
  service: string;
  status: "operational" | "degraded" | "offline";
  lastHeartbeatAt: string;
  metadata?: Record<string, unknown>;
};

const labels: Record<Service["status"], string> = {
  operational: "Operacional",
  degraded: "Atenção",
  offline: "Offline"
};

export function ServiceCard({ service }: { service: Service }) {
  const updatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(service.lastHeartbeatAt));
  return (
    <article className="service-card">
      <div className="card-head">
        <span className={`status-dot ${service.status}`} />
        <span className="status-label">{labels[service.status]}</span>
      </div>
      <h2>{service.service}</h2>
      <p>Último sinal: {updatedAt}</p>
    </article>
  );
}
