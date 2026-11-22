import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("private conversations require consent, enforce membership and keep progress unique", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002",
    c = "00000000-0000-4000-8000-000000000003";
  try {
    await db.exec(
      `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table public.profiles(id uuid primary key,username text,full_name text,bio text,institution text);create function public.is_study_circle_moderator() returns boolean language sql as $$ select false $$;insert into auth.users values('${a}'),('${b}'),('${c}');insert into public.profiles select id,id::text,id::text,'','' from auth.users;grant usage on schema public,auth to authenticated;grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0013_social_connections.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const as = async (id) =>
      db.exec(
        `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
      );
    const call = async (
      action = "read",
      target = null,
      room = null,
      body = "",
      title = "",
      invitees = [],
    ) =>
      (
        await db.query(
          "select public.circle_social($1,$2,$3,$4,$5,$6) result",
          [action, target, room, body, title, invitees],
        )
      ).rows[0].result;
    await as(a);
    await assert.rejects(
      () => call("create", null, null, "", "Room", [b]),
      /mutual/,
    );
    await call("follow", b);
    await as(b);
    await call("follow", a);
    await as(a);
    const created = await call("create", null, null, "", "Python practice", [
      b,
    ]);
    const room = created.selected;
    assert.ok(room);
    await call("send", null, room, "Private first message");
    await as(b);
    assert.equal((await call("read", null, room)).messages.length, 0);
    await assert.rejects(
      () => call("send", null, room, "Not accepted yet"),
      /Accept/,
    );
    await call("accept", null, room);
    assert.equal((await call("read", null, room)).messages.length, 1);
    await as(c);
    assert.equal((await call("read", null, room)).messages.length, 0);
    await assert.rejects(() => call("send", null, room, "Intruder"), /Accept/);
    await assert.rejects(
      () => db.query("select * from public.circle_chat_messages"),
      /permission denied/,
    );
    await as(a);
    await call("goal", null, room, "Practice Python together");
    await call("preferences", null, room, "true", "true");
    await call("checkin", null, room);
    const progress = await call("checkin", null, room);
    assert.equal(progress.ranking[0].days, 1);
    await as(b);
    await call("report", a, null, "Repeated harassment");
    await assert.rejects(
      () => call("report", a, null, "Repeated harassment"),
      /already received/,
    );
    await call("block", a);
    assert.equal((await call("read", null, room)).messages.length, 0);
    await as(a);
    await assert.rejects(
      () => call("send", null, room, "Blocked message"),
      /blocked/,
    );
    await call("leave", null, room);
    assert.equal((await call("read", null, room)).messages.length, 0);
  } finally {
    await db.close();
  }
});
