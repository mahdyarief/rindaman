import assert from "node:assert/strict";
import test from "node:test";

import plugin, { server } from "../dist/index.js";
import { RINDAMAN_RULE, RINDAMAN_RULE_MARKER } from "../dist/rindaman-rule.js";

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
  assert.equal(typeof status.finalResponse.allowed, "boolean");
  assert.equal(typeof status.finalResponse.reason, "string");
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
  assert.equal(status.finalResponse.allowed, true);
  assert.equal(status.finalResponse.reason, "verification passed");
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
