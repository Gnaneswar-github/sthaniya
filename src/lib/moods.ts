/**
 * Trip moods, each with the first line it writes for the traveller. Kept apart from the destination
 * catalogue so the homepage's browser code can offer them without also downloading every city's
 * Wikipedia summary.
 */
export const MOODS = [
  { id: "slow", label: "Slow", prompt: "A slow few days with quiet mornings, long breakfasts and no fixed plans" },
  { id: "romantic", label: "Romantic", prompt: "A romantic trip — sunsets, small restaurants and walks worth taking slowly" },
  { id: "curious", label: "Curious", prompt: "A curious trip — odd museums, old neighbourhoods and things I can't explain to people back home" },
  { id: "energetic", label: "Energetic", prompt: "An energetic trip — long days, lots of ground covered, no wasted afternoons" },
  { id: "peaceful", label: "Peaceful", prompt: "Somewhere peaceful — parks, quiet temples and places I can sit without being hurried" },
  { id: "cultural", label: "Cultural", prompt: "A cultural trip — heritage, local food, markets and the neighbourhoods people actually live in" },
  { id: "adventurous", label: "Adventurous", prompt: "An adventurous trip — hills, early starts and getting properly out of the city" },
  { id: "creative", label: "Creative", prompt: "A creative trip — photography, good light, texture and street life" },
];

/** The little a homepage card needs about a city: never its summary text. */
export type CityPick = { id: string; name: string; thumbnailUrl: string | null };
