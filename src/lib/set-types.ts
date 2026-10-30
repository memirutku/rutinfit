/** F19: Set tipleri. Isınma setleri rekor, hacim ve ilerleme kararına girmez. */
export const SET_TYPES = ["normal", "warmup", "drop", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: "Normal",
  warmup: "Isınma",
  drop: "Drop",
  failure: "Tükeniş",
};

export const isWorkingSet = (setType: string | null | undefined) => setType !== "warmup";

/** Strong/Hevy değerlerini eşler ("warm_up", "dropset"...); bilinmeyen değer normaldir. */
export function normalizeSetType(raw: string | null | undefined): SetType {
  const v = (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (v === "warmup" || v === "warm_up" || v === "isinma" || v === "ısınma") return "warmup";
  if (v === "drop" || v === "dropset" || v === "drop_set") return "drop";
  if (v === "failure" || v === "tukenis" || v === "tükeniş") return "failure";
  return "normal";
}
