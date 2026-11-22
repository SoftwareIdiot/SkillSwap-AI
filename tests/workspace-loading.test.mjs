import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

// Run the real loader outside Next's server-only boundary using its real models.
let source = await readFile(
  new URL("../lib/workspace-server.ts", import.meta.url),
  "utf8",
);
source = source.replace('import "server-only";', "");
for (const name of ["workspace", "skill-paths"])
  source = source.replace(
    `from "./${name}"`,
    `from "${new URL(`../lib/${name}.ts`, import.meta.url).href}"`,
  );
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
});
const { loadWorkspace } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

function fixture({ room = false, communityFails = false } = {}) {
  const requests = [];
  const profile = {
    id: "learner",
    full_name: "Learner",
    username: "learner",
    bio: "",
    institution: "",
  };
  const task = {
    id: "task",
    student_id: "learner",
    title: "Practice",
    done: false,
    created_at: "2026-11-09T00:00:00Z",
  };
  const client = createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").pop();
        requests.push({ table, query: url.searchParams });
        if (
          !room &&
          ["classrooms", "classroom_members", "classroom_messages"].includes(
            table,
          )
        )
          throw new Error("Dormant classroom data must not be requested");
        if (communityFails && table === "skill_divisions")
          return Response.json(
            { message: "Temporarily unavailable" },
            { status: 503 },
          );
        let rows = [];
        if (table === "profiles") rows = [profile];
        if (table === "tasks") rows = [task];
        if (table === "learning_workspaces")
          rows = [{ data: { goal: "Learn safely" } }];
        if (table === "classroom_messages")
          rows = [
            {
              id: "message",
              classroom_id: "room",
              body: "Saved message",
              created_at: "2026-11-09T00:00:00Z",
            },
          ];
        return Response.json(rows);
      },
    },
  });
  return { client, requests, task };
}

test("normal workspace loading skips retired classrooms and preserves learning data", async () => {
  const { client, requests, task } = fixture();
  const data = await loadWorkspace(client, "learner");
  assert.equal(requests.length, 10);
  assert.equal(data.profile.full_name, "Learner");
  assert.deepEqual(data.tasks, [task]);
  assert.equal(data.personal.goal, "Learn safely");
  assert.deepEqual(data.rooms, []);
  assert.deepEqual(data.messages, []);
});

test("explicit legacy classroom requests still load scoped messages", async () => {
  const { client, requests } = fixture({ room: true });
  const data = await loadWorkspace(client, "learner", "room");
  const messages = requests.find((r) => r.table === "classroom_messages");
  assert.equal(messages.query.get("classroom_id"), "eq.room");
  assert.equal(data.messages[0].body, "Saved message");
});

test("a community outage does not discard the learner's saved workspace", async () => {
  const { client, task } = fixture({ communityFails: true });
  const data = await loadWorkspace(client, "learner");
  assert.deepEqual(data.tasks, [task]);
  assert.equal(data.personal.goal, "Learn safely");
  assert.deepEqual(data.communityDivisions, []);
  assert.match(data.communityNotice, /temporarily unavailable/);
});
