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
