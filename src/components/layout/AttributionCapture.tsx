"use client";

import { useEffect } from "react";
import { readAttribution } from "@/lib/attribution";

/**
 * Records where the visit came from on the page it starts on, so the
 * registration form can submit it from any later page. Renders nothing, and
 * works in an effect, so server and client HTML are identical.
 */
export function AttributionCapture() {
  useEffect(() => {
    readAttribution();
  }, []);
  return null;
}
