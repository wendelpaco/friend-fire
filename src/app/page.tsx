"use client";

import { useEffect, useState } from "react";
import { MainMenu } from "@/presentation/lobby/MainMenu";
import {
  SplashScreen,
  shouldSkipSplash,
} from "@/presentation/session/SplashScreen";

type HomePhase = "boot" | "splash" | "hub";

export default function Home() {
  const [phase, setPhase] = useState<HomePhase>("boot");

  useEffect(() => {
    setPhase(shouldSkipSplash() ? "hub" : "splash");
  }, []);

  if (phase === "boot") {
    return (
      <div
        className="min-h-screen bg-[color:var(--ff-void,#0a0c10)]"
        aria-hidden
      />
    );
  }

  if (phase === "splash") {
    return <SplashScreen onEnter={() => setPhase("hub")} />;
  }

  return <MainMenu />;
}
