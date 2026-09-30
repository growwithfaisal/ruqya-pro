import { ImageResponse } from "next/og";

// Home-screen icons, drawn at build time. Abstract eight-point star on a night-to-dawn sky; no figures.
const SIZES: Record<string, { size: number; pad: number }> = {
  "180": { size: 180, pad: 0.24 },
  "192": { size: 192, pad: 0.22 },
  "512": { size: 512, pad: 0.22 },
  // Maskable icons keep the mark inside the central 60% so any OS mask can crop the edges.
  maskable: { size: 512, pad: 0.32 },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(SIZES).map((name) => ({ name }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const spec = SIZES[name];
  if (!spec) return new Response("Not found", { status: 404 });
  const inner = Math.round(spec.size * (1 - spec.pad * 2));

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
        <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
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
    { width: spec.size, height: spec.size },
  );
}
