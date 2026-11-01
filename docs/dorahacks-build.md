# DoraHacks "Create a new Build" — paste-ready

**Name:** Twofold

**Brief description:** Launch a Portaldot token, find its ERC-20 address, and pay out to many holders, with every balance checked from both the native side and the EVM side.

**Tags:** Portaldot, pallet-assets, ERC-20, Foundry, Next.js, Modular Cloud & Middleware

**Project URL:** https://twofold-tau-sooty.vercel.app

**GitHub:** https://github.com/techbone/twofold

**Video:** unlisted upload of `twofold-demo.mp4` (2:08, narrated, captioned)

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

## Week 2 check-in form (submit for review)

**Build:** Twofold

**Track (both dropdowns):** Modular Cloud & Middleware

**Project name:** Twofold

**One-sentence overview:**

Twofold lets a team launch a Portaldot token, get its ERC-20 address straight away, and pay out to many holders, with every balance checked from both the native side and the EVM side.

**Current Project Progress:**

```
Everything below runs on the live Portaldot V3 testnet (chain 420420777). No mocks.

Contracts: NativeAsset.sol (asset id to ERC-20 precompile address) and Disperse.sol (batch payout of any native asset from one approval). 10 Foundry tests pass. Disperse is deployed.

Address layout: Portaldot's ERC-20 precompile address for a native asset isn't documented, and Polkadot Hub's prefix returns nothing here. We found the real layout by scanning every ERC-20 Transfer log on chain (asset id in the first 4 bytes, 0x0001 at bytes 16 to 18) and pinned tests to live pUSD and rUSD.

Web app (Next.js, deployed on Vercel): a directory of all 33 native assets with a native view and an ERC-20 view side by side (total supply matches on both sides for 33 of 33); /launch creates a token with one signature (utility.batchAll of create, setMetadata, mint); /payout pays many recipients from an EVM wallet (precheck, optional tPOT top-up, approve, Disperse, then verification of each balance on both sides).

Real wallet runs: launch signed in SubWallet (1,000,000 WL, asset 71369440, ERC-20 supply matched). 100 WL sent to a Rabby account and shown in Rabby. Payout signed from Rabby to 2 recipients, block 269,675, both sides agreed. Hashes are in docs/build-log.md.

Demo video: recorded, 2:08, narrated. It uses scripted wallets that sign real transactions, and says so on the end card.

Docs: README, ARCHITECTURE.md, build log with evidence.
```

**Outstanding Items:**

```
1. Upload the demo video and link it from the README.
2. Pitch deck.
3. README refresh: asset counts, cover screenshot, payout sequence diagram.
4. Try Add to MetaMask and the payout flow in MetaMask. So far only Rabby and a scripted wallet.
5. Find the exact revert reason when a recipient has no native account. The cause (no provider for a non-sufficient asset) is plausible but not proven.
6. Bug fixes from check-in feedback.

Not planned: liquidity seeding on AssetConversion (cut) and foreign XCM assets.
```

**GitHub Repository:**

```
https://github.com/techbone/twofold
```

**Testnet deployment details:**

```
Network: Portaldot V3 testnet, chain id 420420777, EVM RPC https://test-evm-rpc-v3.portaldot.dev
Disperse contract: 0x389a5f1e3897a3cad547af7d872a174f5d22205c
Deploy tx: 0x7fc579376bb429bb27163ea2cb8fe6f4108811a1f84ad227a060de5054df1123 (block 162,880)
Payout from Rabby: approve 0xedb8873a1b6db7ad09fc6f1153aad88c19c8ca60e92bf233411f7b623fa8e0d0, payout 0x95f01798c20f8ab415143215078a618387e3ff69f2a0836f043a74f764ce674e (block 269,675)
Demo asset TWO (native id 20261023): ERC-20 0x0135289f00000000000000000000000000010000
Live app: https://twofold-tau-sooty.vercel.app
Verify: cast call 0x00001E6100000000000000000000000000010000 "totalSupply()(uint256)" --rpc-url https://test-evm-rpc-v3.portaldot.dev
```

**Demo video link:** the unlisted YouTube/Vimeo/Loom URL, once uploaded.

**Pitch deck link:** not made yet. The form marks it required.

**Looking for teammates:** No
