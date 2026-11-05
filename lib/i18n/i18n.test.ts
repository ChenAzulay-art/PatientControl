import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import he from "@/messages/he.json";
import { isLocale, negotiateLocale } from "./config";
import { format } from "./format";

/** Every "a.b.c" path to a string in a nested messages object. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function valueAt(messages: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown>)[key],
      messages,
    );
}

describe("messages", () => {
  it("has the same keys in Hebrew and English", () => {
    expect(keyPaths(he).sort()).toEqual(keyPaths(en).sort());
  });

  it("has no empty translations", () => {
    for (const messages of [he, en]) {
      for (const path of keyPaths(messages)) {
        expect(String(valueAt(messages, path)).trim(), path).not.toBe("");
      }
    }
  });

  it("uses the same placeholders in both languages", () => {
    for (const path of keyPaths(en)) {
      const placeholders = (text: unknown) =>
        (String(text).match(/\{\w+\}/g) ?? []).sort();
      expect(placeholders(valueAt(he, path)), path).toEqual(
        placeholders(valueAt(en, path)),
      );
    }
  });
});

describe("negotiateLocale", () => {
  it("prefers a saved cookie", () => {
    expect(negotiateLocale("en", "he-IL,he;q=0.9")).toBe("en");
  });

  it("ignores an unsupported cookie value", () => {
    expect(negotiateLocale("fr", "en-US,en;q=0.9")).toBe("en");
  });

  it("follows Accept-Language quality order", () => {
    expect(negotiateLocale(undefined, "fr-FR;q=1, en;q=0.5, he;q=0.8")).toBe(
      "he",
    );
  });

  it("maps the legacy iw code to Hebrew", () => {
    expect(negotiateLocale(null, "iw-IL")).toBe("he");
  });

  it("defaults to Hebrew", () => {
    expect(negotiateLocale(undefined, undefined)).toBe("he");
    expect(negotiateLocale(undefined, "de-DE,fr;q=0.8")).toBe("he");
  });
});

describe("isLocale", () => {
  it("accepts only supported locales", () => {
    expect(isLocale("he")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("format", () => {
  it("fills placeholders and leaves unknown ones alone", () => {
    expect(format("Hello, {name} {missing}", { name: "Dana" })).toBe(
      "Hello, Dana {missing}",
    );
  });

  it("doesn't read inherited properties", () => {
    expect(format("{toString}", {})).toBe("{toString}");
  });
});
