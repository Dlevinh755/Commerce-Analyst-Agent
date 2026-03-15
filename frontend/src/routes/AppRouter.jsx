import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import PrivateLayout from '../layouts/PrivateLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import RoleProtectedRoute from '../components/auth/RoleProtectedRoute';

import HomePage from '../pages/public/HomePage';
import BookListPage from '../pages/public/BookListPage';
import BookDetailPage from '../pages/public/BookDetailPage';
import LoginPage from '../pages/public/LoginPage';
import RegisterPage from '../pages/public/RegisterPage';

import ProfilePage from '../pages/private/ProfilePage';
import CartPage from '../pages/private/CartPage';
import CheckoutPage from '../pages/private/CheckoutPage';
import MyOrdersPage from '../pages/private/MyOrdersPage';
import OrderDetailPage from '../pages/private/OrderDetailPage';
import MyPaymentsPage from '../pages/private/MyPaymentsPage';
import BuyerDashboardPage from '../pages/private/BuyerDashboardPage';
import SellerDashboardPage from '../pages/private/SellerDashboardPage';
import AdminDashboardPage from '../pages/private/AdminDashboardPage';
import SellerProductsPage from '../pages/private/SellerProductsPage';
import SellerProductCreatePage from '../pages/private/SellerProductCreatePage';
import SellerProductEditPage from '../pages/private/SellerProductEditPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/books" element={<BookListPage />} />
        <Route path="/books/:id" element={<BookDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<PrivateLayout />}>
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<RoleProtectedRoute allowedRoles={['buyer']} />}>
            <Route path="/dashboard" element={<BuyerDashboardPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders" element={<MyOrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/payments" element={<MyPaymentsPage />} />
          </Route>

          <Route element={<RoleProtectedRoute allowedRoles={['seller']} />}>
            <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
            <Route path="/seller/products" element={<SellerProductsPage />} />
            <Route path="/seller/products/new" element={<SellerProductCreatePage />} />
            <Route path="/seller/products/:id/edit" element={<SellerProductEditPage />} />
          </Route>

          <Route element={<RoleProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
