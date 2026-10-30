"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  Utensils,
  BookOpen,
  Package,
  Dumbbell,
  TrendingUp,
  Bot,
  Settings,
  FileText,
  MoreHorizontal,
  X,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Ana Panel", icon: LayoutDashboard },
  { href: "/nutrition", label: "Yemek Planı", icon: Utensils },
  { href: "/foods", label: "Besin & Tarif", icon: BookOpen },
  { href: "/pantry", label: "Kilerim", icon: Package },
  { href: "/workouts", label: "Antrenman", icon: Dumbbell },
  { href: "/opengym", label: "openGym", icon: Activity },
  { href: "/progress", label: "İlerleme", icon: TrendingUp },
  { href: "/coach", label: "AI Koçu", icon: Bot },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

// B32: dar ekranda alt menüye sığanlar; geri kalanı "Daha fazla" altında.
const BOTTOM_HREFS = ["/", "/nutrition", "/foods", "/workouts", "/coach"];
const BOTTOM_ITEMS = BOTTOM_HREFS.map((h) => NAV_ITEMS.find((i) => i.href === h)!);
const MORE_ITEMS: NavItem[] = [
  ...NAV_ITEMS.filter((i) => !BOTTOM_HREFS.includes(i.href)),
  { href: "/report", label: "Diyetisyen raporu", icon: FileText },
];

const isActiveHref = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function Navigation() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_ITEMS.some((i) => isActiveHref(pathname, i.href));

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex print:hidden flex-col w-64 bg-slate-900 text-white border-r border-slate-800 p-4 fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-3 px-2 py-4 mb-6 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center font-bold text-white shadow-md">
            RF
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">RutinFit</h1>
            <p className="text-xs text-slate-400">Kişisel Sağlık ve Ritim</p>
          </div>
        </div>

        <nav aria-label="Ana menü" className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveHref(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 text-xs text-slate-400 mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-slate-200">Yerel çalışıyor</span>
          </div>
          <p>Verilerin yalnız bu bilgisayarda tutulur.</p>
        </div>
      </aside>

      {/* B32: "Daha fazla" sayfası (dar ekran) */}
      {moreOpen && (
        <div className="md:hidden print:hidden fixed inset-0 z-50 flex items-end bg-slate-900/40" onClick={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Diğer sayfalar"
            className="w-full rounded-t-2xl bg-white p-4 pb-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Diğer sayfalar</h2>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setMoreOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveHref(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium ${
                      isActive ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Alt menü"
        className="md:hidden print:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-1 shadow-lg"
      >
        <div className="flex justify-around items-center">
          {BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveHref(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? "text-brand-600 font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-label="Daha fazla"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            data-active={moreActive ? "true" : "false"}
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
              moreActive || moreOpen ? "text-brand-600 font-semibold" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <MoreHorizontal className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Daha fazla</span>
          </button>
        </div>
      </nav>
    </>
  );
}
