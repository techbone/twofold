# DoraHacks submission

**Project:** Twofold
**Track:** Modular Cloud & Middleware
**One-liner:** Every Portaldot token is already an ERC-20. Twofold makes it findable and usable.

_Paste-ready paragraph: fill at M4._

## Check-in (Oct 24 12:00 UTC)

- **Progress:** found and verified the ERC-20 precompile layout for Portaldot native assets
  (16/16 testnet assets match on both sides). `NativeAsset` library and `Disperse` contract are
  written, tested (10/10) and deployed. A headless e2e run on testnet launched a native asset,
  resolved it as an ERC-20, approved and paid 3 recipients through Solidity, and checked every
  balance from both the native and EVM side (3/3 agree). The web directory reads all of this live.
- **Outstanding:** browser launch flow (native wallet), browser disperse flow with named steps and
  recipient pre-checks, liquidity seeding on AssetConversion, decoding pallet errors through
  eth-rpc, demo video, pitch deck.
- **Repo:** https://github.com/techbone/twofold
- **Architecture:** https://github.com/techbone/twofold/blob/main/ARCHITECTURE.md
- **Contract address (Disperse):** 0x389a5f1e3897a3cad547af7d872a174f5d22205c
- **Deploy tx:** 0x7fc579376bb429bb27163ea2cb8fe6f4108811a1f84ad227a060de5054df1123 (block 162,880)
- **Disperse payout tx:** 0xb5dca03ec4f08ca0d0cd71644e4cfe38b5a28c7358b6a73e9d17f5f15bd484fe (block 162,890)
- **Native launch extrinsic:** 0xd62fdad837fd94a4ee377ae1603552d1399a6c6488b2e731d5a3876116a6300e
- **Explorer:** https://node-console.portaldot.dev/ (native only; no EVM explorer on this testnet)
- **Evidence:** https://github.com/techbone/twofold/blob/main/docs/evidence/e2e-latest.md
- **Demo:** live link (Vercel, pending) or a video of 3 minutes or less
