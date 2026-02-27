/**
 * Admin Auto-Orders Forecast Dashboard
 *
 * Mini inventory forecasting system showing:
 * - Summary cards (active orders, daily demand, risk items)
 * - Active auto-orders table
 * - Aggregate demand summary
 * - 7-day forecast with stock comparison & shortage alerts
 * - Filters (item, day, risk-only)
 * - CSV export
 */

"use client";
import React, { useEffect, useState, useMemo } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import type { DayOfWeek } from "@/types";

// ─── Types ──────────────────────────────────────

interface EnrichedAutoOrder {
    id: string;
    userId: string;
    userName: string;
    itemId: string;
    itemName: string;
    itemPrice: number;
    quantity: number;
    time: string;
    frequency: string;
    customDays?: DayOfWeek[];
    scheduledDays: DayOfWeek[];
    status: string;
}

interface DemandEntry {
    itemId: string;
    itemName: string;
    day: DayOfWeek;
    totalQuantity: number;
}

interface ForecastDayItem {
    itemId: string;
    itemName: string;
    demand: number;
    currentStock: number;
    cumulativeDemand: number;
    remaining: number;
    risk: boolean;
}

interface ForecastDay {
    date: string;
    dayName: DayOfWeek;
    items: ForecastDayItem[];
}

interface ForecastSummary {
    totalActiveOrders: number;
    itemsAtRisk: number;
    dailyDemandByItem: { itemId: string; itemName: string; totalDaily: number }[];
}

interface ForecastData {
    autoOrders: EnrichedAutoOrder[];
    aggregateDemand: DemandEntry[];
    forecast: ForecastDay[];
    summary: ForecastSummary;
}

// ─── Helpers ────────────────────────────────────

