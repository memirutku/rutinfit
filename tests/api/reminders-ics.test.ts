import fs from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/reminders/ics/route";
import { PUT as putAutoBackup } from "@/app/api/backup/auto/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

describe("B41: GET /api/reminders/ics", () => {
  it("açık hatırlatmaları takvim dosyası olarak indirir; uygulama klasörüne kopya bırakır", async () => {
    await prisma.reminder.create({ data: { kind: "water", title: "Su iç", time: "10:00", days: "1234567" } });
    await prisma.reminder.create({ data: { kind: "custom", title: "Kapalı olan", time: "11:00", days: "12345", enabled: false } });
    const res = await callRoute(GET);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="rutinfit-hatirlatmalar-\d{4}-\d{2}-\d{2}\.ics"/);
    expect(res.text).toContain("SUMMARY:Su iç\r\n");
    expect(res.text).not.toContain("Kapalı olan");
    const copy = decodeURIComponent(res.headers.get("x-rutinfit-export-path")!);
    expect(fs.readFileSync(copy, "utf8")).toBe(res.text);
  });

  it("kopya ayarı kapalıysa yalnız indirilir", async () => {
    await callRoute(putAutoBackup, { method: "PUT", body: { exportCopies: false } });
    const res = await callRoute(GET);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-rutinfit-export-path")).toBeNull();
  });
});
