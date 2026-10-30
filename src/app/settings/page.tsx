"use client";

import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useDiagnostics, useProfile } from "@/lib/client/queries/system";
import { ProfileTargetsSection } from "@/components/settings/ProfileTargetsSection";
import { AIProviderSection } from "@/components/settings/AIProviderSection";
import { OpenGymSection } from "@/components/settings/OpenGymSection";
import { BackupSection } from "@/components/settings/BackupSection";
import { DiagnosticsSection } from "@/components/settings/DiagnosticsSection";
import { TransparencySection } from "@/components/settings/TransparencySection";
import { SupplementsSection } from "@/components/settings/SupplementsSection";
import { RemindersSection } from "@/components/settings/RemindersSection";
import { FastingSection } from "@/components/settings/FastingSection";

export default function SettingsPage() {
  const profile = useProfile();
  // Tanılama profil yüklenirken paralel başlar (aynı anahtar: bölüm açılınca istek tekrarlanmaz).
  useDiagnostics();
  // window.confirm masaüstü görünümünde (WKWebView) çalışmaz; uygulama içi onay kullanılır.
  const { confirm, dialog: confirmDialog } = useConfirm();

  if (profile.isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">Ayarlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Üst Başlık */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Ayarlar & Yapılandırma ⚙️</h2>
        <p className="text-sm text-slate-500 mt-0.5">Kişisel hedefler, yerel AI sağlayıcısı ve tam veritabanı yedekleme. Hesap yok, bulut yok.</p>
      </div>

      {/* 1. PROFİL VE HEDEFLER (profil yüklenemediyse varsayılanlarla) */}
      <ProfileTargetsSection profile={profile.data} />

      {/* F15: TAKVİYELER */}
      <SupplementsSection />

      {/* F83: HATIRLATMALAR */}
      <RemindersSection />

      {/* F76 + F14: ORUÇ VE RAMAZAN */}
      <FastingSection />

      {/* 2. YEREL YAPAY ZEKÂ YAPILANDIRMASI */}
      <AIProviderSection />

      {/* F67: CİHAZDAN NE ÇIKAR? */}
      <TransparencySection />

      {/* 3. OPENGYM ENTEGRASYONU */}
      <OpenGymSection />

      {/* 4. VERİ YEDEKLEME VE GERİ YÜKLEME */}
      <BackupSection confirm={confirm} />

      {/* 5. SİSTEM TANILAMA & VERİTABANI SAĞLIĞI */}
      <DiagnosticsSection />
      {confirmDialog}
    </div>
  );
}
