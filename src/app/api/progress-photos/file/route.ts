import { apiError, HttpError } from "@/lib/api-error";
import { readPhoto } from "@/lib/services/progress-photos";

/** F16: fotoğrafın kendisi (yalnız bu bilgisayardaki arayüz için; önbelleğe alınmaz). */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new HttpError("id parametresi zorunludur.", 400);
    const { bytes, mimeType } = await readPhoto(id);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": mimeType,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
      },
    });
  } catch (error) {
    return apiError(error, "Fotoğraf getirilemedi", "Photo file GET");
  }
}
