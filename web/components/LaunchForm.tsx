"use client";

import type { InjectedAccountWithMeta } from "@polkadot/extension-inject/types";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseAmount, readTotalSupply } from "@/lib/client-chain";
import { erc20Address, formatAmount, NATIVE_DECIMALS, shortAddress } from "@/lib/portaldot";
import { CopyButton } from "./CopyButton";
import { type Step, type StepState, StepList } from "./StepList";
import { useApi, useLagSeconds } from "./useChain";

type Wallet =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "missing" }
  | { kind: "denied" }
  | { kind: "ready"; accounts: InjectedAccountWithMeta[] };

const STEPS: Step[] = [
  { key: "sign", label: "Sign in your wallet", state: "todo" },
  { key: "block", label: "Included in a block", state: "todo" },
  { key: "native", label: "Native supply read back", state: "todo" },
  { key: "evm", label: "ERC-20 supply matches", state: "todo" },
];

const field =
  "num h-9 w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 text-[13px] outline-none focus:border-accent disabled:opacity-60";
const textField = field.replace("num ", "");
const label = "text-[12px] font-medium text-muted";

const TPOT = 10n ** BigInt(NATIVE_DECIMALS);
const tpot = (v: bigint) => formatAmount(v, NATIVE_DECIMALS, 4);

function randomAssetId() {
  return 30_000_000 + Math.floor(Math.random() * 900_000_000);
}

