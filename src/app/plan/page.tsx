import { PlanFlow } from "@/components/PlanFlow";
import { Footer, Nav } from "@/components/Shell";

export default async function Plan({ searchParams }: PageProps<"/plan">) {
  const params = await searchParams;
  const raw = params.q;
  const query = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  return (
    <>
      <Nav />
      {/* The flow owns its own banner: the phase changes as the trip comes into being. */}
      <PlanFlow query={query} />
      <Footer />
    </>
  );
}
