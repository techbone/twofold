import type { Metadata } from "next";
import { LaunchForm } from "@/components/LaunchForm";
import { SiteFooter, SiteHeader } from "@/components/SiteShell";

export const metadata: Metadata = { title: "Launch a token — Twofold" };

export default function LaunchPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <div className="max-w-xl py-10 md:py-12">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em]">
            Launch a token
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Create a native Portaldot asset from your wallet. It is an ERC-20 the moment it exists, so you can use it
            from MetaMask and Solidity straight away.
          </p>
        </div>
        <LaunchForm />
      </main>
      <SiteFooter />
    </div>
  );
}
