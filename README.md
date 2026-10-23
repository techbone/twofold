# Twofold

![tests](https://img.shields.io/badge/tests-10_passing-30A46C) ![rails](https://img.shields.io/badge/rails-Portaldot_V3_testnet-E5484D) ![stack](https://img.shields.io/badge/stack-Foundry_·_Next.js_·_@polkadot/api_·_viem-555)

### Every Portaldot token is already an ERC-20, but nobody can find it.

Twofold is for teams launching tokens on Portaldot. You create a native asset, get its ERC-20
address straight away, hold it in MetaMask, seed a pool and pay out to many holders from
Solidity, all on the live Portaldot V3 testnet with no mocks. Every balance is checked from both
the native side and the EVM side.

**Watch the demo** (soon) · **Live app** (soon) · [**Verify it yourself**](#verify-it-yourself-in-60-seconds) · [**Architecture**](ARCHITECTURE.md) · [**Run it locally**](#run-it-locally)

## Verify it yourself in 60 seconds

pUSD is native asset 7777. Its ERC-20 precompile answers directly over eth-rpc:

```sh
cast call 0x00001E6100000000000000000000000000010000 "totalSupply()(uint256)" \
  --rpc-url https://test-evm-rpc-v3.portaldot.dev
# 100000000000 [1e11]   → 100,000.000000 pUSD (6 decimals)
```

```sh
cd contracts && forge test
# Ran 2 test suites: 10 tests passed, 0 failed
```

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
| Asset id → ERC-20 address | Live precompile calls, tested against pUSD/rUSD | Real |
| Disperse | Solidity on pallet-revive, unit tested | Real (testnet deploy pending) |
| Launch, liquidity, web app | — | In progress |
| Foreign (XCM) assets | — | Not built |

## Tech stack and project layout

```
contracts/   Foundry: NativeAsset library, Disperse contract, tests, deploy script
docs/        build log, evidence from e2e runs, demo script, submission text
```

## Run it locally

```sh
git clone --recursive git@github.com:techbone/twofold.git && cd twofold
cp .env.example .env            # fill in testnet keys
cd contracts && forge test
```

## Known limitations and disclosure

Built for the Portaldot Network V3 Hacker House (DoraHacks), Modular Cloud & Middleware track.
First commit 2026-10-23. Uses Foundry's `forge-std` (MIT/Apache-2.0). Testnet only; not financial advice.
