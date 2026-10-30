"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Wrench } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useDiagnostics, useProfile } from "@/lib/client/queries/system";
import { ProfileTargetsSection } from "@/components/settings/ProfileTargetsSection";
import { AIProviderSection } from "@/components/settings/AIProviderSection";
import { OpenGymSection } from "@/components/settings/OpenGymSection";
import { BackupSection } from "@/components/settings/BackupSection";
import { BackupDetailsPanel } from "@/components/settings/AutoBackupPanel";
import { DiagnosticsSection } from "@/components/settings/DiagnosticsSection";
import { TransparencySection } from "@/components/settings/TransparencySection";
import { SupplementsSection } from "@/components/settings/SupplementsSection";
import { RemindersSection } from "@/components/settings/RemindersSection";
import { FastingSection } from "@/components/settings/FastingSection";

/** B34: içindekiler. Kişisel bölümler sırayla; teknik olanlar "Gelişmiş" altında katlanır. */
const SECTIONS = [
  { id: "profil", label: "Profil" },
  { id: "takviyeler", label: "Takviyeler" },
  { id: "hatirlatmalar", label: "Hatırlatmalar" },
  { id: "oruc", label: "Oruç" },
  { id: "yapay-zeka", label: "AI koçu" },
  { id: "yedek", label: "Yedek" },
  { id: "gelismis", label: "Gelişmiş" },
] as const;
const ADVANCED_IDS = ["gelismis", "seffaflik", "yedek-ayrintilari", "opengym", "tanilama"];

const hashTargetsAdvanced = () => typeof window !== "undefined" && ADVANCED_IDS.includes(window.location.hash.slice(1));

/** Adresteki bölüme kaydırır (sayfa profil yüklenince çizildiği için tarayıcının kendi kaydırması erken kalır). */
function scrollToHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  setTimeout(() => document.getElementById(id)?.scrollIntoView?.({ block: "start" }), 0);
}

/** Ekranda en üstte görünen bölüm (içindekilerde vurgulanır). IntersectionObserver yoksa ilk bölüm. */
function useActiveSection(ready: boolean): string {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    if (!ready || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ready]);
  return active;
}

export default function SettingsPage() {
  const profile = useProfile();
  // Tanılama profil yüklenirken paralel başlar (aynı anahtar: bölüm açılınca istek tekrarlanmaz).
  useDiagnostics();
  // window.confirm masaüstü görünümünde (WKWebView) çalışmaz; uygulama içi onay kullanılır.
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [advancedOpen, setAdvancedOpen] = useState(hashTargetsAdvanced);
  const active = useActiveSection(!profile.isPending);

  // Adres bir gelişmiş bölümü gösterirse (#tanilama gibi) katlanmış bölüm açılır ve bölüme kaydırılır.
  useEffect(() => {
    const onHash = () => {
      if (hashTargetsAdvanced()) {
        setAdvancedOpen(true);
        scrollToHash();
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Panodaki "+ Takviye / Düzenle" (#takviyeler) ya da koçtaki "Ayarlar'da test et" (#yapay-zeka)
  // gibi bağlantılar: sayfa çizilince adresteki bölüme gidilir.
  const ready = !profile.isPending;
  useEffect(() => {
    if (ready) scrollToHash();
  }, [ready]);

  if (profile.isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">Ayarlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl min-w-0">
      {/* Üst Başlık */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Ayarlar</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Hedeflerin, hatırlatmaların, yapay zekâ koçu ve yedeklerin. Hesap yok, bulut yok: bu bilgisayardan neyin çıktığını{" "}
          <a href="#seffaflik" onClick={() => setAdvancedOpen(true)} className="font-semibold text-brand-700 underline">
            Gelişmiş › Şeffaflık
          </a>{" "}
          bölümünde görebilirsin.
        </p>
      </div>

      {/* B34: yapışkan içindekiler (dar ekranda yatay kayar) */}
      <nav aria-label="Ayarlar bölümleri" className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-slate-50/95 backdrop-blur print:hidden">
        <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? "true" : undefined}
                onClick={() => {
                  if (s.id === "gelismis") setAdvancedOpen(true);
                }}
                className={`block px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap ${
                  active === s.id ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* 1. PROFİL VE HEDEFLER (profil yüklenemediyse varsayılanlarla) */}
      <div id="profil" className="scroll-mt-16">
        <ProfileTargetsSection profile={profile.data} />
      </div>

      {/* F15: TAKVİYELER */}
      <div>
        <SupplementsSection />
      </div>

      {/* F83: HATIRLATMALAR */}
      <div id="hatirlatmalar" className="scroll-mt-16">
        <RemindersSection />
      </div>

      {/* F76 + F14: ORUÇ VE RAMAZAN */}
      <div id="oruc" className="scroll-mt-16">
        <FastingSection />
      </div>

      {/* YAPAY ZEKÂ KOÇU */}
      <div>
        <AIProviderSection />
      </div>

      {/* VERİ YEDEKLEME VE DIŞA AKTARMA */}
      <div id="yedek" className="scroll-mt-16">
        <BackupSection confirm={confirm} />
      </div>

      {/* B34: teknik bölümler katlanır */}
      <details
        id="gelismis"
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
        className="group scroll-mt-16 rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 p-5 [&::-webkit-details-marker]:hidden">
          <Wrench className="w-5 h-5 text-slate-600 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block font-bold text-slate-900 text-base">Gelişmiş</span>
            <span className="block text-xs text-slate-500">Şeffaflık, yedek ayrıntıları, openGym ve sistem tanılama</span>
          </span>
          <ChevronDown className="ml-auto w-5 h-5 text-slate-500 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-6 border-t border-slate-100 bg-slate-50 p-3 sm:p-5 rounded-b-2xl">
          {/* F67: CİHAZDAN NE ÇIKAR? */}
          <div id="seffaflik" className="scroll-mt-16">
            <TransparencySection />
          </div>
          <div id="yedek-ayrintilari" className="scroll-mt-16">
            <BackupDetailsPanel />
          </div>
          {/* OPENGYM ENTEGRASYONU */}
          <div id="opengym" className="scroll-mt-16">
            <OpenGymSection />
          </div>
          {/* SİSTEM TANILAMA & VERİTABANI SAĞLIĞI */}
          <div id="tanilama" className="scroll-mt-16">
            <DiagnosticsSection />
          </div>
        </div>
      </details>
      {confirmDialog}
    </div>
  );
}
