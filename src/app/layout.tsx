import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "RutinFit — Kişisel Beslenme ve Antrenman Takibi",
  description:
    "Yerel-first, gizlilik odaklı, iş hayatıyla uyumlu sürdürülebilir fitness ve beslenme yönetim sistemi.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased">
        <Providers>
          <div className="min-h-full flex flex-col md:flex-row">
            <Navigation />
            <main className="flex-1 md:pl-64 pb-20 md:pb-8">
              <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
