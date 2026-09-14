import type { Metadata } from "next";
import { SharedTrip } from "@/components/SharedTrip";
import { Footer, Nav } from "@/components/Shell";

export const metadata: Metadata = {
  title: "A shared trip — Nativa",
  description: "A trip someone planned on Nativa and shared with you.",
};

export default function SharedTripPage() {
  return (
    <>
      <Nav />
      <SharedTrip />
      <Footer />
    </>
  );
}
