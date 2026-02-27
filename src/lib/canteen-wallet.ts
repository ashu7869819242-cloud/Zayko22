import { FieldValue, Transaction, DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

const CANTEEN_WALLET_ID = "canteen_owner";

export interface WalletTransaction {
    amount: number;
    type: "credit" | "withdrawal" | "refund_deduction";
    orderId?: string;
    description: string;
    createdAt: string;
}

/**
 * Syncs the Canteen Wallet balances safely within an existing Firestore transaction.
 * Automatically handles pendingAmount vs totalBalance based on order status changes.
 */
export async function updateCanteenWallet(
    transaction: Transaction,
    oldStatus: string,
    newStatus: string,
    amount: number,
    orderId: string
) {
    if (amount <= 0 || oldStatus === newStatus) return;

    const walletRef = adminDb.collection("wallets").doc(CANTEEN_WALLET_ID);
    const walletDoc = await transaction.get(walletRef);

    // Initialize wallet if it doesn't exist
    let todayCollection = 0;
    let todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    if (!walletDoc.exists) {
        transaction.set(walletRef, {
            totalBalance: 0,
            pendingAmount: 0,
            todayCollection: 0,
            todayDate,
            lastUpdated: new Date().toISOString(),
        });
    } else {
        const data = walletDoc.data()!;
        // Reset todayCollection if it's a new day
        if (data.todayDate !== todayDate) {
            transaction.update(walletRef, { todayCollection: 0, todayDate });
        } else {
            todayCollection = data.todayCollection || 0;
        }
    }

    const updates: Record<string, any> = {
        lastUpdated: new Date().toISOString(),
    };

    let needsTransactionRecord = false;
    let transactionRecordDetails: Omit<WalletTransaction, "createdAt"> | null = null;

    // ─── STATUS TRANSITION LOGIC ───

    // 1. Pending -> Confirmed/Preparing/Ready (Funds enter escrow/pending)
    const isNewConfirmed =
        oldStatus === "pending" &&
        ["confirmed", "preparing", "ready"].includes(newStatus);

    if (isNewConfirmed) {
        updates.pendingAmount = FieldValue.increment(amount);
    }

    // 2. Confirmed/Preparing/Ready -> Completed (Funds move from pending to total)
    const isNewCompleted =
        ["confirmed", "preparing", "ready"].includes(oldStatus) &&
        newStatus === "completed";

    // Direct Pending -> Completed (rare, but handle it)
    const isDirectCompleted = oldStatus === "pending" && newStatus === "completed";

    if (isNewCompleted) {
        updates.pendingAmount = FieldValue.increment(-amount);
        updates.totalBalance = FieldValue.increment(amount);
        updates.todayCollection = FieldValue.increment(amount);
        needsTransactionRecord = true;
        transactionRecordDetails = {
            amount,
            type: "credit",
            orderId,
            description: `Order Completed - #${orderId}`,
        };
    } else if (isDirectCompleted) {
        updates.totalBalance = FieldValue.increment(amount);
        updates.todayCollection = FieldValue.increment(amount);
        needsTransactionRecord = true;
        transactionRecordDetails = {
            amount,
            type: "credit",
            orderId,
            description: `Order Completed (Direct) - #${orderId}`,
        };
    }

    // 3. Cancellation & Refunds
    // If cancelling a pending order, no canteen funds were manipulated (good).
    // If cancelling an already confirmed/preparing order: deduct from pending.
    const isCancellingActive =
        ["confirmed", "preparing", "ready"].includes(oldStatus) &&
        newStatus === "cancelled";

    if (isCancellingActive) {
        updates.pendingAmount = FieldValue.increment(-amount);
    }

    // If cancelling an already completed order (rare admin action): deduct from total.
    const isCancellingCompleted = oldStatus === "completed" && newStatus === "cancelled";

    if (isCancellingCompleted) {
        updates.totalBalance = FieldValue.increment(-amount);
        // We technically don't decrement todayCollection to avoid negative daily vibes, 
        // but could if needed.
        needsTransactionRecord = true;
        transactionRecordDetails = {
            amount,
            type: "refund_deduction",
            orderId,
            description: `Order Refunded - #${orderId}`,
        };
    }

    // Apply Wallet updates if any happened
    if (Object.keys(updates).length > 1) { // 1 is lastUpdated
        transaction.update(walletRef, updates);
    }

    // Create canteen transaction record if needed
    if (needsTransactionRecord && transactionRecordDetails) {
        const txnRef = adminDb.collection("canteenTransactions").doc();
        transaction.set(txnRef, {
            ...transactionRecordDetails,
            createdAt: new Date().toISOString(),
        });
    }
}
