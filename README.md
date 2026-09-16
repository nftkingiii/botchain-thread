# Thread

Thread is a deployed-contract authority workflow explorer for BOT Chain Testnet. It answers a narrow question: which actor can call the configured contract action, what does a local permission check conclude, and what action receipts have actually been emitted?

It is distinct from Cessio-style transaction/workflow products and BotTrace-style general receipt-integrity tooling: Thread foregrounds the deployed contract's exact authority path and ABI-supported action, with the call receipt shown as limited evidence rather than a claim that the underlying work occurred.

## What works

- Public read-only access without a wallet: chain ID, block, bytecode, deployment receipt, immutable `controller()` and `workflow()` values, and `AuthorityAction` logs.
- An evidence-backed path diagram: deployment sender (explicitly not a separate role) → immutable controller → the only supported call, `recordAction(bytes32)`.
- Local actor/action simulation, with allowed/denied results clearly separated from chain simulation.
- Optional injected-wallet connect/disconnect UI, account and chain-change handling, add/switch BOT Chain Testnet, and an explicitly clicked controller-only receipt write. It checks the deployed ABI with `staticCall`, estimates gas, then requests wallet confirmation. The app never initiates a write automatically and has no private-key storage.
- Search and CSV export for the bounded, on-chain event list.
- Desktop relationship workspace with a mobile stacked/drill-down equivalent.

An `AuthorityAction` receipt proves only that the controller called the contract with a bytes32 label. It does not verify that a business action happened. No oracle, external prover, or independent workflow data source is integrated. RPC and explorer availability are external dependencies.

## Verified deployment

See [BOTCHAIN_TESTNET.md](BOTCHAIN_TESTNET.md) for the source-verified contract address, deployment transaction, and explorer link. The app reads these values from environment variables and does not infer additional contracts or roles.

## Local setup

```sh
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
corepack pnpm start
```

Then open `http://localhost:4324`. On PowerShell, use `Copy-Item .env.example .env` instead of `copy` if needed. Required configuration names and the public verified testnet values are in `.env.example`; no secrets are needed. The node server binds to `0.0.0.0`, serves the built app with history fallback, and exposes `/healthz` with a revision field.

## Railway

Set the service root to this repository and use the checked-in `railway.json`. Build is `corepack pnpm install --frozen-lockfile && corepack pnpm build`; start is `corepack pnpm start`. Configure `BOTCHAIN_RPC_URL`, `BOTCHAIN_CHAIN_ID`, `BOTCHAIN_CONTRACT_ADDRESS`, `BOTCHAIN_DEPLOYMENT_TX`, and `BOTCHAIN_DEPLOYMENT_BLOCK` from the verified deployment evidence. Railway supplies `PORT`. The healthcheck path is `/healthz`. Do not add wallet keys or RPC secrets to the frontend.

## Testnet proof checklist

- [x] Verified source and deployment transaction for the testnet contract.
- [x] Live RPC read-back matches chain 968; code, controller, workflow, and deployment receipt verified.
- [ ] In a clean browser, inspect public reads and exercise both permitted and denied local simulation cases.
- [ ] Review wallet account/network flow and explicitly approve any real `recordAction` test write; capture pending/rejected/reverted/confirmed states.
- [ ] Capture the resulting event and explorer/read-back evidence. Describe it only as a contract receipt, not as proof of underlying business completion.

The contract source and test/deployment history remain the authoritative on-chain package; the web service is a read/inspect interface with one explicitly gated call to the existing deployed contract.
