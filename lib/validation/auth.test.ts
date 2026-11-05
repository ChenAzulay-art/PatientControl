import { describe, expect, it } from "vitest";
import { clinicSlugSchema, createClinicSchema, totpCodeSchema } from "./auth";

describe("clinicSlugSchema", () => {
  it.each(["dana-reflex", "clinic1", "abc", "a".repeat(40)])(
    "accepts %s",
    (slug) => {
      expect(clinicSlugSchema.safeParse(slug).success).toBe(true);
    },
  );

  it.each([
    "ab",
    "a".repeat(41),
    "-dana",
    "dana-",
    "dana--clinic",
    "dana clinic",
    "דנה",
    "dana_clinic",
  ])("rejects %s", (slug) => {
    expect(clinicSlugSchema.safeParse(slug).success).toBe(false);
  });

  it("lowercases and trims", () => {
    expect(clinicSlugSchema.parse("  Dana-Clinic ")).toBe("dana-clinic");
  });
});

describe("createClinicSchema", () => {
  it("requires a name of at least 2 characters", () => {
    expect(
      createClinicSchema.safeParse({ name: " ", slug: "dana" }).success,
    ).toBe(false);
    expect(
      createClinicSchema.safeParse({ name: "קליניקה של דנה", slug: "dana" })
        .success,
    ).toBe(true);
  });
});

describe("totpCodeSchema", () => {
  it("accepts six digits, ignoring spaces", () => {
    expect(totpCodeSchema.parse("123 456")).toBe("123456");
  });

  it.each(["12345", "1234567", "abcdef"])("rejects %s", (code) => {
    expect(totpCodeSchema.safeParse(code).success).toBe(false);
  });
});
