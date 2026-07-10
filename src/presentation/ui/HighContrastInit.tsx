"use client";

import { useEffect } from "react";

/** Reads ff_high_contrast from localStorage and sets data-ff-high-contrast on <html>. */
export function HighContrastInit() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ff_high_contrast");
      if (raw === "true") {
        document.documentElement.setAttribute("data-ff-high-contrast", "true");
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
