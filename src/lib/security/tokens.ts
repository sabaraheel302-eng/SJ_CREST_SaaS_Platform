import { createHash, randomBytes } from "node:crypto";

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const SERIAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateSerialNumber() {
  const bytes = randomBytes(12);
  let value = "";
  for (const byte of bytes) value += SERIAL_ALPHABET[byte % SERIAL_ALPHABET.length];
  return `CLN-${value.slice(0, 10)}`;
}
