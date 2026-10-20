import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Masaüstü kabuğunun sunucunun gerçekten bu RutinFit örneği olduğunu doğrulaması için.
 * Kişisel veri içermez; nonce, kabuğun süreci başlatırken verdiği rastgele değerdir.
 */
export function GET() {
  return NextResponse.json({
    app: "rutinfit",
    version: process.env.npm_package_version || "0.1.0",
    nonce: process.env.RUTINFIT_INSTANCE_NONCE || null,
  });
}
