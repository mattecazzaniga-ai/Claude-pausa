import { Nav } from "@/components/nav";
import { HomeClient } from "./home-client";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Nav />
      <HomeClient />
    </main>
  );
}
