import { CHAIN_ID, EVM_RPC } from "@/lib/portaldot";

type Eip1193 = { request(args: { method: string; params?: unknown }): Promise<unknown> };

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

export function getWallet(): Eip1193 {
  if (!window.ethereum) throw new Error("No EVM wallet found. Install MetaMask to continue.");
  return window.ethereum;
}

export async function ensurePortaldot(wallet: Eip1193) {
  const chainId = `0x${CHAIN_ID.toString(16)}`;
  try {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (err) {
    if ((err as { code?: number }).code !== 4902) throw err;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: "Portaldot V3 Testnet",
          nativeCurrency: { name: "Portaldot", symbol: "tPOT", decimals: 18 },
          rpcUrls: [EVM_RPC],
        },
      ],
    });
  }
}
