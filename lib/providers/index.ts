import type { ImportedMatch, MatchProvider } from "../../types/data-provider";
import { createManualProvider } from "./manual";
import { createNifProvider } from "./nif";

export type ProviderName = "nif" | "manual";

export function getMatchProvider(name: ProviderName, manualMatches: ImportedMatch[] = []): MatchProvider {
  if (name === "manual") return createManualProvider(manualMatches);
  return createNifProvider();
}
