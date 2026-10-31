"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, erc20Abi, getAddress, parseEventLogs, type Address } from "viem";
import { evmClient, withRetry } from "@/lib/client-chain";
import { DISPERSE_ADDRESS, disperseAbi, FUND_VALUE, MAX_RECIPIENTS, nativeKey, parseRecipients } from "@/lib/disperse";
import { erc20Address, formatAmount, portaldot, shortAddress } from "@/lib/portaldot";
import { CopyButton } from "./CopyButton";
import { type Step, StepList } from "./StepList";
import { useApi, useLagSeconds } from "./useChain";
import { ensurePortaldot, getWallet } from "./wallet";

const STEPS: Step[] = [
  { key: "approve", label: "Approve the contract to move the tokens", state: "todo" },
  { key: "submit", label: "Submit the payout", state: "todo" },
  { key: "block", label: "Included in a block", state: "todo" },
  { key: "verified", label: "Balances agree on both sides", state: "todo" },
];

const field =
  "num h-9 w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 text-[13px] outline-none focus:border-accent disabled:opacity-60";
const label = "text-[12px] font-medium text-muted";
const button =
  "h-8 rounded-[var(--radius-control)] border border-border px-3 text-[13px] text-muted hover:bg-surface-2 hover:text-text disabled:opacity-60";

type AssetInfo = { symbol: string; decimals: number; balance: bigint | null } | "missing" | null;
type Verified = { to: Address; amount: bigint; native: bigint; evm: bigint; ok: boolean }[];

const walletMessage = (e: unknown) => {
  const err = e as { shortMessage?: string; message?: string; code?: number };
  if (err.code === 4001) return "You rejected the request in the wallet.";
  return err.shortMessage ?? err.message ?? "Unknown error";
};

