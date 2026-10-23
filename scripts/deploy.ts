// Deploys Disperse to Portaldot V3 testnet from the forge artifact and records it in docs/evidence.
import { readFileSync, writeFileSync } from "node:fs";
import type { Hex } from "viem";
import { connect, fallbackAccount, fmt, nativeFree, send, TPOT } from "./clients.ts";

const DEPLOYER_FLOAT = 150n * TPOT;

const { api, issuer, deployer, evm, wallet } = await connect();
const native = fallbackAccount(deployer.address);

let free = await nativeFree(api, native);
console.log(`deployer ${deployer.address} (native ${native}) has ${fmt(free, 14)} tPOT`);
if (free < DEPLOYER_FLOAT / 2n) {
  const issuerFree = await nativeFree(api, issuer.address);
  const amount = issuerFree - 30n * TPOT < DEPLOYER_FLOAT ? issuerFree - 30n * TPOT : DEPLOYER_FLOAT;
  if (amount <= 0n) throw new Error(`issuer ${issuer.address} needs tPOT (has ${fmt(issuerFree, 14)})`);
  const r = await send(api, api.tx.balances.transferKeepAlive(native, amount), issuer);
  console.log(`funded deployer with ${fmt(amount, 14)} tPOT in ${r.block}`);
  free = await nativeFree(api, native);
}

const artifact = JSON.parse(readFileSync("../contracts/out/Disperse.sol/Disperse.json", "utf8"));
const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object as Hex });
const receipt = await evm.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`deploy failed: ${hash}`);
const after = await nativeFree(api, native);

const record = {
  network: "Portaldot V3 testnet",
  chainId: 420420777,
  contract: "Disperse",
  address: receipt.contractAddress,
  txHash: hash,
  block: Number(receipt.blockNumber),
  deployer: deployer.address,
  costTpot: fmt(free - after, 14),
  deployedAt: new Date().toISOString(),
};
writeFileSync("../docs/evidence/deployments.json", JSON.stringify(record, null, 2) + "\n");
console.log(record);
await api.disconnect();
