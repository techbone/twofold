# DoraHacks "Create a new Build" — paste-ready

**Name:** Twofold

**Brief description:** Launch a Portaldot token, find its ERC-20 address, and pay out to many holders, with every balance checked from both the native side and the EVM side.

**Tags:** Portaldot, pallet-assets, ERC-20, Foundry, Next.js, Modular Cloud & Middleware

**Project URL:** https://twofold-tau-sooty.vercel.app

**GitHub:** https://github.com/techbone/twofold

**Video:** unlisted upload of `twofold-demo.mp4` (about 2.5 minutes, silent, captioned)

**Logo:** `twofold-logo-512.png`

## Description (paste into the editor)

### The problem

Every token created on Portaldot with `pallet-assets` is already an ERC-20: the runtime exposes it through a
precompile, so MetaMask, Solidity and EVM tooling can use it with no bridge and no wrapper contract. But the
address layout isn't documented, and the obvious lookups return nothing. Polkadot Hub's documented prefix
(`0x0120`) returns empty on Portaldot, and the `assetsPrecompiles` pallet index points at the wrong thing.
Teams either never reach the EVM side or deploy a duplicate ERC-20 beside their native asset and split liquidity.

We found the real layout by scanning every ERC-20 `Transfer` log on chain: the asset id sits in the first
4 bytes and the prefix `0x0001` at bytes 16 to 18. Two unit tests pin the library to live pUSD and rUSD addresses.

### What Twofold does

| Capability | What you do | Portaldot calls behind it |
|---|---|---|
| Browse | Open the directory | `assets.asset`, `assets.metadata` storage plus precompile `totalSupply` and `decimals` |
| Launch | One native signature | `utility.batchAll[assets.create, setMetadata, mint]` |
| Hold | Add to MetaMask or Rabby | `wallet_watchAsset`, precompile `balanceOf` |
| Pay out | Paste recipients, approve, pay | precompile `approve`, then `Disperse.disperseAsset` |

Every step shows named stages with the transaction hash. After a launch or a payout, each balance is read from
pallet-assets and from the ERC-20 precompile, and the screen only says "verified" when both agree.

### What is real

- `NativeAsset.sol` (asset id to precompile address) and `Disperse.sol` are tested (10 Foundry tests) and
  deployed: Disperse at `0x389a5f1e3897a3cad547af7d872a174f5d22205c` on chain 420420777.
- The directory reads every native asset live (33 when we last checked), and total supply matches on both sides for all of them.
- Launch was signed in SubWallet from the browser. Payout was signed from Rabby. The build log has the hashes.
- A recipient with no tPOT can't hold this token. The payout page checks this first and can top recipients up,
  instead of letting the whole batch revert.

### Not built, stated plainly

- Liquidity seeding on AssetConversion was cut. Foreign (XCM) assets are not handled.
- The payout page is untested in MetaMask. The demo video uses scripted wallets that sign real transactions.
- There is no EVM explorer on this testnet, so transaction hashes are copyable text.

### Tech stack

Foundry and solc 0.8.30 for contracts. Next.js 16, Tailwind 4, `@polkadot/api` for native calls, viem for EVM.
No backend and no database: chain state is the source of truth.

### Verify it yourself

```sh
cast call 0x00001E6100000000000000000000000000010000 "totalSupply()(uint256)" \
  --rpc-url https://test-evm-rpc-v3.portaldot.dev
cd contracts && forge test
```

Full evidence: `docs/evidence/e2e-latest.md` and `docs/build-log.md` in the repo.
