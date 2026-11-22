const megabyte = 1024 * 1024;
export const avatarTypes = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

export function avatarLimit(type: string) {
  return (type === "image/gif" ? 12 : 3) * megabyte;
}

export function avatarSizeMessage(type: string) {
  return `Choose a ${type === "image/gif" ? "GIF" : "photo"} up to ${avatarLimit(type) / megabyte} MB.`;
}

export async function avatarType(file: Blob) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = new TextDecoder().decode(bytes);
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (bytes[0] === 137 && ascii.slice(1, 8) === "PNG\r\n\x1a\n")
    return "image/png";
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a"))
    return "image/gif";
  if (ascii.startsWith("RIFF") && ascii.slice(8) === "WEBP")
    return "image/webp";
  return null;
}
