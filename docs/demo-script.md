# Demo video (2:23, narrated, captioned)

Real runs against the live site and the live testnet. Nothing is sped up. One frame is held for four seconds
(the pUSD page, so the narration can finish before the address snippets appear). The wallets are scripted: a
stand-in that signs real transactions with throwaway keys, and the video says so in the narration and on the end
card. Real SubWallet and Rabby runs are in [build-log.md](build-log.md).

| Time | Screen | Narration |
|---|---|---|
| 0:00 | Title card | Every Portaldot token is already an ERC-20, and nobody can find it. |
| 0:06 | Asset directory | Thirty-three native assets live on Portaldot. Each one is already an ERC-20, but its address isn't in the docs. Twofold shows both views. |
| 0:16 | pUSD asset page, native and ERC-20 side by side | Take pUSD. On the left, the native asset. On the right, its ERC-20. Read separately, and every field matches. Paste that address into Solidity. No wrapper, no bridge. |
| 0:30 | Launch form, connect, fill, sign | Launching a token: name, symbol, supply and one signature. The wallet is scripted here, but every transaction is real. The ERC-20 address is known before you sign. |
| 0:46 | Batch in flight, then supply read back | One batch: create the asset, set the metadata, mint the supply. About one and a half tPOT in deposits. Then we read the supply back from both sides, and they match. |
| 0:56 | New token's asset page | The new token is already an ERC-20. Same name, same symbol, same supply. |
| 1:04 | Payout page, three recipients pasted | Paying out to many people from an EVM wallet. Same scripted wallet, same real chain. |
| 1:13 | Recipient pre-check, two top-ups | Two recipients have never held tPOT, so this token can't reach them. We check that before sending anything. We top them up, 0.2 tPOT each. |
| 1:36 | Approve, submit, in block, verified, with hashes | Approve once, then one Disperse call pays all three. Every step is named, with its transaction hash. |
| 2:03 | Verification table | The proof: for every recipient, the native balance equals the ERC-20 balance. It only says done when both agree. |
| 2:13 | End card | That's Twofold. Launch, hold and pay out, with every balance checked twice. |

## Must be true before recording

- The deployer's EVM account holds the demo token and a few tPOT. The issuer account has enough tPOT for a launch (about 1.5).
- The recipients are fresh addresses with no tPOT, except one, so the pre-check has something to catch.
- The allowance from the deployer to Disperse is 0, so the approve step actually runs.
- The live site answers on all four routes. Warm them first so a cold start isn't on camera.
