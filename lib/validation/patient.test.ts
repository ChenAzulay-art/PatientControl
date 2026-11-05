import { describe, expect, it } from "vitest";
import { ageOn, formatDate } from "@/lib/format";
import { isValidIsraeliId, normalizeIsraeliId } from "./israeli-id";
import { patientInputSchema } from "./patient";
import { formatPhone, normalizePhone, phoneSearchDigits } from "./phone";

describe("Israeli ID numbers", () => {
  it.each(["123456782", "000000018", "18", "12345678-2", "123 456 782"])(
    "accepts %s",
    (id) => {
      // Short numbers are padded with zeros; 18 is too short to be an ID.
      expect(isValidIsraeliId(id)).toBe(id !== "18");
    },
  );

  it.each(["123456789", "000000000", "1234567890", "abcdefghi", ""])(
    "rejects %s",
    (id) => {
      expect(isValidIsraeliId(id)).toBe(false);
    },
  );

  it("pads short numbers to 9 digits", () => {
    expect(normalizeIsraeliId("12345674")).toBe("012345674");
  });
});

describe("phone numbers", () => {
  it.each([
    ["050-123-4567", "+972501234567"],
    ["0501234567", "+972501234567"],
    ["+972 50 123 4567", "+972501234567"],
    ["+972-050-1234567", "+972501234567"],
    ["00972501234567", "+972501234567"],
    ["03-1234567", "+97231234567"],
    ["+1 212 555 0100", "+12125550100"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["12345", "050-123", "hello", "", "0001234567"])(
    "rejects %s",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );

  it("formats Israeli numbers locally", () => {
    expect(formatPhone("+972501234567")).toBe("050-123-4567");
    expect(formatPhone("+97231234567")).toBe("03-123-4567");
    expect(formatPhone("+12125550100")).toBe("+12125550100");
  });

  it("turns a local search into digits that match the stored number", () => {
    expect(phoneSearchDigits("050-123")).toBe("50123");
    expect(phoneSearchDigits("ab")).toBeNull();
  });
});

const valid = {
  fullName: "  דנה כהן ",
  phone: "050-123-4567",
  email: " Dana@Example.TEST ",
  dateOfBirth: "1985-03-14",
  nationalId: "123456782",
  medicalBackground: "",
  importantNotes: "רגישות לשמן לבנדר",
  treatmentTypeIds: [],
  preferredLocale: "he",
  reminderConsent: true,
};

describe("patientInputSchema", () => {
  it("cleans up a valid patient", () => {
    const result = patientInputSchema.parse(valid);
    expect(result).toMatchObject({
      fullName: "דנה כהן",
      phone: "+972501234567",
      email: "dana@example.test",
      nationalId: "123456782",
      medicalBackground: null,
      importantNotes: "רגישות לשמן לבנדר",
    });
  });

  it("allows the optional fields to be empty", () => {
    const result = patientInputSchema.parse({
      ...valid,
      email: "",
      dateOfBirth: "",
      nationalId: "",
    });
    expect(result.email).toBeNull();
    expect(result.dateOfBirth).toBeNull();
    expect(result.nationalId).toBeNull();
  });

  it.each([
    ["fullName", "ד", "nameRequired"],
    ["phone", "12", "phoneInvalid"],
    ["email", "not-an-email", "emailInvalid"],
    ["dateOfBirth", "2999-01-01", "dateOfBirthInvalid"],
    ["dateOfBirth", "1985-02-30", "dateOfBirthInvalid"],
    ["nationalId", "123456789", "nationalIdInvalid"],
  ])("rejects %s = %s with %s", (field, value, message) => {
    const result = patientInputSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: [field],
      message,
    });
  });

  it("rejects an unsupported language", () => {
    expect(
      patientInputSchema.safeParse({ ...valid, preferredLocale: "fr" }).success,
    ).toBe(false);
  });

  it("rejects ids that aren't UUIDs", () => {
    expect(
      patientInputSchema.safeParse({ ...valid, treatmentTypeIds: ["1 or 1=1"] })
        .success,
    ).toBe(false);
  });
});

describe("dates", () => {
  it("computes age around the birthday", () => {
    expect(ageOn("1985-03-14", new Date("2026-03-13T12:00:00Z"))).toBe(40);
    expect(ageOn("1985-03-14", new Date("2026-03-14T12:00:00Z"))).toBe(41);
  });

  it("formats a birth date without shifting the day", () => {
    expect(formatDate("en", "1985-03-14")).toContain("14");
    expect(formatDate("he", "1985-03-14")).toContain("1985");
  });
});
