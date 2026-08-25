import { redirect } from "next/navigation";
import { getAdminSession } from "../../../lib/admin-auth";
import { loginAdmin } from "../actions";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getAdminSession()) redirect("/admin");
  const query = await searchParams;
  const hasError = query.error === "invalid_credentials";
  return (
    <main className="admin-login">
      <section className="admin-login-card">
        <span className="admin-mark" aria-hidden="true">H</span>
        <p className="eyebrow">HUBORDER · ACESSO RESTRITO</p>
        <h1>Central privada</h1>
        <p>Gerencie clientes Wumpus, ocorrências e a operação dos bots em um único lugar.</p>
        {hasError ? <div className="admin-alert danger">Usuário ou senha incorretos.</div> : null}
        {query.expired ? <div className="admin-alert">Sua sessão expirou. Entre novamente.</div> : null}
        <form action={loginAdmin} className="admin-login-form">
          <label><span>Usuário</span><input name="username" autoComplete="username" required /></label>
          <label><span>Senha</span><input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit">Entrar na central <span>→</span></button>
        </form>
        <small>Sessão protegida, HTTP-only e válida por 8 horas.</small>
      </section>
    </main>
  );
}
