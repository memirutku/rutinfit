"use client";

import { useState } from "react";
import { HeartPulse, Trash2 } from "lucide-react";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { errorMessage } from "@/lib/client/api";
import { useAddCardio, useCardio, useDeleteCardio, type CardioInput } from "@/lib/client/queries/cardio";
import { CARDIO_KINDS, CARDIO_KIND_KEYS, type CardioKind } from "@/lib/cardio";
import { addDaysToDateString, startOfWeek } from "@/lib/date-utils";
import { formatDateTr, formatNumberTr } from "@/lib/format";

const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";

/** F27: Koşu, yürüyüş ve diğer kardiyo için elle kayıt; son 30 gün ve bu haftanın özeti. */
export function CardioPanel({ today }: { today: string }) {
  const weekFrom = startOfWeek(today);
  const week = useCardio(weekFrom, addDaysToDateString(weekFrom, 6));
  const recent = useCardio(addDaysToDateString(today, -29), today);
  const add = useAddCardio();
  const remove = useDeleteCardio();
  const [kind, setKind] = useState<CardioKind>("walk");
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [avgHr, setAvgHr] = useState("");
  const [kcal, setKcal] = useState(0);
  const s = week.data?.summary;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: CardioInput = { date, kind, durationMin: duration };
    if (distance > 0) input.distanceKm = distance;
    if (avgHr) input.avgHr = parseInt(avgHr, 10);
    if (kcal > 0) input.kcal = kcal;
    add.mutate(input, { onSuccess: () => (setDuration(0), setDistance(0), setAvgHr(""), setKcal(0)) });
  }

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <HeartPulse className="w-5 h-5 text-rose-600" />
        <h3 className="font-bold text-slate-900 text-base">Kardiyo</h3>
      </div>
      {s && (
        <p className="text-sm font-semibold text-slate-700">
          Bu hafta: {s.sessions} seans · {formatNumberTr(s.minutes)} dk · {formatNumberTr(s.distanceKm)} km
        </p>
      )}

      <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
        <div>
          <label htmlFor="cardio-kind" className={LABEL}>
            Tür
          </label>
          <select id="cardio-kind" value={kind} onChange={(e) => setKind(e.target.value as CardioKind)} className={INPUT}>
            {CARDIO_KIND_KEYS.map((k) => (
              <option key={k} value={k}>
                {CARDIO_KINDS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cardio-date" className={LABEL}>
            Tarih
          </label>
          <input id="cardio-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="cardio-duration" className={LABEL}>
            Süre (dk)
          </label>
          <DecimalInput id="cardio-duration" required value={duration || null} onValueChange={setDuration} className={INPUT} />
        </div>
        <div>
          <label htmlFor="cardio-distance" className={LABEL}>
            Mesafe (km)
          </label>
          <DecimalInput id="cardio-distance" value={distance || null} onValueChange={setDistance} placeholder="İsteğe bağlı" className={INPUT} />
        </div>
        <div>
          <label htmlFor="cardio-hr" className={LABEL}>
            Ort. nabız
          </label>
          <input id="cardio-hr" type="number" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} placeholder="İsteğe bağlı" className={INPUT} />
        </div>
        <div>
          <label htmlFor="cardio-kcal" className={LABEL}>
            Kalori
          </label>
          <DecimalInput id="cardio-kcal" value={kcal || null} onValueChange={setKcal} placeholder="Boşsa tahmin" className={INPUT} />
        </div>
        <div className="col-span-2 sm:col-span-6 flex justify-end">
          <button type="submit" disabled={add.isPending || !(duration > 0)} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
            Kardiyoyu kaydet
          </button>
        </div>
      </form>
      {add.isError && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(add.error, "Kaydedilemedi.")}
        </p>
      )}

      {recent.data && recent.data.logs.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {recent.data.logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2 gap-2">
              <span>
                <span className="font-semibold text-slate-900">{CARDIO_KINDS[l.kind as CardioKind] ?? l.kind}</span>{" "}
                <span className="text-slate-500">
                  {formatDateTr(l.date)} · {formatNumberTr(l.durationMin)} dk
                  {l.distanceKm ? ` · ${formatNumberTr(l.distanceKm)} km` : ""}
                  {l.pace ? ` · ${l.pace}` : ""}
                  {l.avgHr ? ` · ${l.avgHr} nabız` : ""}
                  {l.kcal ? ` · ${l.kcalEstimated ? "~" : ""}${Math.round(l.kcal)} kcal` : ""}
                </span>
              </span>
              <button type="button" aria-label={`${formatDateTr(l.date)} kardiyo kaydını sil`} onClick={() => remove.mutate(l.id)} className="p-1.5 text-slate-400 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-slate-400">Kalori girilmezse süre, tür ve kilondan tahmin edilir (~ işaretli). Saat verisi Apple Health içe aktarımıyla gelir.</p>
    </section>
  );
}
