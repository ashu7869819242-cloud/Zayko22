/**
 * Wallet Page — View balance + transaction history
 *
 * Real-time Firestore onSnapshot for transactions (no more stale data).
 * Balance comes from AuthContext profile (also onSnapshot).
 */

"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import toast from "react-hot-toast";

interface Transaction {
    id: string;
    type: "topup" | "transfer" | "payment" | "credit" | "debit" | "refund";
    amount: number;
    description: string;
    fromUserId?: string;
    toUserId?: string;
    referenceId?: string;
    createdAt: string;
}

export default function WalletPage() {
    const { user, profile, loading, getIdToken } = useAuth();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [txnLoading, setTxnLoading] = useState(true);
    const [topUpAmount, setTopUpAmount] = useState<string>("");
    const [processing, setProcessing] = useState(false);
    const [recipientCode, setRecipientCode] = useState("");
    const [recipientName, setRecipientName] = useState<string | null>(null);
    const [transferAmount, setTransferAmount] = useState("");
    const [lookupLoading, setLookupLoading] = useState(false);
    const [transferring, setTransferring] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.push("/auth");
    }, [user, loading, router]);

    // ── REAL-TIME transaction listener (replaces REST fetch) ──
    useEffect(() => {
        if (!user) {
            setTransactions([]);
            setTxnLoading(false);
            return;
        }

        const q = query(
            collection(db, "walletTransactions"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const txnList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Transaction[];
                setTransactions(txnList);
                setTxnLoading(false);
            },
            (error) => {
                console.error("Transaction listener error:", error);
                toast.error("Failed to load transactions. Check Firestore indexes.");
                setTxnLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    const handleTopUp = async (amount: number) => {
        if (!amount || amount < 1) {
            toast.error("Please enter a valid amount");
            return;
        }

        setProcessing(true);
        try {
            const token = await getIdToken();

            // 1. Create order on server
            const orderRes = await fetch("/api/razorpay/create-order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ amount }),
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.error);

            // 2. Open Razorpay Checkout
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "Campus Canteen",
                description: "Wallet Top-up",
                order_id: orderData.orderId,
                handler: async (response: any) => {
                    setProcessing(true);
                    try {
                        // 3. Verify payment on server
                        const verifyRes = await fetch("/api/razorpay/verify", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                        });

                        const verifyData = await verifyRes.json();
                        if (verifyRes.ok) {
                            toast.success("Wallet topped up successfully! 🎉");
                            setTopUpAmount("");
                            // No need to manually refetch — onSnapshot handles it
                        } else {
                            throw new Error(verifyData.error);
                        }
                    } catch (err: any) {
                        toast.error(err.message || "Payment verification failed");
                    } finally {
                        setProcessing(false);
                    }
                },
                prefill: {
                    name: profile?.name,
                    email: profile?.email,
                },
                theme: {
                    color: "#1e3a5f",
                },
                modal: {
                    ondismiss: () => setProcessing(false),
                },
            };

            if (!(window as any).Razorpay) {
                throw new Error("Razorpay SDK not loaded. Please refresh the page and try again.");
            }
            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (err: any) {
            toast.error(err.message || "Failed to initiate payment");
            setProcessing(false);
        }
    };

    if (loading || txnLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-campus-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const balance = profile?.walletBalance || 0;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="page-container max-w-2xl">
                {/* Balance Card */}
                <div className="gradient-primary rounded-3xl p-8 text-white mb-8 animate-fade-in relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
                    <div className="relative z-10">
                        <p className="text-campus-200 text-sm font-medium">Wallet Balance</p>
                        <h2 className="text-4xl sm:text-5xl font-display font-bold mt-2">
                            ₹{balance.toLocaleString()}
                        </h2>
                        <div className="flex items-center gap-2 text-campus-300 text-sm mt-2">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                            {profile?.name} • {profile?.rollNumber}
                        </div>
                        {profile?.uniqueCode && (
                            <div className="mt-3 bg-white/10 rounded-xl px-4 py-2 inline-flex items-center gap-2">
                                <span className="text-xs text-campus-200">Your Code:</span>
                                <span className="font-display font-bold text-white tracking-widest">{profile.uniqueCode}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Top-up Selection */}
                <div className="glass-card p-6 mb-8 animate-slide-up">
                    <h3 className="font-display font-bold text-campus-700 mb-4">💳 Add Money to Wallet</h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        {[50, 100, 200, 500].map((amt) => (
                            <button
                                key={amt}
                                onClick={() => handleTopUp(amt)}
                                disabled={processing}
                                className="py-3 px-4 rounded-2xl border-2 border-campus-100 text-campus-600 font-bold hover:bg-campus-50 hover:border-campus-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                +₹{amt}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                            <input
                                type="number"
                                value={topUpAmount}
                                onChange={(e) => setTopUpAmount(e.target.value)}
                                placeholder="Enter custom amount"
                                className="input-field pl-10"
                                disabled={processing}
                            />
                        </div>
                        <button
                            onClick={() => handleTopUp(Number(topUpAmount))}
                            disabled={processing || !topUpAmount || Number(topUpAmount) < 1}
                            className="btn-primary w-full flex items-center justify-center gap-2 py-4"
                        >
                            {processing ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Processing...
                                </>
                            ) : (
                                <>Proceed to Pay ₹{topUpAmount || "0"} 🚀</>
                            )}
                        </button>
                    </div>

                    <p className="text-[10px] text-center text-gray-400 mt-4 uppercase tracking-widest font-bold">
                        Secure Encryption • Powered by Razorpay
                    </p>
                </div>

                {/* Transfer Money */}
                <div className="glass-card p-6 mb-8 animate-slide-up">
                    <h3 className="font-display font-bold text-campus-700 mb-4">💸 Transfer Money</h3>
                    <p className="text-xs text-gray-500 mb-4">Send money to another student using their unique code</p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Recipient Code</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={recipientCode}
                                    onChange={(e) => {
                                        setRecipientCode(e.target.value.toUpperCase());
                                        setRecipientName(null);
                                    }}
                                    placeholder="e.g. ABCDEF"
                                    className="input-field uppercase tracking-widest flex-1"
                                    maxLength={8}
                                />
                                <button
                                    onClick={async () => {
                                        if (recipientCode.length < 4) return;
                                        setLookupLoading(true);
                                        try {
                                            const token = await getIdToken();
                                            const res = await fetch(`/api/wallet/lookup?code=${recipientCode}`, {
                                                headers: { Authorization: `Bearer ${token}` },
                                            });
                                            if (res.ok) {
                                                const data = await res.json();
                                                setRecipientName(data.name);
                                            } else {
                                                setRecipientName(null);
                                                toast.error("No user found with that code");
                                            }
                                        } catch {
                                            toast.error("Lookup failed");
                                        }
                                        setLookupLoading(false);
                                    }}
                                    disabled={lookupLoading || recipientCode.length < 4}
                                    className="btn-outline text-sm px-4 whitespace-nowrap"
                                >
                                    {lookupLoading ? "..." : "Look up"}
                                </button>
                            </div>
                            {recipientName && (
                                <p className="text-sm text-emerald-600 font-medium mt-2">✅ {recipientName}</p>
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (₹)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                <input
                                    type="number"
                                    value={transferAmount}
                                    onChange={(e) => setTransferAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    className="input-field pl-10"
                                    min={1}
                                    max={5000}
                                />
                            </div>
                        </div>

                        <button
                            onClick={async () => {
                                if (!recipientName) {
                                    toast.error("Please look up the recipient first");
                                    return;
                                }
                                const amt = Number(transferAmount);
                                if (!amt || amt < 1) {
                                    toast.error("Enter a valid amount");
                                    return;
                                }
                                setTransferring(true);
                                try {
                                    const token = await getIdToken();
                                    const res = await fetch("/api/wallet/transfer", {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json",
                                            Authorization: `Bearer ${token}`,
                                        },
                                        body: JSON.stringify({ recipientCode, amount: amt }),
                                    });
                                    const data = await res.json();
                                    if (res.ok) {
                                        toast.success(data.message || "Transfer successful! 🎉");
                                        setRecipientCode("");
                                        setRecipientName(null);
                                        setTransferAmount("");
                                        // No need to manually refetch — onSnapshot handles it
                                    } else {
                                        toast.error(data.error || "Transfer failed");
                                    }
                                } catch {
                                    toast.error("Transfer failed");
                                }
                                setTransferring(false);
                            }}
                            disabled={transferring || !recipientName || !transferAmount || Number(transferAmount) < 1}
                            className="btn-gold w-full flex items-center justify-center gap-2 py-4"
                        >
                            {transferring ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-campus-800 border-t-transparent rounded-full animate-spin"></div>
                                    Sending...
                                </>
                            ) : (
                                <>Send ₹{transferAmount || "0"} to {recipientName || "..."} 🚀</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Transaction History — Now REAL-TIME via onSnapshot */}
                <div className="animate-slide-up">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-bold text-lg text-campus-700">📊 Transaction History</h3>
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Live
                        </span>
                    </div>

                    {transactions.length === 0 ? (
                        <div className="text-center py-16 glass-card bg-white/50">
                            <div className="text-5xl mb-3">💸</div>
                            <p className="text-gray-500">No transactions yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {transactions.map((txn) => (
                                <div key={txn.id} className="glass-card p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-default">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${txn.type === "credit" || txn.type === "refund" || txn.type === "topup"
                                                ? "bg-emerald-50 text-emerald-600"
                                                : "bg-red-50 text-red-500"
                                                }`}
                                        >
                                            {txn.type === "topup" || txn.type === "credit" ? "💳" : txn.type === "refund" ? "🔄" : txn.type === "transfer" ? "💸" : "🍱"}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-campus-800">{txn.description}</p>
                                            <p className="text-[10px] text-gray-400 font-medium">
                                                {new Date(txn.createdAt).toLocaleString(undefined, {
                                                    dateStyle: 'medium',
                                                    timeStyle: 'short'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-display font-bold text-lg ${(txn.type === "topup" || txn.type === "credit" || txn.type === "refund" || (txn.type === "transfer" && txn.toUserId === user?.uid))
                                            ? "text-emerald-600" : "text-campus-800"
                                            }`}>
                                            {(txn.type === "topup" || txn.type === "credit" || txn.type === "refund" || (txn.type === "transfer" && txn.toUserId === user?.uid)) ? "+" : "-"}₹{txn.amount}
                                        </p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{txn.type}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
