import { useEffect, useMemo, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import Toast from '../../components/common/Toast';
import { payoutService } from '../../services/payoutService';
import { getErrorMessage } from '../../utils/errorMessage';
import { formatCurrencyVND } from '../../utils/currency';

const FEE_RATES = {
  seller: 0.05,
  buyer: 0.02,
};

function parseVndAmount(value) {
  const raw = String(value || '').trim();
  const isNegative = raw.startsWith('-');
  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) {
    return 0;
  }
  const parsed = Number(digitsOnly);
  return isNegative ? -parsed : parsed;
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase();
  const labels = {
    pending: 'Chờ admin xử lý',
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

export default function PayoutsPage() {
  const user = useAuth((state) => state.user);
  const fetchProfile = useAuth((state) => state.fetchProfile);
  const [amountInput, setAmountInput] = useState('');
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const role = String(user?.role || '').toLowerCase();
  const feeRate = FEE_RATES[role] || 0;
  const amount = parseVndAmount(amountInput);
  const feeAmount = Math.round(amount * feeRate);
  const totalDebit = amount + feeAmount;
  const balance = Number(user?.balance || 0);
  const canSubmit = amount > 0 && Boolean(user?.account_number) && totalDebit <= balance && !submitting;

  const loadPayouts = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await payoutService.listMine({ page: 1, page_size: 100 });
      setPayouts(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải lịch sử rút tiền.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayouts();
    fetchProfile().catch(() => {});
  }, [fetchProfile]);

  const feePercentLabel = useMemo(() => `${(feeRate * 100).toFixed(0)}%`, [feeRate]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    try {
      await payoutService.create({ amount });
      setAmountInput('');
      await loadPayouts();
      await fetchProfile().catch(() => null);
      setToast('Đã gửi yêu cầu rút tiền đến admin.');
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể gửi yêu cầu rút tiền.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Rút tiền</h1>
        <p className="mt-1 text-slate-600">Gửi yêu cầu tất toán số dư đến admin.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form className="card space-y-4" onSubmit={onSubmit}>
          <div>
            <p className="text-sm font-semibold text-slate-900">Tạo yêu cầu rút tiền</p>
            <p className="mt-1 text-xs text-slate-500">Phí rút tiền cho tài khoản của bạn: {feePercentLabel}</p>
          </div>

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Số dư</span>
              <span className="font-semibold">{formatCurrencyVND(balance)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Số tài khoản</span>
              <span className="font-semibold">{user?.account_number || '-'}</span>
            </div>
          </div>

          <input
            className="input"
            inputMode="numeric"
            placeholder="Số tiền muốn rút"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
          />

          <div className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Số tiền rút</span>
              <span>{formatCurrencyVND(amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Phí giao dịch</span>
              <span>{formatCurrencyVND(feeAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
              <span>Tổng trừ</span>
              <span>{formatCurrencyVND(totalDebit)}</span>
            </div>
          </div>

          {!user?.account_number ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              Bạn cần cập nhật số tài khoản trong hồ sơ trước khi rút tiền.
            </p>
          ) : null}
          {amount > 0 && totalDebit > balance ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Tổng tiền rút và phí không được vượt quá số dư.
            </p>
          ) : null}
          {amountInput.trim() && amount <= 0 ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Số tiền rút phải lớn hơn 0.
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
            {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>
        </form>

        <article className="card overflow-x-auto">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Lịch sử rút tiền</h2>
            <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={loadPayouts}>
              Làm mới
            </button>
          </div>
          {error ? <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          {loading ? (
            <div className="text-sm text-slate-600">Đang tải...</div>
          ) : payouts.length === 0 ? (
            <div className="text-sm text-slate-600">Chưa có yêu cầu rút tiền.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Mã</th>
                  <th className="px-3 py-2 text-left font-medium">Số tiền</th>
                  <th className="px-3 py-2 text-left font-medium">Phí</th>
                  <th className="px-3 py-2 text-left font-medium">Tổng trừ</th>
                  <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
                  <th className="px-3 py-2 text-left font-medium">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((payout) => (
                  <tr key={payout.payout_id}>
                    <td className="px-3 py-2">#{payout.payout_id}</td>
                    <td className="px-3 py-2">{formatCurrencyVND(payout.amount)}</td>
                    <td className="px-3 py-2">{formatCurrencyVND(payout.fee_amount)}</td>
                    <td className="px-3 py-2 font-medium">{formatCurrencyVND(payout.total_debit)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(payout.status)}`}>
                        {formatStatus(payout.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {payout.requested_at ? new Date(payout.requested_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
