export function scenePose(progress: number) {
  const p = Math.max(0, Math.min(3, Number.isFinite(progress) ? progress : 0));
  // Keep the camera outside every object's bounds. Chapter transitions move
  // objects laterally instead of flying through the extruded brand mark.
  return {
    progress: p,
    cameraX: Math.sin(p * 0.8) * 0.22,
    cameraY: 2.7,
    cameraZ: 12.5 - Math.sin((p * Math.PI) / 3) * 0.35,
  };
}
export function objectPose(chapter: number, progress: number) {
  const delta = chapter - scenePose(progress).progress,
    distance = Math.abs(delta);
  return {
    visible: distance < 0.95,
    opacity: Math.max(0, 1 - distance * 1.45),
    offsetX: delta * 0.8,
    offsetY: delta * 2.1,
    offsetZ: -distance * 0.9,
    scale: 1 - distance * 0.08,
  };
}
export function chapterEase(t: number) {
  const p = Math.max(0, Math.min(1, t));
  return p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2;
}
export function chapterTarget(progress: number, direction: number) {
  const current = Math.round(Number.isFinite(progress) ? progress : 0);
  return Math.max(0, Math.min(3, current + Math.sign(direction)));
}
export function logoTilt(seconds: number) {
  return -0.23 + Math.sin(seconds * 0.36) * 0.08;
}
