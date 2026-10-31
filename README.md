# Twofold

![tests](https://img.shields.io/badge/tests-10_passing-30A46C) ![e2e](https://img.shields.io/badge/e2e-3%2F3_balances_agree_both_sides-30A46C) ![assets](https://img.shields.io/badge/directory-16%2F16_supplies_match-30A46C) ![rails](https://img.shields.io/badge/rails-Portaldot_V3_testnet-E5484D) ![stack](https://img.shields.io/badge/stack-Foundry_·_Next.js_·_@polkadot/api_·_viem-555)

### Every Portaldot token is already an ERC-20, but nobody can find it.

Twofold is for teams launching tokens on Portaldot. You create a native asset, get its ERC-20
address straight away, hold it in MetaMask, seed a pool and pay out to many holders from
Solidity, all on the live Portaldot V3 testnet with no mocks. Every balance is checked from both
the native side and the EVM side.

**Watch the demo** (soon) · [**Live app**](https://twofold-tau-sooty.vercel.app) · [**Verify it yourself**](#verify-it-yourself-in-60-seconds) · [**Architecture**](ARCHITECTURE.md) · [**Run it locally**](#run-it-locally)

## Verify it yourself in 60 seconds

**Deployed on Portaldot V3 testnet (chain 420420777)**

| What | Value |
|---|---|
| `Disperse` contract | `0x389a5f1e3897a3cad547af7d872a174f5d22205c` |
| Deploy tx | `0x7fc579376bb429bb27163ea2cb8fe6f4108811a1f84ad227a060de5054df1123` (block 162,880) |
| Demo asset TWO (native id 20261023) | ERC-20 at `0x0135289f00000000000000000000000000010000` |
| Disperse payout tx | `0xb5dca03ec4f08ca0d0cd71644e4cfe38b5a28c7358b6a73e9d17f5f15bd484fe` (block 162,890) |
| Native launch extrinsic | `0xd62fdad837fd94a4ee377ae1603552d1399a6c6488b2e731d5a3876116a6300e` |
| Native explorer | [node-console.portaldot.dev](https://node-console.portaldot.dev/) (there is no EVM explorer on this testnet yet) |

pUSD is native asset 7777. Its ERC-20 precompile answers directly over eth-rpc:

```sh
cast call 0x00001E6100000000000000000000000000010000 "totalSupply()(uint256)" \
  --rpc-url https://test-evm-rpc-v3.portaldot.dev
# 100000000000 [1e11]   → 100,000.000000 pUSD (6 decimals)
```

The contract is live:

```sh
cast code 0x389a5f1e3897a3cad547af7d872a174f5d22205c --rpc-url https://test-evm-rpc-v3.portaldot.dev | wc -c
# 2677   → 1,337 bytes, same as `forge build --sizes`
cast receipt 0xb5dca03ec4f08ca0d0cd71644e4cfe38b5a28c7358b6a73e9d17f5f15bd484fe status \
  --rpc-url https://test-evm-rpc-v3.portaldot.dev
# 1 (success)
```

```sh
cd contracts && forge test
# Ran 2 test suites: 10 tests passed, 0 failed
```

The full end-to-end run (launch → resolve → approve → disperse → check both sides) is in
[docs/evidence/e2e-latest.md](docs/evidence/e2e-latest.md). Reproduce it with `cd scripts && npm run e2e`.

## Contents

- [The problem](#the-problem)
- [What it does](#what-it-does)
- [Architecture](#architecture)
- [The hard problem](#the-hard-problem-the-erc-20-that-wasnt-where-the-docs-said)
- [What's real vs simplified](#whats-real-vs-simplified)
- [Run it locally](#run-it-locally)
- [Disclosure](#known-limitations-and-disclosure)

## The problem

Teams on Portaldot create tokens as native `pallet-assets` assets. There are 16 on testnet
today, including pUSD, rUSD and PORT. The runtime already exposes each one as an ERC-20 through
a precompile, but the address layout isn't documented, and the obvious lookups return nothing.
So teams either never reach the EVM side or deploy a second ERC-20 next to their native asset
and split their liquidity.

Take out Portaldot's native assets, the assets precompile and AssetConversion, and every flow
below disappears.

## What it does

| Capability | What the user does | Portaldot calls behind it |
|---|---|---|
| Launch | One native signature | `utility.batchAll[assets.create, setMetadata, mint]` |
| Resolve | Paste an asset id | precompile `0x{id:u32}…0001 0000` → `totalSupply`, `decimals` |
| Hold in MetaMask | Add to MetaMask | `wallet_watchAsset`, `balanceOf` |
| Cross sides | Send to a 0x address | `assets.transferKeepAlive` to `h160 ‖ 0xEE×12` |
| Liquidity | Seed a tPOT pool | `assetConversion.createPool`, `addLiquidity` |
| Pay out | Approve → disperse | precompile `approve` → `Disperse.disperseAsset` |

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system diagram, components and milestones.

| Contract | Role |
|---|---|
| `NativeAsset.sol` | Asset id ↔ ERC-20 precompile address |
| `Disperse.sol` | Batch payouts of any native asset from one approval; holds no funds |

## The hard problem: the ERC-20 that wasn't where the docs said

Polkadot Hub documents the assets precompile at `0x{id}…0120 0000`. On Portaldot that returns
nothing. The runtime also has an `AssetsPrecompiles` pallet that maps pUSD to index 6, which
looks like the answer and isn't. We pulled every ERC-20 `Transfer` log on chain, found two
emitters with the precompile shape, and confirmed the real layout:
**asset id in the first 4 bytes, prefix `0x0001` at bytes 16–18.** Two tests now pin the library
to live pUSD and rUSD addresses. The full trail is in [docs/build-log.md](docs/build-log.md).

## What's real vs simplified

| Capability | How it's backed | Status |
|---|---|---|
| Asset id → ERC-20 address | Live precompile calls; 16/16 testnet assets match; unit tests pinned to pUSD/rUSD | Real |
| Disperse | Deployed on pallet-revive; e2e payout to 3 recipients agreed on both sides | Real |
| Launch a native asset | `utility.batchAll[create, setMetadata, mint]`, from the e2e script and from the browser | Real. `/launch` was signed in SubWallet and minted 1,000,000 WL (native id 71369440), and the ERC-20 supply matched |
| Hold it in an EVM wallet | `wallet_addEthereumChain`, `wallet_watchAsset`, precompile `balanceOf` | Real. After 100 WL were sent to the account's `h160 ‖ 0xEE×12` form, Rabby showed 100 WL. Not yet tried in MetaMask |
| Asset directory web app | Reads pallet-assets and the precompile on every request | Real |
| Liquidity seeding | — | Not built yet |
| Foreign (XCM) assets | — | Not built |

## Tech stack and project layout

```
contracts/   Foundry: NativeAsset library, Disperse contract, tests
scripts/     deploy and e2e against the live testnet (@polkadot/api + viem)
web/         Next.js asset directory: both views of every native asset
docs/        build log, evidence from e2e runs, demo script, submission text
```

## Run it locally

```sh
git clone --recursive git@github.com:techbone/twofold.git && cd twofold
cp .env.example .env            # fill in testnet keys; fund ISSUER_ADDRESS with ~200 tPOT
cd contracts && forge test && forge build
cd ../scripts && npm install
npm run deploy                  # funds the EVM deployer, deploys Disperse (~118 tPOT incl. storage deposit)
npm run e2e                     # writes docs/evidence/e2e-latest.md
cd ../web && npm install && npm run dev
```

## Known limitations and disclosure

Built for the Portaldot Network V3 Hacker House (DoraHacks), Modular Cloud & Middleware track.
First commit 2026-10-23. Uses Foundry's `forge-std` (MIT/Apache-2.0). Testnet only; not financial advice.
