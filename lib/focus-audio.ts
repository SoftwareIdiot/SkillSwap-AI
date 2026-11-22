import { recordings, type SoundscapeId } from "./focus-library.ts";

function generatedSound(context: AudioContext, sound: SoundscapeId) {
  const buffer = context.createBuffer(
    1,
    context.sampleRate * 8,
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  const step = (2 * Math.PI) / context.sampleRate;
  let brown = 0;
  let p0 = 0,
    p1 = 0,
    p2 = 0;
  for (let i = 0; i < samples.length; i++) {
    if (sound === "tones") {
      const time = step * i;
      samples[i] =
        (Math.sin(130 * time) + Math.sin(164 * time) + Math.sin(196 * time)) *
        0.07;
    } else {
      const white = Math.random() * 2 - 1;
      if (sound === "pink") {
        p0 = 0.99765 * p0 + white * 0.099046;
        p1 = 0.963 * p1 + white * 0.2965164;
        p2 = 0.57 * p2 + white * 1.0526913;
        samples[i] = (p0 + p1 + p2 + white * 0.1848) * 0.08;
      } else {
        brown = (brown + 0.02 * white) / 1.02;
        samples[i] = brown * 3.5;
      }
    }
  }
  return buffer;
}

function prepareLoop(original: AudioBuffer) {
  const overlap = Math.min(
    Math.round(original.sampleRate * 0.3),
    Math.floor(original.length / 4),
  );
  const length = original.length - overlap;
  // Each buffer belongs to this playback. Crossfade in place to avoid a second
  // full recording allocation; loopEnd excludes the tail used by the crossfade.
  for (let channel = 0; channel < original.numberOfChannels; channel++) {
    const samples = original.getChannelData(channel);
    for (let i = 0; i < overlap; i++) {
      const angle = ((i / overlap) * Math.PI) / 2;
      samples[i] =
        samples[i] * Math.sin(angle) + samples[length + i] * Math.cos(angle);
    }
  }
  return length / original.sampleRate;
}

export async function connectSoundscape(
  context: AudioContext,
  sound: SoundscapeId,
  destination: GainNode,
  signal: AbortSignal,
) {
  const stopped = () => signal.aborted || context.state === "closed";
  if (stopped() || sound === "off") return;
  const recording = recordings[sound];
  let buffer: AudioBuffer;
  if (recording) {
    const response = await fetch(recording.file, {
      signal,
      cache: "force-cache",
    });
    if (!response.ok) throw new Error("Sound could not load.");
    buffer = await context.decodeAudioData(await response.arrayBuffer());
  } else {
    buffer = generatedSound(context, sound);
  }
  if (stopped()) return;
  const source = context.createBufferSource();
  source.loopEnd = prepareLoop(buffer);
  source.buffer = buffer;
  source.loop = true;
  source.connect(destination);
  source.start();
}
