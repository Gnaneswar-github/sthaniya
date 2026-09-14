import type { Metadata } from "next";
import { CloudTripView } from "@/components/CloudTripView";
import { Footer, Nav } from "@/components/Shell";

export const metadata: Metadata = { title: "Trip — Nativa", robots: { index: false } };

export default async function CloudTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Nav />
      <CloudTripView id={id} />
      <Footer />
    </>
  );
}
