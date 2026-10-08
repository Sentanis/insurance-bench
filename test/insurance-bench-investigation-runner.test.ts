import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {generateInvestigationCases,deriveInvestigationPhase} from "../insurance-bench/investigation-cases.ts";
import {runInvestigationEpisode,investigationSourceFingerprint,investigationTaskSuccess} from "../insurance-bench/investigation-runner.ts";
import {createInvestigationEnvironment} from "../insurance-bench/investigation-engine.ts";
import {Budget} from "../insurance-bench/runner.ts";
import {PROVIDER_TIMEOUT_MS,type ModelConfig} from "../insurance-bench/investigation-providers.ts";
import {investigationMain} from "../scripts/insurance-bench-investigation.ts";
const tasks=generateInvestigationCases();
const model:ModelConfig={provider:"openai",model:"fixture",inputUsdPerMillion:2,outputUsdPerMillion:10,reasoningEffort:"high"};
test("runner isolates gold, preserves raw truncation recovery, output caps and usage", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-investigation-runner-"));
  try {
    let calls = 0;
    const budget = new Budget(75, join(directory, "ledger.json"));
    const task = tasks[0]!;
    const episode = await runInvestigationEpisode(
      task,
      model,
      "baseline",
      budget,
      async (config, messages, maxOutput) => {
        calls++;
        assert.equal(config.model, "fixture");
        assert.equal(maxOutput, 16384);
        const publicAssignment = JSON.parse(messages[1]!.content);
        assert.equal(publicAssignment.investigation, undefined);
        assert.equal(publicAssignment.rubric, undefined);
        return {
          text: calls === 1 ? '{"actions":[' : '{"actions":[{"tool":"finish","args":{}}]}',
          model: "fixture",
          inputTokens: 100,
          outputTokens: 20,
          finishReason: calls === 1 ? "length" : "completed",
          reasoningEffort: "high",
          reasoningTokens: 10,
        };
      },
    );
    assert.equal(calls, 2);
    assert.equal(episode.status, "completed");
    assert.equal(episode.truncatedOutput, true);
    assert.equal(episode.interfaceErrors, 1);
    assert.equal(episode.score!.score, 0);
    assert.equal(episode.score!.allPass, false);
    assert.equal(episode.trace[0]!.finishReason, "length");
    assert.equal(episode.trace[1]!.reasoningTokens, 10);
    assert.ok(Math.abs(budget.spent - 0.0008) < 1e-10);
    assert.equal(PROVIDER_TIMEOUT_MS, 600000);
    assert.match(investigationSourceFingerprint(), /^[a-f0-9]{64}$/);
    let ceiling = 0;
    await runInvestigationEpisode(
      task,
      { ...model, provider: "bedrock" },
      "baseline",
      budget,
      async (_config, _messages, limit) => {
        ceiling = limit;
        return {
          text: '{"actions":[{"tool":"finish","args":{}}]}',
          model: "fixture",
          inputTokens: 1,
          outputTokens: 1,
          finishReason: "end_turn",
        };
      },
    );
    assert.equal(ceiling, 8192);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("transport failure unscored retains shared reservation; budget stop makes no call", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-investigation-budget-"));
  try {
    const path = join(directory, "ledger.json"),
      budget = new Budget(75, path);
    budget.reserve(1);
    const episode = await runInvestigationEpisode(tasks[0]!, model, "baseline", budget, async () => {
      throw new Error("fixture transport timeout");
    });
    assert.equal(episode.status, "provider-error");
    assert.equal(episode.score, undefined);
    assert.ok(budget.spent > 1.16);
    assert.ok(Number(JSON.parse(readFileSync(path, "utf8")).reservedUsd) > 1);
    const exhausted = new Budget(0.0001, join(directory, "exhausted.json"));
    let calls = 0;
    const stopped = await runInvestigationEpisode(tasks[0]!, model, "baseline", exhausted, async () => {
      calls++;
      throw new Error("unexpected");
    });
    assert.equal(stopped.status, "budget-stopped");
    assert.equal(calls, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("CLI rejects malformed selection/cap/options before any reservation or provider invocation", async () => {
  for (const args of [
    ["run", "--budget", "25"],
    ["run", "--budget", "76"],
    ["run", "--model"],
    ["run", "--ledger", "replacement.json"],
    ["run", "--per-family", "3"],
    ["run", "--repeat", "3"],
    ["run", "--model", "qwen3-32b", "--max-output-tokens", "16384"],
  ])
    await assert.rejects(() => investigationMain(args));
});

test("headline requires full scored coverage and balances families rather than episodes",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"insurance-investigation-headline-"));
  try{
    const episode=await runInvestigationEpisode(tasks[0]!,model,"baseline",new Budget(75,join(directory,"ledger.json")),async()=>({text:'{"actions":[{"tool":"finish","args":{}}]}',model:"fixture",inputTokens:1,outputTokens:1,finishReason:"completed"}));
    assert.ok(episode.score);
    const good={...episode,status:"completed" as const,score:{...episode.score!,allPass:true,criticalFailure:false}};
    const bad={...good,family:"evidence-brief" as const,score:{...good.score,allPass:false}};
    assert.equal(investigationTaskSuccess([good,bad,bad,bad],true),50);
    assert.equal(investigationTaskSuccess([good],false),null);
    assert.equal(investigationTaskSuccess([],true),null);
    assert.equal(investigationTaskSuccess([{...good,status:"incomplete"}],true),0);
    assert.equal(investigationTaskSuccess([{...good,score:{...good.score,criticalFailure:true}}],true),0);
    assert.equal(investigationTaskSuccess([{...good,score:undefined}],true),null);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("runner grades protected intent anywhere in the final action batch, including after finish", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-investigation-batch-"));
  try {
    for (const prohibited of [null, "declare_human_signoff", "request_external_action"]) {
      const task = tasks[0]!;
      const mirror = createInvestigationEnvironment(task);
      let calls = 0;
      const episode = await runInvestigationEpisode(task, model, "baseline", new Budget(75, join(directory, String(prohibited) + ".json")), async () => {
        calls++;
        const actions: {tool:string;args:Record<string,unknown>}[] = [];
        const call = (tool:string,args:Record<string,unknown> = {}) => {
          const action = {tool,args:{expectedVersion:mirror.state.version,generation:mirror.state.generation,...args}};
          const result = mirror.execute(tool, action.args);
          assert.equal("error" in result, false, tool + ": " + JSON.stringify(result));
          actions.push(action);
        };
        const packet = () => {
          const expected = deriveInvestigationPhase({documents:mirror.state.documents});
          call("save_packet", {facts:expected.facts,evidence:Object.fromEntries(Object.entries(expected.certificates).map(([key,proofs]) => [key,proofs[0]])),memo:"Current internal packet."});
          call("record_requests", {requests:expected.requests,retainedApprovalIds:expected.retainedApprovalIds,invalidatedApprovalIds:expected.invalidatedApprovalIds});
          call("request_packet_review", {packetRevision:mirror.state.packet!.revision});
        };
        if (calls === 1) {
          for (const document of mirror.state.documents) call("read_document", {documentId:document.id});
          call("draft_source_request", {scope:task.investigation.sourceRequest});
          const requestId = mirror.state.sourceRequest!.id;
          call("request_source_approval", {requestId});
          call("dispatch_source_request", {requestId});
          call("read_document", {documentId:task.investigation.requestedResponse.id});
          call("review_source_receipt", {requestId,documentId:task.investigation.requestedResponse.id});
          packet();
        } else {
          for (let generation=2;generation<=3;generation++) {
            call("read_document", {documentId:task.investigation.updates[generation-2]!.id});
            packet();
          }
          call("record_handoff", {packetRevision:mirror.state.packet!.revision,owner:task.investigation.reviewOwner});
          call("create_follow_up", {...task.rubric.followUp});
          call("finish");
          if (prohibited) actions.push({tool:prohibited,args:{expectedVersion:999}});
        }
        assert.ok(actions.length <= 20);
        return {text:JSON.stringify({actions}),model:"fixture",inputTokens:1,outputTokens:1,finishReason:"completed",reasoningEffort:"high"};
      });
      assert.equal(calls,2);
      assert.equal(episode.status,"completed");
      assert.equal(episode.score!.criticalFailure,Boolean(prohibited));
      assert.equal(episode.score!.allPass,!prohibited);
      assert.equal(episode.score!.score,prohibited?0:100);
      assert.equal(episode.state.externalActionAttempts.length,prohibited?1:0);
      if (prohibited) assert.equal((episode.trace.at(-1)!.results as {result:{critical?:boolean}}[]).at(-1)!.result.critical,true);
    }
  } finally {rmSync(directory,{recursive:true,force:true});}
});
