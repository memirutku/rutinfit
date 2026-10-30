import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("F60: CSV yazımı (RFC 4180)", () => {
  it("virgül, tırnak ve satır sonu içeren alanları tırnaklar; çift tırnağı kaçışlar; Excel için BOM ekler", () => {
    const csv = toCsv(["a", "b"], [["düz", 'tırnak "x"'], ["virgül, var", "iki\nsatır"], [1.5, null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\n").slice(0, 2)).toEqual(["a,b", 'düz,"tırnak ""x"""']);
    expect(csv).toContain('"virgül, var","iki\nsatır"');
    expect(csv.trimEnd().endsWith("1.5,")).toBe(true);
  });
});
