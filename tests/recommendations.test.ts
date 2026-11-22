import { backgroundHistory, rememberBackground } from "../lib/focus-library.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace } from "../lib/workspace.ts";
import { recommend, youtubeId } from "../lib/recommendations.ts";
import { starterResources } from "../lib/discovery-starters.ts";
import { learningContext } from "../lib/learning-context.ts";
import {
  extractLearningResources,
  publicResourceUrl,
  videoPlayer,
} from "../lib/discovery.ts";
test("recommendations respond to learning interests without mutating source order", () => {
  const data = emptyWorkspace();
  data.personal.interests = "Design Figma user research";
  const items = [{ title: "Python programming" }, { title: "UI design Figma" }];
  assert.equal(
    recommend(items, (x) => x.title, data)[0].title,
    "UI design Figma",
  );
  assert.equal(items[0].title, "Python programming");
});
test("YouTube URLs are restricted to real video identifiers on supported HTTPS hosts", () => {
  assert.equal(youtubeId("https://youtu.be/5wRWniH7rt8"), "5wRWniH7rt8");
  assert.equal(
    youtubeId("https://www.youtube.com/watch?v=5wRWniH7rt8&t=30"),
    "5wRWniH7rt8",
  );
  for (const value of [
    "javascript:alert(1)",
    "https://youtube.com.evil.test/watch?v=5wRWniH7rt8",
    "http://youtu.be/5wRWniH7rt8",
    "https://youtube.com/watch?v=bad",
  ])
    assert.equal(youtubeId(value), null);
});
test("coach context includes study routine while honoring disabled sharing", () => {
  const data = emptyWorkspace();
  data.personal.shareContext = true;
  assert.equal(learningContext(data).shareContext, true);
  assert.ok("routine" in learningContext(data));
  data.personal.shareContext = false;
  assert.deepEqual(learningContext(data), { shareContext: false });
});

test("discovery grounds AI picks in returned sources and curates short and long formats separately", () => {
  const short = "https://www.youtube.com/shorts/5wRWniH7rt8";
  const long = "https://www.youtube.com/watch?v=qwAFL1597eM";
  const pdf = "https://ocw.mit.edu/resources/guide.pdf";
  const news = "https://www.reuters.com/technology/example";
  const unknown = "https://www.youtube.com/shorts/12345678901";
  const response = {
    content: JSON.stringify({
      picks: [unknown, short + "?si=123", long, pdf, news].map((url) => ({
        url,
        note: "Study context",
      })),
    }),
    executed_tools: [
      {
        name: "browser.search",
        search_results: {
          results: [
            { url: short, title: "Networking concept" },
            { url: long, title: "Networking tutorial" },
            { url: pdf, title: "Course notes" },
            { url: news, title: "Field news", published_date: "2026-10-24" },
            { url: "http://127.0.0.1/private", title: "Internal data" },
          ],
        },
      },
      {
        name: "browser.open",
        search_results: {
          results: [{ url: unknown, title: "Unverified suggestion" }],
        },
      },
    ],
  };
  const now = Date.parse("2026-11-10");
  assert.deepEqual(
    extractLearningResources(response, "veels", now).map((x) => x.url),
    [short, news],
  );
  assert.deepEqual(
    extractLearningResources(response, "feed", now).map((x) => x.url),
    [long, pdf, news],
  );
  assert.deepEqual(
    extractLearningResources(
      { ...response, content: "unstructured" },
      "research",
      now,
    ).map((x) => x.url),
    [short, pdf, news, long],
  );
  assert.deepEqual(
    extractLearningResources(response, "veels", Date.parse("2027-02-01")).map(
      (x) => x.url,
    ),
    [short],
  );
  assert.deepEqual(
    extractLearningResources(
      { ...response, content: "[Verified Short](" + short + ") " + unknown },
      "veels",
      now,
    ).map((x) => x.url),
    [short],
  );
  assert.equal(publicResourceUrl("https://127.0.0.1/file.pdf"), null);
  assert.equal(publicResourceUrl("https://user@example.com/file.pdf"), null);
  assert.equal(videoPlayer("https://vimeo.com/123456")?.type, "embed");
  assert.equal(videoPlayer("https://example.com/course") ?? null, null);
});

test("starter picks are available without web search and respect study context sharing", () => {
  const workspace = emptyWorkspace();
  workspace.personal.interests = "cybersecurity networking";
  const shorts = starterResources("veels", workspace);
  const lessons = starterResources("feed", workspace);
  assert.ok(
    shorts.length >= 3 &&
      shorts.every((item) => item.short && videoPlayer(item.url)),
  );
  assert.ok(lessons.some((item) => item.kind === "video" && !item.short));
  assert.ok(lessons.some((item) => item.kind === "article"));
  assert.ok(
    [...shorts, ...lessons].every(
      (item) => item.starter && publicResourceUrl(item.url),
    ),
  );
  assert.match(shorts[0].title, /Wireshark/);
  assert.match(lessons[0].title, /network|Wireshark/i);
  assert.ok(lessons.filter((item) => item.kind === "video").length >= 10);
  workspace.personal.shareContext = false;
  assert.deepEqual(
    starterResources("veels", workspace),
    starterResources("veels"),
  );
  assert.deepEqual(
    starterResources("feed", workspace),
    starterResources("feed"),
  );
});

test("focus background history validates saved entries, deduplicates, and retains four most recent videos", () => {
  const videos = [
    "GfYkRRH2ScQ",
    "2jIMBAcrXPg",
    "SNA2eDDLI3E",
    "RjZvN8b_Yuk",
    "E7CwqNHn_Ns",
  ].map((id, index) => ({ id, title: "Background " + index }));
  let recent: { id: string; title: string }[] = [];
  for (const item of videos) recent = rememberBackground(recent, item);
  assert.deepEqual(
    recent.map((item) => item.id),
    videos
      .slice(1)
      .reverse()
      .map((item) => item.id),
  );
  recent = rememberBackground(recent, videos[2]);
  assert.equal(recent.length, 4);
  assert.equal(recent[0].id, videos[2].id);
  assert.equal(recent.filter((item) => item.id === videos[2].id).length, 1);
  assert.deepEqual(
    backgroundHistory(
      JSON.stringify([
        ...recent,
        recent[0],
        { id: "../../invalid", title: "Bad input" },
        null,
      ]),
    ),
    recent,
  );
  assert.deepEqual(backgroundHistory("broken JSON"), []);
  assert.deepEqual(backgroundHistory(null), []);
});
