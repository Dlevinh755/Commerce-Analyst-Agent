import api from './http';

export const vnpayService = {
  createPaymentUrl: (payload) => api.post('/vnpay/create-payment-url', payload),
};
