import { connect, fmt, nativeFree, send, TPOT } from "./clients.ts";

// usage: npm run fund -- <native address> [tPOT amount]
const [to, amountArg = "5"] = process.argv.slice(2);
if (!to) throw new Error("usage: npm run fund -- <native address> [tPOT amount]");

const { api, issuer } = await connect();
const amount = BigInt(Math.round(Number(amountArg) * 1e4)) * (TPOT / 10_000n);

console.log(`issuer   ${issuer.address}  ${fmt(await nativeFree(api, issuer.address), 14)} tPOT`);
console.log(`to       ${to}  ${fmt(await nativeFree(api, to), 14)} tPOT`);

const { block, hash } = await send(api, api.tx.balances.transferKeepAlive(to, amount), issuer);
console.log(`sent ${fmt(amount, 14)} tPOT, in block ${block}, extrinsic ${hash}`);
console.log(`to       ${fmt(await nativeFree(api, to), 14)} tPOT`);

await api.disconnect();
