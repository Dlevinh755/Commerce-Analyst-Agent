const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrencyVND(value) {
  return vndFormatter.format(Number(value || 0));
}