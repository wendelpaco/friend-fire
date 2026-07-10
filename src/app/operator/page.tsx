"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { OperatorSelect } from "@/presentation/session/OperatorSelect";

function OperatorPageInner() {
  const search = useSearchParams();
  const next = search.get("next");
  return <OperatorSelect next={next} />;
}

export default function OperatorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[color:var(--ff-void,#0a0c10)]" />
      }
    >
      <OperatorPageInner />
    </Suspense>
  );
}
