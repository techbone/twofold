// End-to-end on real rails: launch a native asset → hold it as ERC-20 → disperse from Solidity
// → verify every balance from both the native side and the EVM side.
import { readFileSync, writeFileSync } from "node:fs";
import { erc20Abi, parseUnits, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { erc20Address } from "../web/lib/portaldot.ts";
import { connect, fallbackAccount, fmt, nativeFree, send, TPOT } from "./clients.ts";

const ASSET_ID = Number(process.env.TWOFOLD_ASSET_ID ?? 20261023);
const DECIMALS = 6;
const SUPPLY = parseUnits("1000000", DECIMALS);
const PAYOUTS = [parseUnits("1250", DECIMALS), parseUnits("830.5", DECIMALS), parseUnits("19.75", DECIMALS)];

const { api, issuer, deployer, evm, wallet } = await connect();
const deployment = JSON.parse(readFileSync("../docs/evidence/deployments.json", "utf8"));
const disperse = deployment.address as Address;
const disperseAbi = JSON.parse(readFileSync("../contracts/out/Disperse.sol/Disperse.json", "utf8")).abi;
const token = erc20Address(ASSET_ID);
const deployerNative = fallbackAccount(deployer.address);
const log: string[] = [];
const step = (name: string, detail: string) => {
  const line = `- **${name}**: ${detail}`;
  log.push(line);
  console.log(`✓ ${name}: ${detail}`);
};

const nativeAssetBalance = async (who: string) =>
  (await api.query.assets.account(ASSET_ID, who)).unwrapOr(null)?.balance.toBigInt() ?? 0n;
const evmBalance = (who: Address) =>
  evm.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [who] });

// 1. Launch on the native side (skipped if this issuer already owns the asset).
const existing = await api.query.assets.asset(ASSET_ID);
if (existing.isSome) {
  if (existing.unwrap().owner.toString() !== issuer.address) throw new Error(`asset ${ASSET_ID} is taken`);
  step("Launch", `asset ${ASSET_ID} already exists, owned by issuer; reusing`);
} else {
  const r = await send(
    api,
    api.tx.utility.batchAll([
      api.tx.assets.create(ASSET_ID, issuer.address, 1),
      api.tx.assets.setMetadata(ASSET_ID, "Twofold Demo", "TWO", DECIMALS),
      api.tx.assets.mint(ASSET_ID, deployerNative, SUPPLY),
    ]),
    issuer,
  );
  step("Launch", `utility.batchAll[create, setMetadata, mint] → extrinsic ${r.hash} in block ${r.block}`);
}

// 2. The same asset answers as an ERC-20 at the derived precompile address.
const [nativeSupply, evmSupply] = await Promise.all([
  api.query.assets.asset(ASSET_ID).then((d) => d.unwrap().supply.toBigInt()),
  evm.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }),
]);
if (nativeSupply !== evmSupply) throw new Error(`supply mismatch: native ${nativeSupply} vs evm ${evmSupply}`);
step("Resolve", `${token} totalSupply() = native supply = ${fmt(evmSupply, DECIMALS)} TWO`);

// 3. Recipients: three fresh EVM accounts. A non-sufficient asset needs the receiver to exist
//    natively, so first prove the unfunded case fails, then give each the existential deposit.
const recipients = PAYOUTS.map(() => privateKeyToAccount(generatePrivateKey()).address);
const total = PAYOUTS.reduce((a, b) => a + b, 0n);

const allowance = await evm.readContract({
  address: token, abi: erc20Abi, functionName: "allowance", args: [deployer.address, disperse],
});
if (allowance < total) {
  const approveHash = await wallet.writeContract({
    address: token, abi: erc20Abi, functionName: "approve", args: [disperse, total * 1000n],
  });
  const r = await evm.waitForTransactionReceipt({ hash: approveHash });
  if (r.status !== "success") throw new Error(`approve reverted: ${approveHash}`);
  step("Approve", `precompile approve(Disperse) → ${approveHash}`);
}

const unfunded = await evm
  .simulateContract({
    account: deployer, address: disperse, abi: disperseAbi, functionName: "disperseAsset",
    args: [ASSET_ID, recipients, PAYOUTS],
  })
  .then(() => "succeeded")
  .catch((e: Error) => `reverted (${e.message.split("\n")[0].slice(0, 120)})`);
step("Unfunded recipients", `simulated disperse ${unfunded}`);

const fund = await send(
  api,
  api.tx.utility.batchAll(recipients.map((r) => api.tx.balances.transferKeepAlive(fallbackAccount(r), TPOT / 5n))),
  issuer,
);
step("Fund recipients", `0.2 tPOT to each fallback account → extrinsic ${fund.hash}`);

// 4. Pay out from Solidity.
const hash = (await wallet.writeContract({
  address: disperse, abi: disperseAbi, functionName: "disperseAsset", args: [ASSET_ID, recipients, PAYOUTS],
})) as Hex;
const receipt = await evm.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error(`disperse reverted: ${hash}`);
step("Disperse", `disperseAsset(${ASSET_ID}, 3 recipients, ${fmt(total, DECIMALS)} TWO) → ${hash} (block ${receipt.blockNumber})`);

// 5. Verify each balance from both sides.
const rows: string[] = [];
let ok = 0;
for (const [i, r] of recipients.entries()) {
  const [e, n] = await Promise.all([evmBalance(r), nativeAssetBalance(fallbackAccount(r))]);
  const agree = e === n && e === PAYOUTS[i];
  ok += agree ? 1 : 0;
  rows.push(`| \`${r}\` | ${fmt(PAYOUTS[i], DECIMALS)} | ${fmt(e, DECIMALS)} | ${fmt(n, DECIMALS)} | ${agree ? "yes" : "NO"} |`);
}
if (ok !== recipients.length) throw new Error(`${recipients.length - ok} recipients disagree across sides`);
step("Verify", `${ok}/${recipients.length} recipients: balanceOf() = assets.account() = expected`);

const md = `# E2E run — ${new Date().toISOString()}

Network: Portaldot V3 testnet (chain 420420777) · Asset ${ASSET_ID} (TWO) · ERC-20 \`${token}\` · Disperse \`${disperse}\`

${log.join("\n")}

| Recipient (EVM) | Expected | balanceOf() | assets.account() | Agree |
|---|---|---|---|---|
${rows.join("\n")}

Deployer native balance after run: ${fmt(await nativeFree(api, deployerNative), 14)} tPOT
`;
writeFileSync("../docs/evidence/e2e-latest.md", md);
console.log("\nwrote docs/evidence/e2e-latest.md");
await api.disconnect();
