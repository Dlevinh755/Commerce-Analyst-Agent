import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SellerProductForm from '../../components/seller/SellerProductForm';
import { sellerProductService } from '../../services/sellerProductService';
import { getErrorMessage } from '../../utils/errorMessage';

export default function SellerProductEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [product, setProduct] = useState(null);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      setError('');
      try {
        const { data } = await sellerProductService.detail(id);
        setProduct(data);
      } catch (err) {
        setError(getErrorMessage(err, 'Không thể tải chi tiết sản phẩm.'));
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  const handleUpdate = async (payload) => {
    setSubmitting(true);
    try {
      await sellerProductService.update(id, payload);
      navigate('/seller/products', {
        replace: true,
        state: { message: 'Cập nhật sản phẩm thành công.' },
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <section className="card">Đang tải sản phẩm...</section>;
  }

  if (error || !product) {
    return (
      <section className="space-y-4">
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error || 'Không tìm thấy sản phẩm.'}</div>
        <Link to="/seller/products" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          Quay lại danh sách sản phẩm
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Chỉnh sửa sản phẩm</h1>
          <p className="mt-1 text-slate-600">Cập nhật thông tin sản phẩm của bạn.</p>
        </div>
        <Link to="/seller/products" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          Quay lại danh sách sản phẩm
        </Link>
      </div>

      <div className="card">
        <SellerProductForm
          initialValues={product}
          submitText="Lưu thay đổi"
          onSubmit={handleUpdate}
          submitting={submitting}
        />
      </div>
    </section>
  );
}
