import assert from "node:assert/strict";
import test from "node:test";

import plugin, { server } from "../dist/index.js";
import {
  RINDAMAN_RULE,
  RINDAMAN_RULE_MARKER,
  RINDAMAN_REVIEWER_RULE_MARKER,
  RINDAMAN_SENIOR_FULLSTACK_RULE_MARKER,
} from "../dist/rindaman-rule.js";

const createTextPart = (text) => ({
  type: "text",
  text,
});

const createMessage = (role, text, id = role + "-message") => ({
  info: {
    id,
    role,
  },
  parts: [createTextPart(text)],
});

const createOutput = (messages) => ({
  messages: structuredClone(messages),
});

const runTransform = async (messages) => {
  const hooks = await server();
  const transform = hooks["experimental.chat.messages.transform"];

  assert.equal(typeof transform, "function", "transform hook should exist");

  const output = createOutput(messages);
  await transform({}, output);
  return output.messages;
};

const createToolContext = (overrides = {}) => ({
  sessionID: overrides.sessionID ?? `session-${Date.now()}-${Math.random()}`,
  directory: overrides.directory ?? process.cwd(),
});

const readStatus = async (hooks, context) =>
  JSON.parse(await hooks.tool.rindaman_status.execute({}, context));

const getRindamanRuleMessages = (messages) =>
  messages.filter(
    (message) =>
      message.info?.role === "system" &&
      message.parts?.some(
        (part) =>
          part.type === "text" &&
          typeof part.text === "string" &&
          part.text.includes(RINDAMAN_RULE_MARKER),
      ),
  );

const getSeniorFullstackRuleMessages = (messages) =>
  messages.filter(
    (message) =>
      message.info?.role === "system" &&
      message.parts?.some(
        (part) =>
          part.type === "text" &&
          typeof part.text === "string" &&
          part.text.includes(RINDAMAN_SENIOR_FULLSTACK_RULE_MARKER),
      ),
  );

const getReviewerRuleMessages = (messages) =>
  messages.filter(
    (message) =>
      message.info?.role === "system" &&
      message.parts?.some(
        (part) =>
          part.type === "text" &&
          typeof part.text === "string" &&
          part.text.includes(RINDAMAN_REVIEWER_RULE_MARKER),
      ),
  );

test("plugin exports expected id", () => {
  assert.equal(plugin.id, "rindaman");
  assert.equal(plugin.server, server);
});

test("injects rindaman rule by default", async () => {
  const messages = await runTransform([
    createMessage("user", "Implement the dashboard filter"),
  ]);

  assert.equal(messages[0].info.role, "system");
  assert.equal(messages[0].parts[0].text, RINDAMAN_RULE);
  assert.equal(getRindamanRuleMessages(messages).length, 1);
  assert.equal(getSeniorFullstackRuleMessages(messages).length, 0);
});

