import localFont from "next/font/local";

export const instrumentSans = localFont({
  src: [
    {
      path: "../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2",
      style: "normal",
    },
  ],
  variable: "--font-instrument-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const instrumentSerif = localFont({
  src: [
    {
      path: "../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2",
      style: "normal",
      weight: "400",
    },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
  fallback: ["Georgia", "serif"],
});
