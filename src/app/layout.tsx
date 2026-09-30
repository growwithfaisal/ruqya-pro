import type { Metadata, Viewport } from "next";
import { Amiri, Hedvig_Letters_Serif, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PwaRegister } from "@/components/PwaRegister";

const display = Hedvig_Letters_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const ui = Schibsted_Grotesk({ variable: "--font-ui", subsets: ["latin"] });
const arabic = Amiri({ variable: "--font-arabic", subsets: ["arabic", "latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  applicationName: "RuqyaPro",
  appleWebApp: { capable: true, title: "RuqyaPro", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/180", sizes: "180x180", type: "image/png" }] },
  title: { default: "RuqyaPro", template: "%s · RuqyaPro" },
  description:
    "A calm guide to authentic ruqyah: recitations with a source you can open, red flags for scammers, and wellness alongside medical care.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // let the sky run under the notch and home indicator when opened from the home screen
};

/**
 * Runs before paint: sets the sky from device local time (?sky=dawn|day|dusk|night overrides,
 * for previewing) and restores the reader's Arabic size. No network, no location.
 */
const bootScript = `(function(){try{
var q=new URLSearchParams(location.search).get('sky');
var d=new Date(),h=d.getHours()+d.getMinutes()/60;
var s=(q&&/^(dawn|day|dusk|night)$/.test(q))?q:(h>=5&&h<8?'dawn':h>=8&&h<16.5?'day':h>=16.5&&h<19.5?'dusk':'night');
document.documentElement.dataset.sky=s;
var tc={dawn:'#c6bff8',day:'#b4e7fc',dusk:'#411c49',night:'#060b22'}[s];
var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',tc);
var a=parseFloat(localStorage.getItem('rp:arabic')||'1');
if(a>=0.8&&a<=1.8)document.documentElement.style.setProperty('--arabic-scale',String(a));
}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-sky="day" suppressHydrationWarning className={`${display.variable} ${ui.variable} ${arabic.variable}`}>
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
        <SkyBackdrop />
        <Header />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
        <PwaRegister />
      </body>
    </html>
  );
}