export function LaunchForm() {
  const [wallet, setWallet] = useState<Wallet>({ kind: "idle" });
  const [address, setAddress] = useState("");
  const { api, error: apiError } = useApi();
  const lagSeconds = useLagSeconds(api);
  const [balance, setBalance] = useState<bigint | null>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState("6");
  const [supply, setSupply] = useState("1000000");
  const [assetId, setAssetId] = useState<string>("");
  const [idFree, setIdFree] = useState<boolean | null>(null);

  const [steps, setSteps] = useState<Step[] | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [launched, setLaunched] = useState<number | null>(null);

  useEffect(() => setAssetId(String(randomAssetId())), []);

  useEffect(() => {
    if (!api || !address) return setBalance(null);
    let live = true;
    api.query.system.account(address).then((r) => live && setBalance(r.data.free.toBigInt()));
    return () => {
      live = false;
    };
  }, [api, address, launched]);

  const idNum = /^\d{1,10}$/.test(assetId) ? Number(assetId) : null;
  useEffect(() => {
    if (!api || idNum === null || idNum > 0xffffffff) return setIdFree(null);
    let live = true;
    api.query.assets.asset(idNum).then((r) => live && setIdFree(r.isNone));
    return () => {
      live = false;
    };
  }, [api, idNum, launched]);

  const connect = useCallback(async () => {
    setWallet({ kind: "connecting" });
    try {
      const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");
      const exts = await web3Enable("Twofold");
      if (exts.length === 0) return setWallet({ kind: "missing" });
      const accounts = await web3Accounts({ ss58Format: 42 });
      if (accounts.length === 0) return setWallet({ kind: "denied" });
      setWallet({ kind: "ready", accounts });
      setAddress(accounts[0].address);
    } catch {
      setWallet({ kind: "denied" });
    }
  }, []);

  const decNum = /^\d{1,2}$/.test(decimals) ? Number(decimals) : null;
  const supplyRaw = decNum !== null && decNum <= 18 ? parseAmount(supply, decNum) : null;
  const bytes = new TextEncoder();
  const nameLen = bytes.encode(name).length;
  const symLen = bytes.encode(symbol).length;

  // Once a launch is under way the id is ours, so "taken" would only be our own asset showing up.
  const taken = idFree === false && !steps;

  const problems = useMemo(() => {
    const p: string[] = [];
    if (!name.trim() || nameLen > 50) p.push("Name must be 1–50 bytes.");
    if (!symbol.trim() || symLen > 50) p.push("Symbol must be 1–50 bytes.");
    if (decNum === null || decNum > 18) p.push("Decimals must be 0–18.");
    else if (supplyRaw === null || supplyRaw === 0n) p.push(`Supply must be a positive number with at most ${decNum} decimals.`);
    if (idNum === null || idNum > 0xffffffff) p.push("Asset id must be a number up to 4,294,967,295.");
    else if (taken) p.push("That asset id is taken.");
    return p;
  }, [name, nameLen, symbol, symLen, decNum, supplyRaw, idNum, taken]);

  // Deposits are returned if the asset is destroyed; fees are not. A dry run of this batch measured a
  // 0.0235 tPOT fee, so 0.1 leaves headroom. The 1 tPOT asset-account deposit is left out on purpose:
  // pallet-assets doesn't take it when the holder already has tPOT, and the signer always does. A real
  // launch of a 7-byte name and symbol cost 1.5427 tPOT, which matches.
  const cost = useMemo(() => {
    if (!api) return null;
    const c = api.consts.assets;
    const deposits =
      c.assetDeposit.toBigInt() +
      c.metadataDepositBase.toBigInt() +
      c.metadataDepositPerByte.toBigInt() * BigInt(nameLen + symLen);
    return { deposits, total: deposits + TPOT / 10n };
  }, [api, nameLen, symLen]);

  const stalled = lagSeconds !== null && lagSeconds > 120;
  const short = balance !== null && cost !== null && balance < cost.total;
  const canLaunch =
    wallet.kind === "ready" && api && !!address && problems.length === 0 && !stalled && !short && !steps;

  const setStep = (key: string, state: StepState, detail?: string) =>
    setSteps((s) => s && s.map((x) => (x.key === key ? { ...x, state, detail: detail ?? x.detail } : x)));

  async function launch() {
    if (!api || idNum === null || supplyRaw === null || decNum === null) return;
    setSteps(STEPS.map((s) => ({ ...s })));
    setTxHash(null);
    setStep("sign", "active", "Waiting for you to approve in the wallet");
    try {
      const { web3FromAddress } = await import("@polkadot/extension-dapp");
      const injector = await web3FromAddress(address);
      const tx = api.tx.utility.batchAll([
        api.tx.assets.create(idNum, address, 1),
        api.tx.assets.setMetadata(idNum, name.trim(), symbol.trim(), decNum),
        api.tx.assets.mint(idNum, address, supplyRaw),
      ]);
      const inBlock = await new Promise<string>((resolve, reject) => {
        let unsub: (() => void) | undefined;
        tx.signAndSend(address, { signer: injector.signer }, (r) => {
          if (r.status.isReady || r.status.isBroadcast) {
            setTxHash(r.txHash.toHex());
            setStep("sign", "done", `Extrinsic ${shortAddress(r.txHash.toHex(), 10, 8)}`);
            setStep("block", "active", "Waiting for a block");
          }
          const failed = r.events.find(({ event }) => api.events.system.ExtrinsicFailed.is(event));
          if (failed) {
            const err = (failed.event.data as unknown as [{ isModule: boolean; asModule: never }])[0];
            const meta = err.isModule ? api.registry.findMetaError(err.asModule) : null;
            unsub?.();
            return reject(new Error(meta ? `${meta.section}.${meta.name}` : "Extrinsic failed"));
          }
          // utility.batchAll reports a failed inner call as ExtrinsicFailed; success needs ExtrinsicSuccess.
          if (r.status.isInBlock && r.events.some(({ event }) => api.events.system.ExtrinsicSuccess.is(event))) {
            unsub?.();
            resolve(r.status.asInBlock.toHex());
          }
        })
          .then((u) => (unsub = u))
          .catch(reject);
      });
      setStep("block", "done", `Block ${shortAddress(inBlock, 10, 8)}`);

      setStep("native", "active");
      const d = (await api.query.assets.asset(idNum)).unwrapOr(null);
      if (!d || d.supply.toBigInt() !== supplyRaw) throw new Error("Native supply does not match what you minted");
      setStep("native", "done", `${formatAmount(d.supply.toBigInt(), decNum, decNum)} ${symbol.trim()}`);

      setStep("evm", "active", "Reading the ERC-20 precompile");
      const evmSupply = await readTotalSupply(idNum);
      if (evmSupply === null) throw new Error("The ERC-20 address did not answer. Open the asset page to retry.");
      if (evmSupply !== supplyRaw) throw new Error(`ERC-20 totalSupply() is ${evmSupply}, expected ${supplyRaw}`);
      setStep("evm", "done", erc20Address(idNum));
      setLaunched(idNum);
    } catch (e) {
      setSteps((s) =>
        s
          ? s.map((x) =>
              x.state === "active" || (x.state === "todo" && s.every((y) => y.state !== "active"))
                ? x.state === "active"
                  ? { ...x, state: "error", detail: (e as Error).message }
                  : x
                : x,
            )
          : s,
      );
    }
  }

  const accounts = wallet.kind === "ready" ? wallet.accounts : [];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        {/* 1. wallet */}
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-[13px] font-medium">1. Wallet</h2>
          {wallet.kind !== "ready" ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={connect}
                disabled={wallet.kind === "connecting"}
                className="h-8 rounded-[var(--radius-control)] bg-accent px-3 text-[13px] font-medium text-accent-fg disabled:opacity-60"
              >
                {wallet.kind === "connecting" ? "Waiting for the wallet…" : "Connect SubWallet, Talisman or Polkadot.js"}
              </button>
              {wallet.kind === "missing" && (
                <p className="mt-3 text-[13px] text-warning">
                  No wallet extension found. Install SubWallet, Talisman or Polkadot.js, then reload.
                </p>
              )}
              {wallet.kind === "denied" && (
                <p className="mt-3 text-[13px] text-warning">
                  Access was declined, or the wallet has no accounts. Allow Twofold in the wallet and try again.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <select
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={field}
                disabled={!!steps && launched === null}
                aria-label="Account"
              >
                {accounts.map((a) => (
                  <option key={a.address} value={a.address}>
                    {(a.meta.name ?? "Account") + " · " + shortAddress(a.address, 8, 6)}
                  </option>
                ))}
              </select>
              <p className="text-[12px] text-muted">
                Balance{" "}
                <span className="num text-text">{balance === null ? "…" : `${tpot(balance)} tPOT`}</span>
                {short && cost && <span className="text-warning"> · needs about {tpot(cost.total)} tPOT</span>}
              </p>
            </div>
          )}
        </section>

        {/* 2. token */}
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-[13px] font-medium">2. Token</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={label}>Name</label>
              <input id="name" className={`${textField} mt-1.5`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Dollar" disabled={!!steps} />
            </div>
            <div>
              <label htmlFor="symbol" className={label}>Symbol</label>
              <input id="symbol" className={`${textField} mt-1.5`} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="ACME" disabled={!!steps} />
            </div>
            <div>
              <label htmlFor="supply" className={label}>Initial supply</label>
              <input id="supply" inputMode="decimal" className={`${field} mt-1.5`} value={supply} onChange={(e) => setSupply(e.target.value)} disabled={!!steps} />
            </div>
            <div>
              <label htmlFor="decimals" className={label}>Decimals</label>
              <input id="decimals" inputMode="numeric" className={`${field} mt-1.5`} value={decimals} onChange={(e) => setDecimals(e.target.value)} disabled={!!steps} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="assetId" className={label}>
                Native asset id{" "}
                {idFree === true && <span className="text-success">· available</span>}
                {taken && <span className="text-danger">· taken</span>}
              </label>
              <div className="mt-1.5 flex gap-2">
                <input id="assetId" inputMode="numeric" className={field} value={assetId} onChange={(e) => setAssetId(e.target.value)} disabled={!!steps} />
                <button
                  type="button"
                  onClick={() => setAssetId(String(randomAssetId()))}
                  disabled={!!steps}
                  className="h-9 shrink-0 rounded-[var(--radius-control)] border border-border px-3 text-[13px] text-muted hover:bg-surface-2 hover:text-text disabled:opacity-60"
                >
                  New id
                </button>
              </div>
              {idNum !== null && idNum <= 0xffffffff && (
                <p className="num mt-2 break-all text-[12px] text-muted">
                  ERC-20 address will be {erc20Address(idNum)}
                </p>
              )}
            </div>
          </div>
          {problems.length > 0 && (name || symbol) && (
            <ul className="mt-4 space-y-1 text-[12px] text-warning">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. launch */}
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-[13px] font-medium">3. Launch</h2>
          {stalled && (
            <p role="status" className="mt-3 flex items-start gap-2 text-[13px] text-warning">
              <AlertTriangle size={16} strokeWidth={1.5} className="mt-px shrink-0" />
              The testnet has not produced a block for {Math.floor((lagSeconds ?? 0) / 60)} minutes, so a launch would
              sit in the queue. Launching is disabled until blocks resume.
            </p>
          )}
          {apiError && <p className="mt-3 text-[13px] text-danger">Could not reach the node: {apiError}</p>}
          <button
            type="button"
            onClick={launch}
            disabled={!canLaunch}
            className="mt-3 h-9 rounded-[var(--radius-control)] bg-accent px-4 text-[13px] font-medium text-accent-fg disabled:opacity-40"
          >
            {!api && !apiError ? "Connecting to the node…" : "Launch token"}
          </button>
          {steps && <StepList steps={steps} />}
          {steps?.some((s) => s.state === "error") && (
            <button
              type="button"
              onClick={() => setSteps(null)}
              className="mt-4 h-8 rounded-[var(--radius-control)] border border-border px-3 text-[13px] text-muted hover:bg-surface-2 hover:text-text"
            >
              Edit and try again
            </button>
          )}
          {launched !== null && (
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Link href={`/asset/${launched}`} className="text-[13px] font-medium text-accent hover:underline">
                Open the asset page
              </Link>
              <span className="flex items-center gap-1 text-[12px] text-muted">
                <span className="num">{erc20Address(launched)}</span>
                <CopyButton value={erc20Address(launched)} label="Copy ERC-20 address" />
              </span>
            </div>
          )}
          {txHash && <p className="num mt-3 break-all text-[11px] text-faint">tx {txHash}</p>}
        </section>
      </div>

      <aside className="h-fit rounded-[var(--radius-card)] border border-border bg-surface p-4 text-[13px] sm:p-5">
        <h2 className="font-medium">What this costs</h2>
        <dl className="mt-3 space-y-2">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Deposits</dt>
            <dd className="num">{cost ? `${tpot(cost.deposits)} tPOT` : "…"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Fee allowance</dt>
            <dd className="num">0.1 tPOT</dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-border pt-3 text-[12px] leading-relaxed text-muted">
          One signature sends <span className="num">utility.batchAll</span> with{" "}
          <span className="num">assets.create</span>, <span className="num">setMetadata</span> and{" "}
          <span className="num">mint</span>. If any call fails, none of them apply. The asset id becomes an ERC-20 at a
          fixed address, which the last step checks against the supply you minted.
        </p>
      </aside>
    </div>
  );
}
