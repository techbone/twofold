import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Twofold home">
          <Logo />
        </Link>
        <span className="flex items-center gap-2 text-[12px] text-muted">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          Portaldot V3 testnet
          <span className="num hidden text-faint sm:inline">chain 420420777</span>
        </span>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-[12px] text-muted sm:px-6">
        <span>Built for the Portaldot V3 Hacker House. Testnet only.</span>
        <a className="hover:text-text" href="https://github.com/techbone/twofold">
          Source on GitHub
        </a>
      </div>
    </footer>
  );
}
