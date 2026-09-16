# Thread project state

- Product: authority workflow explorer for the existing AuthorityReceipt contract.
- Testnet: BOT Chain, chain ID 968; public RPC `https://rpc.bohr.life`.
- Contract identity and deployment evidence: `BOTCHAIN_TESTNET.md`.
- Web interface: React/Vite app; Node API supplies bounded RPC reads; no write key or server signer.
- Supported write: wallet-confirmed `recordAction(bytes32)` by immutable controller only.
- Proof limitation: event records an action digest only; it is not a truth oracle for off-chain work.
- Outstanding: browser screenshots/checks, clean wallet test states, deployment and human review of any live action.
