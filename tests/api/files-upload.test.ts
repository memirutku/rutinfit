import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/files/upload/route";
import { prisma } from "@/lib/prisma";
import { getStoragePaths } from "@/lib/storage-paths";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

function form(name: string, content: string | Uint8Array<ArrayBuffer>, type = "text/plain") {
  const fd = new FormData();
  fd.append("file", new File([content], name, { type }));
  return fd;
}

describe("POST /api/files/upload", () => {
  it("metin dosyasını uygulama veri klasörüne kaydeder (çalışma dizinine değil)", async () => {
    const res = await callRoute(POST, { formData: form("plan.txt", "Pazartesi: 3x10 squat") });
    expect(res.status).toBe(200);

    const row = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: res.json.file.id } });
    const uploadsDir = getStoragePaths().uploadsDir;
    expect(row.storagePath.startsWith(uploadsDir + path.sep)).toBe(true);
    expect(fs.existsSync(row.storagePath)).toBe(true);
  });

  it("dosya adındaki yol aşımı (../) veri klasörünün dışına yazamaz", async () => {
    const res = await callRoute(POST, { formData: form("../../../etc/passwd.txt", "x") });
    const row = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: res.json.file.id } });
    expect(path.dirname(row.storagePath)).toBe(getStoragePaths().uploadsDir);
  });

  it("aynı içerik iki kez yüklenince tek kayıt tutulur", async () => {
    await callRoute(POST, { formData: form("a.txt", "aynı içerik") });
    await callRoute(POST, { formData: form("b.txt", "aynı içerik") });
    expect(await prisma.uploadedFile.count()).toBe(1);
  });

  it("dosya yoksa 400 döner", async () => {
    const res = await callRoute(POST, { formData: new FormData() });
    expect(res.status).toBe(400);
  });

  it("Content-Length sınırı aşıyorsa gövdeyi ayrıştırmadan 413 döner", async () => {
    const res = await callRoute(POST, {
      formData: form("big.txt", "küçük"),
      headers: { "content-length": String(50 * 1024 * 1024) },
    });
    expect(res.status).toBe(413);
    expect(await prisma.uploadedFile.count()).toBe(0);
  });

  it("modelin göreceği PDF metni yapısal veride saklanır", async () => {
    // Geçerli ama metinsiz minimal PDF: ayrıştırıcı hata verse de yanıt 200 ve uyarı içerir.
    const res = await callRoute(POST, {
      formData: form("bos.pdf", new TextEncoder().encode("%PDF-1.4\n%%EOF\n"), "application/pdf"),
    });
    expect(res.status).toBe(200);
    expect(res.json.artifact.uncertainties.length).toBeGreaterThan(0);
    expect(res.json.artifact.structuredData).toHaveProperty("text");
  });
});
