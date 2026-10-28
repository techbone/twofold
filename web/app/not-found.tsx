import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteShell";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-3 px-4 py-24 sm:px-6">
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em]">No such asset</h1>
        <p className="max-w-md text-[14px] text-muted">
          There is no native asset with that id on the Portaldot testnet.
        </p>
        <Link href="/" className="text-[13px] text-accent hover:underline">
          Back to all assets
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
