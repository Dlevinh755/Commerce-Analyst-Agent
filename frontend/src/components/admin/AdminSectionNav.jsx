import { NavLink } from 'react-router-dom';

const links = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/buyers', label: 'Buyers' },
  { to: '/admin/sellers', label: 'Sellers' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/orders', label: 'Orders' },
];

export default function AdminSectionNav() {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `rounded-lg border px-3 py-1.5 text-sm ${
              isActive
                ? 'border-brand-200 bg-brand-50 text-brand-700'
                : 'border-slate-300 bg-white text-slate-700'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
