/** Pazar günü meal-prep (ön hazırlık) rehberi: sabit içerik. */
export function MealPrepGuide() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Pazar Günü Meal-Prep (Ön Hazırlık) Rehberi 🍱</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Hafta içi iş çıkışı yorgunluğunu azaltmak için 1 saatlik pazar ön hazırlığı hayat kurtarır.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl">
          <h4 className="font-bold text-blue-900 text-sm mb-2">1. Tavuk Göğsü Toplu Pişirme</h4>
          <p className="text-xs text-blue-800 leading-relaxed mb-2">
            Pazar günü 800g–1kg tavuk göğsünü zeytinyağı, pul biber ve kekikle harmanlayıp fırında 200°C'de 25 dk pişirin.
          </p>
          <div className="text-xs text-blue-700 bg-white/70 p-2.5 rounded-lg border border-blue-100">
            <strong>Saklama:</strong> Cam saklama kabında buzdolabında 3–4 gün tazeliğini korur.
          </div>
        </div>

        <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl">
          <h4 className="font-bold text-emerald-900 text-sm mb-2">2. Bulgur / Pirinç Haşlama</h4>
          <p className="text-xs text-emerald-800 leading-relaxed mb-2">
            Haftalık 300g pilavlık bulguru önceden pişirip porsiyonlayın. Isıtıldığında kurumasını önlemek için üzerine 1 yemek kaşığı su ekleyerek mikrodalgaya atın.
          </p>
          <div className="text-xs text-emerald-700 bg-white/70 p-2.5 rounded-lg border border-emerald-100">
            <strong>Saklama:</strong> Hava geçirmez kapta buzdolabında 4–5 gün.
          </div>
        </div>

        <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl">
          <h4 className="font-bold text-amber-900 text-sm mb-2">3. İş Yeri Ara Öğün Kapları</h4>
          <p className="text-xs text-amber-800 leading-relaxed mb-2">
            Muz, yoğurt ve lor peynirini iş yeri buzdolabına pazartesi günü haftalık stoklayabilir veya her akşam 2 dakikada hazırlayıp çantaya atabilirsiniz.
          </p>
          <div className="text-xs text-amber-700 bg-white/70 p-2.5 rounded-lg border border-amber-100">
            <strong>İpucu:</strong> Saat 17:00'de yenecek bu ara öğün, 19:30 eve varışta enerjinizi yüksek tutar.
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <h4 className="font-bold text-slate-800 text-sm mb-2">4. Gıda Güvenliği Hatırlatması</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pişirilmiş yemekleri oda sıcaklığında 2 saatten fazla bekletmeyin; ılındıktan hemen sonra buzdolabına kaldırın. Kokusu veya görüntüsü değişen gıdaları tüketmeyin.
          </p>
        </div>
      </div>
    </div>
  );
}
