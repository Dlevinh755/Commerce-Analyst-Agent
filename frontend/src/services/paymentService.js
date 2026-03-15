import api from './http';

export const paymentService = {
  listMyPayments: () => api.get('/payments/my'),
  create: (payload) => {
    const normalizedOrderId = Number(payload?.order_id);
    if (!Number.isInteger(normalizedOrderId) || normalizedOrderId <= 0) {
      throw new Error('Invalid order id for payment creation.');
    }

    return api.post('/payments', {
      ...payload,
      order_id: normalizedOrderId,
      payment_method: String(payload?.payment_method || '').trim().toUpperCase(),
    });
  },
};
