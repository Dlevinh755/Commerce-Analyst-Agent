import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SellerProductForm from '../../components/seller/SellerProductForm';
import { sellerProductService } from '../../services/sellerProductService';

export default function SellerProductCreatePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      await sellerProductService.create(payload);
      navigate('/seller/products', {
        replace: true,
        state: { message: 'Product created successfully.' },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Create Product</h1>
          <p className="mt-1 text-slate-600">Publish a new book to your seller catalog.</p>
        </div>
        <Link to="/seller/products" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          Back to products
        </Link>
      </div>

      <div className="card">
        <SellerProductForm submitText="Create Product" onSubmit={handleCreate} submitting={submitting} />
      </div>
    </section>
  );
}
