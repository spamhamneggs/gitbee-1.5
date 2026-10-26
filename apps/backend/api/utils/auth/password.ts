import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import bcrypt from "bcryptjs";

// Stored as scrypt$N$r$p$salt$hash (base64), so the cost can be raised later
// without breaking hashes that are already in the database.
const COST = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function deriveKey(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scrypt(password, salt, keyLength, options, (error, key) => {
            if (error) reject(error);
            else resolve(key);
        });
    });
}

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await deriveKey(password, salt, KEY_LENGTH, COST);
    return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    if (stored.startsWith("$2")) {
        return bcrypt.compare(password, stored);
    }
    const [scheme, N, r, p, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) {
        return false;
    }

    const expected = Buffer.from(hash, "base64");
    const key = await deriveKey(password, Buffer.from(salt, "base64"), expected.length, {
        N: Number(N),
        r: Number(r),
        p: Number(p),
    });
    return timingSafeEqual(key, expected);
}
