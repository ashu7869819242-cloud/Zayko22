/**
 * Admin Orders API — View all orders + Update order status/prepTime
 * 
 * SECURITY CHANGES:
 * - All handlers now require admin JWT verification via verifyAdmin()
 * - Returns 401 Unauthorized if token is missing or invalid
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";
import { updateCanteenWallet } from "@/lib/canteen-wallet";

export const runtime = "nodejs";

// SECURITY: Centralized auth check for all admin orders operations
function requireAdmin(req: NextRequest): NextResponse | null {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
}

export async function GET(req: NextRequest) {
    const authError = requireAdmin(req);
    if (authError) return authError;

    try {
        const snapshot = await adminDb
            .collection("orders")
            .orderBy("createdAt", "desc")
            .get();
        const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ orders });
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const authError = requireAdmin(req);
    if (authError) return authError;

    try {
        const { orderId, status, prepTime } = await req.json();
        if (!orderId) {
            return NextResponse.json({ error: "Order ID required" }, { status: 400 });
        }

        const orderRef = adminDb.collection("orders").doc(orderId);

        await adminDb.runTransaction(async (transaction) => {
            const orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists) throw new Error("Order not found");

            const orderData = orderDoc.data()!;
            const oldStatus = orderData.status;

            // --- 1. HANDLE CANCELLATION & REFUND ---
            if (status === "cancelled") {
                if (oldStatus === "cancelled") {
                    throw new Error("Order is already cancelled");
                }

                const userId = orderData.userId;
                const total = orderData.total;
                const orderIdDisplay = orderData.orderId;

                // Sync Wallet (deduct pending/total if cancelling an active/completed order)
                await updateCanteenWallet(transaction, oldStatus, "cancelled", total, orderIdDisplay);

                // Update order
                transaction.update(orderRef, {
                    status: "cancelled",
                    updatedAt: new Date().toISOString(),
                });

                // Refund User Wallet
                const userRef = adminDb.collection("users").doc(userId);
                transaction.update(userRef, {
                    walletBalance: FieldValue.increment(total),
                });

                // Record Refund Txn for User
                const txnRef = adminDb.collection("walletTransactions").doc();
                transaction.set(txnRef, {
                    userId,
                    type: "refund",
                    amount: total,
                    description: `Refund - Order #${orderIdDisplay} Cancelled`,
                    transactionId: txnRef.id,
                    createdAt: new Date().toISOString(),
                });

                return; // End transaction for cancellation block
            }

            // --- 2. NORMAL STATUS / PREP TIME UPDATE ---
            const updateData: Record<string, unknown> = {
                updatedAt: new Date().toISOString(),
            };

            let newStatus = status || oldStatus;

            // When status is set to "ready", clear countdowns
            if (newStatus === "ready") {
                updateData.readyAt = null;
                updateData.estimatedReadyAt = null;
            }

            if (prepTime) {
                updateData.prepTime = prepTime;
                const readyAtISO = new Date(Date.now() + prepTime * 60 * 1000).toISOString();
                updateData.estimatedReadyAt = readyAtISO;
                updateData.readyAt = readyAtISO;

                // Auto-promote to confirmed if pending and no explicit status sent
                if (!status && oldStatus === "pending") {
                    newStatus = "confirmed";
                }
            }

            if (newStatus !== oldStatus) {
                updateData.status = newStatus;

                // Sync Wallet for status progression
                await updateCanteenWallet(
                    transaction,
                    oldStatus,
                    newStatus,
                    orderData.total,
                    orderData.orderId
                );
            }

            transaction.update(orderRef, updateData);
        });

        return NextResponse.json({ success: true, refunded: status === "cancelled" });
    } catch (error) {
        console.error("Failed to update order:", error);
        const message = error instanceof Error ? error.message : "Failed to update order";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
