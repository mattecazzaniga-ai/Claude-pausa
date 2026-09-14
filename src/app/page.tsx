import { Fraunces } from "next/font/google";
import { HomeClient } from "./home-client";

// Loaded only here — the landing is the one place in the app that uses a
// serif display face; everywhere else (dashboard, athlete pages, etc.)
// keeps the plain Geist Sans UI untouched.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-landing-serif",
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export default function Home() {
  return (
    <main className={`min-h-screen ${fraunces.variable}`}>
      <HomeClient />
    </main>
  );
}
