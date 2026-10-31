import type { Metadata } from "next";
import { Suspense } from "react";
import { PayoutForm } from "@/components/PayoutForm";
import { SiteFooter, SiteHeader } from "@/components/SiteShell";

export const metadata: Metadata = { title: "Pay out — Twofold" };

export default function PayoutPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <div className="max-w-xl py-10 md:py-12">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em]">
            Pay out a token
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Send a native Portaldot asset to many addresses from one approval. Recipients are checked first, and every
            balance is confirmed from both the native side and the ERC-20 side afterwards.
          </p>
        </div>
        <Suspense>
          <PayoutForm />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
