import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Shell from "@/components/Shell";
import { ToastProvider } from "@/components/ui";
import { ensureRegistry } from "@/db/registry";
import { FiltersProvider } from "@/state/filters";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--ff-display",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--ff-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--ff-mono",
});

export const metadata: Metadata = {
  title: "KoboMerge — VAS Revenue Console",
  description:
    "Merge operator Excel exports, filter transactions by Service ID and monitor gross & net VAS revenue.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans text-ink-900 antialiased">
        <ToastProvider>
          <FiltersProvider>
            <Shell>{children}</Shell>
          </FiltersProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
