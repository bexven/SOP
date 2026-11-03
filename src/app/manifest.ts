import type { MetadataRoute } from "next";

/** Lets people add Product SOP to their phone's home screen (needed for push on iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Product SOP",
    short_name: "Product SOP",
    description: "Product launch pipeline and tasks",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f6fb",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
