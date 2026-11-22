import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

test("database permissions protect private communities, call signaling, profiles, exchanges, and AI quotas", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002",
    c = "00000000-0000-4000-8000-000000000003";
  try {
    await db.exec(
      `create schema auth;create role authenticated;create role anon;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${a}'),('${b}'),('${c}');`,
    );
    const foundation = await readFile(
      new URL("../supabase/migrations/0001_foundation.sql", import.meta.url),
      "utf8",
    );
    await db.exec(foundation);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0002_learning_workspace.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0003_skill_studio.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      "grant usage on schema public to authenticated,anon;grant select,insert,update,delete on all tables in schema public to authenticated;grant select on all tables in schema public to anon;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0004_study_group_indexes.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    // Reproduce the explicit anonymous grants observed in the hosted project.
    await db.exec(
      "grant execute on function public.join_classroom_by_code(text), public.consume_ai_request() to anon",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0005_authenticated_helper_access.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0006_study_circle_voice.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(`
      create schema storage;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (bucket_id text references storage.buckets(id), name text, primary key(bucket_id, name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
    `);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0007_profile_avatars.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0008_profile_gif_limit.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const bucket = (
      await db.query(
        "select public, file_size_limit from storage.buckets where id='profile-avatars'",
      )
    ).rows[0];
    assert.equal(bucket.file_size_limit, 12 * 1024 * 1024);
    assert.equal(bucket.public, false);
    const feedMigration = await readFile(
      new URL(
        "../supabase/migrations/0009_study_circle_feed.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(feedMigration);
    await db.exec(feedMigration);
    const longVideoMigration = await readFile(
      new URL(
        "../supabase/migrations/0011_study_circle_long_videos.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(longVideoMigration);
    await db.exec(longVideoMigration);
    const clipBucket = (
      await db.query(
        "select public,file_size_limit from storage.buckets where id='study-clips'",
      )
    ).rows[0];
    assert.equal(clipBucket.file_size_limit, 40 * 1024 * 1024);
    assert.equal(clipBucket.public, false);
    await db.query(
      "insert into public.study_circle_posts(author_id,kind,title,media_type) values($1,'post','A long video','video/mp4')",
      [a],
    );
    await db.query(
      "insert into public.study_circle_posts(author_id,kind,title,youtube_id) values($1,'post','A YouTube lesson','5wRWniH7rt8')",
      [a],
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into public.study_circle_posts(author_id,kind,title,media_type,youtube_id) values($1,'post','Conflicting media','video/mp4','5wRWniH7rt8')",
          [a],
        ),
      /check constraint/,
    );
    await db.query("delete from public.study_circle_posts");
    const access = (
      await db.query(
        "select has_function_privilege('anon','public.join_classroom_by_code(text)','execute') as anonymous_join, has_function_privilege('anon','public.consume_ai_request()','execute') as anonymous_quota, has_function_privilege('authenticated','public.join_classroom_by_code(text)','execute') as signed_in_join",
      )
    ).rows[0];
    assert.equal(access.anonymous_join, false);
    assert.equal(access.anonymous_quota, false);
    assert.equal(access.signed_in_join, true);
    const asUser = async (user) => {
      await db.exec(
        `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`,
      );
    };
    await asUser(a);
    const clip = "00000000-0000-4000-8000-000000000201";
    const clipPath = `${a}/${clip}`;
    await db.query("insert into storage.objects values ('study-clips',$1)", [
      clipPath,
    ]);
    await asUser(b);
    assert.equal(
      (
        await db.query(
          "select name from storage.objects where bucket_id='study-clips'",
        )
      ).rows.length,
      0,
      "unpublished clips are private",
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into public.study_circle_posts(author_id,kind,title,body) values($1,'post','Impersonation','Blocked')",
          [a],
        ),
      /row-level security/,
    );
    await asUser(a);
    await assert.rejects(
      () =>
        db.query(
          "insert into public.study_circle_posts(author_id,kind,title,body,youtube_id,media_type) values($1,'clip','Two sources','','dQw4w9WgXcQ','video/mp4')",
          [a],
        ),
      /check constraint/,
    );
    await db.query(
      "insert into public.study_circle_posts(id,author_id,kind,title,media_type) values($1,$2,'clip','A study clip','video/mp4')",
      [clip, a],
    );
    await asUser(b);
    assert.equal(
      (await db.query("select id from public.study_circle_posts")).rows[0].id,
      clip,
    );
    assert.equal(
      (
        await db.query(
          "select name from storage.objects where bucket_id='study-clips'",
        )
      ).rows[0].name,
      clipPath,
    );
    assert.equal(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [clipPath],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "delete from public.study_circle_posts where id=$1 returning id",
          [clip],
        )
      ).rows.length,
      0,
    );
    await asUser(a);
    await db.query("delete from public.study_circle_posts where id=$1", [clip]);
    await asUser(b);
    assert.equal(
      (
        await db.query(
          "select name from storage.objects where bucket_id='study-clips'",
        )
      ).rows.length,
      0,
      "removed clips cannot get new signed URLs",
    );
    await asUser(a);
    await db.query("delete from storage.objects where name=$1", [clipPath]);
    await db.exec("reset role");
    const discussionMigration = await readFile(
      new URL(
        "../supabase/migrations/0010_study_circle_discussions.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(discussionMigration);
    await db.exec(discussionMigration);
    await db.query(
      "insert into public.study_circle_moderators(user_id) values($1)",
      [c],
    );
    await asUser(a);
    await db.query(
      "insert into public.study_circle_posts(id,author_id,kind,title,media_type) values($1,$2,'clip','A reported clip','video/mp4')",
      [clip, a],
    );
    await db.query("insert into storage.objects values ('study-clips',$1)", [
      clipPath,
    ]);
    const milestone = (
      await db.query(
        "insert into public.achievements(author_id,title,description,category) values($1,'A learning milestone','A milestone to discuss','Academic') returning id",
        [a],
      )
    ).rows[0].id;
    await asUser(b);
    const reply = (
      await db.query(
        "insert into public.study_circle_replies(author_id,post_id,body) values($1,$2,'A follow-up question') returning id",
        [b, clip],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.study_circle_replies(author_id,milestone_id,body) values($1,$2,'A milestone reply')",
      [b, milestone],
    );
    for (let i = 0; i < 2; i++) {
      await db.query(
        "insert into public.study_circle_helpful(author_id,post_id) values($1,$2) on conflict(author_id,post_id) do nothing",
        [b, clip],
      );
      await db.query(
        "select public.report_study_circle_entry('post',$1,'spam','Sample report')",
        [clip],
      );
    }
    const engagement = (
      await db.query(
        "select * from public.study_circle_engagement(array[$1]::uuid[],array[$2]::uuid[]) order by kind",
        [clip, milestone],
      )
    ).rows;
    assert.deepEqual(
      engagement.map(({ replies, helpful, reacted }) => [
        replies,
        helpful,
        reacted,
      ]),
      [
        [1, 0, false],
        [1, 1, true],
      ],
    );
    assert.equal(
      (await db.query("select * from public.study_circle_reports")).rows.length,
      0,
    );
    await assert.rejects(
      () =>
        db.query("select public.review_study_circle_report($1,'hide')", [clip]),
      /Moderator access required/,
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into public.study_circle_moderators(user_id) values($1)",
          [b],
        ),
      /permission denied/,
    );
    await asUser(a);
    assert.equal(
      (await db.query("select * from public.study_circle_helpful")).rows.length,
      0,
      "reaction identities stay private",
    );
    assert.equal(
      (
        await db.query(
          "delete from public.study_circle_replies where id=$1 returning id",
          [reply],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.study_circle_reports")).rows.length,
      0,
      "reported users cannot read reports",
    );
    await db.query(
      "select public.report_study_circle_entry('reply',$1,'other','Sample reply report')",
      [reply],
    );
    await asUser(c);
    const reports = (
      await db.query(
        "select id,target_kind from public.study_circle_reports order by target_kind",
      )
    ).rows;
    assert.equal(reports.length, 2, "one report per person and item");
    await db.query("select public.review_study_circle_report($1,'dismiss')", [
      reports.find((report) => report.target_kind === "reply").id,
    ]);
    await db.query("select public.review_study_circle_report($1,'hide')", [
      reports.find((report) => report.target_kind === "post").id,
    ]);
    await asUser(b);
    assert.equal(
      (
        await db.query("select id from public.study_circle_posts where id=$1", [
          clip,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select id from public.study_circle_replies where id=$1",
          [reply],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query("select name from storage.objects where name=$1", [
          clipPath,
        ])
      ).rows.length,
      0,
      "a hidden clip cannot get a new playback URL",
    );
    await asUser(a);
    await db.query("delete from storage.objects where name=$1", [clipPath]);
    const avatar = `${a}/avatar`;
    const saveAvatar = () =>
      db.query(
        "insert into storage.objects values ('profile-avatars',$1) on conflict (bucket_id,name) do update set name=excluded.name returning name",
        [avatar],
      );
    assert.equal((await saveAvatar()).rows[0].name, avatar);
    assert.equal(
      (await saveAvatar()).rows[0].name,
      avatar,
      "owners can replace their picture",
    );
    await asUser(b);
    assert.equal(
      (await db.query("select name from storage.objects")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [avatar],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(saveAvatar, /row-level security/);
    await asUser(a);
    assert.equal(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [avatar],
        )
      ).rows.length,
      1,
    );
    await db.query(
      "insert into public.profiles(id,username,full_name) values($1,$2,$3)",
      [a, "learner_a", "Learner A"],
    );
    await assert.rejects(() =>
      db.query(
        "insert into public.profiles(id,username,full_name) values($1,$2,$3)",
        [b, "impersonator", "Bad Profile"],
      ),
    );
    const room = (
      await db.query(
        "insert into public.classrooms(host_id,name,topic,visibility,code) values($1,'Private Study','React','private','SKILL-A1B2C3D4E5') returning id",
        [a],
      )
    ).rows[0].id;
    assert.equal(
      (await db.query("select * from public.classroom_members")).rows.length,
      1,
      "host membership is atomic",
    );
    await db.query(
      "insert into public.classroom_messages(classroom_id,sender_id,body) values($1,$2,'Private message')",
      [room, a],
    );
    await asUser(b);
    assert.equal(
      (await db.query("select * from public.classrooms")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.classroom_messages")).rows.length,
      0,
    );
    await assert.rejects(() =>
      db.query(
        "insert into public.classroom_messages(classroom_id,sender_id,body) values($1,$2,'Not joined')",
        [room, b],
      ),
    );
    await db.query("select public.join_classroom_by_code('SKILL-A1B2C3D4E5')");
    assert.equal(
      (await db.query("select * from public.classrooms")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.classroom_messages")).rows.length,
      1,
    );
    await asUser(a);
    const voiceRoom = (
      await db.query(
        "insert into public.study_voice_rooms(classroom_id,created_by,title,background) values($1,$2,'Quiet practice','forest') returning id",
        [room, a],
      )
    ).rows[0].id;
    const sessionA = "00000000-0000-4000-8000-000000000101";
    const sessionB = "00000000-0000-4000-8000-000000000102";
    const voice = async (
      session,
      action,
      after = 0,
      target = null,
      description = null,
    ) =>
      (
        await db.query(
          "select public.study_voice($1,$2,$3,$4,$5,$6) as result",
          [voiceRoom, session, action, after, target, description],
        )
      ).rows[0].result;
    await voice(sessionA, "join");
    await asUser(c);
    assert.equal(
      (await db.query("select * from public.study_voice_rooms")).rows.length,
      0,
    );
    await assert.rejects(
      () => voice(sessionB, "join"),
      /Join the community first/,
    );
    await asUser(b);
    assert.equal(
      (await db.query("select * from public.study_voice_rooms")).rows.length,
      1,
    );
    await assert.rejects(
      () => db.query("select * from public.study_voice_signals"),
      /permission denied/,
    );
    await voice(sessionB, "join");
    await assert.rejects(() => voice(sessionA, "poll"), /session has ended/);
    await asUser(a);
    const before = await voice(sessionA, "poll");
    assert.deepEqual(
      before.members.map((member) => member.id),
      [sessionA, sessionB],
    );
    const offer = { type: "offer", sdp: "test offer" };
    await voice(sessionA, "signal", 0, sessionB, offer);
    assert.deepEqual((await voice(sessionA, "poll")).signals, []);
    await asUser(b);
    const received = (await voice(sessionB, "poll")).signals;
    assert.equal(received.length, 1);
    assert.equal(received[0].sender, sessionA);
    assert.deepEqual(received[0].description, offer);
    assert.deepEqual(
      (await voice(sessionB, "poll", received[0].id)).signals,
      [],
    );
    const answer = { type: "answer", sdp: "test answer" };
    await voice(sessionB, "signal", 0, sessionA, answer);
    await asUser(a);
    assert.deepEqual(
      (await voice(sessionA, "poll")).signals[0].description,
      answer,
    );
    await asUser(b);
    await voice(sessionB, "leave");
    await asUser(a);
    assert.deepEqual(
      (await voice(sessionA, "poll")).members.map((member) => member.id),
      [sessionA],
    );
    await asUser(b);
    await db.query(
      "insert into public.skills(student_id,name,kind,level) values($1,'Python','teach','advanced')",
      [b],
    );
    await asUser(a);
    await db.query(
      "insert into public.skills(student_id,name,kind,level) values($1,'Figma','teach','intermediate')",
      [a],
    );
    const request = (
      await db.query(
        "insert into public.exchange_requests(sender_id,receiver_id,skill_name,offering,message) values($1,$2,'Python','Figma','Let us learn together') returning id",
        [a, b],
      )
    ).rows[0].id;
    await assert.rejects(
      () =>
        db.query(
          "update public.exchange_requests set status='accepted' where id=$1",
          [request],
        ),
      /Senders/,
    );
    await asUser(c);
    assert.equal(
      (await db.query("select * from public.exchange_requests")).rows.length,
      0,
    );
    await db.query(
      'insert into public.learning_workspaces(student_id,data) values($1,\'{"memory":"private"}\')',
      [c],
    );
    await asUser(a);
    assert.equal(
      (await db.query("select * from public.learning_workspaces")).rows.length,
      0,
    );
    await asUser(b);
    await assert.rejects(
      () =>
        db.query(
          "update public.exchange_requests set offering='Changed' where id=$1",
          [request],
        ),
      /Only request status/,
    );
    await db.query(
      "update public.exchange_requests set status='accepted' where id=$1",
      [request],
    );
    assert.equal(
      (
        await db.query(
          "select status from public.exchange_requests where id=$1",
          [request],
        )
      ).rows[0].status,
      "accepted",
    );
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await db.query("select public.consume_ai_request() as allowed"))
          .rows[0].allowed,
        true,
      );
    assert.equal(
      (await db.query("select public.consume_ai_request() as allowed")).rows[0]
        .allowed,
      false,
      "rate limit is enforced in the database",
    );
    await asUser(a);
    const division = "00000000-0000-4000-8000-000000000099";
    await db.query(
      "select public.save_skill_division($1,'Private curriculum',$2,'private',$3)",
      [
        division,
        { sections: [] },
        { checkins: [{ journal: "Private journal sentinel" }] },
      ],
    );
    await asUser(b);
    assert.equal(
      (
        await db.query("select * from public.skill_divisions where id=$1", [
          division,
        ])
      ).rows.length,
      0,
      "private drafts are not discoverable by peers",
    );
    assert.equal(
      (
        await db.query(
          "select * from public.learning_workspaces where student_id=$1",
          [a],
        )
      ).rows.length,
      0,
      "planner and journal stay account-private",
    );
    await asUser(a);
    await assert.rejects(() =>
      db.query(
        "select public.save_skill_division($1,'Invalid publish',$2,'public',$3)",
        [division, { sections: [] }, []],
      ),
    );
    assert.equal(
      (
        await db.query(
          "select visibility from public.skill_divisions where id=$1",
          [division],
        )
      ).rows[0].visibility,
      "private",
      "publish rolls back if the private revision cannot save",
    );
    await db.query(
      "select public.save_skill_division($1,'Published curriculum',$2,'public',$3)",
      [
        division,
        { sections: [] },
        { checkins: [{ journal: "Private journal sentinel" }] },
      ],
    );
    await asUser(b);
    const published = (
      await db.query("select * from public.skill_divisions where id=$1", [
        division,
      ])
    ).rows;
    assert.equal(published.length, 1);
    assert.ok(!JSON.stringify(published).includes("Private journal sentinel"));
    assert.equal(
      (
        await db.query(
          "update public.skill_divisions set title='Peer edit' where id=$1 returning id",
          [division],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(() =>
      db.query(
        "select public.save_skill_division($1,'Stolen skill',$2,'public',$3)",
        [division, { sections: [] }, {}],
      ),
    );
    await asUser(a);
    await db.query(
      "select public.save_skill_division($1,'Private again',$2,'private',$3)",
      [division, { sections: [] }, {}],
    );
    await asUser(b);
    assert.equal(
      (
        await db.query("select * from public.skill_divisions where id=$1", [
          division,
        ])
      ).rows.length,
      0,
      "making private removes community discovery",
    );
    await db.exec("reset role;set role anon;");
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      0,
    );
    await assert.rejects(() => db.query("select public.consume_ai_request()"));
  } finally {
    await db.close();
  }
});
