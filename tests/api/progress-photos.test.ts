import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST, DELETE } from "@/app/api/progress-photos/route";
import { GET as FILE } from "@/app/api/progress-photos/file/route";
import { photosDir } from "@/lib/services/progress-photos";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function form(bytes: Buffer, fields: Record<string, string>, name = "foto.jpg", type = "image/jpeg") {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(bytes)], name, { type }));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("/api/progress-photos (F16)", () => {
  it("fotoğraf veri klasörüne yazılır, listelenir, dosyası aynı içerikle döner ve silinir", async () => {
    const res = await callRoute(POST, { method: "POST", formData: form(JPEG, { date: "2026-10-01", pose: "front", notes: "Sabah" }) });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ date: "2026-10-01", pose: "front", mimeType: "image/jpeg", sizeBytes: JPEG.length, notes: "Sabah" });
    const file = path.join(photosDir(), res.json.fileName);
    expect(fs.existsSync(file)).toBe(true);

    await callRoute(POST, { method: "POST", formData: form(PNG, { date: "2026-10-20", pose: "side" }, "yan.png", "image/png") });
    const list = await callRoute(GET);
    expect(list.json.photos.map((p: any) => p.pose)).toEqual(["side", "front"]);
    expect(list.json.folder).toBe(photosDir());

    const served = await callRoute(FILE, { query: { id: res.json.id } });
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
    expect(served.headers.get("cache-control")).toContain("no-store");

    expect((await callRoute(DELETE, { method: "DELETE", query: { id: res.json.id } })).status).toBe(200);
    expect(fs.existsSync(file)).toBe(false);
    expect((await callRoute(FILE, { query: { id: res.json.id } })).status).toBe(404);
  });

  it("resim olmayan içerik (uzantı ne derse desin), geçersiz poz ve tarih 400", async () => {
    const filesBefore = fs.readdirSync(photosDir()).length;
    const fake = Buffer.from("<script>alert(1)</script>");
    expect((await callRoute(POST, { method: "POST", formData: form(fake, { pose: "front" }, "x.jpg") })).status).toBe(400);
    expect((await callRoute(POST, { method: "POST", formData: form(JPEG, { pose: "top" }) })).status).toBe(400);
    expect((await callRoute(POST, { method: "POST", formData: form(JPEG, { pose: "front", date: "dün" }) })).status).toBe(400);
    expect(await prisma.progressPhoto.count()).toBe(0);
    expect(fs.readdirSync(photosDir())).toHaveLength(filesBefore);
  });
});
