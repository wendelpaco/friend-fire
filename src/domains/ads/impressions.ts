import { createId } from "@/shared/ids";
import type { AdImpression, AdPlacement } from "./types";

export function recordImpression(input: {
  placement: AdPlacement;
  creativeId: string;
  sessionId: string;
  now?: number;
}): AdImpression {
  return {
    id: createId("imp"),
    placement: input.placement,
    creativeId: input.creativeId,
    sessionId: input.sessionId,
    at: input.now ?? Date.now(),
  };
}
