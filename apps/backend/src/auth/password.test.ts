import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("stores a salted scrypt hash and verifies the original password", async () => {
    const encoded = await hashPassword("correct horse battery staple");
    expect(encoded).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(await verifyPassword("correct horse battery staple", encoded)).toBe(true);
    expect(await verifyPassword("incorrect password", encoded)).toBe(false);
  });

  it("rejects malformed or unsupported password hashes", async () => {
    await expect(verifyPassword("anything", "not-a-password-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "bcrypt:00000000000000000000000000000000:" + "0".repeat(128))).resolves.toBe(false);
  });
});
