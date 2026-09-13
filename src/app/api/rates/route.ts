import { CURRENCIES } from "@/lib/currency/catalog";
import { rateProvider } from "@/lib/currency/rates";

/**
 * Exchange rates for the traveller's display currency. Whatever the provider can't cover
 * simply isn't in the response, and the UI shows no conversion for those — an approximate
 * rate presented confidently is worse than an honest gap.
 */
export async function GET(request: Request) {
  const base = new URL(request.url).searchParams.get("base")?.toUpperCase() ?? "USD";
  const quotes = CURRENCIES.map((c) => c.code).filter((code) => code !== base);

  try {
    const rates = await rateProvider.getRates(base, quotes);
    return Response.json({ base, rates, provider: rateProvider.name });
  } catch {
    return Response.json({ base, rates: {}, provider: rateProvider.name, degraded: true });
  }
}
