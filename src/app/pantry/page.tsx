'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Package, Plus, ShoppingCart } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { PANTRY_ALL, PantryFilters } from '@/components/pantry/PantryFilters';
import { PantryItemCard } from '@/components/pantry/PantryItemCard';
import { PantryItemModal } from '@/components/pantry/PantryItemModal';
import { useTimedMessage } from '@/hooks/useTimedMessage';
import { errorMessage } from '@/lib/client/api';
import { useAdjustPantry, useDeletePantryItem, usePantry, useSavePantryItem } from '@/lib/client/queries/pantry';
import { pantryStep } from '@/lib/format';
import { includesTr } from '@/lib/text';
import type { PantryItem, PantryItemInput } from '@/lib/schemas/pantry';

interface Feedback {
  type: 'success' | 'error';
  message: string;
}

export default function PantryPage() {
  // window.confirm masaüstü görünümünde (WKWebView) çalışmaz; uygulama içi onay kullanılır.
  const { confirm, dialog: confirmDialog } = useConfirm();
  const pantry = usePantry();
  const saveItem = useSavePantryItem();
  const deleteItem = useDeletePantryItem();
  const adjust = useAdjustPantry();
  const feedback = useTimedMessage<Feedback>(4000);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(PANTRY_ALL);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);

  const items = pantry.data ?? [];

  function openAddModal() {
    setEditingItem(null);
    setIsModalOpen(true);
  }

  function openEditModal(item: PantryItem) {
    setEditingItem(item);
    setIsModalOpen(true);
  }

  async function handleSaveItem(input: PantryItemInput) {
    try {
      await saveItem.mutateAsync(input);
      feedback.show({
        type: 'success',
        message: editingItem ? 'Malzeme güncellendi.' : `"${input.name}" kilere eklendi.`,
      });
      setIsModalOpen(false);
    } catch (err) {
      // Pencere açık kalır; kullanıcı düzeltip tekrar dener.
      feedback.show({ type: 'error', message: errorMessage(err, 'Bir hata oluştu.') });
    }
  }

  async function handleDelete(item: PantryItem) {
    const ok = await confirm({
      title: 'Malzemeyi sil',
      message: `${item.name} kilerden silinsin mi?`,
      confirmLabel: 'Sil',
      tone: 'danger',
    });
    if (!ok) return;
    deleteItem.mutate(item.id, {
      onSuccess: () => feedback.show({ type: 'success', message: 'Malzeme kilerden çıkarıldı.' }, 3000),
      onError: (err) => feedback.show({ type: 'error', message: errorMessage(err, 'Malzeme silinemedi.') }),
    });
  }

  function adjustAmount(item: PantryItem, direction: 1 | -1) {
    const delta = direction * pantryStep(item.unit);
    if (item.amount + delta <= 0) {
      handleDelete(item);
      return;
    }
    // İyimser: miktar anında değişir; sunucuda atomik artırım yapılır, hata olursa geri alınır.
    adjust.mutate(
      { id: item.id, delta },
      { onError: (err) => feedback.show({ type: 'error', message: errorMessage(err, 'Miktar güncellenemedi.') }) }
    );
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch = includesTr(item.name, search) || includesTr(item.category, search);
    const matchesCategory = selectedCategory === PANTRY_ALL || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Üst Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Kilerim (Evdeki Malzemeler) 🥫</h2>
            <span className="text-xs bg-brand-50 text-brand-700 font-bold px-2 py-0.5 rounded-full">Pantry Host Motoru</span>
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

      {feedback.message && (
        <div
          role={feedback.message.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
            feedback.message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.message.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{feedback.message.message}</span>
        </div>
      )}

      {/* Arama ve Filtreleme */}
      <PantryFilters
        search={search}
        onSearchChange={setSearch}
        category={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {pantry.isError && (
        <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {errorMessage(pantry.error, 'Kiler envanteri alınamadı.')}
        </p>
      )}

      {/* Kiler Listesi */}
      {pantry.isPending ? (
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
            <PantryItemCard
              key={item.id}
              item={item}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
              onAdjust={(direction) => adjustAmount(item, direction)}
            />
          ))}
        </div>
      )}

      {/* Malzeme Ekle/Düzenle Modal */}
      <PantryItemModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingItem={editingItem}
        onSubmit={handleSaveItem}
      />
      {confirmDialog}
    </div>
  );
}
