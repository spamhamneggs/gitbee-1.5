import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "../api/utils/auth/password.js";

describe("password hashing", () => {
  it("stores a self-describing scrypt hash, never the plain password", async () => {
    const hash = await hashPassword("secret");

    assert.match(hash, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    assert.ok(!hash.includes("secret"));
    assert.ok(hash.length <= 255, "must fit user.password VARCHAR(255)");
  });

  it("salts every hash", async () => {
    assert.notEqual(await hashPassword("secret"), await hashPassword("secret"));
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("secret");

    assert.equal(await verifyPassword("secret", hash), true);
    assert.equal(await verifyPassword("Secret", hash), false);
  });

  it("rejects values that are not scrypt hashes", async () => {
    assert.equal(await verifyPassword("secret", "secret"), false);
    assert.equal(await verifyPassword("secret", "bcrypt$x$y"), false);
  });
});
