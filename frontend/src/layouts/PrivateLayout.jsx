import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';

export default function PrivateLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-cream">
      <Navbar />
      <main className="container-page flex-1 py-6 md:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
