import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RuqyaPro",
    short_name: "RuqyaPro",
    description: "A calm guide to authentic ruqyah, with a source on every dua.",
    start_url: "/?source=homescreen",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#b4e7fc",
    theme_color: "#b4e7fc",
    categories: ["lifestyle", "education"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
