import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-surface-cream via-surface-warm/40 to-white">
      <Navbar />
      <main className="container-page flex-1 py-6 md:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
