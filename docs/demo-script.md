# Demo video (about 2:00, silent, captioned)

Real runs only, against the live site and the live testnet. Nothing is sped up. The wallets are scripted
(a stand-in that signs real transactions with throwaway keys), and the video says so on screen. Real SubWallet and
Rabby runs are in `docs/build-log.md`.

| Time | Screen | Caption |
|---|---|---|
| 0:00 | Title card | Every Portaldot token is already an ERC-20. Nobody can find it. |
| 0:05 | Asset directory, hover on pUSD | 33 native assets live on Portaldot V3. Each one is already an ERC-20. Its address isn't in the docs. |
| 0:15 | pUSD asset page | Left: pallet-assets. Right: the ERC-20 precompile. Every field matches. |
| 0:25 | Launch form, then the signature | One batch: create, set metadata, mint. About 1.5 tPOT in deposits. |
| 0:55 | New token's asset page | The new token is already an ERC-20. Same name, symbol and supply on both sides. |
| 1:10 | Payout: recipients checked, two top-ups | Two recipients have never held tPOT. Checked before anything is sent. |
| 1:40 | Approve, payout, verification table | Native balance equals ERC-20 balance for every recipient. |
| 1:55 | End card | Live app, repo, contract address, and the disclosure about scripted wallets. |

Made with Playwright (screen recording of the live site) and ffmpeg (captions and cards as PNG overlays).
The output is `demo-out/twofold-demo.mp4`, which is gitignored. Upload it unlisted.
