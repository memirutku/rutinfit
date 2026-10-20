'use client';

import { useState, useEffect } from 'react';
import { includesTr } from '@/lib/text';
import { Modal } from '@/components/ui/Modal';
import { formatAmount, pantryStep } from '@/lib/format';
import Link from 'next/link';
import {
  Package,
  Plus,
  Trash2,
  Edit2,
  Search,
  ShoppingCart,
  Calendar,
  AlertTriangle,
  Check,
} from 'lucide-react';

interface PantryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: string;
  expiryDate: string | null;
  notes: string | null;
  updatedAt: string;
}

const CATEGORIES = [
  'Tümü',
  'Kuru Gıda',
  'Süt Ürünleri',
  'Kasap/Balık',
  'Manav',
  'Baharat & Sos',
  'Atıştırmalık',
  'Diğer',
];

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '500',
    unit: 'g',
    category: 'Kuru Gıda',
    expiryDate: '',
    notes: '',
  });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadPantry();
  }, []);

  async function loadPantry() {
    setLoading(true);
    try {
      const res = await fetch('/api/pantry');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Kiler yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingItem(null);
    setFormData({
      name: '',
      amount: '500',
      unit: 'g',
      category: 'Kuru Gıda',
      expiryDate: '',
      notes: '',
    });
    setIsModalOpen(true);
  }

  function openEditModal(item: PantryItem) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      amount: String(item.amount),
      unit: item.unit,
      category: item.category,
      expiryDate: item.expiryDate || '',
      notes: item.notes || '',
    });
    setIsModalOpen(true);
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.amount) return;

    try {
      const res = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem ? editingItem.id : undefined,
          name: formData.name.trim(),
          amount: parseFloat(formData.amount),
          unit: formData.unit,
          category: formData.category,
          expiryDate: formData.expiryDate || null,
          notes: formData.notes.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Kaydedilemedi');

      setFeedback({
        type: 'success',
        message: editingItem ? 'Malzeme güncellendi.' : `"${formData.name}" kilere eklendi.`,
      });
      setIsModalOpen(false);
      loadPantry();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Bir hata oluştu.' });
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu malzemeyi kilerden silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/pantry?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setFeedback({ type: 'success', message: 'Malzeme kilerden çıkarıldı.' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Silme hatası:', err);
    }
  }

  async function adjustAmount(item: PantryItem, direction: 1 | -1) {
    const delta = direction * pantryStep(item.unit);
    if (item.amount + delta <= 0) {
      handleDelete(item.id);
      return;
    }

    try {
      // Sunucuda atomik artırım: hızlı art arda tıklamalar birbirini ezmez, SKT/not korunur.
      const res = await fetch('/api/pantry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, delta }),
      });

      if (res.ok) {
        const data = await res.json();
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, amount: data.item.amount } : i)));
      }
    } catch (err) {
      console.error('Miktar ayarlama hatası:', err);
    }
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      includesTr(item.name, search) || includesTr(item.category, search);
    const matchesCategory =
      selectedCategory === 'Tümü' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Üst Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Kilerim (Evdeki Malzemeler) 🥫
            </h2>
            <span className="text-xs bg-brand-50 text-brand-700 font-bold px-2 py-0.5 rounded-full">
              Pantry Host Motoru
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Evdeki malzemelerinizi takip edin; haftalık menüden kiler stokları otomatik düşülerek net alışveriş listesi hazırlanır.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/nutrition"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Alışveriş Listesi</span>
          </Link>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Malzeme Ekle</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Arama ve Filtreleme */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Kilerde ara (örn: Yulaf, Tavuk, Yumurta)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Kiler Listesi */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-sm">
          Kiler envanteri yükleniyor...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Kilerinizde malzeme bulunamadı</h3>
          <p className="text-slate-500 text-xs max-w-sm mx-auto">
            Evdeki yulaf, pirinç, yumurta gibi malzemeleri ekleyerek haftalık menüde olan malzemelerin tekrar satın alınmasını önleyebilirsiniz.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" />
            <span>İlk Malzemeyi Ekle</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-shadow shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                    {item.category}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm mt-1">{item.name}</h4>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(item)}
                    aria-label={`${item.name} öğesini düzenle`}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    aria-label={`${item.name} öğesini sil`}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Miktar Ayar Çubuğu */}
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                <span className="text-xs text-slate-500 font-medium">Stok Miktarı:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustAmount(item, -1)}
                    aria-label={`${item.name} miktarını azalt`}
                    className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-600 text-xs font-bold hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm text-slate-900">
                    {formatAmount(item.amount, item.unit)}
                  </span>
                  <button
                    onClick={() => adjustAmount(item, 1)}
                    aria-label={`${item.name} miktarını artır`}
                    className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-600 text-xs font-bold hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Son Kullanma & Notlar */}
              {(item.expiryDate || item.notes) && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  {item.expiryDate ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      SKT: {item.expiryDate}
                    </span>
                  ) : <span />}
                  {item.notes && <span className="italic truncate max-w-[150px]">{item.notes}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Malzeme Ekle/Düzenle Modal */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Malzemeyi Düzenle' : 'Kilere Malzeme Ekle'}>
            <form onSubmit={handleSaveItem} className="space-y-3.5">
              <div>
                <label htmlFor="pantry-field-1" className="block text-xs font-bold text-slate-700 mb-1">Malzeme Adı *</label>
                <input id="pantry-field-1"
                  type="text"
                  required
                  placeholder="örn: Yulaf Ezmesi, Tavuk Göğsü, Yumurta"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pantry-field-2" className="block text-xs font-bold text-slate-700 mb-1">Miktar *</label>
                  <input id="pantry-field-2"
                    type="number"
                    step="any"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label htmlFor="pantry-field-3" className="block text-xs font-bold text-slate-700 mb-1">Birim</label>
                  <select id="pantry-field-3"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="g">Gram (g)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="ml">Mililitre (ml)</option>
                    <option value="adet">Adet</option>
                    <option value="paket">Paket</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pantry-field-4" className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <select id="pantry-field-4"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    {CATEGORIES.filter((c) => c !== 'Tümü').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pantry-field-5" className="block text-xs font-bold text-slate-700 mb-1">SKT (İsteğe bağlı)</label>
                  <input id="pantry-field-5"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pantry-field-6" className="block text-xs font-bold text-slate-700 mb-1">Not / Marka (İsteğe bağlı)</label>
                <input id="pantry-field-6"
                  type="text"
                  placeholder="örn: Buzlukta 2 paket var"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 shadow-xs"
                >
                  {editingItem ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
}
