/**
 * POST /api/razorpay/create-order — Create a Razorpay order
 *
 * PRODUCTION FLOW:
 * 1. Verify Firebase ID token (authentication)
 * 2. Validate amount (₹1–₹5,000)
 * 3. Create order via Razorpay Orders API (dynamic, not static QR)
 * 4. Return order_id to frontend for Razorpay Checkout
 *
 * SECURITY:
 * - key_secret never leaves the server
 * - Env vars validated at startup (fail-fast)
 * - Amount validated server-side before Razorpay call
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/user-auth";
import Razorpay from "razorpay";

export const runtime = "nodejs";

// ── Fail-fast env validation ────────────────────────────────────────────
if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error(
        "[FATAL] Missing Razorpay env vars. Set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local"
    );
}

const RAZORPAY_KEY_ID: string = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_SECRET: string = process.env.RAZORPAY_KEY_SECRET;

const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_SECRET,
});

// ── Minimum / maximum amount in INR ─────────────────────────────────────
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 5000;

export async function POST(req: NextRequest) {
    // SECURITY: Require Firebase ID token
    const uid = await getAuthenticatedUser(req);
    if (!uid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { amount } = await req.json();

        // Validate amount (server-side, never trust frontend)
        const parsedAmount = Number(amount);
        if (
            !Number.isFinite(parsedAmount) ||
            parsedAmount < MIN_AMOUNT ||
            parsedAmount > MAX_AMOUNT
        ) {
            return NextResponse.json(
                { error: `Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}` },
                { status: 400 }
            );
        }

        // Convert to paise (integer) — Razorpay rejects float values
        const amountInPaise = Math.round(parsedAmount * 100);

        const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `w_${uid.slice(0, 8)}_${Date.now()}`,
            notes: {
                userId: uid,
                purpose: "wallet_topup",
            },
        });

        console.log(
            `[Razorpay] Order created: ${order.id} | ₹${parsedAmount} | user=${uid.slice(0, 8)}…`
        );

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
        });
    } catch (error: any) {
        console.error("[Razorpay] Order creation failed:", {
            message: error?.message,
            statusCode: error?.statusCode,
            error: error?.error,
        });
        return NextResponse.json(
            { error: "Failed to create payment order" },
            { status: 500 }
        );
    }
}
