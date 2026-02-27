/**
 * POST /api/razorpay/verify — Verify Razorpay payment and credit wallet
 *
 * PRODUCTION FLOW:
 * 1. Verify Firebase ID token (authentication)
 * 2. Verify Razorpay payment signature (HMAC SHA256, timing-safe)
 * 3. Cross-verify amount with Razorpay Orders API (don't trust frontend)
 * 4. Atomic Firestore transaction: dedup → credit wallet → log transaction
 *
 * SECURITY:
 * - Timing-safe signature comparison (prevents timing attacks)
 * - Server-side amount fetched from Razorpay (never trust client amount)
 * - Idempotent via payments/{payment_id} dedup doc
 * - Atomic wallet credit + transaction log in single Firestore transaction
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/user-auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
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

export async function POST(req: NextRequest) {
    // SECURITY: Require Firebase ID token
    const uid = await getAuthenticatedUser(req);
    if (!uid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = await req.json();

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json(
                { error: "Missing payment details" },
                { status: 400 }
            );
        }

        // ── STEP 1: Timing-safe signature verification ──────────────────
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", RAZORPAY_SECRET)
            .update(body)
            .digest("hex");

        // Timing-safe comparison prevents timing attacks
        const sigBuffer = Buffer.from(razorpay_signature, "hex");
        const expectedBuffer = Buffer.from(expectedSignature, "hex");

        if (
            sigBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
        ) {
            console.warn(
                `[Razorpay] ⚠ Invalid signature for order=${razorpay_order_id} user=${uid.slice(0, 8)}…`
            );
            return NextResponse.json(
                { error: "Invalid payment signature" },
                { status: 400 }
            );
        }

        // ── STEP 2: Cross-verify amount from Razorpay (don't trust frontend) ─
        let orderAmount: number;
        try {
            const order = await razorpay.orders.fetch(razorpay_order_id);
            orderAmount = Number(order.amount); // in paise
        } catch (fetchErr) {
            console.error("[Razorpay] Failed to fetch order for cross-check:", fetchErr);
            return NextResponse.json(
                { error: "Could not verify order amount" },
                { status: 500 }
            );
        }

        // Convert paise → rupees
        const amountInRupees = Math.round(orderAmount / 100);

        if (amountInRupees < 1 || amountInRupees > 5000) {
            return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }

        // ── STEP 3: Atomic Firestore transaction ────────────────────────
        await adminDb.runTransaction(async (transaction) => {
            // DEDUP: Check if this payment was already processed
            const paymentRef = adminDb.collection("payments").doc(razorpay_payment_id);
            const paymentDoc = await transaction.get(paymentRef);
            if (paymentDoc.exists) {
                throw new Error("Payment already processed");
            }

            const userRef = adminDb.collection("users").doc(uid);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error("User not found");
            }

            // Record payment for dedup
            transaction.set(paymentRef, {
                razorpayPaymentId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id,
                userId: uid,
                amount: amountInRupees,
                amountPaise: orderAmount,
                verified: true,
                createdAt: new Date().toISOString(),
            });

            // Credit wallet
            transaction.update(userRef, {
                walletBalance: FieldValue.increment(amountInRupees),
            });

            // Record wallet transaction
            const txnRef = adminDb.collection("walletTransactions").doc();
            transaction.set(txnRef, {
                userId: uid,
                fromUserId: "razorpay",
                toUserId: uid,
                type: "topup",
                amount: amountInRupees,
                description: `Wallet top-up via Razorpay`,
                razorpayPaymentId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id,
                transactionId: txnRef.id,
                createdAt: new Date().toISOString(),
            });
        });

        console.log(
            `[Razorpay] ✅ Payment verified: ${razorpay_payment_id} | ₹${amountInRupees} | user=${uid.slice(0, 8)}…`
        );

        return NextResponse.json({
            success: true,
            message: `₹${amountInRupees} added to wallet`,
        });
    } catch (error) {
        console.error("[Razorpay] Payment verification failed:", error);
        const message =
            error instanceof Error ? error.message : "Payment verification failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
