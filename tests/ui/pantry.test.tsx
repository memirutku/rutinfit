import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PantryItemCard } from "@/components/pantry/PantryItemCard";
import { PantryFilters } from "@/components/pantry/PantryFilters";
import { PantryItemModal } from "@/components/pantry/PantryItemModal";
import PantryPage from "@/app/pantry/page";
import type { PantryItem } from "@/lib/schemas/pantry";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { renderWithQuery } from "../helpers/query";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const milk: PantryItem = {
  id: "p1",
  name: "Süt",
  amount: 1,
  unit: "l",
  category: "Süt Ürünleri",
  expiryDate: "2030-01-01",
  notes: "laktozsuz",
};
const eggs: PantryItem = { id: "p2", name: "Yumurta", amount: 1, unit: "adet", category: "Diğer", expiryDate: null, notes: null };

describe("PantryItemCard", () => {
  it("miktarı, SKT'yi ve notu gösterir; düğmeler erişilebilir adlarıyla çalışır", () => {
    const handlers = { onEdit: vi.fn(), onDelete: vi.fn(), onAdjust: vi.fn() };
    renderWithQuery(<PantryItemCard item={milk} {...handlers} />);
    expect(screen.getByText("1 l")).toBeTruthy();
    expect(screen.getByText(/SKT: 01\.01\.2030/)).toBeTruthy(); // F80: gg.aa.yyyy
    expect(screen.getByText("laktozsuz")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Süt miktarını artır" }));
    fireEvent.click(screen.getByRole("button", { name: "Süt miktarını azalt" }));
    fireEvent.click(screen.getByRole("button", { name: "Süt öğesini düzenle" }));
    fireEvent.click(screen.getByRole("button", { name: "Süt öğesini sil" }));
    expect(handlers.onAdjust.mock.calls).toEqual([[1], [-1]]);
    expect(handlers.onEdit).toHaveBeenCalled();
    expect(handlers.onDelete).toHaveBeenCalled();
  });
});

describe("PantryFilters", () => {
  it("arama ve kategori değişikliklerini bildirir", () => {
    const onSearchChange = vi.fn();
    const onCategoryChange = vi.fn();
    renderWithQuery(<PantryFilters search="" onSearchChange={onSearchChange} category="Tümü" onCategoryChange={onCategoryChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Kilerde ara/), { target: { value: "yulaf" } });
    fireEvent.click(screen.getByRole("button", { name: "Manav" }));
    expect(onSearchChange).toHaveBeenCalledWith("yulaf");
    expect(onCategoryChange).toHaveBeenCalledWith("Manav");
  });
});

describe("PantryItemModal", () => {
  it("düzenlemede alanları doldurur ve ayrıştırılmış değerleri gönderir", async () => {
    const onSubmit = vi.fn();
    renderWithQuery(<PantryItemModal open onClose={vi.fn()} editingItem={milk} onSubmit={onSubmit} />);
    const dialog = screen.getByRole("dialog", { name: "Malzemeyi Düzenle" });
    expect((within(dialog).getByLabelText("Malzeme Adı *") as HTMLInputElement).value).toBe("Süt");
    fireEvent.change(within(dialog).getByLabelText("Miktar *"), { target: { value: "1,5".replace(",", ".") } });
    fireEvent.change(within(dialog).getByLabelText("Not / Marka (İsteğe bağlı)"), { target: { value: "  " } });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Güncelle" })));
    expect(onSubmit).toHaveBeenCalledWith({
      id: "p1",
      name: "Süt",
      amount: 1.5,
      unit: "l",
      category: "Süt Ürünleri",
      expiryDate: "2030-01-01",
      notes: null,
    });
  });

  it("yeniden açılınca öğeden yeniden dolar; açıkken başka öğe verilirse ona geçer", () => {
    const name = () => (screen.getByLabelText("Malzeme Adı *") as HTMLInputElement).value;
    const { rerender } = renderWithQuery(<PantryItemModal open onClose={vi.fn()} editingItem={milk} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Malzeme Adı *"), { target: { value: "Ayran" } });
    expect(name()).toBe("Ayran");

    rerender(<PantryItemModal open={false} onClose={vi.fn()} editingItem={milk} onSubmit={vi.fn()} />);
    rerender(<PantryItemModal open onClose={vi.fn()} editingItem={milk} onSubmit={vi.fn()} />);
    expect(name()).toBe("Süt");

    rerender(<PantryItemModal open onClose={vi.fn()} editingItem={eggs} onSubmit={vi.fn()} />);
    expect(name()).toBe("Yumurta");
    expect((screen.getByLabelText("Not / Marka (İsteğe bağlı)") as HTMLInputElement).value).toBe("");
  });

  it("yeni malzemede varsayılanlarla açılır", () => {
    renderWithQuery(<PantryItemModal open onClose={vi.fn()} editingItem={null} onSubmit={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Kilere Malzeme Ekle" });
    expect((within(dialog).getByLabelText("Miktar *") as HTMLInputElement).value).toBe("500");
    expect(within(dialog).getByRole("button", { name: "Kaydet" })).toBeTruthy();
  });
});

describe("Kiler sayfası", () => {
  it("+ düğmesi yeni miktarı sunucu yanıtından önce gösterir; hata olursa geri alır", async () => {
    const patch = deferred<Response>();
    const s = stubFetch([
      ["/api/pantry", (_u, init) => (init?.method === "PATCH" ? patch.promise : jsonResponse({ items: [milk] }))],
    ]);
    restore = s.restore;
    renderWithQuery(<PantryPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Süt miktarını artır" }));
    expect(await screen.findByText("1,1 l")).toBeTruthy();
    const body = JSON.parse(String(s.calls.find((c) => c.init?.method === "PATCH")?.init?.body));
    expect(body).toEqual({ id: "p1", delta: 0.1 });

    await act(async () => patch.resolve(jsonResponse({ error: "Miktar güncellenemedi." }, 500)));
    expect(await screen.findByText("1 l")).toBeTruthy();
    expect(screen.queryByText("1,1 l")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Miktar güncellenemedi.");
  });

  it("silme uygulama içi onayla yapılır; Vazgeç silmez", async () => {
    const s = stubFetch([
      ["/api/pantry", (_u, init) => (init?.method === "DELETE" ? jsonResponse({ success: true }) : jsonResponse({ items: [milk] }))],
    ]);
    restore = s.restore;
    renderWithQuery(<PantryPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Süt öğesini sil" }));
    await act(async () =>
      fireEvent.click(within(screen.getByRole("dialog", { name: "Malzemeyi sil" })).getByRole("button", { name: "Vazgeç" }))
    );
    expect(s.calls.some((c) => c.init?.method === "DELETE")).toBe(false);
    expect(screen.getByText("Süt")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Süt öğesini sil" }));
    await act(async () =>
      fireEvent.click(within(screen.getByRole("dialog", { name: "Malzemeyi sil" })).getByRole("button", { name: "Sil" }))
    );
    expect(await screen.findByText("Malzeme kilerden çıkarıldı.")).toBeTruthy();
    expect(screen.queryByText("Süt")).toBeNull();
    expect(s.calls.find((c) => c.init?.method === "DELETE")?.url).toContain("id=p1");
  });

  it("miktar sıfıra inecekse önce silme onayı sorulur", async () => {
    const s = stubFetch([["/api/pantry", () => jsonResponse({ items: [eggs] })]]);
    restore = s.restore;
    renderWithQuery(<PantryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Yumurta miktarını azalt" }));
    expect(await screen.findByRole("dialog", { name: "Malzemeyi sil" })).toBeTruthy();
    expect(s.calls.some((c) => c.init?.method === "PATCH")).toBe(false);
  });

  it("kayıt başarısız olursa hata gösterilir ve pencere açık kalır", async () => {
    restore = stubFetch([
      ["/api/pantry", (_u, init) =>
        init?.method === "POST" ? jsonResponse({ error: "Ürün adı zorunludur." }, 400) : jsonResponse({ items: [] }),
      ],
    ]).restore;
    renderWithQuery(<PantryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "İlk Malzemeyi Ekle" }));
    const dialog = screen.getByRole("dialog", { name: "Kilere Malzeme Ekle" });
    fireEvent.change(within(dialog).getByLabelText("Malzeme Adı *"), { target: { value: "Yulaf" } });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Kaydet" })));
    expect((await screen.findByRole("alert")).textContent).toContain("Ürün adı zorunludur.");
    expect(screen.getByRole("dialog", { name: "Kilere Malzeme Ekle" })).toBeTruthy();
  });

  it("başarılı kayıt pencereyi kapatır ve bildirir", async () => {
    let items: PantryItem[] = [];
    restore = stubFetch([
      ["/api/pantry", (_u, init) => {
        if (init?.method === "POST") {
          items = [{ ...eggs, name: "Yulaf", amount: 500, unit: "g" }];
          return jsonResponse({ success: true, item: items[0] });
        }
        return jsonResponse({ items });
      }],
    ]).restore;
    renderWithQuery(<PantryPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Malzeme Ekle/ }));
    const dialog = screen.getByRole("dialog", { name: "Kilere Malzeme Ekle" });
    fireEvent.change(within(dialog).getByLabelText("Malzeme Adı *"), { target: { value: "Yulaf" } });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Kaydet" })));
    expect(await screen.findByText('"Yulaf" kilere eklendi.')).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Yulaf" })).toBeTruthy());
  });
});
