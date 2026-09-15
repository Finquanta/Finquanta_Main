"use client";

import { useEffect, useState } from "react";
import { clearBetaFeaturesCache, getMyBetaFeaturesShared } from "@/lib/api/betaFeatures";

export type BetaFeatureState = "loading" | "on" | "off";

/**
 * Is this beta feature on for the active workspace — or not known yet?
 *
 * For callers that must tell "not answered yet" from "off", such as sending a
 * deep link to a beta-only tab elsewhere once it is known to be unavailable.
 * Re-asks when the workspace changes, keeping the last answer meanwhile. Pass
 * `enabled = false` where there is no signed-in session (the Try-It Demo), so
 * no request is made at all.
 */
export function useBetaFeatureState(key: string, enabled = true): BetaFeatureState {
  const [state, setState] = useState<BetaFeatureState>(enabled ? "loading" : "off");

  useEffect(() => {
    if (!enabled) {
      setState("off");
      return;
    }
    let alive = true;
    const load = () => {
      getMyBetaFeaturesShared()
        .then((features) => { if (alive) setState(features.includes(key) ? "on" : "off"); })
        .catch(() => { if (alive) setState("off"); });
    };
    const onWorkspaceChange = () => {
      clearBetaFeaturesCache();
      load();
    };
    load();
    window.addEventListener("finna:businessChanged", onWorkspaceChange);
    return () => {
      alive = false;
      window.removeEventListener("finna:businessChanged", onWorkspaceChange);
    };
  }, [key, enabled]);

  return state;
}

/**
 * Is this beta feature on for the active workspace?
 *
 * False until the answer arrives, so a beta-only link never flashes in and out.
 */
export function useBetaFeature(key: string, enabled = true): boolean {
  return useBetaFeatureState(key, enabled) === "on";
}
