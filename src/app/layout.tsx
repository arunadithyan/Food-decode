import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";

export const metadata: Metadata = {
  title: { default: "FoodDecode", template: "%s · FoodDecode" },
  description: "Personalised, explainable food-label intelligence for Indian packaged foods.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#10302C", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
