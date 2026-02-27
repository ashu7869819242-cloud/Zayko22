/**
 * POST /api/users/register — Server-side user profile creation
 * 
 * SECURITY: Replaces client-side Firestore writes during registration.
 * Validates all fields server-side and enforces walletBalance = 0.
 * Generates a globally unique 6-char alphanumeric code per user.
 * Requires a valid Firebase ID token.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

/**
 * Generate a random 6-char uppercase alphanumeric code.
 * Uses crypto.randomBytes for secure randomness.
 */
function generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
    const bytes = crypto.randomBytes(6);
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}

/**
 * Generate a unique code with retry — checks Firestore for collisions.
 * Max 5 attempts before failing.
 */
async function generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        const existing = await adminDb
            .collection("users")
            .where("uniqueCode", "==", code)
            .limit(1)
            .get();
        if (existing.empty) return code;
    }
    throw new Error("Failed to generate unique code after 5 attempts");
}

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    let uid: string;
    let email: string | undefined;

    try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
        email = decoded.email;
    } catch {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    try {
        const { name, phone, pin } = await req.json();

        // Check if user already exists
        const userRef = adminDb.collection("users").doc(uid);
        const userDoc = await userRef.get();

        // PIN validation (common for both new and existing)
        if (!pin || !/^\d{4}$/.test(pin)) {
            return NextResponse.json({ error: "4-digit PIN is required" }, { status: 400 });
        }

        const pinHash = await bcrypt.hash(pin, 10);

        if (userDoc.exists) {
            const userData = userDoc.data();
            if (!userData) return NextResponse.json({ error: "User data missing" }, { status: 404 });

            // If user exists, we only allow updating PIN if it's missing (migration case)
            if (userData.pinHash) {
                return NextResponse.json({ error: "PIN already set for this account" }, { status: 409 });
            }

            // Update existing user with PIN
            await userRef.update({
                pinHash,
                // Optionally update name/phone if they were missing (from very old accounts)
                ...(name && !userData.name ? { name: name.trim() } : {}),
                ...(phone && !userData.phone ? { phone: phone.trim() } : {}),
                updatedAt: new Date().toISOString()
            });

            return NextResponse.json({ success: true, message: "PIN set successfully" });
        }

        // --- NEW USER REGISTRATION ---
        if (!name || typeof name !== "string" || name.trim().length < 2) {
            return NextResponse.json({ error: "Valid name is required" }, { status: 400 });
        }

        if (!phone || !/^\d{10}$/.test(phone)) {
            return NextResponse.json({ error: "Valid 10-digit phone number is required" }, { status: 400 });
        }

        // Generate globally unique code
        const uniqueCode = await generateUniqueCode();

        // Create new user doc
        await userRef.set({
            uid,
            email: email || "",
            name: name.trim(),
            phone: phone.trim(),
            pinHash,
            uniqueCode,
            role: "user",
            walletBalance: 0,
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, uniqueCode });
    } catch (error) {
        console.error("User registration/setup failed:", error);
        return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
    }
}
