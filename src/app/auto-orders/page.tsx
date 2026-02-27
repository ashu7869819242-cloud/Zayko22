/**
 * Auto Orders Page — Manage recurring/scheduled orders
 *
 * Features:
 * - List all auto orders with status, schedule, and failure info
 * - Create new auto orders via modal (select item, quantity, time, frequency)
 * - Edit existing auto orders
 * - Pause/Resume toggle
 * - Delete with confirmation
 */

"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAutoOrders } from "@/hooks/useAutoOrders";
import type { MenuItem, AutoOrder, AutoOrderFrequency, DayOfWeek } from "@/types";
import { useRouter } from "next/navigation";

const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatTime12(time24: string): string {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function getFrequencyLabel(freq: AutoOrderFrequency, customDays?: DayOfWeek[]): string {
    if (freq === "daily") return "Daily";
    if (freq === "weekdays") return "Weekdays";
    if (freq === "custom" && customDays) return customDays.join(", ");
    return freq;
}

// ─── Modal Form ────────────────────────────────

interface AutoOrderFormProps {
    menuItems: MenuItem[];
    onSubmit: (data: {
        itemId: string;
        quantity: number;
        time: string;
        frequency: AutoOrderFrequency;
        customDays?: DayOfWeek[];
    }) => Promise<boolean>;
    onClose: () => void;
    editOrder?: AutoOrder | null;
    onEdit?: (
        id: string,
        data: {
            itemId: string;
            quantity: number;
            time: string;
            frequency: AutoOrderFrequency;
            customDays?: DayOfWeek[];
        }
    ) => Promise<boolean>;
}

function AutoOrderForm({ menuItems, onSubmit, onClose, editOrder, onEdit }: AutoOrderFormProps) {
    const [itemId, setItemId] = useState(editOrder?.itemId || "");
    const [quantity, setQuantity] = useState(editOrder?.quantity || 1);
    const [time, setTime] = useState(editOrder?.time || "08:00");
    const [frequency, setFrequency] = useState<AutoOrderFrequency>(editOrder?.frequency || "daily");
    const [customDays, setCustomDays] = useState<DayOfWeek[]>(editOrder?.customDays || []);
    const [submitting, setSubmitting] = useState(false);

    const toggleDay = (day: DayOfWeek) => {
        setCustomDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const data = {
            itemId,
            quantity,
            time,
            frequency,
            ...(frequency === "custom" ? { customDays } : {}),
        };

        let success = false;
        if (editOrder && onEdit) {
            success = await onEdit(editOrder.id, data);
        } else {
            success = await onSubmit(data);
        }
        setSubmitting(false);
        if (success) onClose();
    };

    const selectedItem = menuItems.find((m) => m.id === itemId);
    const estimatedCost = selectedItem ? selectedItem.price * quantity : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div
                className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in"
                style={{ background: "white" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-display font-bold text-zayko-500">
                        {editOrder ? "Edit Auto Order" : "New Auto Order"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Item Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Select Item
                        </label>
                        <select
                            value={itemId}
                            onChange={(e) => setItemId(e.target.value)}
                            className="input-field"
                            required
                        >
                            <option value="">Choose an item...</option>
                            {menuItems
                                .filter((m) => m.available)
                                .map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} — ₹{m.price}
                                    </option>
                                ))}
                        </select>
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Quantity
                        </label>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-lg font-bold hover:bg-zayko-50 transition-colors"
                            >
                                −
                            </button>
                            <span className="w-12 text-center text-xl font-bold text-zayko-600">
                                {quantity}
                            </span>
                            <button
                                type="button"
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-lg font-bold hover:bg-zayko-50 transition-colors"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Time */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Delivery Time
                        </label>
                        <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="input-field"
                            required
                        />
                    </div>

                    {/* Frequency */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Frequency
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(["daily", "weekdays", "custom"] as AutoOrderFrequency[]).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFrequency(f)}
                                    className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${frequency === f
                                            ? "gradient-primary text-white shadow-glow"
                                            : "bg-gray-50 text-gray-600 hover:bg-zayko-50 border border-gray-200"
                                        }`}
                                >
                                    {f === "daily" ? "Daily" : f === "weekdays" ? "Weekdays" : "Custom"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Days */}
                    {frequency === "custom" && (
                        <div className="animate-slide-down">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Select Days
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_DAYS.map((day) => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleDay(day)}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${customDays.includes(day)
                                                ? "gradient-primary text-white shadow-glow"
                                                : "bg-gray-50 text-gray-600 hover:bg-zayko-50 border border-gray-200"
                                            }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Cost Estimate */}
                    {selectedItem && (
                        <div className="bg-zayko-50 rounded-xl p-4 border border-zayko-100">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Estimated per order</span>
                                <span className="text-lg font-bold text-zayko-600">
                                    ₹{estimatedCost}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                {selectedItem.name} × {quantity} @ ₹{selectedItem.price} each
                            </p>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting || !itemId || (frequency === "custom" && customDays.length === 0)}
                        className="btn-primary w-full text-center disabled:opacity-50"
                    >
                        {submitting
                            ? "Saving..."
                            : editOrder
                                ? "Update Auto Order"
                                : "Create Auto Order"}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Auto Order Card ───────────────────────────

function AutoOrderCard({
    order,
    onToggle,
    onEdit,
    onDelete,
}: {
    order: AutoOrder;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const isActive = order.status === "active";

    return (
        <div
            className={`glass-card overflow-hidden transition-all duration-300 ${!isActive ? "opacity-70" : ""
                }`}
        >
            {/* Status indicator bar */}
            <div
                className={`h-1 w-full ${isActive ? "bg-gradient-to-r from-teal-400 to-teal-600" : "bg-gray-300"
                    }`}
            />

            <div className="p-5">
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-display font-bold text-zayko-600">
                                {order.itemName}
                            </h3>
                            <span
                                className={`badge ${isActive ? "badge-available" : "badge-unavailable"
                                    }`}
                            >
                                {isActive ? "Active" : "Paused"}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500">Qty: {order.quantity} × ₹{order.itemPrice}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-zayko-600">
                            ₹{order.itemPrice * order.quantity}
                        </p>
                        <p className="text-xs text-gray-400">per order</p>
                    </div>
                </div>

                {/* Schedule info */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5 bg-zayko-50 px-3 py-1.5 rounded-lg">
                        <span className="text-sm">⏰</span>
                        <span className="text-sm font-semibold text-zayko-600">
                            {formatTime12(order.time)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-gold-50 px-3 py-1.5 rounded-lg">
                        <span className="text-sm">📅</span>
                        <span className="text-sm font-semibold text-gold-700">
                            {getFrequencyLabel(order.frequency, order.customDays)}
                        </span>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                        <p className="text-xs text-gray-400">Total Runs</p>
                        <p className="text-lg font-bold text-zayko-600">{order.totalExecutions}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                        <p className="text-xs text-gray-400">Failures</p>
                        <p className={`text-lg font-bold ${order.totalFailures > 0 ? "text-red-500" : "text-teal-600"}`}>
                            {order.totalFailures}
                        </p>
                    </div>
                </div>

                {/* Failure alert */}
                {order.lastFailureReason && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                        <div className="flex items-start gap-2">
                            <span className="text-red-500 text-sm mt-0.5">⚠️</span>
                            <div>
                                <p className="text-xs font-semibold text-red-600">Last Failure</p>
                                <p className="text-xs text-red-500">{order.lastFailureReason}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggle}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive
                                ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                                : "bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                            }`}
                    >
                        {isActive ? "⏸ Pause" : "▶ Resume"}
                    </button>
                    <button
                        onClick={onEdit}
                        className="py-2.5 px-4 rounded-xl text-sm font-semibold bg-zayko-50 text-zayko-600 hover:bg-zayko-100 border border-zayko-100 transition-all"
                    >
                        ✏️ Edit
                    </button>
                    {!confirmDelete ? (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="py-2.5 px-4 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 transition-all"
                        >
                            🗑
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                onDelete();
                                setConfirmDelete(false);
                            }}
                            className="py-2.5 px-4 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all animate-scale-in"
                        >
                            Confirm
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────

export default function AutoOrdersPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { autoOrders, loading, addAutoOrder, editAutoOrder, toggleAutoOrder, removeAutoOrder } =
        useAutoOrders();

    const [showForm, setShowForm] = useState(false);
    const [editingOrder, setEditingOrder] = useState<AutoOrder | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [menuLoading, setMenuLoading] = useState(true);

    // Redirect if not logged in
    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/auth");
        }
    }, [authLoading, user, router]);

    // Fetch menu items for the form
    useEffect(() => {
        async function fetchMenu() {
            try {
                const res = await fetch("/api/menu");
                if (res.ok) {
                    const data = await res.json();
                    setMenuItems(data.items || []);
                }
            } catch (err) {
                console.error("Failed to fetch menu:", err);
            } finally {
                setMenuLoading(false);
            }
        }
        fetchMenu();
    }, []);

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const activeCount = autoOrders.filter((o) => o.status === "active").length;
    const pausedCount = autoOrders.filter((o) => o.status === "paused").length;

    return (
        <div className="page-container animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="section-title flex items-center gap-3">
                        🔄 Auto Orders
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Schedule recurring orders that run automatically
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingOrder(null);
                        setShowForm(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                    disabled={menuLoading}
                >
                    <span className="text-lg">+</span>
                    Add New
                </button>
            </div>

            {/* Stats Row */}
            {autoOrders.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="glass-card p-4 text-center">
                        <p className="text-2xl font-bold text-zayko-600">{autoOrders.length}</p>
                        <p className="text-xs text-gray-400 font-medium">Total</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <p className="text-2xl font-bold text-teal-600">{activeCount}</p>
                        <p className="text-xs text-gray-400 font-medium">Active</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <p className="text-2xl font-bold text-amber-600">{pausedCount}</p>
                        <p className="text-xs text-gray-400 font-medium">Paused</p>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-gray-400 text-sm">Loading auto orders...</p>
                </div>
            ) : autoOrders.length === 0 ? (
                /* Empty State */
                <div className="glass-card p-12 text-center">
                    <div className="text-6xl mb-4">🔄</div>
                    <h2 className="text-xl font-display font-bold text-zayko-500 mb-2">
                        No Auto Orders Yet
                    </h2>
                    <p className="text-gray-400 mb-6 max-w-md mx-auto">
                        Set up recurring orders for your daily essentials. Your order will be placed
                        automatically at the scheduled time with wallet payment.
                    </p>
                    <button
                        onClick={() => {
                            setEditingOrder(null);
                            setShowForm(true);
                        }}
                        className="btn-gold inline-flex items-center gap-2"
                    >
                        <span>+</span> Create Your First Auto Order
                    </button>
                </div>
            ) : (
                /* Order List */
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {autoOrders.map((order) => (
                        <AutoOrderCard
                            key={order.id}
                            order={order}
                            onToggle={() => toggleAutoOrder(order.id, order.status)}
                            onEdit={() => {
                                setEditingOrder(order);
                                setShowForm(true);
                            }}
                            onDelete={() => removeAutoOrder(order.id)}
                        />
                    ))}
                </div>
            )}

            {/* How It Works */}
            <div className="mt-12 glass-card p-6">
                <h3 className="text-lg font-display font-bold text-zayko-500 mb-4">
                    How Auto Orders Work
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        {
                            icon: "📋",
                            title: "Set Schedule",
                            desc: "Choose item, quantity, time, and frequency",
                        },
                        {
                            icon: "⏰",
                            title: "Automatic Trigger",
                            desc: "System checks every minute and places orders on time",
                        },
                        {
                            icon: "💰",
                            title: "Wallet Payment",
                            desc: "Amount deducted from wallet automatically",
                        },
                        {
                            icon: "🔔",
                            title: "Notifications",
                            desc: "Get notified about each auto order placed",
                        },
                    ].map((step, i) => (
                        <div
                            key={i}
                            className="text-center p-4 bg-gray-50 rounded-xl"
                        >
                            <div className="text-3xl mb-2">{step.icon}</div>
                            <h4 className="font-semibold text-zayko-600 text-sm mb-1">
                                {step.title}
                            </h4>
                            <p className="text-xs text-gray-400">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal */}
            {showForm && (
                <AutoOrderForm
                    menuItems={menuItems}
                    onSubmit={addAutoOrder}
                    onClose={() => {
                        setShowForm(false);
                        setEditingOrder(null);
                    }}
                    editOrder={editingOrder}
                    onEdit={editAutoOrder}
                />
            )}
        </div>
    );
}
