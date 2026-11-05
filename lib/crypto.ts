import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * Field-level encryption for sensitive patient data (ID number, medical
 * background, important notes, later session summaries).
 *
 * One 32-byte master key (DATA_ENCRYPTION_KEY, base64) derives two keys:
 * an AES-256-GCM key for encryption, and an HMAC key for lookup hashes that
 * let us find duplicates without decrypting. Ciphertext is versioned so the
 * key can be rotated later.
 */

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

type Keys = { encryption: Buffer; lookup: Buffer };
let cached: { source: string; keys: Keys } | undefined;

function keys(): Keys {
  const source = process.env.DATA_ENCRYPTION_KEY;
  if (!source) {
    throw new Error(
      "DATA_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }
  if (cached?.source === source) return cached.keys;

  const master = Buffer.from(source, "base64");
  if (master.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  }
  const derive = (info: string) =>
    Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), info, 32));
  const derived = {
    encryption: derive("patient-control/encryption/v1"),
    lookup: derive("patient-control/lookup/v1"),
  };
  cached = { source, keys: derived };
  return derived;
}

/** Encrypts text. Empty or missing values stay null, so "not given" is visible. */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keys().encryption, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  return `${VERSION}:${payload.toString("base64")}`;
}

/** Decrypts a value from `encrypt`. Throws if it was tampered with or the key is wrong. */
export function decrypt(value: string | null | undefined): string | null {
  if (value == null) return null;
  const [version, data] = value.split(":", 2);
  if (version !== VERSION || !data) {
    throw new Error("Unsupported encrypted value.");
  }
  const payload = Buffer.from(data, "base64");
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = payload.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", keys().encryption, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * A keyed hash for equality lookups (e.g. "is this ID number already on
 * file?"). Scoped by `scope` (the clinic id) so the same value hashes
 * differently in different clinics.
 */
export function lookupHash(scope: string, value: string): string {
  return createHmac("sha256", keys().lookup)
    .update(`${scope}\u0000${value}`)
    .digest("base64url");
}
