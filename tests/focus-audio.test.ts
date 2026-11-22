import { test } from "node:test";
import assert from "node:assert/strict";
import { connectSoundscape } from "../lib/focus-audio.ts";

test("recorded ambience keeps the same crossfade on both channels without duplicating the recording", async (t) => {
  const channels = [
    Float32Array.from({ length: 40 }, (_, i) => Math.sin(i)),
    Float32Array.from({ length: 40 }, (_, i) => Math.cos(i)),
  ];
  const original = channels.map((channel) => channel.slice());
  const buffer = {
    sampleRate: 10,
    length: 40,
    numberOfChannels: 2,
    getChannelData: (index: number) => channels[index],
  };
  let started = false;
  const destination = {} as GainNode;
  const source = {
    buffer: null as unknown,
    loop: false,
    loopEnd: 0,
    connect: (target: GainNode) => assert.equal(target, destination),
    start: () => {
      started = true;
    },
  };
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(new Uint8Array([1])),
  );
  const context = {
    state: "running",
    decodeAudioData: async () => buffer,
    createBuffer: () => {
      throw new Error("A second full recording must not be allocated");
    },
    createBufferSource: () => source,
  } as unknown as AudioContext;
  await connectSoundscape(
    context,
    "rain",
    destination,
    new AbortController().signal,
  );
  assert.equal(source.buffer, buffer);
  assert.equal(source.loopEnd, 3.7);
  assert.equal(source.loop, true);
  assert.equal(started, true);
  for (let channel = 0; channel < channels.length; channel++) {
    for (let i = 0; i < 37; i++) {
      const angle = ((i / 3) * Math.PI) / 2;
      const expected =
        i < 3
          ? original[channel][i] * Math.sin(angle) +
            original[channel][37 + i] * Math.cos(angle)
          : original[channel][i];
      assert.ok(Math.abs(channels[channel][i] - expected) < 1e-6);
    }
  }
});

test("switching sounds during decoding never starts the cancelled recording", async (t) => {
  const request = new AbortController();
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(new Uint8Array([1])),
  );
  const context = {
    state: "running",
    decodeAudioData: async () => {
      request.abort();
      return {};
    },
    createBufferSource: () => {
      throw new Error("Cancelled sound started");
    },
  } as unknown as AudioContext;
  await connectSoundscape(context, "ocean", {} as GainNode, request.signal);
});

test("silence and already-cancelled sounds do no audio or network work", async () => {
  const context = { state: "running" } as AudioContext;
  await connectSoundscape(
    context,
    "off",
    {} as GainNode,
    new AbortController().signal,
  );
  await connectSoundscape(context, "rain", {} as GainNode, AbortSignal.abort());
});
