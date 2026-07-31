import type { Metadata } from "next";
import { DartsGame } from "./game/DartsGame";

const isSiteBuild = process.env.DART_ROOM_BUILD_TARGET === "site";
const canonicalPath = isSiteBuild ? "/projects/dart-room/play" : "/";
const assetBasePath = isSiteBuild ? "/project-apps/dart-room" : "";

export const metadata: Metadata = {
  title: "Dart Room — Play 3D Darts in Your Browser",
  description:
    "Play Count Up, 301, or Cricket in a polished 3D browser darts game. Challenge the CPU or share the board with a friend.",
  alternates: { canonical: canonicalPath },
  robots: { index: !isSiteBuild, follow: !isSiteBuild },
  openGraph: {
    title: "Dart Room — Free 3D Browser Darts",
    description: "Flick a dart, chase a checkout, and challenge your friends. No download or account required.",
    type: "website",
    url: canonicalPath,
    images: [{ url: `${assetBasePath}/game-og.png`, width: 1672, height: 941, alt: "Dart Room — play 3D darts in your browser" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dart Room — Free 3D Browser Darts",
    description: "Play Count Up, 301, and Cricket against the CPU or a friend.",
    images: [`${assetBasePath}/game-og.png`],
  },
};

export default function Home() {
  return <DartsGame />;
}
