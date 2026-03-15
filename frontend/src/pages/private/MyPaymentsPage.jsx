import { useEffect } from 'react';
import useOrderStore from '../../store/orderStore';

function paymentBadge(status) {
  if (status === 'PAID') return 'bg-emerald-100 text-emerald-700';
  if (status === 'UNPAID') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

export default function MyPaymentsPage() {
  const payments = useOrderStore((state) => state.payments);
  const fetchPayments = useOrderStore((state) => state.fetchPayments);
  const isLoading = useOrderStore((state) => state.isLoading);
  const error = useOrderStore((state) => state.error);

  useEffect(() => {
    fetchPayments().catch(() => {});
  }, [fetchPayments]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">My Payments</h1>

      {isLoading ? <div className="card">Loading payments...</div> : null}
      {error ? <div className="card text-red-600">{error}</div> : null}

      {!isLoading && !payments.length ? (
        <div className="card text-center text-slate-600">No payments found.</div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Payment ID</th>
              <th className="px-4 py-3 font-medium">Order ID</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{payment.id}</td>
                <td className="px-4 py-3">{payment.order_id}</td>
                <td className="px-4 py-3">${Number(payment.amount || 0).toFixed(2)}</td>
                <td className="px-4 py-3">{payment.method}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${paymentBadge(payment.status)}`}>
                    {payment.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {payment.created_at ? new Date(payment.created_at).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}