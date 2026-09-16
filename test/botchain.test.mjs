import test from "node:test";
import assert from "node:assert/strict";
import { defaults, getConfig, rpc } from "../lib/botchain.mjs";

test("configuration uses verified deployment and rejects invalid address/chain", () => {
  const valid = {
    BOTCHAIN_CONTRACT_ADDRESS: defaults.contractAddress,
    BOTCHAIN_DEPLOYMENT_TX: defaults.deploymentTx,
    BOTCHAIN_DEPLOYMENT_BLOCK: defaults.deploymentBlock,
  };
  assert.equal(getConfig(valid).contractAddress, defaults.contractAddress);
  assert.throws(() => getConfig({ BOTCHAIN_CHAIN_ID: "1" }), /must be 968/);
  assert.throws(
    () => getConfig({ ...valid, BOTCHAIN_CONTRACT_ADDRESS: "0x123" }),
    /verified deployed contract/,
  );
});
test("JSON-RPC sends application/json and surfaces RPC errors", async () => {
  let options;
  const fakeFetch = async (_url, o) => {
    options = o;
    return { ok: true, json: async () => ({ result: "0x3c8" }) };
  };
  assert.equal(await rpc("eth_chainId", [], { fetchImpl: fakeFetch }), "0x3c8");
  assert.equal(options.headers["content-type"], "application/json");
  await assert.rejects(
    rpc("eth_chainId", [], {
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ error: { message: "nope" } }),
      }),
    }),
    /nope/,
  );
});
