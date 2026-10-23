# E2E run — 2026-10-23T16:49:26.042Z

Network: Portaldot V3 testnet (chain 420420777) · Asset 20261023 (TWO) · ERC-20 `0x0135289f00000000000000000000000000010000` · Disperse `0x389a5f1e3897a3cad547af7d872a174f5d22205c`

- **Launch**: utility.batchAll[create, setMetadata, mint] → extrinsic 0xd62fdad837fd94a4ee377ae1603552d1399a6c6488b2e731d5a3876116a6300e in block 0xc58464a0b4eaa805160d2823a80852243be480813c6602dbe1e5034859e2a2d9
- **Resolve**: 0x0135289f00000000000000000000000000010000 totalSupply() = native supply = 1000000.000000 TWO
- **Approve**: precompile approve(Disperse) → 0xcc2c42586a66a9eb2ded7e53f68158fad887ab3bf58e32a98ffc192602e6c4c9
- **Unfunded recipients**: simulated disperse reverted (The contract function "disperseAsset" reverted.)
- **Fund recipients**: 0.2 tPOT to each fallback account → extrinsic 0x8e3d23eca78e4235543ec6fffca519d091e76454604ee40ed46cf9d54016607b
- **Disperse**: disperseAsset(20261023, 3 recipients, 2100.250000 TWO) → 0xb5dca03ec4f08ca0d0cd71644e4cfe38b5a28c7358b6a73e9d17f5f15bd484fe (block 162890)
- **Verify**: 3/3 recipients: balanceOf() = assets.account() = expected

| Recipient (EVM) | Expected | balanceOf() | assets.account() | Agree |
|---|---|---|---|---|
| `0x04053eA51F65F7fcC21fb260C97E9825A46310e5` | 1250.000000 | 1250.000000 | 1250.000000 | yes |
| `0xB62c59D3e5942246024ae0189B93738522a356be` | 830.500000 | 830.500000 | 830.500000 | yes |
| `0xA1743b053452508c4eB93da05aa8aa90bF1c70E9` | 19.750000 | 19.750000 | 19.750000 | yes |

Deployer native balance after run: 32.29094703178745 tPOT
