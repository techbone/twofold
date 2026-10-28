// Refreshes lib/metadata.json from the live testnet. Run after a Portaldot runtime upgrade.
const { WsProvider, ApiPromise } = require("@polkadot/api");
const fs = require("node:fs");

(async () => {
  const api = await ApiPromise.create({ provider: new WsProvider("wss://test-node-v3.portaldot.dev"), noInitWarn: true });
  const metadata = (await api.rpc.state.getMetadata()).toHex();
  const out = { genesisHash: api.genesisHash.toHex(), specVersion: api.runtimeVersion.specVersion.toNumber(), metadata };
  fs.writeFileSync("lib/metadata.json", JSON.stringify(out));
  console.log(`spec ${out.specVersion}, ${Math.round(metadata.length / 1024)} KB`);
  await api.disconnect();
})();
