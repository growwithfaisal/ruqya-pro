import { Suspense, ViewTransition } from "react";
import type { Metadata, Viewport } from "next";
import { Amiri, Hedvig_Letters_Serif, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PwaRegister } from "@/components/PwaRegister";
import { SkyClock } from "@/components/SkyClock";
import { TabBar } from "@/components/TabBar";
import { OfflineSync } from "@/components/OfflineSync";
import { SPLASH_SIZES } from "@/lib/splash";

const display = Hedvig_Letters_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const ui = Schibsted_Grotesk({ variable: "--font-ui", subsets: ["latin"] });
const arabic = Amiri({ variable: "--font-arabic", subsets: ["arabic", "latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  applicationName: "RuqyaPro",
  appleWebApp: {
    capable: true,
    title: "RuqyaPro",
    statusBarStyle: "black-translucent",
    // Launch screens per device size, so the app opens on its own sky instead of a blank screen.
    startupImage: SPLASH_SIZES.map((s) => ({
      url: `/splash/${s.w}x${s.h}`,
      media: `(device-width: ${s.dw}px) and (device-height: ${s.dh}px) and (-webkit-device-pixel-ratio: ${s.r}) and (orientation: portrait)`,
    })),
  },
  // Next only writes the newer mobile-web-app-capable; iOS reads the apple- name to run edge to edge from the home screen.
  other: { "apple-mobile-web-app-capable": "yes" },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/180", sizes: "180x180", type: "image/png" }] },
  title: { default: "RuqyaPro", template: "%s · RuqyaPro" },
  description:
    "A calm guide to authentic ruqyah: recitations with a source you can open, on every card.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // let the sky run under the notch and home indicator when opened from the home screen
};

/**
 * Runs before paint: sets the sky from the real sun at the saved place (cached by SkyClock), else from device local time
 * (?sky=dawn|day|dusk|night overrides, for previewing) and restores the reader's Arabic size. No network, no location.
 */
const bootScript = `(function(){try{
var q=new URLSearchParams(location.search).get('sky');
var d=new Date(),h=d.getHours()+d.getMinutes()/60;
var s=(q&&/^(dawn|day|dusk|night)$/.test(q))?q:(h>=5&&h<8?'dawn':h>=8&&h<16.5?'day':h>=16.5&&h<19.5?'dusk':'night');
if(!q){var c=JSON.parse(localStorage.getItem('rp:v1:prayer:skybounds')||'null'),n=d.getTime();
if(c&&c.t&&c.d===d.toLocaleDateString('en-CA')&&n>=c.t[0][0]&&n<c.t[c.t.length-1][0]){for(var i=0;i<c.t.length;i++){if(c.t[i][0]<=n)s=c.t[i][1];}}}
document.documentElement.dataset.sky=s;
var tc={dawn:'#c6bff8',day:'#b4e7fc',dusk:'#411c49',night:'#060b22'}[s];
var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',tc);
var a=parseFloat(localStorage.getItem('rp:arabic')||'1');
if(a>=0.8&&a<=1.8)document.documentElement.style.setProperty('--arabic-scale',String(a));
var t=parseFloat(localStorage.getItem('rp:translit')||'1');
if(t>=0.8&&t<=1.8)document.documentElement.style.setProperty('--translit-scale',String(t));
}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${ui.variable} ${arabic.variable}`}>
      <head>
        <meta name="theme-color" content="#b4e7fc" />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="flex flex-col">
        {/*
          THESIS: the day is the interface. Light, colour and the orb's place on the arc follow the reader's own hour; the refused default is a green-crescent card dashboard.
          OWN-WORLD: four OKLCH sky palettes (dawn lilac-apricot, day aqua, dusk plum-ember, night indigo); a drifting eight-fold star lattice as hairline ornament; arch-niche recitation cards; Hedvig Letters Serif display, Schibsted Grotesk UI, Amiri for Arabic.
          STORY: a worried reader sees a calm sky, the right adhkar for the hour, and a citation on every dua; they recite, tick it off, and keep seeing a doctor.
          FIRST VIEWPORT: wordmark and menu on top; a sky arc with the sun or moon placed at the real hour, one display line for the hour, one primary action with today's progress ring; the four intents follow as ruled rows with the medical disclaimer beneath.
          FORM: sky-clock, brief-pinned (owner's brief overrides the dealt roll; seed 1e482c8c was dealt an oscilloscope and set aside).
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
        */}
        <div className="status-scrim" aria-hidden />
        <SkyBackdrop />
        <Header />
        <main id="main" className="flex-1"><ViewTransition default="page-fade">{children}</ViewTransition></main>
        <Footer />
        <Suspense fallback={null}><TabBar /></Suspense>
        <PwaRegister />
        <SkyClock />
        <OfflineSync />
      </body>
    </html>
  );
}
