# E2E run — 2026-10-29T20:20:16.202Z

Network: Portaldot V3 testnet (chain 420420777) · Asset 20261023 (TWO) · ERC-20 `0x0135289f00000000000000000000000000010000` · Disperse `0x389a5f1e3897a3cad547af7d872a174f5d22205c`

- **Launch**: asset 20261023 already exists, owned by issuer; reusing
- **Resolve**: 0x0135289f00000000000000000000000000010000 totalSupply() = native supply = 1000000.000000 TWO
- **Unfunded recipients**: simulated disperse reverted (The contract function "disperseAsset" reverted.)
- **Fund recipients**: 0.2 tPOT to each fallback account → extrinsic 0x1c157c9c1f6e7ce6fa42dac7d9da6c15dddc67ffe9dd6a4ec6364dbaf56a1496
- **Disperse**: disperseAsset(20261023, 3 recipients, 2100.250000 TWO) → 0x03074758667bf04cea8ad8a8d34185561b573658c131702641e702c425c913fc (block 242917)
- **Verify**: 3/3 recipients: balanceOf() = assets.account() = expected

| Recipient (EVM) | Expected | balanceOf() | assets.account() | Agree |
|---|---|---|---|---|
| `0xc51Da9B8038792fdfE7404eCA4a847aAFE6CA27F` | 1250.000000 | 1250.000000 | 1250.000000 | yes |
| `0xCA4a306d47af998CE50250DB9Fc851Ec72a15351` | 830.500000 | 830.500000 | 830.500000 | yes |
| `0x0d84CAE3cd44B33C62Bf04bB54FaA3CD5754533E` | 19.750000 | 19.750000 | 19.750000 | yes |

Deployer native balance after run: 32.24322611013102 tPOT
