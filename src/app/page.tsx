import { Planner } from "@/components/Planner";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10">
      <header className="mb-10">
        <h1 className="font-display text-2xl tracking-tight text-ink">Sthānīya</h1>
        <p className="mt-1 text-sm text-ink-faint">Travel like a local. Plan like you know the city.</p>
      </header>

      <Planner />

      <footer className="mt-16 border-t border-line pt-5 text-xs text-ink-faint">
        Built for people with one afternoon and no local friend to ask.
      </footer>
    </main>
  );
}
