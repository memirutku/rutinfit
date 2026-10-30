"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/queries/keys";
import { getLocalDateString } from "@/lib/date-utils";
import { formatDateTr } from "@/lib/format";

type Pose = "front" | "side" | "back";
const POSES: Array<{ value: Pose; label: string }> = [
  { value: "front", label: "Önden" },
  { value: "side", label: "Yandan" },
  { value: "back", label: "Arkadan" },
];
const poseLabel = (p: string) => POSES.find((x) => x.value === p)?.label ?? p;

interface Photo {
  id: string;
  date: string;
  pose: Pose;
  notes: string | null;
}

const KEY = [...queryKeys.progress, "photos"];
const src = (id: string) => `/api/progress-photos/file?id=${id}`;
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";

/** F16: İlerleme fotoğrafları. Yalnız bu bilgisayarda saklanır; yedek dosyasına girmez. */
export function PhotosSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => apiFetch<{ photos: Photo[]; folder: string }>("/api/progress-photos") });
  const [pose, setPose] = useState<Pose>("front");
  const [comparePose, setComparePose] = useState<Pose>("front");
  const [date, setDate] = useState(getLocalDateString());
  const [file, setFile] = useState<File | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("file", file!);
      form.append("pose", pose);
      form.append("date", date);
      return apiFetch("/api/progress-photos", { method: "POST", body: form });
    },
    onSuccess: () => {
      setFile(null);
      return invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/progress-photos?id=${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const photos = data?.photos ?? [];
  const ofPose = photos.filter((p) => p.pose === comparePose); // yeniden eskiye
  const first = ofPose[ofPose.length - 1];
  const last = ofPose[0];

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="w-5 h-5 text-brand-600" />
        <h3 className="font-bold text-slate-900 text-base">İlerleme fotoğrafları</h3>
      </div>
      <p className="text-xs text-slate-500">
        Fotoğraflar yalnız bu bilgisayarda saklanır, hiçbir yere gönderilmez ve yedek dosyasına girmez; klasörü ayrıca yedekle.
        {data?.folder && <span className="block font-mono text-[11px] text-slate-400 break-all">{data.folder}</span>}
      </p>

      <div className="space-y-2">
        <div className="max-w-xs">
          <label htmlFor="photo-compare-pose" className="block text-xs font-semibold text-slate-600 mb-1">
            Karşılaştırılacak poz
          </label>
          <select id="photo-compare-pose" value={comparePose} onChange={(e) => setComparePose(e.target.value as Pose)} className={INPUT}>
            {POSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div role="group" aria-label="Karşılaştırma" className="grid grid-cols-2 gap-3">
          {first && last && first.id !== last.id ? (
            [first, last].map((p) => (
              <figure key={p.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- yerel API'den gelen kullanıcı fotoğrafı */}
                <img src={src(p.id)} alt={`${poseLabel(p.pose)} · ${formatDateTr(p.date)}`} className="w-full aspect-[3/4] object-cover rounded-xl bg-slate-100" />
                <figcaption className="text-xs text-slate-600 text-center">{formatDateTr(p.date)}</figcaption>
              </figure>
            ))
          ) : (
            <p className="col-span-2 text-xs text-slate-500">Karşılaştırmak için bu pozda en az iki fotoğraf gerekir.</p>
          )}
        </div>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- yerel API'den gelen kullanıcı fotoğrafı */}
              <img src={src(p.id)} alt={`${poseLabel(p.pose)} · ${formatDateTr(p.date)}`} loading="lazy" className="w-full aspect-[3/4] object-cover rounded-lg bg-slate-100" />
              <p className="text-[10px] text-slate-500 text-center">
                {formatDateTr(p.date, { short: true })} · {poseLabel(p.pose)}
              </p>
              <button
                type="button"
                aria-label={`${formatDateTr(p.date)} ${poseLabel(p.pose)} fotoğrafını sil`}
                onClick={() => remove.mutate(p.id)}
                className="absolute top-1 right-1 p-1 rounded-md bg-white/80 text-slate-500 hover:text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
        <div className="sm:col-span-2">
          <label htmlFor="photo-file" className="block text-xs font-semibold text-slate-600 mb-1">
            Fotoğraf
          </label>
          <input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        </div>
        <div>
          <label htmlFor="photo-pose" className="block text-xs font-semibold text-slate-600 mb-1">
            Poz
          </label>
          <select id="photo-pose" value={pose} onChange={(e) => setPose(e.target.value as Pose)} className={INPUT}>
            {POSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="photo-date" className="block text-xs font-semibold text-slate-600 mb-1">
            Tarih
          </label>
          <input id="photo-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
        </div>
        <button
          type="button"
          disabled={!file || upload.isPending}
          onClick={() => upload.mutate()}
          className="sm:col-span-4 justify-self-start px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
        >
          Fotoğrafı ekle
        </button>
      </div>
      {(upload.error || remove.error) && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(upload.error ?? remove.error, "İşlem yapılamadı.")}
        </p>
      )}
      <p className="text-[11px] text-slate-500">İpucu: aynı ışıkta, aynı saatte ve aynı uzaklıktan çek; değişim böyle daha net görünür.</p>
    </section>
  );
}
