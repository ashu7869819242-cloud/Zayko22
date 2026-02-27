"use client";
import React, { useState } from "react";
import { useCart } from "@/context/CartContext";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

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
    const [flyAnim, setFlyAnim] = useState(false);

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
        setFlyAnim(true);
        setTimeout(() => setFlyAnim(false), 400);
        toast.success(`${name} added to cart! 🛒`, {
            style: {
                background: "#0a1628",
                color: "#e2e8f0",
                border: "1px solid rgba(251,191,36,0.2)",
            },
            iconTheme: { primary: "#fbbf24", secondary: "#050b14" },
        });
    };

    const categoryEmoji = category === "beverages" ? "☕" : category === "snacks" ? "🍿" : category === "meals" ? "🍱" : category === "desserts" ? "🍰" : "🍽️";

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            whileHover={{ y: -6, scale: 1.02 }}
            className={`menu-card glass-card overflow-hidden group ${!available ? "opacity-50 pointer-events-none" : ""}`}
        >
            {/* Image / Placeholder Section */}
            <div className="relative h-40 sm:h-44 bg-gradient-to-br from-zayko-800 to-zayko-700 flex items-center justify-center overflow-hidden">
                {image ? (
                    <img src={image} alt={name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                    <div className="text-6xl opacity-40 group-hover:scale-110 transition-transform duration-500">
                        {categoryEmoji}
                    </div>
                )}

                {/* Gradient overlay for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-zayko-900/60 to-transparent" />

                {/* Category badge (top-left) */}
                <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-zayko-500/80 text-zayko-100 backdrop-blur-md border border-white/10">
                    {category}
                </span>

                {/* Price badge (top-right) */}
                <span className="absolute top-3 right-3 px-3 py-1.5 rounded-xl text-sm font-bold bg-gold-500/90 text-zayko-900 shadow-lg">
                    ₹{price}
                </span>

                {/* Sold out overlay */}
                <AnimatePresence>
                    {!available && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center"
                        >
                            <span className="bg-red-500/90 text-white px-5 py-2 rounded-xl font-bold text-sm rotate-[-3deg] shadow-lg">
                                SOLD OUT
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Name */}
                <h3 className="font-display font-semibold text-lg text-white line-clamp-1 tracking-tight">
                    {name}
                </h3>

                {/* Description */}
                {description && (
                    <p className="text-sm text-zayko-300 line-clamp-2 leading-relaxed">{description}</p>
                )}

                {/* Badges Row */}
                <div className="flex items-center gap-2 flex-wrap">
                    {available ? (
                        <>
                            <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${quantity <= 3
                                    ? "bg-amber-500/15 text-amber-400 border-amber-500/20 low-stock-pulse"
                                    : quantity <= 5
                                        ? "bg-amber-500/10 text-amber-300 border-amber-500/15"
                                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    }`}
                            >
                                {quantity <= 3 ? `🔥 Only ${quantity} left!` : quantity <= 5 ? `⚠️ Only ${quantity} left!` : `✓ ${quantity} left`}
                            </span>
                            {preparationTime && preparationTime > 0 && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-zayko-700/50 text-zayko-300 border border-white/5">
                                    ⏱ ~{preparationTime} min
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
                            ✗ Unavailable
                        </span>
                    )}
                </div>

                {/* Add Button */}
                <button
                    onClick={handleAdd}
                    disabled={!available || quantity <= 0}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${available && quantity > 0
                        ? "bg-gradient-to-r from-gold-400 to-gold-500 text-zayko-900 hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:scale-[1.03] active:scale-95"
                        : "bg-zayko-700 text-zayko-500 cursor-not-allowed"
                        }`}
                >
                    <span className={flyAnim ? "cart-fly" : ""}>
                        {inCart > 0 ? (
                            <>In Cart ({inCart}) +</>
                        ) : (
                            <>Add 🛒</>
                        )}
                    </span>
                </button>
            </div>
        </motion.div>
    );
}
