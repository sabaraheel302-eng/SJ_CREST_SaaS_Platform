import argon2 from "argon2";
import { randomBytes } from "node:crypto";

export const passwordPolicyMessage = "Use 12 to 128 characters, including a letter and a number.";
export function isStrongPassword(password: string) {
  return password.length >= 12 && password.length <= 128 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
}

export function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password).catch(() => false);
}

let dummyHash: Promise<string> | undefined;
export async function verifyPasswordForLogin(hash: string | undefined, password: string) {
  dummyHash ??= hashPassword(randomBytes(32).toString("hex"));
  const storedHash = hash ?? await dummyHash;
  const matched = await verifyPassword(storedHash, password);
  return Boolean(hash) && matched;
}
