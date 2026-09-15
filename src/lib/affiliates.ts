import { cleanEnvValue } from "./env";
import type { TravellerType } from "./types";

/**
 * Booking links. They work today as plain search links into GetYourGuide, Viator and
 * Booking.com; the moment partner IDs are added to the environment the same links carry them
 * and earn commission. Nothing about what we recommend depends on whether a link pays.
 */

export type AffiliateIds = { getYourGuide?: string; viator?: string; booking?: string };

export const AFFILIATE_IDS: AffiliateIds = {
  getYourGuide: cleanEnvValue(process.env.NEXT_PUBLIC_GYG_PARTNER_ID),
  viator: cleanEnvValue(process.env.NEXT_PUBLIC_VIATOR_PID),
  booking: cleanEnvValue(process.env.NEXT_PUBLIC_BOOKING_AID),
};

export const earnsCommission = (ids: AffiliateIds = AFFILIATE_IDS) => Boolean(ids.getYourGuide || ids.viator || ids.booking);

export type BookingLink = { url: string; provider: string };

/** Tours and tickets for a place or a city. GetYourGuide unless only a Viator ID is configured. */
export function toursLink(query: string, ids: AffiliateIds = AFFILIATE_IDS): BookingLink {
  if (!ids.getYourGuide && ids.viator) {
    const params = new URLSearchParams({ text: query, pid: ids.viator, mcid: "42383", medium: "link" });
    return { url: `https://www.viator.com/searchResults/all?${params}`, provider: "Viator" };
  }
  const params = new URLSearchParams({ q: query });
  if (ids.getYourGuide) params.set("partner_id", ids.getYourGuide);
  return { url: `https://www.getyourguide.com/s/?${params}`, provider: "GetYourGuide" };
}

export function adultsFor(travellerType: TravellerType): number {
  return travellerType === "solo" || travellerType === "business" ? 1 : 2;
}

/** Places to stay for the trip's own dates and party — the real headcount when the traveller gave one. */
export function staysLink(
  input: { city: string; checkin: string; checkout: string; travellerType: TravellerType; adults?: number; children?: number },
  ids: AffiliateIds = AFFILIATE_IDS,
): BookingLink {
  const params = new URLSearchParams({
    ss: input.city,
    checkin: input.checkin,
    checkout: input.checkout,
    group_adults: String(input.adults ?? adultsFor(input.travellerType)),
    no_rooms: "1",
  });
  if (input.children && input.children > 0) params.set("group_children", String(input.children));
  if (ids.booking) params.set("aid", ids.booking);
  return { url: `https://www.booking.com/searchresults.html?${params}`, provider: "Booking.com" };
}
