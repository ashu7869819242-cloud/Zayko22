"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import toast from "react-hot-toast";
import { useCountdown } from "@/hooks/useCountdown";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import type { Order } from "@/types";

/* ─── Status Config ──────────────────────────────────────── */
const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending: { label: "Pending", color: "text-yellow-700", bg: "bg-yellow-100", icon: "⏳" },
    confirmed: { label: "Confirmed", color: "text-blue-700", bg: "bg-blue-100", icon: "✅" },
    preparing: { label: "Preparing", color: "text-orange-700", bg: "bg-orange-100", icon: "👨‍🍳" },
    ready: { label: "Ready!", color: "text-emerald-700", bg: "bg-emerald-100", icon: "🎉" },
    completed: { label: "Completed", color: "text-gray-600", bg: "bg-gray-100", icon: "📦" },
    cancelled: { label: "Cancelled", color: "text-red-600", bg: "bg-red-100", icon: "✗" },
};

/* ─── Countdown Display Component ────────────────────────── */
function OrderCountdown({ readyAt, status }: { readyAt?: string; status: string }) {
    const { formatted, isExpired, totalSeconds } = useCountdown(readyAt);

    if (status === "ready") {
        return (
            <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 ready-celebration">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🎉</span>
                    <div>
                        <p className="font-display font-bold text-emerald-700 text-sm">Your order is ready!</p>
                        <p className="text-emerald-600 text-xs">Head to the counter for pickup</p>
                    </div>
                </div>
            </div>
        );
    }

    if (status === "completed") {
        return (
            <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2">
                    <span className="text-lg">📦</span>
                    <p className="text-gray-600 text-sm font-medium">Order completed</p>
                </div>
            </div>
        );
    }

    if ((status !== "preparing" && status !== "confirmed") || !readyAt) return null;

    if (isExpired) {
        return (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 animate-pulse">
                <div className="flex items-center gap-2">
                    <span className="text-lg">⏰</span>
                    <p className="text-amber-700 text-sm font-semibold">Almost ready — any moment now!</p>
                </div>
            </div>
        );
    }

    // Progress percentage for the visual bar
    const urgentThreshold = 60; // last 60 seconds = urgent
    const isUrgent = totalSeconds <= urgentThreshold;

    return (
        <div className={`mt-3 p-3 rounded-xl border ${isUrgent ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"} countdown-container`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`text-lg ${isUrgent ? "countdown-pulse" : ""}`}>🕒</span>
                    <div>
                        <p className={`text-xs font-medium ${isUrgent ? "text-red-600" : "text-orange-600"}`}>
                            Preparing your order
                        </p>
                        <p className={`font-display font-bold text-lg tabular-nums ${isUrgent ? "text-red-700 countdown-pulse" : "text-orange-700"}`}>
                            {formatted} <span className="text-xs font-normal">remaining</span>
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400">
                        Ready by {new Date(readyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Orders Page ───────────────────────────────────── */
export default function OrdersPage() {
    const { user, loading, profile } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);

    // Feedback Modal State
    const [feedbackOrder, setFeedbackOrder] = useState<Order | null>(null);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.push("/auth");
    }, [user, loading, router]);

    // Real-time subscription for user's orders
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "orders"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const orderList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Order[];
                setOrders(orderList);
                setOrdersLoading(false);
            },
            (error) => {
                console.error("Orders listener error:", error);
                if (error.code === "failed-precondition") {
                    toast.error("Firestore index required.");
                } else {
                    toast.error("Failed to load orders.");
                }
                setOrdersLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    const submitFeedback = async () => {
        if (!feedbackOrder || !user) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/feedbacks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: feedbackOrder.id,
                    userId: user.uid,
                    userName: profile?.name || user.email || "User",
                    rating,
                    comment
                })
            });

            if (res.ok) {
                toast.success("Feedback submitted! Thanks! ❤️");
                setFeedbackOrder(null);
                setRating(5);
                setComment("");
            } else {
                toast.error("Failed to submit feedback.");
            }
        } catch (err) {
            toast.error("Error submitting feedback.");
        } finally {
            setSubmitting(false);
        }
    };

    // 🔔 Notification hook
    useOrderNotifications(orders);

    if (loading || ordersLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const activeStatuses = ["pending", "confirmed", "preparing", "ready"];
    const activeOrders = orders.filter((o) => activeStatuses.includes(o.status));
    const pastOrders = orders.filter((o) => !activeStatuses.includes(o.status));

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="page-container max-w-3xl">
                <div className="mb-8 animate-fade-in pt-6">
                    <h1 className="section-title">My Orders 📋</h1>
                    <p className="text-gray-500 mt-1">{orders.length} order{orders.length !== 1 ? "s" : ""} placed</p>
                </div>

                {orders.length === 0 ? (
                    <div className="text-center py-20 animate-fade-in">
                        <div className="text-6xl mb-4">📋</div>
                        <h1 className="text-xl font-display font-bold text-gray-700 mb-2">No orders yet</h1>
                        <p className="text-gray-500 mb-6">Your order history will appear here</p>
                        <button onClick={() => router.push("/")} className="btn-primary">
                            Browse Menu 🍽️
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8 pb-20">
                        {/* Active Orders */}
                        {activeOrders.length > 0 && (
                            <div>
                                <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                    Active Orders
                                </h2>
                                <div className="space-y-4">
                                    {activeOrders.map((order) => (
                                        <OrderCard key={order.id} order={order} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Past Orders */}
                        {pastOrders.length > 0 && (
                            <div>
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                                    Past Orders
                                </h2>
                                <div className="space-y-4">
                                    {pastOrders.map((order) => (
                                        <OrderCard key={order.id} order={order} onReview={() => setFeedbackOrder(order)} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Feedback Modal */}
            {feedbackOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-zoom-in">
                        <div className="p-6">
                            <h3 className="text-xl font-display font-bold text-gray-800 mb-2">Rate Order #{feedbackOrder.orderId}</h3>
                            <p className="text-gray-500 text-sm mb-6">How was your experience with "Zayko"?</p>

                            {/* Stars */}
                            <div className="flex items-center justify-center gap-2 mb-8 text-4xl">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setRating(star)}
                                        className={`transition-transform active:scale-90 ${star <= rating ? "text-gold-500" : "text-gray-200"}`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>

                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Any comments? (optional)"
                                className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-gold-400 outline-none resize-none mb-6"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setFeedbackOrder(null)}
                                    className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Skip
                                </button>
                                <button
                                    onClick={submitFeedback}
                                    disabled={submitting}
                                    className="flex-[2] py-4 bg-gold-400 text-zayko-900 font-display font-bold rounded-2xl hover:bg-gold-500 transition-all disabled:opacity-50"
                                >
                                    {submitting ? "Sending..." : "Submit Review"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Order Card Component ───────────────────────────────── */
function OrderCard({ order, onReview }: { order: Order; onReview?: () => void }) {
    const st = statusConfig[order.status] || statusConfig.pending;

    return (
        <div className={`glass-card overflow-hidden animate-slide-up ${order.status === "ready" ? "ring-2 ring-emerald-400 ring-offset-2" : ""}`}>
            {/* Order Header */}
            <div className="p-4 sm:p-5 border-b border-gray-50">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-zayko-700">
                                Order #{order.orderId}
                            </h3>
                            <span className={`badge ${st.bg} ${st.color}`}>
                                {st.icon} {st.label}
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            {new Date(order.createdAt).toLocaleString()}
                        </p>
                    </div>
                    <span className="font-display font-bold text-lg text-teal-600">
                        ₹{order.total}
                    </span>
                </div>

                {/* Countdown Timer / Ready / Completed Display */}
                <OrderCountdown readyAt={order.readyAt || order.estimatedReadyAt} status={order.status} />
            </div>

            {/* Order Items */}
            <div className="p-4 sm:p-5 bg-gray-50/50">
                {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 text-sm">
                        <span className="text-gray-700">
                            {item.name} × {item.quantity}
                        </span>
                        <span className="text-gray-500">₹{item.price * item.quantity}</span>
                    </div>
                ))}

                {/* Feedback Button for Past Orders */}
                {order.status === "completed" && onReview && (
                    <button
                        onClick={onReview}
                        className="mt-4 w-full py-2.5 border-2 border-zayko-100 text-zayko-600 rounded-xl text-sm font-bold hover:bg-zayko-50 hover:border-zayko-200 transition-all flex items-center justify-center gap-2"
                    >
                        ⭐ Review Order
                    </button>
                )}
            </div>
        </div>
    );
}

