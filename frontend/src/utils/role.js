export function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

export function getDefaultRouteByRole(role) {
  const normalized = normalizeRole(role);

  if (normalized === 'admin') {
    return '/admin/dashboard';
  }

  if (normalized === 'seller') {
    return '/seller/orders';
  }

  if (normalized === 'buyer') {
    return '/profile';
  }

  return '/profile';
}
