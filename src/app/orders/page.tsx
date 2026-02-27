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
    const { user, loading } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);

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
                // Common cause: composite index not deployed
                if (error.code === "failed-precondition") {
                    toast.error("Firestore index required. Check console for the index creation link.");
                } else {
                    toast.error("Failed to load orders. Please refresh.");
                }
                setOrdersLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    // 🔔 Notification hook: fires toast + browser notification + sound on "ready"
    useOrderNotifications(orders);

    if (loading || ordersLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // Separate active orders (need attention) from past orders
    const activeStatuses = ["pending", "confirmed", "preparing", "ready"];
    const activeOrders = orders.filter((o) => activeStatuses.includes(o.status));
    const pastOrders = orders.filter((o) => !activeStatuses.includes(o.status));

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="page-container max-w-3xl">
                <div className="mb-8 animate-fade-in">
                    <h1 className="section-title">My Orders 📋</h1>
                    <p className="text-gray-500 mt-1">{orders.length} order{orders.length !== 1 ? "s" : ""} placed</p>
                </div>

                {orders.length === 0 ? (
                    <div className="text-center py-20 animate-fade-in">
                        <div className="text-6xl mb-4">📋</div>
                        <h3 className="text-xl font-display font-bold text-gray-700 mb-2">No orders yet</h3>
                        <p className="text-gray-500 mb-6">Your order history will appear here</p>
                        <button onClick={() => router.push("/")} className="btn-primary">
                            Browse Menu 🍽️
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Active Orders */}
                        {activeOrders.length > 0 && (
                            <div>
                                <h2 className="text-lg font-display font-bold text-zayko-600 mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
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
                                <h2 className="text-lg font-display font-bold text-gray-400 mb-4">
                                    Past Orders
                                </h2>
                                <div className="space-y-4">
                                    {pastOrders.map((order) => (
                                        <OrderCard key={order.id} order={order} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Order Card Component ───────────────────────────────── */
function OrderCard({ order }: { order: Order }) {
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
            </div>
        </div>
    );
}
