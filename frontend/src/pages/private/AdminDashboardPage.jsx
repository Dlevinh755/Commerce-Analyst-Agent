export default function AdminDashboardPage() {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="mt-1 text-slate-600">Control center for system governance and operational monitoring.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h2 className="text-lg font-semibold">User & Role Control</h2>
          <p className="mt-2 text-sm text-slate-600">
            Placeholder for user moderation and role assignment workflows.
          </p>
        </article>

        <article className="card">
          <h2 className="text-lg font-semibold">System Health</h2>
          <p className="mt-2 text-sm text-slate-600">
            Placeholder for gateway/service status and critical audit logs.
          </p>
        </article>
      </div>
    </section>
  );
}
