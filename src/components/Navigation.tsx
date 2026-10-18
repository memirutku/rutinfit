"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Utensils,
  BookOpen,
  Package,
  Dumbbell,
  TrendingUp,
  Bot,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Ana Panel", icon: LayoutDashboard },
  { href: "/nutrition", label: "Yemek Planı", icon: Utensils },
  { href: "/foods", label: "Besin & Tarif", icon: BookOpen },
  { href: "/pantry", label: "Kilerim", icon: Package },
  { href: "/workouts", label: "Antrenman", icon: Dumbbell },
  { href: "/opengym", label: "openGym", icon: TrendingUp },
  { href: "/progress", label: "İlerleme", icon: TrendingUp },
  { href: "/coach", label: "AI Koçu", icon: Bot },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800 p-4 fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-3 px-2 py-4 mb-6 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center font-bold text-white shadow-md">
            RF
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">RutinFit</h1>
            <p className="text-xs text-slate-400">Kişisel Sağlık ve Ritim</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
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
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-slate-200">Yerel-First Aktif</span>
          </div>
          <p>Verileriniz yalnızca bu cihazda SQLite üzerinde tutulur.</p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-1 shadow-lg">
        <div className="flex justify-around items-center">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "text-brand-600 font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
          {/* Quick link to Coach on mobile */}
          <Link
            href="/coach"
            className={`flex flex-col items-center py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
              pathname.startsWith("/coach")
                ? "text-brand-600 font-semibold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Bot className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">AI Koçu</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
