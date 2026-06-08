import { randomBytes, createCipheriv } from "crypto";
import { gzipSync, gunzipSync } from "zlib";
import { decrypt } from "./crypto";

// Mirrors the edge daemon's AES-256-GCM wire format: nonce(12) || ciphertext || tag(16).
function encrypt(key: Buffer, plaintext: Buffer): Buffer {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ct, tag]);
}

describe("decrypt (validator)", () => {
  it("reverses the daemon's AES-256-GCM encryption", () => {
    const key = randomBytes(32);
    const plaintext = Buffer.from("CREATE TABLE t (id int);\nINSERT INTO t VALUES (1);\n");
    const out = decrypt(key, encrypt(key, plaintext));
    expect(out.equals(plaintext)).toBe(true);
  });

  it("throws on a wrong key (GCM auth failure)", () => {
    const blob = encrypt(randomBytes(32), Buffer.from("secret dump"));
    expect(() => decrypt(randomBytes(32), blob)).toThrow();
  });

  it("throws on a tampered ciphertext", () => {
    const key = randomBytes(32);
    const blob = encrypt(key, Buffer.from("secret dump"));
    blob[20] ^= 0xff; // flip a byte in the ciphertext region
    expect(() => decrypt(key, blob)).toThrow();
  });
});

describe("compress→encrypt→decrypt→decompress round-trip", () => {
  it("recovers the exact original dump (full pipeline order)", () => {
    const key = randomBytes(32);
    const dump = Buffer.from("-- a realistic SQL dump --\n".repeat(200));

    // daemon order: compress then encrypt
    const wire = encrypt(key, gzipSync(dump));
    // validator order: decrypt then (detect gzip magic) decompress
    const decrypted = decrypt(key, wire);
    const isGzip = decrypted[0] === 0x1f && decrypted[1] === 0x8b;
    const restored = isGzip ? gunzipSync(decrypted) : decrypted;

    expect(isGzip).toBe(true);
    expect(restored.equals(dump)).toBe(true);
  });
});
