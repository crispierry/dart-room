import type { Metadata } from "next";
import "./globals.css";
import { instrumentSans, instrumentSerif } from "./fonts";

const SITE_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_SITE_URL
    ?? process.env.URL
    ?? "http://localhost:3000",
);

export const metadata: Metadata = {
  metadataBase: SITE_ORIGIN,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${instrumentSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
