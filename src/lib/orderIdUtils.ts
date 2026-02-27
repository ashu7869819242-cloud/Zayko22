/**
 * Order ID Utility — Generates unique Zayko-format order IDs.
 *
 * Format: ZKO + 4 alphanumeric characters (at least 1 letter + 1 digit)
 * Examples: ZKO4F7X, ZKO9K2Q
 */

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O to avoid confusion
const DIGITS = "0123456789";
const ALPHANUMERIC = LETTERS + DIGITS;

function randomChar(pool: string): string {
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Generate a Zayko-format order ID.
 * Guarantees at least 1 letter and 1 digit in the 4-char suffix.
 */
export function generateOrderId(): string {
    // Ensure at least 1 letter and 1 digit
    const mandatoryLetter = randomChar(LETTERS);
    const mandatoryDigit = randomChar(DIGITS);

    // Fill remaining 2 chars from full alphanumeric pool
    const extra1 = randomChar(ALPHANUMERIC);
    const extra2 = randomChar(ALPHANUMERIC);

    // Shuffle the 4 characters so positions are random
    const chars = [mandatoryLetter, mandatoryDigit, extra1, extra2];
    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return `ZKO${chars.join("")}`;
}

