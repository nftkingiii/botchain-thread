import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserProvider,
  Contract,
  Interface,
  encodeBytes32String,
} from "ethers";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  LoaderCircle,
  Network,
  Play,
  RefreshCw,
  Shield,
  Wallet,
  X,
} from "lucide-react";
import "./style.css";
const abi = [
  "function controller() view returns (address)",
  "function workflow() view returns (bytes32)",
  "function recordAction(bytes32 action)",
  "event AuthorityAction(bytes32 indexed workflow,address indexed actor,bytes32 indexed action,uint256 blockNumber)",
];
const iface = new Interface(abi);
const CHAIN = 968,
  HEX = "0x3c8",
  RPC = "https://rpc.bohr.life",
  EXPLORER = "https://scan.bohr.life";
type Snap = {
  chainId: number;
  latestBlock: number;
  contractAddress: string;
  controller: string;
  workflow: string;
  deployer: string;
  deploymentTx: string;
  deploymentBlock: number;
  deployed: boolean;
  actions: {
    workflow: string;
    actor: string;
    action: string;
    blockNumber: number;
    txHash: string;
    logIndex: number;
  }[];
  source: string;
  explorerBase: string;
};
declare global {
  interface Window {
    ethereum?: any;
  }
}
function short(s: string, n = 6) {
  return s ? `${s.slice(0, n + 2)}…${s.slice(-4)}` : "—";
}
function textError(e: any) {
  if (e?.code === 4001) return "Wallet request rejected. Nothing was sent.";
  return e?.shortMessage || e?.reason || e?.message || "Something went wrong.";
}
function App() {
  const [view, setView] = useState(location.hash.replace("#", "") || "explore"),
    [snap, setSnap] = useState<Snap | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [account, setAccount] = useState(""),
    [walletChain, setWalletChain] = useState<number | null>(null),
    [walletBusy, setWalletBusy] = useState(false),
    [actor, setActor] = useState(""),
    [action, setAction] = useState("THREAD_REVIEW"),
    [sim, setSim] = useState(false),
    [status, setStatus] = useState(""),
    [tx, setTx] = useState(""),
    [filter, setFilter] = useState(""),
    [copied, setCopied] = useState(false);
  const key = `thread:v1:${CHAIN}:${snap?.contractAddress?.toLowerCase() || "pending"}:${account.toLowerCase() || "disconnected"}`;
  useEffect(() => {
    const v = location.hash.replace("#", "");
    if (["explore", "simulate", "activity"].includes(v)) setView(v);
    const pop = () => {
      const h = location.hash.slice(1);
      if (["explore", "simulate", "activity"].includes(h)) setView(h);
    };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    fetch("/api/snapshot")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Read failed");
        return d;
      })
      .then((d) => {
        setSnap(d);
        setActor(d.controller);
      })
      .catch((e) => setError(textError(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!snap) return;
    try {
      const d = JSON.parse(localStorage.getItem(key) || "{}");
      if (d.actor) setActor(d.actor);
      if (d.action) setAction(d.action);
    } catch {}
  }, [key, snap]);
  useEffect(() => {
    if (snap)
      try {
        localStorage.setItem(key, JSON.stringify({ actor, action }));
      } catch {}
  }, [actor, action, key, snap]);
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    const accountsChanged = (xs: string[]) => {
      setAccount(xs[0] || "");
      setSim(false);
      setStatus("Account changed; local simulation cleared.");
    };
    const chainChanged = (id: string) => {
      setWalletChain(Number.parseInt(id, 16));
      setSim(false);
      setStatus("Wallet network changed; local simulation cleared.");
    };
    eth.on?.("accountsChanged", accountsChanged);
    eth.on?.("chainChanged", chainChanged);
    return () => {
      eth.removeListener?.("accountsChanged", accountsChanged);
      eth.removeListener?.("chainChanged", chainChanged);
    };
  }, []);
  const allowed =
    !!snap &&
    /^0x[0-9a-fA-F]{40}$/.test(actor) &&
    actor.toLowerCase() === snap.controller.toLowerCase();
  const filtered = useMemo(
    () =>
      snap?.actions.filter((x) =>
        `${x.actor} ${x.action} ${x.txHash}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ) || [],
    [snap, filter],
  );
  function navigate(v: string) {
    setView(v);
    history.pushState({}, "", `#${v}`);
    setSim(false);
  }
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/snapshot", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setSnap(d);
    } catch (e) {
      setError(textError(e));
    } finally {
      setLoading(false);
    }
  }
  async function connect() {
    if (!window.ethereum) {
      setStatus(
        "No injected EVM wallet detected. Public reads still work without one.",
      );
      return;
    }
    setWalletBusy(true);
    try {
      const p = new BrowserProvider(window.ethereum);
      const xs = await p.send("eth_requestAccounts", []);
      setAccount(xs[0] || "");
      const n = await p.getNetwork();
      setWalletChain(Number(n.chainId));
      setActor(xs[0] || "");
      setStatus(
        "Wallet connected for this session. No transaction has been sent.",
      );
    } catch (e) {
      setStatus(textError(e));
    } finally {
      setWalletBusy(false);
    }
  }
  async function switchChain() {
    if (!window.ethereum) return;
    setWalletBusy(true);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HEX }],
      });
      setWalletChain(CHAIN);
      setStatus("Switched to BOT Chain Testnet.");
    } catch (e: any) {
      if (e.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: HEX,
                chainName: "BOT Chain Testnet",
                nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
                rpcUrls: [RPC],
                blockExplorerUrls: [EXPLORER],
              },
            ],
          });
          setWalletChain(CHAIN);
          setStatus("BOT Chain Testnet added to wallet.");
        } catch (x) {
          setStatus(textError(x));
        }
      } else setStatus(textError(e));
    } finally {
      setWalletBusy(false);
    }
  }
  function disconnect() {
    setAccount("");
    setActor(snap?.controller || "");
    setWalletChain(null);
    setSim(false);
    setStatus(
      "Wallet disconnected from this interface. Wallet authorization was not revoked.",
    );
  }
  function simulate() {
    if (!/^0x[\da-fA-F]{40}$/.test(actor)) {
      setSim(false);
      setStatus("Enter a valid 20-byte actor address.");
      return;
    }
    if (!action.trim() || new TextEncoder().encode(action).length > 31) {
      setSim(false);
      setStatus("Action label must contain 1–31 UTF-8 bytes.");
      return;
    }
    setSim(true);
    setStatus(
      "Local ABI simulation only. No wallet prompt or transaction occurred.",
    );
  }
  async function record() {
    if (
      !window.ethereum ||
      !snap ||
      !allowed ||
      walletChain !== CHAIN ||
      !account ||
      account.toLowerCase() !== snap.controller.toLowerCase()
    )
      return;
    setWalletBusy(true);
    setStatus("Awaiting wallet confirmation…");
    setTx("");
    try {
      const p = new BrowserProvider(window.ethereum);
      const signer = await p.getSigner();
      const c = new Contract(snap.contractAddress, abi, signer);
      const data = encodeBytes32String(action.trim());
      await c.recordAction.staticCall(data);
      const gas = await c.recordAction.estimateGas(data);
      const sent = await c.recordAction(data, {
        gasLimit: (gas * 120n) / 100n,
      });
      setTx(sent.hash);
      setStatus("Transaction submitted; waiting for confirmation.");
      await sent.wait();
      setStatus(
        "Confirmed on BOT Chain Testnet. This records an action label; it does not prove the underlying business action happened.",
      );
      await refresh();
    } catch (e) {
      setStatus(textError(e));
    } finally {
      setWalletBusy(false);
    }
  }
  function exportCsv() {
    const rows = [
      ["block", "actor", "action_hash", "transaction"],
      ...filtered.map((x) => [x.blockNumber, x.actor, x.action, x.txHash]),
    ];
    const csv = rows
      .map((row) =>
        row.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "thread-authority-events.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function copy(s: string) {
    await navigator.clipboard?.writeText(s);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <div className="app">
      <header>
        <a
          className="brand"
          href="#explore"
          onClick={(e) => {
            e.preventDefault();
            navigate("explore");
          }}
        >
          <img src="/thread-mark.svg" />
          <span>Thread</span>
        </a>
        <nav aria-label="Main">
          <button
            className={view === "explore" ? "on" : ""}
            onClick={() => navigate("explore")}
          >
            <GitBranch size={16} />
            Explore
          </button>
          <button
            className={view === "simulate" ? "on" : ""}
            onClick={() => navigate("simulate")}
          >
            <Play size={15} />
            Simulate
          </button>
          <button
            className={view === "activity" ? "on" : ""}
            onClick={() => navigate("activity")}
          >
            <Activity size={16} />
            Activity{" "}
            <span className="count">{snap?.actions.length ?? "—"}</span>
          </button>
        </nav>
        <div className="headright">
          <span className="chain">
            <i />
            BOT Chain Testnet <code>968</code>
          </span>
          {account ? (
            <button
              className="wallet connected"
              title="Disconnect wallet"
              onClick={disconnect}
            >
              <Wallet size={15} />
              {short(account)}
              <X size={13} />
            </button>
          ) : (
            <button className="wallet" onClick={connect} disabled={walletBusy}>
              <Wallet size={15} />
              {walletBusy ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </header>
      <main>
        <div className="pagehead">
          <div>
            <h1>
              {view === "explore"
                ? "Authority path"
                : view === "simulate"
                  ? "Permission simulator"
                  : "Action activity"}
            </h1>
            <p>
              {view === "explore"
                ? "Inspect the deployed controller and the one action this contract permits."
                : view === "simulate"
                  ? "Check an actor locally, then explicitly choose whether to submit a receipt."
                  : "Read confirmed AuthorityAction events from the deployed contract."}
            </p>
          </div>
          <button
            className="iconbtn"
            onClick={refresh}
            title="Refresh chain snapshot"
            aria-label="Refresh chain snapshot"
          >
            <RefreshCw size={17} />
          </button>
        </div>
        {loading && (
          <div className="notice">
            <LoaderCircle className="spin" size={17} />
            Reading contract state from BOT Chain…
          </div>
        )}
        {error && (
          <div className="notice danger">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button onClick={refresh}>Retry</button>
          </div>
        )}
        {!loading && snap && (
          <div className="sourcebar">
            <span>
              <i className="live" />
              RPC read · block <b>{snap.latestBlock.toLocaleString()}</b>
            </span>
            <span>
              Contract{" "}
              <a
                href={`${EXPLORER}/address/${snap.contractAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                {short(snap.contractAddress, 8)} <ExternalLink size={12} />
              </a>
            </span>
            <span>Source: deployed state + bounded event logs</span>
          </div>
        )}
        {view === "explore" && (
          <section className="workspace">
            <aside className="inventory">
              <div className="lanehead">
                <span>CONTRACT</span>
                <button
                  className="tiny"
                  title="Copy contract address"
                  onClick={() => snap && copy(snap.contractAddress)}
                >
                  <Copy size={14} />
                </button>
              </div>
              <div className="contractpick">
                <div className="contractglyph">
                  <Shield size={19} />
                </div>
                <div>
                  <strong>AuthorityReceipt</strong>
                  <small>Verified deployment · BOT Chain Testnet</small>
                </div>
                <Check size={16} className="ok" />
              </div>
              <p className="subhead">DEPLOYMENT</p>
              <a
                className="hashlink"
                href={snap ? `${EXPLORER}/tx/${snap.deploymentTx}` : "#"}
                target="_blank"
                rel="noreferrer"
              >
                {short(snap?.deploymentTx || "", 9)} <ExternalLink size={12} />
              </a>
              <small className="muted">
                Block {snap?.deploymentBlock.toLocaleString() || "—"}
              </small>
              <div className="sidefoot">
                One verified contract is configured. No other addresses or
                authority edges are inferred.
              </div>
            </aside>
            <section className="pathlane">
              <div className="lanehead">
                AUTHORITY RELATIONSHIP{" "}
                <span className="verified">ON-CHAIN</span>
              </div>
              <div className="path">
                <div className="node deployer">
                  <div className="nodeicon">
                    <Network size={17} />
                  </div>
                  <div>
                    <small>DEPLOYER</small>
                    <strong>{short(snap?.deployer || "", 8)}</strong>
                    <span>Deployment sender; not a separate role</span>
                  </div>
                  <button
                    title="Copy deployer address"
                    onClick={() => snap && copy(snap.deployer)}
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <div className="edge">
                  <span>same address verified</span>
                </div>
                <div className="node controller">
                  <div className="nodeicon">
                    <Shield size={17} />
                  </div>
                  <div>
                    <small>CONTROLLER · IMMUTABLE</small>
                    <strong>{short(snap?.controller || "", 8)}</strong>
                    <span>Only address allowed to call recordAction</span>
                  </div>
                  <button
                    title="Copy controller address"
                    onClick={() => snap && copy(snap.controller)}
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <div className="edge accent">
                  <span>authorized caller</span>
                </div>
                <button
                  className="node actionnode"
                  onClick={() => navigate("simulate")}
                >
                  <div className="nodeicon">
                    <Activity size={17} />
                  </div>
                  <div>
                    <small>SUPPORTED CONTRACT ACTION</small>
                    <strong>recordAction(bytes32)</strong>
                    <span>
                      Emits an action receipt; not proof of real-world
                      completion
                    </span>
                  </div>
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className="diagramnote">
                <span className="linekey" />
                Permissions come from the deployed contract’s controller() state
                and verified source.
              </div>
            </section>
            <aside className="detail">
              <div className="lanehead">EVIDENCE</div>
              <h2>What is verified</h2>
              <ul className="facts">
                <li>
                  <Check size={15} />
                  <span>
                    Chain ID matches <b>968</b>
                  </span>
                </li>
                <li>
                  <Check size={15} />
                  <span>Contract bytecode is present</span>
                </li>
                <li>
                  <Check size={15} />
                  <span>Deployment receipt succeeded</span>
                </li>
                <li>
                  <Check size={15} />
                  <span>Controller and workflow read from contract</span>
                </li>
              </ul>
              <div className="digest">
                <small>WORKFLOW DIGEST</small>
                <code>{snap?.workflow || "Loading…"}</code>
                <button onClick={() => snap && copy(snap.workflow)}>
                  <Copy size={14} /> Copy
                </button>
              </div>
              <a
                className="textlink"
                href={`${EXPLORER}/address/${snap?.contractAddress || ""}`}
                target="_blank"
                rel="noreferrer"
              >
                Open verified source <ExternalLink size={13} />
              </a>
              <p className="caveat">
                An on-chain receipt proves only that this controller submitted a
                label. It does not establish that the described business action
                occurred.
              </p>
            </aside>
          </section>
        )}
        {view === "simulate" && (
          <section className="simulator">
            <div className="simintro">
              <div className="simicon">
                <Play size={19} />
              </div>
              <h2>Test an actor against the deployed rule</h2>
              <p>
                This local check mirrors the contract’s fixed controller check.
                It does not simulate chain state or send a transaction.
              </p>
            </div>
            <form
              className="simform"
              onSubmit={(e) => {
                e.preventDefault();
                simulate();
              }}
            >
              <label>
                ACTOR ADDRESS
                <input
                  value={actor}
                  onChange={(e) => {
                    setActor(e.target.value);
                    setSim(false);
                  }}
                  placeholder="0x…"
                  spellCheck={false}
                />
              </label>
              <label>
                ACTION LABEL <small>1–31 UTF-8 bytes</small>
                <input
                  value={action}
                  maxLength={31}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setSim(false);
                  }}
                  placeholder="e.g. THREAD_REVIEW"
                />
              </label>
              <button className="primary" type="submit">
                <Play size={15} /> Simulate permission
              </button>
            </form>
            {sim && (
              <div className={`verdict ${allowed ? "allow" : "deny"}`}>
                <span className="verdicticon">
                  {allowed ? <Check size={19} /> : <X size={19} />}
                </span>
                <div>
                  <strong>
                    {allowed
                      ? "Allowed by controller check"
                      : "Denied by controller check"}
                  </strong>
                  <p>
                    {allowed
                      ? "Actor matches the immutable controller. The supported call is recordAction(bytes32)."
                      : "Actor does not match the immutable controller read from chain."}{" "}
                    This is a local ABI-level permission preview.
                  </p>
                </div>
              </div>
            )}
            {account && (
              <div className="writebox">
                <div className="writehead">
                  <h3>Record an on-chain action receipt</h3>
                  <span className="manual">MANUAL WALLET WRITE</span>
                </div>
                <p>
                  Available only when the connected wallet is the deployed
                  controller and is on BOT Chain Testnet. Clicking asks your
                  wallet to simulate, estimate, and submit{" "}
                  <code>recordAction</code>.
                </p>
                {walletChain !== CHAIN && (
                  <button
                    className="secondary"
                    onClick={switchChain}
                    disabled={walletBusy}
                  >
                    <Network size={15} />{" "}
                    {walletChain
                      ? "Switch to BOT Chain Testnet"
                      : "Add BOT Chain Testnet"}
                  </button>
                )}
                {walletChain === CHAIN &&
                  account.toLowerCase() === snap?.controller.toLowerCase() &&
                  sim &&
                  allowed && (
                    <button
                      className="primary write"
                      onClick={record}
                      disabled={walletBusy}
                    >
                      <Wallet size={15} />
                      {walletBusy
                        ? "Wallet action pending…"
                        : "Submit action receipt"}
                    </button>
                  )}
                {walletChain === CHAIN &&
                  account.toLowerCase() !== snap?.controller.toLowerCase() && (
                    <div className="inlinewarn">
                      <AlertCircle size={15} />
                      Connected account is not this contract’s controller;
                      writing is disabled.
                    </div>
                  )}
                {tx && (
                  <a
                    className="textlink"
                    href={`${EXPLORER}/tx/${tx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View submitted transaction {short(tx, 8)}{" "}
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            )}
            {status && (
              <div className="statusmsg" role="status">
                {status}
              </div>
            )}
          </section>
        )}
        {view === "activity" && (
          <section className="activity">
            <div className="activitytools">
              <label className="search">
                Search receipts
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Actor, action hash, transaction…"
                />
              </label>
              <button
                className="secondary"
                onClick={exportCsv}
                disabled={!filtered.length}
              >
                <Download size={15} /> Export CSV
              </button>
            </div>
            <p className="scope">
              Events are queried from deployment block to latest block and
              capped to the most recent 100 returned records. Empty means no
              matching logs were returned, not that the real-world workflow did
              not occur.
            </p>
            {loading ? (
              <div className="empty">
                <LoaderCircle className="spin" />
                Loading receipts…
              </div>
            ) : filtered.length ? (
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>BLOCK</th>
                      <th>ACTOR</th>
                      <th>ACTION DIGEST</th>
                      <th>TRANSACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered
                      .slice()
                      .reverse()
                      .map((x) => (
                        <tr key={`${x.txHash}-${x.logIndex}`}>
                          <td>{x.blockNumber.toLocaleString()}</td>
                          <td>
                            <code>{short(x.actor, 8)}</code>
                          </td>
                          <td>
                            <code>{short(x.action, 8)}</code>
                          </td>
                          <td>
                            <a
                              href={`${EXPLORER}/tx/${x.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {short(x.txHash, 8)} <ExternalLink size={12} />
                            </a>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                <Activity size={21} />
                <strong>
                  {filter
                    ? "No events match this search."
                    : "No AuthorityAction events found."}
                </strong>
                <span>
                  Confirmed contract events will appear here after a controller
                  submits an action receipt.
                </span>
              </div>
            )}
          </section>
        )}
        {status && view !== "simulate" && (
          <div className="toast" role="status">
            {copied ? "Copied to clipboard." : status}
          </div>
        )}
      </main>
      <footer>
        <span>Thread · BOT Chain Testnet · Read path is public</span>
        <span>
          Receipts are evidence of calls, not underlying business truth.
        </span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
