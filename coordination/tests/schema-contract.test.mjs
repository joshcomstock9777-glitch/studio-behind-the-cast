import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const taskSchema = JSON.parse(await readFile(new URL("task.schema.json", root), "utf8"));
const handoffSchema = JSON.parse(await readFile(new URL("handoff.schema.json", root), "utf8"));
const evidenceSchema = JSON.parse(await readFile(new URL("evidence.schema.json", root), "utf8"));
const ownerValues = taskSchema.properties.owner.enum;
const stateValues = taskSchema.properties.state.enum;

function requireFields(value, schema) {
  for (const key of schema.required) assert.ok(Object.hasOwn(value, key), `missing ${key}`);
}

function validateTask(value) {
  requireFields(value, taskSchema);
  assert.equal(value.schema, taskSchema.properties.schema.const);
  assert.ok(ownerValues.includes(value.owner));
  assert.ok(stateValues.includes(value.state));
  assert.ok(Number.isInteger(value.retry_count) && value.retry_count >= 0 && value.retry_count <= 2);
  assert.ok(value.acceptance_tests.length > 0);
  if (value.state === "passed") assert.ok(value.evidence.length > 0, "passed requires evidence");
  if (value.state === "awaiting_josh") assert.ok(value.manual_step, "awaiting_josh requires manual_step");
}

test("schemas expose unique versioned contracts", () => {
  assert.equal(new Set([taskSchema.$id, handoffSchema.$id, evidenceSchema.$id]).size, 3);
  assert.match(taskSchema.properties.schema.const, /\.v1$/);
  assert.match(handoffSchema.properties.schema.const, /\.v1$/);
  assert.match(evidenceSchema.properties.schema.const, /\.v1$/);
});

test("Allie, Amber, and Cassandra packets satisfy coordination invariants", async () => {
  const files = (await readdir(new URL("examples/", root))).filter((name) => name.endsWith(".task.json"));
  assert.deepEqual(files.sort(), ["allie.task.json", "amber.task.json", "cassandra.task.json"]);
  for (const file of files) validateTask(JSON.parse(await readFile(new URL(`examples/${file}`, root), "utf8")));
});

test("unsafe terminal and escalation states are rejected", () => {
  const base = {
    schema: "moonshadow.coordination.task.v1", task_id: "T", correlation_id: "C",
    title: "T", owner: "allie", state: "active", scope: "S", inputs: [],
    expected_output: "O", acceptance_tests: ["A"], evidence: [],
    cost: { maximum_usd: 0, actual_usd: 0 }, permission_level: "read_only",
    rollback: "R", blocker: null, next_action: "N", retry_count: 0,
    manual_step: null, updated_at: "2026-08-15T08:30:00Z"
  };
  assert.throws(() => validateTask({ ...base, state: "passed" }), /passed requires evidence/);
  assert.throws(() => validateTask({ ...base, state: "awaiting_josh" }), /manual_step/);
  assert.throws(() => validateTask({ ...base, retry_count: 3 }));
});