test("does not duplicate rindaman rule", async () => {
  const existingRule = {
    info: {
      id: "rindaman-global-rule",
      role: "system",
    },
    parts: [createTextPart(RINDAMAN_RULE)],
  };

  const messages = await runTransform([
    existingRule,
    createMessage("user", "Implement the dashboard filter"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
  assert.equal(messages[0].parts[0].text, RINDAMAN_RULE);
});

test("disables rindaman for session", async () => {
  const messages = await runTransform([
    createMessage("user", "/rindaman off"),
    createMessage("user", "Implement the dashboard filter"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 0);
});

test("re-enables rindaman after disabling", async () => {
  const messages = await runTransform([
    createMessage("user", "/rindaman off"),
    createMessage("user", "/rindaman on"),
    createMessage("user", "Implement the dashboard filter"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
  assert.equal(messages[0].parts[0].text, RINDAMAN_RULE);
});

test("supports strict compatibility toggles", async () => {
  const messages = await runTransform([
    createMessage("user", "/strict off"),
    createMessage("user", "/strict on"),
    createMessage("user", "Implement the dashboard filter"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
});

test("supports quality compatibility toggles", async () => {
  const messages = await runTransform([
    createMessage("user", "/quality off"),
    createMessage("user", "/quality on"),
    createMessage("user", "Implement the dashboard filter"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
});

test("accepts line-based commands inside a multi-line message", async () => {
  const messages = await runTransform([
    createMessage("user", "Continue this task.\n/rindaman off\nThen explain status."),
    createMessage("user", "Implement the dashboard filter"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 0);
});

test("does not toggle for incidental discussion text", async () => {
  const messages = await runTransform([
    createMessage("user", "Can you explain what rindaman means in this plugin?"),
    createMessage("user", "Implement the dashboard filter"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
  assert.equal(getSeniorFullstackRuleMessages(messages).length, 0);
});

test("implementation requests inject senior fullstack guidance", async () => {
  const messages = await runTransform([
    createMessage("user", "Implement a new auth flow for the dashboard"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
  assert.equal(getSeniorFullstackRuleMessages(messages).length, 1);
});

test("generic implementation request without engineering context stays core-only", async () => {
  const messages = await runTransform([
    createMessage("user", "Implement the dashboard filter"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
  assert.equal(getSeniorFullstackRuleMessages(messages).length, 0);
});

test("config core mode suppresses senior guidance", async () => {
  const hooks = await server({}, { mode: "core" });
  const output = createOutput([
    createMessage("user", "Implement an auth and API flow"),
  ]);

  await hooks["experimental.chat.messages.transform"]({}, output);

  assert.equal(getRindamanRuleMessages(output.messages).length, 1);
  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 0);
});

test("config senior mode forces senior guidance", async () => {
  const hooks = await server({}, { mode: "senior" });
  const output = createOutput([createMessage("user", "Check release status")]);

  await hooks["experimental.chat.messages.transform"]({}, output);

  assert.equal(getRindamanRuleMessages(output.messages).length, 1);
  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 1);
  assert.equal(getReviewerRuleMessages(output.messages).length, 0);
});

test("config reviewer mode forces reviewer guidance", async () => {
  const hooks = await server({}, { mode: "reviewer" });
  const output = createOutput([createMessage("user", "Implement an auth flow")]);

  await hooks["experimental.chat.messages.transform"]({}, output);

  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 0);
  assert.equal(getReviewerRuleMessages(output.messages).length, 1);
});

test("session command can switch mode from auto to core", async () => {
  const hooks = await server();
  const output = createOutput([
    createMessage("user", "/rindaman mode core"),
    createMessage("user", "Implement an auth and API flow"),
  ]);

  await hooks["chat.message"](
    { sessionID: "mode-core-session" },
    { parts: [createTextPart("/rindaman mode core")] },
  );
  await hooks["experimental.chat.messages.transform"](
    { sessionID: "mode-core-session" },
    output,
  );

  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 0);
});

test("session command can switch mode from auto to senior", async () => {
  const hooks = await server();
  const output = createOutput([
    createMessage("user", "/rindaman mode senior"),
    createMessage("user", "Check release status"),
  ]);

  await hooks["chat.message"](
    { sessionID: "mode-senior-session" },
    { parts: [createTextPart("/rindaman mode senior")] },
  );
  await hooks["experimental.chat.messages.transform"](
    { sessionID: "mode-senior-session" },
    output,
  );

  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 1);
  assert.equal(getReviewerRuleMessages(output.messages).length, 0);
});

test("session command can switch mode to reviewer", async () => {
  const hooks = await server();
  const output = createOutput([
    createMessage("user", "/rindaman mode reviewer"),
    createMessage("user", "Implement an auth flow"),
  ]);

  await hooks["chat.message"](
    { sessionID: "mode-reviewer-session" },
    { parts: [createTextPart("/rindaman mode reviewer")] },
  );
  await hooks["experimental.chat.messages.transform"](
    { sessionID: "mode-reviewer-session" },
    output,
  );

  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 0);
  assert.equal(getReviewerRuleMessages(output.messages).length, 1);
});

test("session command can switch mode back to auto", async () => {
  const hooks = await server({}, { mode: "senior" });
  const output = createOutput([
    createMessage("user", "/rindaman mode auto"),
    createMessage("user", "Check release status"),
  ]);

  await hooks["chat.message"](
    { sessionID: "mode-auto-session" },
    { parts: [createTextPart("/rindaman mode auto")] },
  );
  await hooks["experimental.chat.messages.transform"](
    { sessionID: "mode-auto-session" },
    output,
  );

  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 0);
});

test("release or status requests do not inject senior fullstack guidance", async () => {
  const messages = await runTransform([
    createMessage("user", "Check release status and verify the branch"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
  assert.equal(getSeniorFullstackRuleMessages(messages).length, 0);
  assert.equal(getReviewerRuleMessages(messages).length, 1);
});

test("review request mentioning api or auth stays core-only", async () => {
  const messages = await runTransform([
    createMessage("user", "Review the auth API schema and tell me the risks"),
  ]);

  assert.equal(getRindamanRuleMessages(messages).length, 1);
  assert.equal(getSeniorFullstackRuleMessages(messages).length, 0);
  assert.equal(getReviewerRuleMessages(messages).length, 1);
});

test("core mode suppresses reviewer and senior layers", async () => {
  const hooks = await server({}, { mode: "core" });
  const output = createOutput([createMessage("user", "Review this auth API and find issues")]);

  await hooks["experimental.chat.messages.transform"]({}, output);

  assert.equal(getSeniorFullstackRuleMessages(output.messages).length, 0);
  assert.equal(getReviewerRuleMessages(output.messages).length, 0);
});

test("exposes Rindaman quality tools", async () => {
  const hooks = await server();

  assert.equal(typeof hooks.tool?.rindaman_check?.execute, "function");
  assert.equal(typeof hooks.tool?.rindaman_status?.execute, "function");
});

test("rindaman_status exposes final response gate metadata", async () => {
  const hooks = await server();
  const context = createToolContext();
  const status = await readStatus(hooks, context);

  assert.equal(status.lastCheck.status, "not_run");
  assert.equal(status.lastCheck.command, null);
  assert.equal(status.lastCheck.checkedAt, null);
  assert.equal(status.checkFreshness, "not_run");
  assert.equal(status.nextAction.command, "rindaman_check");
  assert.equal(typeof status.mode, "string");
  assert.equal(typeof status.seniorEngineer.active, "boolean");
  assert.equal(typeof status.finalResponse.allowed, "boolean");
  assert.equal(typeof status.finalResponse.reason, "string");
});

test("rindaman_status reports senior fullstack activation state", async () => {
  const hooks = await server();
  const context = createToolContext();
  const output = createOutput([
    createMessage("user", "Implement a product API and auth flow"),
  ]);

  await hooks["experimental.chat.messages.transform"](
    { sessionID: context.sessionID },
    output,
  );
  const status = await readStatus(hooks, context);

  assert.equal(typeof status.seniorEngineer.active, "boolean");
  assert.equal(status.seniorEngineer.active, true);
});

test("rindaman_status reports mode and senior engineer semantics", async () => {
  const hooks = await server({}, { mode: "auto" });
  const context = createToolContext();
  const output = createOutput([
    createMessage("user", "Implement a product API and auth flow"),
  ]);

  await hooks["experimental.chat.messages.transform"](
    { sessionID: context.sessionID },
    output,
  );
  const status = await readStatus(hooks, context);

  assert.equal(status.mode, "auto");
  assert.equal(status.secondaryLayer, "senior");
  assert.equal(typeof status.seniorEngineer.active, "boolean");
  assert.equal(typeof status.seniorEngineer.reason, "string");
  assert.equal(typeof status.seniorEngineer.intent, "string");
  assert.equal(typeof status.seniorEngineer.intentSource, "string");
  assert.ok(Array.isArray(status.seniorEngineer.matchedSignals));
});

test("status reports reviewer secondary layer", async () => {
  const hooks = await server({}, { mode: "reviewer" });
  const context = createToolContext();
  const output = createOutput([createMessage("user", "Review this API")]);

  await hooks["experimental.chat.messages.transform"]({ sessionID: context.sessionID }, output);
  const status = await readStatus(hooks, context);

  assert.equal(status.mode, "reviewer");
  assert.equal(status.secondaryLayer, "reviewer");
  assert.equal(typeof status.reviewer.active, "boolean");
});

test("status reports matched signals and intent source", async () => {
  const hooks = await server({}, { mode: "auto" });
  const context = createToolContext();
  const output = createOutput([
    createMessage("user", "Implement an auth API contract for the dashboard"),
  ]);

  await hooks["experimental.chat.messages.transform"](
    { sessionID: context.sessionID },
    output,
  );
  const status = await readStatus(hooks, context);

  assert.ok(Array.isArray(status.seniorEngineer.matchedSignals));
  assert.equal(typeof status.seniorEngineer.intentSource, "string");
});

test("dirty session requires verification before final response", async () => {
  const hooks = await server();
  const context = createToolContext();

  await hooks["tool.execute.after"](
    { sessionID: context.sessionID, tool: "edit" },
    { output: "src/example.ts" },
  );

  const status = await readStatus(hooks, context);

  assert.equal(status.verificationRequired, true);
  assert.equal(status.checkFreshness, "stale");
  assert.equal(status.nextAction.command, "rindaman_check");
  assert.equal(status.finalResponse.allowed, false);
  assert.equal(status.finalResponse.reason, "verification pending");
  assert.ok(status.changedFiles.length > 0);
});

test("errored rindaman_check keeps final response blocked", async () => {
  const hooks = await server();
  const context = createToolContext({ directory: "/path/that/does/not/exist" });

  await hooks["tool.execute.after"](
    { sessionID: context.sessionID, tool: "edit" },
    { output: "src/example.ts" },
  );
  await hooks.tool.rindaman_check.execute(
    { mode: "check", json: true, strict: false, report: false },
    context,
  );
  const status = await readStatus(hooks, context);

  assert.equal(status.lastCheck.status, "error");
  assert.equal(status.finalResponse.allowed, false);
  assert.equal(status.finalResponse.reason, "verification errored");
});

test("passing rindaman_check allows final response", async () => {
  const hooks = await server();
  const context = createToolContext();

  await hooks["tool.execute.after"](
    { sessionID: context.sessionID, tool: "edit" },
    { output: "README.md" },
  );
  await hooks.tool.rindaman_check.execute(
    { mode: "doctor", json: true, strict: false, report: false },
    context,
  );
  const status = await readStatus(hooks, context);

  assert.equal(status.lastCheck.status, "passed");
  assert.equal(status.checkFreshness, "fresh");
  assert.equal(status.finalResponse.allowed, true);
  assert.equal(status.finalResponse.reason, "verification passed");
});

test("untouched session reports not_run freshness", async () => {
  const hooks = await server();
  const context = createToolContext();
  const status = await readStatus(hooks, context);

  assert.equal(status.checkFreshness, "not_run");
  assert.equal(status.nextAction.command, "rindaman_check");
});

test("edit after check reports stale status and next action", async () => {
  const hooks = await server();
  const context = createToolContext();

  await hooks.tool.rindaman_check.execute(
    { mode: "doctor", json: true, strict: false, report: false },
    context,
  );
  await hooks["tool.execute.after"](
    { sessionID: context.sessionID, tool: "edit" },
    { output: "src/example.ts" },
  );

  const status = await readStatus(hooks, context);

  assert.equal(status.checkFreshness, "stale");
  assert.equal(status.nextAction.command, "rindaman_check");
});

test("quality lifecycle disabled allows final response", async () => {
  const hooks = await server({}, { qualityLifecycle: false });
  const context = createToolContext();

  await hooks["tool.execute.after"](
    { sessionID: context.sessionID, tool: "edit" },
    { output: "src/example.ts" },
  );

  const status = await readStatus(hooks, context);

  assert.equal(status.verificationRequired, true);
  assert.equal(status.finalResponse.allowed, true);
  assert.equal(status.finalResponse.reason, "quality lifecycle disabled");
});
