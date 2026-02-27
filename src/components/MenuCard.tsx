"use client";
import React from "react";
import { useCart } from "@/context/CartContext";
import toast from "react-hot-toast";

interface MenuCardProps {
    id: string;
    name: string;
    price: number;
    category: string;
    available: boolean;
    quantity: number;
    preparationTime?: number;
    image?: string;
    description?: string;
}

export default function MenuCard({ id, name, price, category, available, quantity, preparationTime, image, description }: MenuCardProps) {
    const { addItem, items } = useCart();
    const cartItem = items.find((i) => i.id === id);
    const inCart = cartItem ? cartItem.quantity : 0;

    const handleAdd = () => {
        if (!available || quantity <= 0) {
            toast.error("This item is currently unavailable");
            return;
        }
        if (inCart >= quantity) {
            toast.error("Maximum available quantity reached");
            return;
        }
        addItem({ id, name, price, maxQuantity: quantity, category, image });
        toast.success(`${name} added to cart! 🛒`);
    };

    return (
        <div className={`menu-card glass-card overflow-hidden ${!available ? "opacity-60" : ""}`}>
            {/* Image Section */}
            <div className="relative h-40 sm:h-48 bg-gradient-to-br from-zayko-100 to-teal-50 flex items-center justify-center overflow-hidden">
                {image ? (
                    <img src={image} alt={name} className="w-full h-full object-cover" />
                ) : (
                    <div className="text-5xl opacity-50">
                        {category === "beverages" ? "☕" : category === "snacks" ? "🍿" : category === "meals" ? "🍱" : "🍽️"}
                    </div>
                )}
                {/* Category Badge */}
                <span className="absolute top-3 left-3 badge bg-zayko-500/90 text-white capitalize text-xs">
                    {category}
                </span>
                {/* Availability */}
                {!available && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm rotate-[-5deg]">
                            SOLD OUT
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-display font-semibold text-lg text-zayko-700 line-clamp-1">{name}</h3>
                    <span className="text-lg font-bold text-teal-600 whitespace-nowrap">₹{price}</span>
                </div>

                {description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{description}</p>
                )}

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                        {available ? (
                            <>
                                <span className={quantity <= 5 ? "badge bg-amber-100 text-amber-700" : "badge-available"}>
                                    {quantity <= 5 ? `⚠️ Only ${quantity} left!` : `✓ ${quantity} left`}
                                </span>
                                {preparationTime && preparationTime > 0 && (
                                    <span className="badge bg-zayko-50 text-zayko-600">
                                        ⏱ ~{preparationTime} min
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="badge-unavailable">✗ Unavailable</span>
                        )}
                    </div>

                    <button
                        onClick={handleAdd}
                        disabled={!available || quantity <= 0}
                        className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${available && quantity > 0
                            ? "bg-zayko-500 text-white hover:bg-zayko-600 hover:scale-105 active:scale-95"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                    >
                        {inCart > 0 ? (
                            <>
                                <span>In Cart ({inCart})</span>
                                <span>+</span>
                            </>
                        ) : (
                            <>
                                <span>Add</span>
                                <span>🛒</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
