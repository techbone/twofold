# Agent notes for Twofold

Read `ARCHITECTURE.md` first. Keep it updated when a decision changes.

## Stack gotchas (Portaldot V3 testnet, runtime `portaldot-v3` 3002)

- EVM is **pallet-revive** behind `eth-rpc`, not Frontier. `allowEVMBytecode: true`, so plain solc
  output deploys. Chain id 420420777.
- Native token tPOT has **14 decimals**; eth-rpc shows 18 (`nativeToEthRatio` 10,000). Convert at the edge.
- Gas figures are huge (~10^14) and gas price tiny (~33k wei) because weight and storage deposit
  are folded into gas. Never hardcode Ethereum gas limits.
- Storage deposit: 0.06 tPOT per byte, 0.15 per item. Deploying Disperse (1.3 KB) actually cost
  117.5 tPOT (code deposit plus the 30% code-hash lockup), not the ~80 estimated from bytes alone.
- **Asset ERC-20 precompile address** = `asset id (u32 BE, 4 bytes) ‖ 12 zero bytes ‖ 0x0001 ‖ 0x0000`.
  pUSD (7777) → `0x00001E6100000000000000000000000000010000`. `assetsPrecompiles.*Index*` storage
  is for foreign assets only; don't use it for local ids.
- EVM address `0xH` ↔ native account `H ‖ 0xEE×12`. Send native assets/tPOT there to fund a MetaMask account.
- Asset accounts need a provider: a fresh address with no tPOT can't receive a non-sufficient asset.
  Asset account deposit is 1 tPOT; ED is 0.1 tPOT.
- Asset/pool costs: create 1 tPOT, metadata 0.1 + 0.06/byte, pool setup 1 tPOT, LP fee 0.3%.
- Explorer: `https://node-console.portaldot.dev/` (native). No EVM explorer exists; link tx hashes
  through our own pages.

## Commits

Short conventional commits, one line, lowercase, no trailing period, no body, no co-author or
"generated with" lines. Commit at sensible points within a milestone.

## Design rules (web/)

Target feel: Linear, Vercel, Stripe. It must not look AI-generated.

- **Type:** headings in Geist (tight tracking, -0.02em at 28px+); body Inter 14/15px; Geist Mono for
  every address, hash, id and amount, with `font-variant-numeric: tabular-nums`.
- **Scale:** 12 / 13 / 14 / 16 / 20 / 28 / 40. Spacing on a 4px grid (4, 8, 12, 16, 24, 32, 48, 64).
- **Colour:** neutrals from zinc, plus one accent `#E5484D` (Portaldot-adjacent red), used for primary
  actions and focus only. Success `#30A46C`, warning `#F5A524`. Dark mode is designed: bg `#0B0B0C`,
  surface `#141416`, border `#232326`, not an inversion.
- **Radii:** 6px controls, 10px cards. Borders over shadows; one subtle shadow for popovers only.
- **Icons:** Lucide only, 16px, stroke 1.5, muted colour.
- **Components:** dense tables for data; every async action shows named steps
  (approve → submit → in block → verified) with the tx hash linked; explicit empty/loading/error states.
- **Never:** gradients, gradient text, glow, glassmorphism, emoji icons, sparkles, "AI-powered",
  centered template hero with three feature cards, filler copy ("seamless", "unlock", "next-gen").
- **Copy:** plain and specific, written for a dev launching a token. Show real numbers.
- Before calling a screen done: would anyone guess an AI made this? If yes, fix it.
