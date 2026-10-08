import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { awsArguments, awsJson, PROVIDER_TIMEOUT_MS, requestJson, type ProviderTransport } from "../insurance-bench/investigation-providers.ts";
import { PROVIDER_TIMEOUT_MS as historicalDeadline } from "../insurance-bench/providers.ts";

test("new transport changes only its prospective deadline and preserves historical source", () => {
  const legacy = readFileSync(new URL("../insurance-bench/providers.ts", import.meta.url), "utf8");
  const candidate = readFileSync(new URL("../insurance-bench/investigation-providers.ts", import.meta.url), "utf8");
  assert.equal(historicalDeadline, 300_000);
  assert.equal(candidate.slice(candidate.indexOf('import { execFile }')), legacy.replace('export const PROVIDER_TIMEOUT_MS = 300_000;', 'export const PROVIDER_TIMEOUT_MS = 600_000;'));
});
test("all new HTTP/AWS paths use the declared 600-second deadline without retries", async t => {
  assert.equal(PROVIDER_TIMEOUT_MS, 600_000);
  const args = awsArguments("bench-test", "us-east-1");
  assert.equal(args[args.indexOf("--cli-connect-timeout") + 1], "10");
  assert.equal(args[args.indexOf("--cli-read-timeout") + 1], "595");
  let calls = 0;
  const transport: ProviderTransport = { env: {},
    aws: async () => { calls++; throw { killed: true, stderr: "withheld" }; },
    fetch: ((_url, init) => { calls++; return new Promise((_resolve,reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("withheld")), {once:true});
    }); }) as typeof fetch,
  };
  await assert.rejects(awsJson(args,transport), /request exceeded 600 seconds; billing status uncertain/);
  t.mock.timers.enable({apis:["setTimeout"]});
  for (const provider of ["openai","anthropic","gemini","xai"]) {
    const pending = requestJson(provider,"https://mock.invalid",{},transport);
    const rejection = assert.rejects(pending,new RegExp(`Insurance Bench ${provider}: request exceeded 600 seconds`));
    t.mock.timers.tick(600_000);
    await rejection;
  }
  assert.equal(calls,5);
});
