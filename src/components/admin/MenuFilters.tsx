"use client";

import React from "react";

/**
 * MenuFilters — Filter bar for admin menu management.
 * Accepts dynamic categories from Firestore instead of hardcoded list.
 */

export type AvailabilityFilter = "all" | "available" | "unavailable";

interface MenuFiltersProps {
    categoryFilter: string;
    availabilityFilter: AvailabilityFilter;
    onCategoryChange: (value: string) => void;
    onAvailabilityChange: (value: AvailabilityFilter) => void;
    /** Total items (unfiltered) */
    totalCount: number;
    /** Filtered items count */
    filteredCount: number;
    /** Dynamic categories from Firestore */
    dynamicCategories?: { value: string; label: string }[];
}

const AVAILABILITY_OPTIONS: { value: AvailabilityFilter; label: string }[] = [
    { value: "all", label: "All Status" },
    { value: "available", label: "✅ Available" },
    { value: "unavailable", label: "❌ Unavailable" },
];

export default function MenuFilters({
    categoryFilter,
    availabilityFilter,
    onCategoryChange,
    onAvailabilityChange,
    totalCount,
    filteredCount,
    dynamicCategories = [],
}: MenuFiltersProps) {
    const categoryOptions = [
        { value: "all", label: "All Categories" },
        ...dynamicCategories,
    ];

    return (
        <div className="bg-zayko-800/50 border border-zayko-700 rounded-xl p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {/* Category Filter */}
                <div className="flex items-center gap-2">
                    <label className="text-zayko-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                        Category
                    </label>
                    <select
                        value={categoryFilter}
                        onChange={(e) => onCategoryChange(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-zayko-700 border border-zayko-600 text-white text-sm focus:ring-2 focus:ring-gold-400 focus:outline-none min-w-[160px]"
                    >
                        {categoryOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Availability Filter */}
                <div className="flex items-center gap-2">
                    <label className="text-zayko-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                        Status
                    </label>
                    <select
                        value={availabilityFilter}
                        onChange={(e) => onAvailabilityChange(e.target.value as AvailabilityFilter)}
                        className="px-3 py-2 rounded-lg bg-zayko-700 border border-zayko-600 text-white text-sm focus:ring-2 focus:ring-gold-400 focus:outline-none min-w-[160px]"
                    >
                        {AVAILABILITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Results Count */}
                <div className="sm:ml-auto text-zayko-500 text-xs">
                    Showing <span className="text-zayko-300 font-semibold">{filteredCount}</span> of{" "}
                    <span className="text-zayko-300 font-semibold">{totalCount}</span> items
                </div>
            </div>
        </div>
    );
}
