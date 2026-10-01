import { ImageResponse } from "next/og";
import { SPLASH_SIZES } from "@/lib/splash";


export const dynamic = "force-static";

export function generateStaticParams() {
  return SPLASH_SIZES.map((s) => ({ name: `${s.w}x${s.h}` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const spec = SPLASH_SIZES.find((s) => `${s.w}x${s.h}` === name);
  if (!spec) return new Response("Not found", { status: 404 });
  const mark = Math.round(Math.min(spec.w, spec.h) * 0.2);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #14183c 0%, #3b3a78 55%, #b0689a 100%)",
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 24 24" fill="none">
          <path
            d="M12.00 2.40 L14.81 5.21 L18.79 5.21 L18.79 9.19 L21.60 12.00 L18.79 14.81 L18.79 18.79 L14.81 18.79 L12.00 21.60 L9.19 18.79 L5.21 18.79 L5.21 14.81 L2.40 12.00 L5.21 9.19 L5.21 5.21 L9.19 5.21 Z"
            stroke="#f6e7b4"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="1.6" fill="#f6e7b4" />
        </svg>
      </div>
    ),
    { width: spec.w, height: spec.h },
  );
}
