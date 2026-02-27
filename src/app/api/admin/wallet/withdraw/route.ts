import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { amount } = await req.json();
        if (!amount || amount <= 0) {
            return NextResponse.json({ error: "Invalid withdrawal amount" }, { status: 400 });
        }

        const walletRef = adminDb.collection("wallets").doc("canteen_owner");

        await adminDb.runTransaction(async (transaction) => {
            const walletDoc = await transaction.get(walletRef);
            if (!walletDoc.exists) throw new Error("Wallet not found");

            const currentBalance = walletDoc.data()!.totalBalance || 0;
            if (currentBalance < amount) {
                throw new Error("Insufficient balance for withdrawal");
            }

            // Deduct balance
            transaction.update(walletRef, {
                totalBalance: FieldValue.increment(-amount),
                lastUpdated: new Date().toISOString(),
            });

            // Record Global Transaction
            const txnRef = adminDb.collection("canteenTransactions").doc();
            transaction.set(txnRef, {
                amount,
                type: "withdrawal",
                description: "Wallet Withdrawal",
                createdAt: new Date().toISOString(),
            });

            // Record specific Withdrawal request
            const withdrawRef = adminDb.collection("withdrawals").doc();
            transaction.set(withdrawRef, {
                amount,
                status: "completed",
                requestedAt: new Date().toISOString(),
                processedAt: new Date().toISOString(),
            });
        });

        return NextResponse.json({ success: true, message: "Withdrawal successful" });
    } catch (error) {
        console.error("Withdrawal error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Withdrawal failed" },
            { status: 500 }
        );
    }
}
