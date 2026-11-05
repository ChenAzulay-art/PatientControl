// @vitest-environment node
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt, lookupHash } from "./crypto";

const original = process.env.DATA_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

afterEach(() => {
  process.env.DATA_ENCRYPTION_KEY = original;
});

describe("encrypt / decrypt", () => {
  it("round-trips Hebrew and English text", () => {
    const text = "אלרגיה לשמן לבנדר; knee surgery 2019";
    const sealed = encrypt(text);
    expect(sealed).not.toContain("לבנדר");
    expect(sealed).toMatch(/^v1:/);
    expect(decrypt(sealed)).toBe(text);
  });

  it("produces different ciphertext for the same text", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("keeps empty values as null", () => {
    expect(encrypt("")).toBeNull();
    expect(encrypt(null)).toBeNull();
    expect(decrypt(null)).toBeNull();
  });

  it("rejects tampered ciphertext", () => {
    const sealed = encrypt("secret")!;
    const bytes = Buffer.from(sealed.slice(3), "base64");
    bytes[bytes.length - 1] ^= 1;
    expect(() => decrypt(`v1:${bytes.toString("base64")}`)).toThrow();
  });

  it("can't be read with a different key", () => {
    const sealed = encrypt("secret");
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decrypt(sealed)).toThrow();
  });

  it("requires a 32-byte key", () => {
    process.env.DATA_ENCRYPTION_KEY = randomBytes(16).toString("base64");
    expect(() => encrypt("x")).toThrow(/32 bytes/);
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/not set/);
  });
});

describe("lookupHash", () => {
  it("is stable within a clinic and differs between clinics", () => {
    expect(lookupHash("clinic-a", "123456782")).toBe(
      lookupHash("clinic-a", "123456782"),
    );
    expect(lookupHash("clinic-a", "123456782")).not.toBe(
      lookupHash("clinic-b", "123456782"),
    );
  });

  it("doesn't contain the value", () => {
    expect(lookupHash("clinic-a", "123456782")).not.toContain("123456782");
  });
});