export function PayoutForm() {
  const { api, error: apiError } = useApi();
  const lagSeconds = useLagSeconds(api);

  const [account, setAccount] = useState<Address | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [tpotResult, setTpotResult] = useState<{ account: Address; value: bigint } | null>(null);

  const preset = useSearchParams().get("asset") ?? "";
  const [assetInput, setAssetInput] = useState(/^\d{1,10}$/.test(preset) ? preset : "");
  const [assetResult, setAssetResult] = useState<{ key: string; info: AssetInfo } | null>(null);
  const [text, setText] = useState("");

  const [unfundedResult, setUnfundedResult] = useState<{ key: string; list: Address[] } | null>(null);
  const [funding, setFunding] = useState<{ done: number; total: number } | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);

  const [steps, setSteps] = useState<Step[] | null>(null);
  const [hashes, setHashes] = useState<{ approve?: string; payout?: string }>({});
  const [verified, setVerified] = useState<Verified | null>(null);
  const [refresh, setRefresh] = useState(0);

  const assetId = /^\d{1,10}$/.test(assetInput) && Number(assetInput) <= 0xffffffff ? Number(assetInput) : null;

  // Asset: native storage says whether it exists, the precompile says what the contract will see.
  // Results carry the inputs they were read for, so a stale one is ignored without resetting state in the effect.
  const assetKey = `${assetId}:${account}`;
  const asset = assetResult?.key === assetKey ? assetResult.info : null;
  useEffect(() => {
    if (!api || assetId === null) return;
    let live = true;
    const done = (info: AssetInfo) => live && setAssetResult({ key: assetKey, info });
    (async () => {
      try {
        if ((await api.query.assets.asset(assetId)).isNone) return done("missing");
        const address = erc20Address(assetId);
        const [symbol, decimals, balance] = await Promise.all([
          withRetry(() => evmClient.readContract({ address, abi: erc20Abi, functionName: "symbol" })),
          withRetry(() => evmClient.readContract({ address, abi: erc20Abi, functionName: "decimals" })),
          account
            ? withRetry(() => evmClient.readContract({ address, abi: erc20Abi, functionName: "balanceOf", args: [account] }))
            : Promise.resolve(null),
        ]);
        done({ symbol, decimals, balance });
      } catch {
        done(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [api, assetId, account, assetKey, refresh]);

  const tpotBalance = account && tpotResult?.account === account ? tpotResult.value : null;
  useEffect(() => {
    if (!account) return;
    let live = true;
    evmClient
      .getBalance({ address: account })
      .then((value) => live && setTpotResult({ account, value }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [account, refresh]);

  const decimals = asset && asset !== "missing" ? asset.decimals : null;
  const parsed = useMemo(
    () => (decimals === null ? null : parseRecipients(text, decimals)),
    [text, decimals],
  );
  const rows = useMemo(() => parsed?.rows ?? [], [parsed]);
  const total = rows.reduce((t, r) => t + r.amount, 0n);
  const unique = useMemo(() => [...new Set(rows.map((r) => r.to))], [rows]);
  const uniqueKey = unique.join();

  // A recipient with no tPOT has no native account, and pallet-assets won't credit a non-sufficient asset to it.
  const unfunded = unfundedResult?.key === uniqueKey ? unfundedResult.list : null;
  useEffect(() => {
    if (!api || unique.length === 0) return;
    let live = true;
    api.query.system.account
      .multi(unique.map(nativeKey))
      .then(
        (infos) =>
          live && setUnfundedResult({ key: uniqueKey, list: unique.filter((_, i) => infos[i].providers.isZero()) }),
      )
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [api, unique, uniqueKey, refresh]);

  const stalled = lagSeconds !== null && lagSeconds > 120;
  const running = !!steps && !steps.some((s) => s.state === "error") && !verified;
  const enough = asset && asset !== "missing" && asset.balance !== null && asset.balance >= total;
  const problems: string[] = [];
  if (parsed) problems.push(...parsed.errors);
  if (asset && asset !== "missing" && asset.balance !== null && total > asset.balance && rows.length > 0) {
    problems.push(
      `You hold ${formatAmount(asset.balance, asset.decimals, asset.decimals)} ${asset.symbol} at this address and the payout needs ${formatAmount(total, asset.decimals, asset.decimals)}.`,
    );
  }
  const canPay =
    !!account && !!api && !!parsed && rows.length > 0 && problems.length === 0 && enough && unfunded?.length === 0 &&
    !stalled && !steps;

  const connect = useCallback(async () => {
    setWalletError(null);
    try {
      const w = getWallet();
      const accounts = (await w.request({ method: "eth_requestAccounts" })) as string[];
      await ensurePortaldot(w);
      setAccount(getAddress(accounts[0]));
    } catch (e) {
      setWalletError(walletMessage(e));
    }
  }, []);

  const walletClient = () => createWalletClient({ account: account!, chain: portaldot, transport: custom(getWallet()) });

  async function fundRecipients() {
    if (!account || !unfunded?.length) return;
    setFundError(null);
    setFunding({ done: 0, total: unfunded.length });
    try {
      await ensurePortaldot(getWallet());
      const wc = walletClient();
      for (const [i, to] of unfunded.entries()) {
        const gas = await evmClient.estimateGas({ account, to, value: FUND_VALUE });
        const hash = await wc.sendTransaction({ to, value: FUND_VALUE, gas: (gas * 12n) / 10n });
        const r = await evmClient.waitForTransactionReceipt({ hash });
        if (r.status !== "success") throw new Error(`Funding ${shortAddress(to)} reverted: ${hash}`);
        setFunding({ done: i + 1, total: unfunded.length });
      }
      setRefresh((n) => n + 1);
    } catch (e) {
      setFundError(walletMessage(e));
    } finally {
      setFunding(null);
    }
  }

  async function pay() {
    if (!account || !api || assetId === null || !asset || asset === "missing") return;
    setSteps(STEPS.map((s) => ({ ...s })));
    setHashes({});
    setVerified(null);
    let current = "approve";
    const set = (key: string, state: Step["state"], detail?: string) => {
      current = key;
      setSteps((s) => s && s.map((x) => (x.key === key ? { ...x, state, detail: detail ?? x.detail } : x)));
    };
    try {
      const token = erc20Address(assetId);
      const tos = rows.map((r) => r.to);
      const amounts = rows.map((r) => r.amount);
      const balanceOf = (a: Address) =>
        withRetry(() => evmClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [a] }));
      const before = await Promise.all(unique.map(balanceOf));

      set("approve", "active", "Checking the current allowance");
      await ensurePortaldot(getWallet());
      const wc = walletClient();
      const allowance = await withRetry(() =>
        evmClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account, DISPERSE_ADDRESS] }),
      );
      if (allowance >= total) {
        set("approve", "done", "Allowance already covers this payout");
      } else {
        set("approve", "active", "Waiting for you to approve in the wallet");
        const args = [DISPERSE_ADDRESS, total] as const;
        const gas = await evmClient.estimateContractGas({ account, address: token, abi: erc20Abi, functionName: "approve", args });
        const hash = await wc.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args, gas: (gas * 12n) / 10n, chain: portaldot });
        setHashes((h) => ({ ...h, approve: hash }));
        set("approve", "active", `Waiting for the approval ${shortAddress(hash, 10, 8)}`);
        const r = await evmClient.waitForTransactionReceipt({ hash });
        if (r.status !== "success") throw new Error(`The approval reverted: ${hash}`);
        set("approve", "done", `Approval ${shortAddress(hash, 10, 8)}`);
      }

      set("submit", "active", "Checking the payout would succeed");
      const args = [assetId, tos, amounts] as const;
      let gas: bigint;
      try {
        gas = await evmClient.estimateContractGas({ account, address: DISPERSE_ADDRESS, abi: disperseAbi, functionName: "disperseAsset", args });
      } catch {
        throw new Error(
          "The contract call would revert, so nothing was sent. The usual cause is a recipient the chain doesn't know yet. Check the tPOT column and try again.",
        );
      }
      set("submit", "active", "Waiting for you to confirm in the wallet");
      const hash = await wc.writeContract({
        address: DISPERSE_ADDRESS, abi: disperseAbi, functionName: "disperseAsset", args, gas: (gas * 12n) / 10n, chain: portaldot,
      });
      setHashes((h) => ({ ...h, payout: hash }));
      set("submit", "done", `Transaction ${shortAddress(hash, 10, 8)}`);

      set("block", "active", "Waiting for a block");
      const receipt = await evmClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`The payout reverted on chain: ${hash}`);
      const event = parseEventLogs({ abi: disperseAbi, logs: receipt.logs, eventName: "Dispersed" })[0];
      if (!event || event.args.total !== total || Number(event.args.recipients) !== rows.length) {
        throw new Error("The Dispersed event doesn't match the payout that was sent.");
      }
      set("block", "done", `Block ${receipt.blockNumber.toLocaleString("en-US")}`);

      set("verified", "active", "Reading every recipient from the native side and the ERC-20 side");
      const expected = new Map(unique.map((a, i) => [a, before[i]]));
      for (const r of rows) expected.set(r.to, (expected.get(r.to) ?? 0n) + r.amount);
      const result: Verified = await Promise.all(
        unique.map(async (to) => {
          const [evm, native] = await Promise.all([
            balanceOf(to),
            api.query.assets.account(assetId, nativeKey(to)).then((a) => a.unwrapOr(null)?.balance.toBigInt() ?? 0n),
          ]);
          const want = expected.get(to)!;
          return { to, amount: rows.filter((r) => r.to === to).reduce((t, r) => t + r.amount, 0n), native, evm, ok: native === want && evm === want };
        }),
      );
      setVerified(result);
      if (!result.every((r) => r.ok)) throw new Error("A balance on one side doesn't match what was paid. See the table below.");
      set("verified", "done", `${result.length} recipient${result.length === 1 ? "" : "s"} agree on both sides`);
      setRefresh((n) => n + 1);
    } catch (e) {
      set(current, "error", walletMessage(e));
    }
  }

  const failed = steps?.some((s) => s.state === "error");
  const sym = asset && asset !== "missing" ? asset.symbol : "";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        {/* 1. wallet */}
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-[13px] font-medium">1. Wallet</h2>
          {account ? (
            <p className="mt-3 text-[12px] text-muted">
              <span className="num break-all text-text">{account}</span>
              <span className="mx-2">·</span>
              <span className="num text-text">{tpotBalance === null ? "…" : `${formatAmount(tpotBalance, 18, 4)} tPOT`}</span>
            </p>
          ) : (
            <div className="mt-3">
              <button
                type="button"
                onClick={connect}
                className="h-8 rounded-[var(--radius-control)] bg-accent px-3 text-[13px] font-medium text-accent-fg"
              >
                Connect MetaMask or Rabby
              </button>
              {walletError && <p className="mt-3 text-[13px] text-warning">{walletError}</p>}
            </div>
          )}
        </section>

        {/* 2. token */}
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-[13px] font-medium">2. Token</h2>
          <div className="mt-4">
            <label htmlFor="asset" className={`${label} block`}>Native asset id</label>
            <input
              id="asset"
              inputMode="numeric"
              className={`${field} mt-1.5 max-w-xs`}
              value={assetInput}
              onChange={(e) => setAssetInput(e.target.value.trim())}
              placeholder="71369440"
              disabled={!!steps && !failed && !verified}
            />
            <p className="num mt-2 break-all text-[12px] text-muted">
              {assetId === null && assetInput !== "" && "Asset id must be a number up to 4,294,967,295."}
              {asset === "missing" && <span className="text-warning">No native asset has this id.</span>}
              {asset && asset !== "missing" && (
                <>
                  {asset.symbol} · {asset.decimals} decimals · you hold{" "}
                  <span className="text-text">
                    {asset.balance === null ? "connect a wallet to see" : `${formatAmount(asset.balance, asset.decimals, asset.decimals)} ${asset.symbol}`}
                  </span>
                </>
              )}
            </p>
          </div>
        </section>

        {/* 3. recipients */}
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-[13px] font-medium">3. Recipients</h2>
          <label htmlFor="recipients" className={`${label} mt-4 block`}>One per line: address, amount</label>
          <textarea
            id="recipients"
            rows={6}
            spellCheck={false}
            className="num mt-1.5 w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-[13px] outline-none focus:border-accent disabled:opacity-60"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"0xAaa25b61814f4AaaAE0993770b1dF86b70076c58, 25\n0x5A6DDe5159045793CC9e5427dFb6d4E74a0C3a51, 12.5"}
            disabled={decimals === null || !!steps}
          />
          {decimals === null && <p className="mt-2 text-[12px] text-muted">Pick a token first, so amounts can be read with its decimals.</p>}
          {problems.length > 0 && (
            <ul className="mt-3 space-y-1 text-[12px] text-warning">
              {problems.slice(0, 6).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {problems.length > 6 && <li>…and {problems.length - 6} more.</li>}
            </ul>
          )}

          {rows.length > 0 && (
            <div className="mt-4">
              <div className="max-h-72 overflow-auto rounded-[var(--radius-control)] border border-border">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-surface text-left text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Recipient</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">tPOT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.line} className="border-t border-border">
                        <td className="num px-3 py-1.5">{shortAddress(r.to, 10, 8)}</td>
                        <td className="num px-3 py-1.5 text-right">{formatAmount(r.amount, decimals ?? 0, decimals ?? 0)}</td>
                        <td className="px-3 py-1.5">
                          {unfunded === null ? (
                            <span className="text-faint">checking</span>
                          ) : unfunded.includes(r.to) ? (
                            <span className="inline-flex items-center gap-1 text-warning"><X size={13} strokeWidth={1.75} />none</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-success"><Check size={13} strokeWidth={1.75} />has some</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="num mt-2 text-[12px] text-muted">
                {rows.length} of {MAX_RECIPIENTS} · total{" "}
                <span className="text-text">{formatAmount(total, decimals ?? 0, decimals ?? 0)} {sym}</span>
              </p>
            </div>
          )}

          {unfunded && unfunded.length > 0 && !steps && (
            <div className="mt-4 border-t border-border pt-4 text-[13px]">
              <p className="flex items-start gap-2 text-warning">
                <AlertTriangle size={16} strokeWidth={1.5} className="mt-px shrink-0" />
                {unfunded.length} recipient{unfunded.length === 1 ? " has" : "s have"} no tPOT. This token isn&apos;t
                self-sufficient, so the payout would revert for {unfunded.length === 1 ? "them" : "those addresses"}.
              </p>
              <button type="button" onClick={fundRecipients} disabled={!account || !!funding} className={`${button} mt-3`}>
                {funding
                  ? `Sending tPOT ${funding.done + 1} of ${funding.total}…`
                  : `Send 0.2 tPOT to ${unfunded.length} recipient${unfunded.length === 1 ? "" : "s"}`}
              </button>
              {!account && <span className="ml-3 text-[12px] text-muted">Connect a wallet first.</span>}
              {fundError && <p className="mt-2 text-[12px] text-danger">{fundError}</p>}
            </div>
          )}
        </section>

        {/* 4. send */}
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-[13px] font-medium">4. Pay out</h2>
          {stalled && (
            <p role="status" className="mt-3 flex items-start gap-2 text-[13px] text-warning">
              <AlertTriangle size={16} strokeWidth={1.5} className="mt-px shrink-0" />
              The testnet has not produced a block for {Math.floor((lagSeconds ?? 0) / 60)} minutes, so a payout would sit
              in the queue. It&apos;s disabled until blocks resume.
            </p>
          )}
          {apiError && <p className="mt-3 text-[13px] text-danger">Could not reach the node: {apiError}</p>}
          <button
            type="button"
            onClick={pay}
            disabled={!canPay}
            className="mt-3 h-9 rounded-[var(--radius-control)] bg-accent px-4 text-[13px] font-medium text-accent-fg disabled:opacity-40"
          >
            {!api && !apiError
              ? "Connecting to the node…"
              : rows.length > 0
                ? `Pay ${rows.length} recipient${rows.length === 1 ? "" : "s"}`
                : "Pay out"}
          </button>
          {steps && <StepList steps={steps} />}
          {(hashes.approve || hashes.payout) && (
            <div className="mt-3 space-y-1">
              {hashes.approve && <HashLine name="approve" hash={hashes.approve} />}
              {hashes.payout && <HashLine name="payout" hash={hashes.payout} />}
            </div>
          )}
          {verified && (
            <div className="mt-5 overflow-auto rounded-[var(--radius-control)] border border-border">
              <table className="w-full text-[12px]">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Recipient</th>
                    <th className="px-3 py-2 text-right font-medium">Paid</th>
                    <th className="px-3 py-2 text-right font-medium">Native balance</th>
                    <th className="px-3 py-2 text-right font-medium">ERC-20 balance</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {verified.map((v) => (
                    <tr key={v.to} className="border-t border-border">
                      <td className="num px-3 py-1.5">{shortAddress(v.to, 10, 8)}</td>
                      <td className="num px-3 py-1.5 text-right">{formatAmount(v.amount, decimals ?? 0, decimals ?? 0)}</td>
                      <td className="num px-3 py-1.5 text-right">{formatAmount(v.native, decimals ?? 0, decimals ?? 0)}</td>
                      <td className="num px-3 py-1.5 text-right">{formatAmount(v.evm, decimals ?? 0, decimals ?? 0)}</td>
                      <td className="px-3 py-1.5">
                        {v.ok ? <Check size={14} strokeWidth={1.75} className="text-success" /> : <X size={14} strokeWidth={1.75} className="text-danger" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {steps && (failed || verified) && (
            <button
              type="button"
              onClick={() => {
                setSteps(null);
                if (verified?.every((v) => v.ok)) setText("");
                setVerified(null);
                setRefresh((n) => n + 1);
              }}
              className={`${button} mt-4`}
            >
              {failed ? "Edit and try again" : "Start another payout"}
            </button>
          )}
          {running && <p className="mt-3 text-[12px] text-muted">Keep this tab open until the last step is ticked.</p>}
        </section>
      </div>

      <aside className="h-fit rounded-[var(--radius-card)] border border-border bg-surface p-4 text-[13px] sm:p-5">
        <h2 className="font-medium">How it pays</h2>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Two transactions from your EVM wallet: an <span className="num">approve</span> on the token&apos;s ERC-20
          address, then one <span className="num">Disperse.disperseAsset</span> call that moves each amount straight from
          you to its recipient. The contract never holds any of it.
        </p>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Afterwards every recipient is read twice, from pallet-assets and from the precompile, and both numbers must
          equal what they held before plus what you paid.
        </p>
        <dl className="mt-4 space-y-2 border-t border-border pt-3 text-[12px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Disperse contract</dt>
            <dd className="num flex items-center gap-1">
              {shortAddress(DISPERSE_ADDRESS, 8, 6)}
              <CopyButton value={DISPERSE_ADDRESS} label="Copy contract address" />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Fees</dt>
            <dd className="num">tPOT, from your wallet</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function HashLine({ name, hash }: { name: string; hash: string }) {
  return (
    <p className="num flex items-center gap-1 break-all text-[11px] text-faint">
      {name} {hash}
      <CopyButton value={hash} label={`Copy ${name} hash`} />
    </p>
  );
}
