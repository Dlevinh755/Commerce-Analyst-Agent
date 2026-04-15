import api from './http';

export const paymentService = {
  listMyPayments: () => api.get('/payments/my'),
  create: (payload) => {
    const normalizedOrderId = Number(payload?.order_id);
    if (!Number.isInteger(normalizedOrderId) || normalizedOrderId <= 0) {
      throw new Error('Mã đơn hàng không hợp lệ để tạo thanh toán.');
    }

    return api.post('/payments', {
      ...payload,
      order_id: normalizedOrderId,
      payment_method: String(payload?.payment_method || '').trim().toUpperCase(),
    });
  },
};
