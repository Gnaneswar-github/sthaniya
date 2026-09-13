import type { Metadata } from "next";
import { SharedTrip } from "@/components/SharedTrip";
import { Footer, Nav } from "@/components/Shell";

export const metadata: Metadata = {
  title: "A shared trip — Sthānīya",
  description: "A trip someone planned on Sthānīya and shared with you.",
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
