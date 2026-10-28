# Build log

Each time the rails or our code surprised us: the dead end, the path chosen, the test that guards it.

## 2026-10-23 — The ERC-20 that wasn't where the docs said

- **Expected:** Polkadot Hub's assets precompile layout, `0x{id}000…0120 0000`. Got empty `0x` for
  pUSD (7777) and for asset 1.
- **Dead end 2:** this runtime has an `AssetsPrecompiles` pallet with `assetIndexToForeignAssetId`
  (pUSD → index 6). Index-based addresses with prefixes 0x0120/0x0220/0x0320/… all returned empty.
- **What worked:** pulled every ERC-20 `Transfer` log on chain (`eth_getLogs` from block 0). Two log
  emitters had the precompile shape: `0x00001e61…00010000` (7777) and `0x00001e5a…00010000` (7770).
  Layout is **asset id in the first 4 bytes, prefix `0x0001` at bytes 16..18**. `totalSupply()` and
  `decimals()` on those addresses return pUSD's real values (100,000.000000, 6).
- **Guard:** `test_toAddress_matchesLivePusd`, `test_toAddress_matchesLiveRusd`, `testFuzz_roundTrip`.

## 2026-10-23 — Native balance isn't spendable from MetaMask

- Test tPOT lands on the native `5…` account. pallet-revive maps an EVM address `0xH` to native
  `H ‖ 0xEE×12`, so funding MetaMask means sending to that account's SS58 form.
- **Guard:** e2e script derives the fallback account and checks the balance from both sides.

## 2026-10-23 — Deploy cost 47% more than the byte count said

- Estimated ~80 tPOT from `depositPerByte` × 1,337 bytes. The actual deploy took **117.5 tPOT**.
  The difference fits `codeHashLockupDepositPercent: 30%` plus per-item deposits.
- **Path chosen:** `scripts/deploy.ts` measures the real cost (native balance before and after) and
  records it in `docs/evidence/deployments.json` instead of trusting the estimate.

## 2026-10-23 — Paying a brand-new address fails until it exists natively

- `disperseAsset` simulated to three fresh EVM addresses **reverted**. After sending each fallback
  account 0.2 tPOT (above the 0.1 ED), the identical call succeeded. This is consistent with
  pallet-assets refusing to create an account for a non-sufficient asset when the receiver has no
  provider. The revert reason isn't surfaced through eth-rpc yet; decoding it is on the list.
- **Product consequence:** the disperse flow must check each recipient's native existence first and
  offer to fund them in the same session, rather than let one bad row revert the whole batch.
- **Guard:** `npm run e2e` simulates the unfunded case on every run and records the result.

## 2026-10-28 — The live site took 15 seconds, then the chain stopped

- **Cold start:** the first request after a deploy took 15.3s; repeats 2.5–3.6s. Cause: `ApiPromise.create`
  downloads the full runtime metadata (1.1 MB) on every cold start, ~7.7s from here.
- **Path chosen:** bundle the metadata (`web/lib/metadata.json`, refresh with `npm run metadata`) keyed by
  genesis hash and spec version. Connect time 7.7s → 2.3s. If the runtime upgrades, the key no longer
  matches and @polkadot/api fetches fresh metadata itself. Also batch the EVM `totalSupply()` calls and
  discard a failed or dropped connection so a dead promise isn't reused.
- **The testnet stopped:** latest block 232,115 stamped 12:45:54 UTC, 4h+ old when found, node reports
  0 peers and `shouldHavePeers: true`, 2 validators. Reads still work, writes can't land.
- **Product consequence:** the directory shows a warning when the last block is more than 2 minutes older
  than the read, so a judge opening the site during an outage sees why, not a seemingly healthy page.

## 2026-10-28 — The precompile answers name() and symbol() too, and the RPC flaps

- Probed the assets precompile for 7777 and our TWO token: `name()`, `symbol()`, `decimals()` and
  `totalSupply()` all return the native values. The asset page now compares all four from both sides.
- During the testnet halt the eth-rpc node answered the same precompile calls with
  `execution reverted: panic: memory allocation error (0x41)` in bursts, then recovered seconds later
  (6/6 failures in one loop, 8/8 successes a minute later). **Guard:** every precompile read retries
  four times with backoff before the page calls it unreadable.
- A precompile call for an asset id that does not exist returns `0`, not a revert. A zero supply is
  therefore not proof an asset exists; the asset page checks native storage first and 404s on a miss.
- `shortAddress` lowercased everything, which corrupted case-sensitive SS58 owner addresses
  (`5Eph8MeA…` showed as `5eph8mea…`). Only `0x` addresses are lowercased now.

## 2026-10-28 — Testing a wallet flow while the chain is stopped

- `/launch` signs one `utility.batchAll[create, setMetadata, mint]` with a Polkadot-style wallet
  (SubWallet, Talisman, Polkadot.js) through `@polkadot/extension-dapp`.
- **Can't submit anything with no blocks and no wallet in the test browser.** What we could check:
  `system_dryRun` of the exact batch signed by the throwaway issuer returned `Ok(Ok)` against live
  state, and `paymentInfo` measured a **0.0235 tPOT** fee, 20× below the 0.5 tPOT first guessed.
  A Chrome run confirmed the no-wallet message, input validation (50-byte limit, decimals), taken-id
  detection (7777) and the disabled launch button while the chain is stalled.
- **Not yet verified:** the real signing prompt in SubWallet, and whether SubWallet accepts a payload for
  a chain it doesn't have metadata for. If it doesn't, the fix is adding Portaldot V3 as a custom network.
- `batchAll` success is detected from `ExtrinsicSuccess` in the block, not from "in block" alone, so a
  failed inner call can't show as done.
