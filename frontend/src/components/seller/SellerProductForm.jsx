import { useEffect, useMemo, useState } from 'react';
import { sellerProductService } from '../../services/sellerProductService';
import { getErrorMessage } from '../../utils/errorMessage';

const defaultForm = {
  title: '',
  author: '',
  price: '',
  stock_quantity: '',
  description: '',
  image_url: '',
  category_name: '',
};

function normalizeInitialValues(initialValues = {}) {
  return {
    ...defaultForm,
    ...initialValues,
    category_name:
      initialValues.category?.name ?? initialValues.category_name ?? initialValues.categoryName ?? '',
    price:
      initialValues.price === null || initialValues.price === undefined
        ? ''
        : String(initialValues.price),
    stock_quantity:
      initialValues.stock_quantity === null || initialValues.stock_quantity === undefined
        ? ''
        : String(initialValues.stock_quantity),
  };
}

export default function SellerProductForm({
  initialValues,
  submitText,
  onSubmit,
  submitting,
}) {
  const [form, setForm] = useState(() => normalizeInitialValues(initialValues));
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const { data } = await sellerProductService.listCategories();
        setCategories(Array.isArray(data) ? data : []);
      } catch {
        setCategories([]);
      }
    }

    loadCategories();
  }, []);

  const canSubmit = useMemo(() => {
    return Boolean(form.title.trim() && form.author.trim() && form.price !== '' && form.stock_quantity !== '');
  }, [form]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      price: Number(form.price),
      stock_quantity: Number(form.stock_quantity),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      category_name: form.category_name.trim() || null,
    };

    if (!payload.title || !payload.author) {
      setError('Title and author are required.');
      return;
    }

    if (Number.isNaN(payload.price) || payload.price < 0) {
      setError('Price must be a valid number >= 0.');
      return;
    }

    if (!Number.isInteger(payload.stock_quantity) || payload.stock_quantity < 0) {
      setError('Stock quantity must be an integer >= 0.');
      return;
    }

    try {
      if (selectedFile) {
        setUploadingImage(true);
        const { data } = await sellerProductService.uploadImage(selectedFile);
        payload.image_url = data?.image_url || payload.image_url;
      }
      await onSubmit(payload);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save product.'));
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          className="input sm:col-span-2"
          placeholder="Book title"
          value={form.title}
          onChange={(event) => handleChange('title', event.target.value)}
        />
        <input
          className="input sm:col-span-2"
          placeholder="Author"
          value={form.author}
          onChange={(event) => handleChange('author', event.target.value)}
        />
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          value={form.price}
          onChange={(event) => handleChange('price', event.target.value)}
        />
        <input
          className="input"
          type="number"
          min="0"
          step="1"
          placeholder="Stock quantity"
          value={form.stock_quantity}
          onChange={(event) => handleChange('stock_quantity', event.target.value)}
        />
        <input
          className="input"
          placeholder="Category name (e.g. Software, Data)"
          list="seller-category-options"
          value={form.category_name}
          onChange={(event) => handleChange('category_name', event.target.value)}
        />
        <datalist id="seller-category-options">
          {categories.map((category) => (
            <option key={category.category_id} value={category.name} />
          ))}
        </datalist>
        <input
          className="input"
          placeholder="Current image URL"
          value={form.image_url}
          onChange={(event) => handleChange('image_url', event.target.value)}
        />
        <input
          className="input sm:col-span-2"
          type="file"
          accept="image/*"
          onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
        />
        {selectedFile ? (
          <p className="sm:col-span-2 text-xs text-slate-600">Selected image: {selectedFile.name}</p>
        ) : null}
        {form.image_url ? (
          <img
            src={form.image_url}
            alt="Current cover"
            className="sm:col-span-2 h-48 w-full rounded-lg border border-slate-200 object-cover"
          />
        ) : null}
        <textarea
          className="input sm:col-span-2 min-h-28"
          placeholder="Description (optional)"
          value={form.description}
          onChange={(event) => handleChange('description', event.target.value)}
        />
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <button className="btn-primary" type="submit" disabled={!canSubmit || submitting || uploadingImage}>
        {submitting || uploadingImage ? 'Saving...' : submitText}
      </button>
    </form>
  );
}
