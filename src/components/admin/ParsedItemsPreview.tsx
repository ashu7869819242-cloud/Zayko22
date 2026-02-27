"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

/**
 * ParsedItemsPreview — Editable preview table for AI-parsed menu items.
 * Admin can edit name, price, category, remove items, and confirm to bulk-save.
 */

interface ParsedMenuItem {
    name: string;
    price: number;
    category: string;
}

interface ParsedItemsPreviewProps {
    /** Items parsed by the AI from the uploaded image */
    items: ParsedMenuItem[];
    /** Called when saving is complete (success or cancel) */
    onClose: () => void;
}

interface CatOption {
    slug: string;
    name: string;
}

export default function ParsedItemsPreview({ items: initialItems, onClose }: ParsedItemsPreviewProps) {
    const [items, setItems] = useState<ParsedMenuItem[]>(initialItems);
    const [saving, setSaving] = useState(false);
    const [catOptions, setCatOptions] = useState<CatOption[]>([]);

    // Load categories from Firestore
    useEffect(() => {
        const q = query(collection(db, "categories"), orderBy("order", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            setCatOptions(snap.docs.map((d) => ({ slug: d.data().slug, name: d.data().name })));
        });
        return () => unsub();
    }, []);

    // Update a specific field of an item
    const updateItem = (index: number, field: keyof ParsedMenuItem, value: string | number) => {
        setItems((prev) =>
            prev.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            )
        );
    };

    // Remove an item from the list
    const removeItem = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    // Bulk-save all items to Firestore
    const handleConfirmAndAdd = async () => {
        // Validate all items
        const invalidItems = items.filter((item) => !item.name.trim() || item.price <= 0);
        if (invalidItems.length > 0) {
            toast.error("Please fix items with empty names or invalid prices");
            return;
        }

        if (items.length === 0) {
            toast.error("No items to add");
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem("adminToken");
            const response = await fetch("/api/admin/menu/bulk", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ items }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save items");
            }

            const data = await response.json();
            toast.success(`🎉 Successfully added ${data.count} menu items!`);
            onClose();
        } catch (err) {
            console.error("Bulk save error:", err);
            toast.error(err instanceof Error ? err.message : "Failed to save items");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zayko-800 border border-zayko-700 rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] flex flex-col animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-display font-bold text-white">
                            ✅ Review Parsed Items
                        </h3>
                        <p className="text-zayko-400 text-sm mt-1">
                            {items.length} item{items.length !== 1 ? "s" : ""} detected — edit before saving
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="text-zayko-400 hover:text-white transition-colors text-xl"
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable Items List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {items.length === 0 ? (
                        <div className="text-center py-12 text-zayko-500">
                            <div className="text-4xl mb-2">🗑️</div>
                            <p>All items removed. Close this dialog to go back.</p>
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <div
                                key={index}
                                className="bg-zayko-700/50 border border-zayko-600 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center"
                            >
                                {/* Item Number */}
                                <span className="text-zayko-500 text-xs font-bold min-w-[24px]">
                                    #{index + 1}
                                </span>

                                {/* Name */}
                                <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => updateItem(index, "name", e.target.value)}
                                    placeholder="Item name"
                                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-zayko-800 border border-zayko-600 text-white text-sm placeholder:text-zayko-500 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                                />

                                {/* Price */}
                                <div className="flex items-center gap-1">
                                    <span className="text-zayko-400 text-sm">₹</span>
                                    <input
                                        type="number"
                                        value={item.price}
                                        onChange={(e) => updateItem(index, "price", Number(e.target.value))}
                                        min={0}
                                        className="w-20 px-3 py-2 rounded-lg bg-zayko-800 border border-zayko-600 text-white text-sm focus:ring-2 focus:ring-gold-400 focus:outline-none"
                                    />
                                </div>

                                {/* Category */}
                                <select
                                    value={item.category}
                                    onChange={(e) => updateItem(index, "category", e.target.value)}
                                    className="px-3 py-2 rounded-lg bg-zayko-800 border border-zayko-600 text-white text-sm focus:ring-2 focus:ring-gold-400 focus:outline-none"
                                >
                                    {catOptions.map((c) => (
                                        <option key={c.slug} value={c.slug}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>

                                {/* Remove Button */}
                                <button
                                    onClick={() => removeItem(index)}
                                    className="px-2 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all text-sm"
                                    title="Remove item"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex gap-3 mt-4 pt-4 border-t border-zayko-700">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 px-4 py-3 bg-zayko-700 text-zayko-300 rounded-xl hover:bg-zayko-600 transition-all font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirmAndAdd}
                        disabled={saving || items.length === 0}
                        className="flex-1 btn-gold py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </span>
                        ) : (
                            `✅ Confirm & Add ${items.length} Item${items.length !== 1 ? "s" : ""}`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