function formatTime12(time24: string): string {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── CSV Export ─────────────────────────────────

function exportCSV(forecast: ForecastDay[]) {
    const headers = ["Date", "Day", "Item", "Expected Demand", "Current Stock", "Cumulative Demand", "Remaining", "Risk"];
    const rows = [headers.join(",")];

    for (const day of forecast) {
        for (const item of day.items) {
            rows.push([
                day.date,
                day.dayName,
                `"${item.itemName}"`,
                item.demand,
                item.currentStock,
                item.cumulativeDemand,
                item.remaining,
                item.risk ? "YES" : "NO",
            ].join(","));
        }
    }

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auto-order-forecast-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Main Component ─────────────────────────────

export default function AutoOrdersForecastPage() {
    const [data, setData] = useState<ForecastData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filters
    const [filterItem, setFilterItem] = useState("all");
    const [filterDay, setFilterDay] = useState("all");
    const [riskOnly, setRiskOnly] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const token = localStorage.getItem("adminToken");
                const res = await fetch("/api/admin/auto-orders-forecast", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("Failed to fetch forecast data");
                const json = await res.json();
                setData(json);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // Unique items list for filter dropdown
    const itemOptions = useMemo(() => {
        if (!data) return [];
        const map = new Map<string, string>();
        for (const o of data.autoOrders) {
            map.set(o.itemId, o.itemName);
        }
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [data]);

    // Filtered auto orders
    const filteredOrders = useMemo(() => {
        if (!data) return [];
        let orders = data.autoOrders;
        if (filterItem !== "all") {
            orders = orders.filter(o => o.itemId === filterItem);
        }
        if (filterDay !== "all") {
            orders = orders.filter(o => o.scheduledDays.includes(filterDay as DayOfWeek));
        }
        return orders;
    }, [data, filterItem, filterDay]);

    // Filtered demand
    const filteredDemand = useMemo(() => {
        if (!data) return [];
        let demand = data.aggregateDemand;
        if (filterItem !== "all") {
            demand = demand.filter(d => d.itemId === filterItem);
        }
        if (filterDay !== "all") {
            demand = demand.filter(d => d.day === filterDay);
        }
        return demand;
    }, [data, filterItem, filterDay]);

    // Filtered forecast
    const filteredForecast = useMemo(() => {
        if (!data) return [];
        return data.forecast.map(day => {
            let items = day.items;
            if (filterItem !== "all") {
                items = items.filter(i => i.itemId === filterItem);
            }
            if (riskOnly) {
                items = items.filter(i => i.risk);
            }
            return { ...day, items };
        }).filter(day => {
            if (filterDay !== "all" && day.dayName !== filterDay) return false;
            return day.items.length > 0 || !riskOnly;
        });
    }, [data, filterItem, filterDay, riskOnly]);

    return (
        <AdminGuard>
            <div className="min-h-screen bg-campus-900">
                {/* Header */}
                <div className="bg-campus-800 border-b border-campus-700 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl">📊</div>
                            <div>
                                <h1 className="text-lg font-display font-bold text-white">Auto-Order Forecast</h1>
                                <p className="text-xs text-campus-400">Inventory demand forecasting</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link
                                href="/admin/dashboard"
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-xl transition-all"
                            >
                                ← Dashboard
                            </Link>
                            {data && (
                                <button
                                    onClick={() => exportCSV(data.forecast)}
                                    className="flex items-center gap-2 px-4 py-2 bg-gold-500/20 hover:bg-gold-500/30 text-gold-400 text-sm rounded-xl transition-all font-semibold"
                                >
                                    📥 Export CSV
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-20">
                            <div className="text-4xl mb-4">⚠️</div>
                            <p className="text-red-400 text-lg">{error}</p>
                        </div>
                    ) : !data || data.autoOrders.length === 0 ? (
                        <div className="text-center py-20 animate-fade-in">
                            <div className="text-6xl mb-4">📭</div>
                            <h2 className="text-xl font-display font-bold text-white mb-2">No Active Auto Orders</h2>
                            <p className="text-campus-400">There are no active auto-orders to forecast. Users need to create recurring orders first.</p>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-fade-in">
                            {/* ── Summary Cards ── */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-campus-800/50 border border-campus-700 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">🔄</span>
                                        <span className="text-xs text-campus-400 font-semibold">Active Auto Orders</span>
                                    </div>
                                    <p className="text-3xl font-display font-bold text-blue-400">{data.summary.totalActiveOrders}</p>
                                </div>

                                <div className="bg-campus-800/50 border border-campus-700 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">📦</span>
                                        <span className="text-xs text-campus-400 font-semibold">Top Daily Demand</span>
                                    </div>
                                    {data.summary.dailyDemandByItem.length > 0 ? (
                                        <div className="space-y-1">
                                            {data.summary.dailyDemandByItem.slice(0, 3).map((item) => (
                                                <div key={item.itemId || item.itemName} className="flex items-center justify-between">
                                                    <span className="text-sm text-campus-300 truncate">{item.itemName}</span>
                                                    <span className="text-sm font-bold text-gold-400">{item.totalDaily} units</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-campus-500 text-sm">No demand data</p>
                                    )}
                                </div>

                                <div className={`border rounded-2xl p-5 ${data.summary.itemsAtRisk > 0 ? "bg-red-900/30 border-red-700/50" : "bg-campus-800/50 border-campus-700"}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">{data.summary.itemsAtRisk > 0 ? "🚨" : "✅"}</span>
                                        <span className="text-xs text-campus-400 font-semibold">Items at Risk</span>
                                    </div>
                                    <p className={`text-3xl font-display font-bold ${data.summary.itemsAtRisk > 0 ? "text-red-400" : "text-emerald-400"}`}>
                                        {data.summary.itemsAtRisk}
                                    </p>
                                    {data.summary.itemsAtRisk > 0 && (
                                        <p className="text-xs text-red-400/70 mt-1">Stock shortage expected in 7 days</p>
                                    )}
                                </div>
                            </div>

                            {/* ── Filters ── */}
                            <div className="bg-campus-800/50 border border-campus-700 rounded-2xl p-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-campus-400 font-semibold">Item:</label>
                                        <select
                                            value={filterItem}
                                            onChange={(e) => setFilterItem(e.target.value)}
                                            className="bg-campus-700 border border-campus-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold-400"
                                        >
                                            <option value="all">All Items</option>
                                            {itemOptions.map((opt) => (
                                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-campus-400 font-semibold">Day:</label>
                                        <select
                                            value={filterDay}
                                            onChange={(e) => setFilterDay(e.target.value)}
                                            className="bg-campus-700 border border-campus-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold-400"
                                        >
                                            <option value="all">All Days</option>
                                            {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as DayOfWeek[]).map((d) => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={riskOnly}
                                            onChange={(e) => setRiskOnly(e.target.checked)}
                                            className="w-4 h-4 rounded border-campus-600 text-red-500 focus:ring-red-400 bg-campus-700"
                                        />
                                        <span className="text-xs text-campus-400 font-semibold">Show Only Shortage Risk</span>
                                    </label>
                                </div>
                            </div>

                            {/* ── Active Auto-Orders Table ── */}
                            <div className="bg-campus-800/50 border border-campus-700 rounded-2xl overflow-hidden animate-slide-up">
                                <div className="px-6 py-4 border-b border-campus-700">
                                    <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                                        🔄 Active Auto-Orders
                                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-semibold">{filteredOrders.length}</span>
                                    </h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-campus-700">
                                                <th className="text-left px-6 py-3 text-xs font-semibold text-campus-400 uppercase">User</th>
                                                <th className="text-left px-6 py-3 text-xs font-semibold text-campus-400 uppercase">User ID</th>
                                                <th className="text-left px-6 py-3 text-xs font-semibold text-campus-400 uppercase">Item</th>
                                                <th className="text-center px-6 py-3 text-xs font-semibold text-campus-400 uppercase">Qty</th>
                                                <th className="text-center px-6 py-3 text-xs font-semibold text-campus-400 uppercase">Time</th>
                                                <th className="text-center px-6 py-3 text-xs font-semibold text-campus-400 uppercase">Days</th>
                                                <th className="text-center px-6 py-3 text-xs font-semibold text-campus-400 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredOrders.map((order) => (
                                                <tr key={order.id} className="border-b border-campus-700/50 hover:bg-campus-700/30 transition-colors">
                                                    <td className="px-6 py-3 text-white font-medium">{order.userName}</td>
                                                    <td className="px-6 py-3 text-campus-400 font-mono text-xs">{order.userId.slice(0, 8)}…</td>
                                                    <td className="px-6 py-3 text-campus-300">{order.itemName}</td>
                                                    <td className="px-6 py-3 text-center text-white font-bold">{order.quantity}</td>
                                                    <td className="px-6 py-3 text-center text-gold-400 font-medium">{formatTime12(order.time)}</td>
                                                    <td className="px-6 py-3 text-center">
                                                        <div className="flex flex-wrap justify-center gap-1">
                                                            {order.scheduledDays.map((d) => (
                                                                <span key={d} className="text-xs bg-campus-600 text-campus-200 px-1.5 py-0.5 rounded">{d}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-center">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">
                                                            Active
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* ── Aggregate Demand Summary ── */}
                            <div className="bg-campus-800/50 border border-campus-700 rounded-2xl overflow-hidden animate-slide-up">
                                <div className="px-6 py-4 border-b border-campus-700">
                                    <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                                        📦 Aggregate Demand per Item per Day
                                    </h2>
                                </div>
                                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {filteredDemand.map((entry, i) => (
                                        <div key={`${entry.itemId}-${entry.day}-${i}`} className="bg-campus-700/40 rounded-xl px-4 py-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-white">{entry.itemName}</p>
                                                <p className="text-xs text-campus-400">{entry.day}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-gold-400">{entry.totalQuantity}</p>
                                                <p className="text-xs text-campus-500">units</p>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredDemand.length === 0 && (
                                        <p className="text-campus-500 col-span-full text-center py-4">No demand data for selected filters</p>
                                    )}
                                </div>
                            </div>

                            {/* ── 7-Day Forecast ── */}
                            <div className="bg-campus-800/50 border border-campus-700 rounded-2xl overflow-hidden animate-slide-up">
                                <div className="px-6 py-4 border-b border-campus-700">
                                    <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                                        📅 7-Day Stock Forecast
                                    </h2>
                                    <p className="text-xs text-campus-400 mt-1">Cumulative demand vs current stock — items turning red indicate shortage risk</p>
                                </div>

                                {filteredForecast.map((day) => (
                                    <div key={day.date} className="border-b border-campus-700/50 last:border-b-0">
                                        <div className="px-6 py-3 bg-campus-700/20 flex items-center gap-3">
                                            <span className="text-sm font-bold text-white">{formatDate(day.date)}</span>
                                            <span className="text-xs bg-campus-600 text-campus-300 px-2 py-0.5 rounded-full font-semibold">{day.dayName}</span>
                                            {day.items.some(i => i.risk) && (
                                                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold animate-pulse">⚠️ Shortage Risk</span>
                                            )}
                                        </div>

                                        {day.items.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr>
                                                            <th className="text-left px-6 py-2 text-xs font-semibold text-campus-500">Item</th>
                                                            <th className="text-center px-4 py-2 text-xs font-semibold text-campus-500">Today&apos;s Demand</th>
                                                            <th className="text-center px-4 py-2 text-xs font-semibold text-campus-500">Current Stock</th>
                                                            <th className="text-center px-4 py-2 text-xs font-semibold text-campus-500">Cumulative Demand</th>
                                                            <th className="text-center px-4 py-2 text-xs font-semibold text-campus-500">Remaining</th>
                                                            <th className="text-center px-4 py-2 text-xs font-semibold text-campus-500">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {day.items.map((item) => (
                                                            <tr key={item.itemId} className={`border-t border-campus-700/30 ${item.risk ? "bg-red-900/20" : ""}`}>
                                                                <td className="px-6 py-2.5 text-white font-medium">{item.itemName}</td>
                                                                <td className="px-4 py-2.5 text-center text-campus-300">{item.demand}</td>
                                                                <td className="px-4 py-2.5 text-center text-campus-300">{item.currentStock}</td>
                                                                <td className="px-4 py-2.5 text-center text-amber-400 font-semibold">{item.cumulativeDemand}</td>
                                                                <td className={`px-4 py-2.5 text-center font-bold ${item.remaining < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                                                    {item.remaining}
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    {item.risk ? (
                                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                                                                            🚨 Stock Shortage Risk
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">
                                                                            ✅ OK
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="px-6 py-4 text-campus-500 text-sm">
                                                {riskOnly ? "No shortage risks on this day" : "No auto-order demand on this day"}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {filteredForecast.length === 0 && (
                                    <div className="px-6 py-8 text-center text-campus-500">
                                        No forecast data matches your filters
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminGuard>
    );
}
