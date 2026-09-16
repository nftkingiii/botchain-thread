export const defaults = Object.freeze({
  chainId: 968,
  rpcUrl: "https://rpc.bohr.life",
  contractAddress: "0x724317160f3844Cc5D9C2c85748b81dddDC83947",
  deploymentTx:
    "0xbafdf600149a098bb02d471f582b6b306051938df0af5f2b95a4252d8dc8572e",
  deploymentBlock: "0x16804e8",
});
export const abi = [
  "function controller() view returns (address)",
  "function workflow() view returns (bytes32)",
  "function recordAction(bytes32 action)",
  "event AuthorityAction(bytes32 indexed workflow,address indexed actor,bytes32 indexed action,uint256 blockNumber)",
  "error NotController()",
  "error ZeroAddress()",
];
export const eventTopic =
  "0x7670f048ba85cadb7b06c05b9c26ffbc6fe3759c1bafb0e567775fed77814d2e";

export function getConfig(env = process.env) {
  const chainId = Number(env.BOTCHAIN_CHAIN_ID || defaults.chainId);
  const contractAddress = env.BOTCHAIN_CONTRACT_ADDRESS;
  if (!Number.isSafeInteger(chainId) || chainId !== defaults.chainId)
    throw new Error("BOTCHAIN_CHAIN_ID must be 968.");
  if (!contractAddress || !/^0x[\da-fA-F]{40}$/.test(contractAddress))
    throw new Error(
      "Set BOTCHAIN_CONTRACT_ADDRESS to the verified deployed contract.",
    );
  const deploymentTx = env.BOTCHAIN_DEPLOYMENT_TX;
  const deploymentBlock = env.BOTCHAIN_DEPLOYMENT_BLOCK;
  if (!deploymentTx || !/^0x[\da-fA-F]{64}$/.test(deploymentTx))
    throw new Error(
      "Set BOTCHAIN_DEPLOYMENT_TX to the verified deployment transaction.",
    );
  if (!deploymentBlock || !/^0x[\da-fA-F]+$/.test(deploymentBlock))
    throw new Error(
      "Set BOTCHAIN_DEPLOYMENT_BLOCK to its verified block number.",
    );
  return {
    chainId,
    rpcUrl: env.BOTCHAIN_RPC_URL || defaults.rpcUrl,
    contractAddress,
    deploymentTx,
    deploymentBlock,
  };
}

export async function rpc(
  method,
  params = [],
  { url = defaults.rpcUrl, fetchImpl = fetch } = {},
) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || `RPC error: ${method}`);
  if (body.result === undefined || body.result === null)
    throw new Error(`RPC returned no result for ${method}`);
  return body.result;
}

export async function readContract(config = getConfig(), fetchImpl = fetch) {
  const client = (method, params) =>
    rpc(method, params, { url: config.rpcUrl, fetchImpl });
  const [chainHex, blockHex, code, tx, receipt] = await Promise.all([
    client("eth_chainId"),
    client("eth_blockNumber"),
    client("eth_getCode", [config.contractAddress, "latest"]),
    client("eth_getTransactionByHash", [config.deploymentTx]),
    client("eth_getTransactionReceipt", [config.deploymentTx]),
  ]);
  const chainId = Number.parseInt(chainHex, 16);
  if (chainId !== config.chainId)
    throw new Error(
      `RPC chain ${chainId} does not match configured ${config.chainId}.`,
    );
  if (code === "0x" || !/^0x[\da-fA-F]+$/.test(code))
    throw new Error("No contract bytecode at configured address.");
  if (
    !tx ||
    !receipt ||
    receipt.status !== "0x1" ||
    receipt.contractAddress?.toLowerCase() !==
      config.contractAddress.toLowerCase()
  )
    throw new Error(
      "Deployment transaction does not verify this contract address.",
    );
  const selector = (s) => s.toLowerCase();
  const coder = (await import("ethers")).AbiCoder.defaultAbiCoder();
  const fromBlock = `0x${Math.max(Number.parseInt(config.deploymentBlock, 16), Number.parseInt(blockHex, 16) - 20000).toString(16)}`;
  const [controllerRaw, workflowRaw, logs] = await Promise.all([
    client("eth_call", [
      { to: config.contractAddress, data: "0xf77c4791" },
      "latest",
    ]),
    client("eth_call", [
      { to: config.contractAddress, data: "0xa3344125" },
      "latest",
    ]),
    client("eth_getLogs", [
      {
        address: config.contractAddress,
        fromBlock,
        toBlock: blockHex,
        topics: [eventTopic],
      },
    ]),
  ]);
  const controller = coder.decode(["address"], controllerRaw)[0];
  const workflow = coder.decode(["bytes32"], workflowRaw)[0];
  if (tx.from.toLowerCase() !== controller.toLowerCase())
    throw new Error(
      "Deployment sender differs from immutable controller; authority graph not shown.",
    );
  const actions = logs.slice(-100).map((log) => ({
    workflow: log.topics[1],
    actor: `0x${log.topics[2].slice(-40)}`,
    action: log.topics[3],
    blockNumber: Number.parseInt(log.data.slice(2), 16),
    txHash: log.transactionHash,
    logIndex: Number.parseInt(log.logIndex, 16),
  }));
  return {
    chainId,
    latestBlock: Number.parseInt(blockHex, 16),
    contractAddress: config.contractAddress,
    controller,
    workflow,
    deployer: tx.from,
    deploymentTx: config.deploymentTx,
    deploymentBlock: Number.parseInt(receipt.blockNumber, 16),
    deployed: true,
    actions,
    source: "BOT Chain RPC; deployed AuthorityReceipt ABI",
    explorerBase: "https://scan.bohr.life",
  };
}
