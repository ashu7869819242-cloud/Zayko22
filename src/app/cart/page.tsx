"use client";
import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

export default function CartPage() {
    const { user, profile, loading } = useAuth();
    const { items, updateQuantity, removeItem, clearCart, total, itemCount } = useCart();
    const router = useRouter();

    // FIX: Move redirect out of render body into useEffect
    useEffect(() => {
        if (!loading && !user) router.push("/auth");
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) return null;

    const handlePlaceOrder = () => {
        if (!profile) {
            toast.error("Please complete your profile first");
            return;
        }
        if ((profile.walletBalance || 0) < total) {
            toast.error("Insufficient wallet balance. Please top up your wallet first!");
            return;
        }
        // Navigate to chat with order intent
        router.push("/chat?action=place_order");
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="page-container max-w-3xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 animate-fade-in">
                    <div>
                        <h1 className="section-title">Your Cart 🛒</h1>
                        <p className="text-gray-500 mt-1">
                            {itemCount > 0 ? `${itemCount} item${itemCount > 1 ? "s" : ""} in your cart` : "Your cart is empty"}
                        </p>
                    </div>
                    {items.length > 0 && (
                        <button
                            onClick={() => { clearCart(); toast.success("Cart cleared"); }}
                            className="text-sm text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {items.length === 0 ? (
                    <div className="text-center py-20 animate-fade-in">
                        <div className="text-6xl mb-4">🛒</div>
                        <h3 className="text-xl font-display font-bold text-gray-700 mb-2">Your cart is empty</h3>
                        <p className="text-gray-500 mb-6">Browse the menu and add some delicious items!</p>
                        <Link href="/" className="btn-primary inline-block">
                            Browse Menu 🍽️
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4 animate-slide-up">
                        {/* Cart Items */}
                        {items.map((item) => (
                            <div key={item.id} className="glass-card p-4 sm:p-5 flex items-center gap-4">
                                {/* Item Icon */}
                                <div className="w-14 h-14 rounded-xl bg-zayko-50 flex items-center justify-center text-2xl flex-shrink-0">
                                    {item.category === "beverages" ? "☕" : item.category === "snacks" ? "🍿" : item.category === "meals" ? "🍱" : "🍽️"}
                                </div>

                                {/* Item Details */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-zayko-700 truncate">{item.name}</h3>
                                    <p className="text-sm text-gray-500">₹{item.price} each</p>
                                </div>

                                {/* Quantity Controls */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600 transition-colors"
                                    >
                                        −
                                    </button>
                                    <span className="w-8 text-center font-semibold text-zayko-700">
                                        {item.quantity}
                                    </span>
                                    <button
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        disabled={item.quantity >= item.maxQuantity}
                                        className="w-8 h-8 rounded-lg bg-zayko-500 hover:bg-zayko-600 text-white flex items-center justify-center font-bold transition-colors disabled:opacity-50"
                                    >
                                        +
                                    </button>
                                </div>

                                {/* Price & Remove */}
                                <div className="text-right flex-shrink-0">
                                    <p className="font-bold text-teal-600">₹{item.price * item.quantity}</p>
                                    <button
                                        onClick={() => { removeItem(item.id); toast.success("Removed from cart"); }}
                                        className="text-xs text-red-400 hover:text-red-600 mt-1"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Order Summary */}
                        <div className="glass-card p-6 mt-6">
                            <h3 className="font-display font-bold text-lg text-zayko-700 mb-4">Order Summary</h3>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal ({itemCount} items)</span>
                                    <span>₹{total}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Service Fee</span>
                                    <span className="text-teal-600">Free ✨</span>
                                </div>
                                <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                                    <span className="font-display font-bold text-lg text-zayko-700">Total</span>
                                    <span className="font-display font-bold text-2xl text-teal-600">₹{total}</span>
                                </div>
                            </div>

                            {/* Wallet Info */}
                            <div className="mt-4 p-3 rounded-xl bg-zayko-50 flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <span>💰</span>
                                    <span className="text-zayko-600">Wallet Balance</span>
                                </div>
                                <span className={`font-bold ${(profile?.walletBalance || 0) >= total ? "text-teal-600" : "text-red-500"}`}>
                                    ₹{profile?.walletBalance || 0}
                                </span>
                            </div>

                            {(profile?.walletBalance || 0) < total && (
                                <Link
                                    href="/wallet"
                                    className="block w-full text-center mt-3 text-sm text-zayko-500 hover:underline"
                                >
                                    ⚠️ Insufficient balance. Top up your wallet →
                                </Link>
                            )}

                            <button
                                onClick={handlePlaceOrder}
                                disabled={(profile?.walletBalance || 0) < total}
                                className="btn-primary w-full mt-4 py-4 text-lg"
                            >
                                Place Order via AI Assistant 🤖
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
