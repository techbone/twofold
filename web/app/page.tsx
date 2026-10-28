import { Suspense } from "react";
import { AssetLookup } from "@/components/AssetLookup";
import { AssetTable, AssetTableSkeleton } from "@/components/AssetTable";
import { SiteFooter, SiteHeader } from "@/components/SiteShell";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <section className="grid gap-8 py-12 md:grid-cols-[minmax(0,1fr)_400px] md:items-start md:py-16">
          <div className="min-w-0 max-w-xl">
            <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[40px]">
              Every Portaldot token is already an ERC-20.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Assets created with pallet-assets are exposed to the EVM through a precompile at a fixed
              address. You don&apos;t need a bridge or a wrapper contract, just the address. Twofold
              resolves it for every asset and checks the supply from the native side and the ERC-20
              side.
            </p>
          </div>
          <AssetLookup />
        </section>

        <Suspense fallback={<AssetTableSkeleton />}>
          <AssetTable />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
