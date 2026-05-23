import { useEffect, useState } from 'react';
import AdminSectionNav from '../../components/admin/AdminSectionNav';
import Toast from '../../components/common/Toast';
import useAuth from '../../hooks/useAuth';
import { payoutService } from '../../services/payoutService';
import { formatCurrencyVND } from '../../utils/currency';
import { getErrorMessage } from '../../utils/errorMessage';

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase();
  const labels = {
    pending: 'Chờ xử lý',
    approved: 'Đã thanh toán',
    rejected: 'Đã từ chối',
  };
  return labels[normalized] || normalized || '-';
}

function getStatusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'rejected') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-700';
}

function formatRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'seller') return 'Seller';
  if (normalized === 'buyer') return 'Buyer';
  return role || '-';
}

export default function AdminPayoutsPage() {
  const fetchProfile = useAuth((state) => state.fetchProfile);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const [toast, setToast] = useState('');

  const loadPayouts = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page: 1, page_size: 100 };
      if (statusFilter) {
        params.status = statusFilter;
      }
      const { data } = await payoutService.listForAdmin(params);
      setPayouts(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách yêu cầu rút tiền.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, [statusFilter]);

  const onApprove = async (payoutId) => {
    setReviewingId(payoutId);
    try {
      const { data } = await payoutService.approve(payoutId);
      setPayouts((prev) => prev.map((item) => (item.payout_id === payoutId ? data : item)));
      await fetchProfile().catch(() => null);
      setToast(`Đã xác nhận thanh toán yêu cầu #${payoutId}.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể xác nhận thanh toán yêu cầu này.'));
    } finally {
      setReviewingId(null);
    }
  };

  const onReject = async (payoutId) => {
    setReviewingId(payoutId);
    try {
      const { data } = await payoutService.reject(payoutId);
      setPayouts((prev) => prev.map((item) => (item.payout_id === payoutId ? data : item)));
      setToast(`Đã từ chối yêu cầu #${payoutId}.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể từ chối yêu cầu này.'));
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Yêu cầu rút tiền</h1>
        <p className="mt-1 text-slate-600">Duyệt tất toán và theo dõi phí giao dịch.</p>
      </div>

      <AdminSectionNav />

      <article className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Danh sách yêu cầu</h2>
          <div className="flex gap-2">
            <select
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="approved">Đã thanh toán</option>
              <option value="rejected">Đã từ chối</option>
            </select>
            <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={loadPayouts}>
              Làm mới
            </button>
          </div>
        </div>

        {error ? <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <div className="text-sm text-slate-600">Đang tải...</div>
        ) : payouts.length === 0 ? (
          <div className="text-sm text-slate-600">Không có yêu cầu rút tiền.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Mã</th>
                <th className="px-3 py-2 text-left font-medium">Người yêu cầu</th>
                <th className="px-3 py-2 text-left font-medium">Số TK</th>
                <th className="px-3 py-2 text-left font-medium">Số tiền rút</th>
                <th className="px-3 py-2 text-left font-medium">Phí</th>
                <th className="px-3 py-2 text-left font-medium">Tổng trừ</th>
                <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
                <th className="px-3 py-2 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payouts.map((payout) => {
                const isPending = String(payout.status).toLowerCase() === 'pending';
                const feePercent = `${(Number(payout.fee_rate || 0) * 100).toFixed(0)}%`;
                return (
                  <tr key={payout.payout_id}>
                    <td className="px-3 py-2">#{payout.payout_id}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{payout.requester?.username || `User #${payout.requester_id}`}</p>
                      <p className="text-xs text-slate-500">{formatRole(payout.requester_role)}</p>
                    </td>
                    <td className="px-3 py-2">{payout.account_number}</td>
                    <td className="px-3 py-2">{formatCurrencyVND(payout.amount)}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{formatCurrencyVND(payout.fee_amount)}</p>
                      <p className="text-xs text-slate-500">{feePercent}</p>
                    </td>
                    <td className="px-3 py-2 font-semibold">{formatCurrencyVND(payout.total_debit)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(payout.status)}`}>
                        {formatStatus(payout.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isPending ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700"
                            onClick={() => onApprove(payout.payout_id)}
                            disabled={reviewingId === payout.payout_id}
                          >
                            {reviewingId === payout.payout_id ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700"
                            onClick={() => onReject(payout.payout_id)}
                            disabled={reviewingId === payout.payout_id}
                          >
                            {reviewingId === payout.payout_id ? 'Đang xử lý...' : 'Từ chối'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </article>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
