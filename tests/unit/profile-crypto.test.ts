import { beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { emptyProfile, ProfileValidationError, validateProfile } from "@/lib/profile";

beforeAll(() => { process.env.FD_DATA_KEY = crypto.randomBytes(32).toString("base64"); });

describe("profile validation (server-side source of truth)", () => {
  it("accepts a full valid profile", () => {
    const p = validateProfile({ diet: { pattern: "jain", customAvoid: ["mushroom"] }, allergies: { items: ["peanut"], custom: ["mustard"] }, conditions: { items: ["diabetes"] }, goals: ["reduce-sugar"], limits: [{ nutrient: "sodiumMg", amount: 600, per: "portion", clinicianAdvised: true }] });
    expect(p.allergies.items).toEqual(["peanut"]);
    expect(p.limits[0].clinicianAdvised).toBe(true);
  });
  it("rejects unknown values and malformed limits", () => {
    expect(() => validateProfile({ allergies: { items: ["unicorn"] } })).toThrow(ProfileValidationError);
    expect(() => validateProfile({ limits: [{ nutrient: "sodiumMg", amount: -1, per: "day" }] })).toThrow(ProfileValidationError);
    expect(() => validateProfile("nope")).toThrow(ProfileValidationError);
  });
  it("'prefer not to disclose' clears conditions", () => {
    const p = validateProfile({ conditions: { items: ["diabetes"], preferNotToDisclose: true } });
    expect(p.conditions.items).toEqual([]);
  });
  it("strips markup characters from free text", () => {
    expect(validateProfile({ allergies: { custom: ["<script>kiwi"] } }).allergies.custom[0]).toBe("scriptkiwi");
    expect(emptyProfile().diet.pattern).toBe("none");
  });
});

describe("encryption at rest and password hashing", () => {
  it("round-trips, hides plaintext, and is bound to its owner (AAD)", async () => {
    const { encryptJSON, decryptJSON } = await import("@/lib/server/crypto");
    const blob = encryptJSON({ allergy: "peanut-marker-123" }, "profile:userA");
    expect(blob).not.toMatch(/peanut-marker/);
    expect(decryptJSON(blob, "profile:userA")).toEqual({ allergy: "peanut-marker-123" });
    expect(() => decryptJSON(blob, "profile:userB")).toThrow();
  });
  it("hashes passwords with scrypt and verifies them", async () => {
    const { hashPassword, verifyPassword } = await import("@/lib/server/crypto");
    const h = await hashPassword("correct horse battery");
    expect(h).not.toContain("correct");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong password!!", h)).toBe(false);
  });
});
