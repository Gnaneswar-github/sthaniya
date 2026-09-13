import { PlanFlow } from "@/components/PlanFlow";
import { Footer, Nav } from "@/components/Shell";

export default async function Plan({ searchParams }: PageProps<"/plan">) {
  const params = await searchParams;
  const raw = params.q;
  const query = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-7">
        <PlanFlow query={query} />
      </main>
      <Footer />
    </>
  );
}
