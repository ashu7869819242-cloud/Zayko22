import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    let uid: string;

    try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
    } catch {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    try {
        const { pin } = await req.json();

        if (!pin || !/^\d{4}$/.test(pin)) {
            return NextResponse.json({ error: "4-digit PIN required" }, { status: 400 });
        }

        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }

        const { pinHash } = userDoc.data()!;
        if (!pinHash) {
            return NextResponse.json({ error: "PIN not set for this account" }, { status: 400 });
        }

        const isValid = await bcrypt.compare(pin, pinHash);

        if (isValid) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
        }

    } catch (error) {
        console.error("PIN verification failed:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
