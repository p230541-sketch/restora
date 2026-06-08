import { createDecipheriv } from "crypto";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

// Always fetch the current key version so a rotated key is picked up immediately.
export async function fetchKey(
  client: SecretsManagerClient,
  secretId: string
): Promise<Buffer> {
  const cmd = new GetSecretValueCommand({ SecretId: secretId });
  const resp = await client.send(cmd);
  if (!resp.SecretString) throw new Error("Secret has no string value");
  const key = Buffer.from(resp.SecretString, "hex");
  if (key.length !== 32) throw new Error(`Key must be 32 bytes, got ${key.length}`);
  return key;
}

// Decrypt AES-256-GCM payload: first 12 bytes = nonce, rest = ciphertext+tag
export function decrypt(key: Buffer, data: Buffer): Buffer {
  const nonce = data.subarray(0, 12);
  const ciphertext = data.subarray(12);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  // GCM tag is last 16 bytes
  const tag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain;
}
