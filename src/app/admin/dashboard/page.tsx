"use client";
import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

interface Stats {
    summary: {
        totalRevenue: number;
        totalOrders: number;
        pendingOrders: number;
        completedOrders: number;
        averageOrderValue: number;
    };
    dailySales: Array<{ date: string; revenue: number; orders: number }>;
    monthlySales: Array<{ month: string; revenue: number; orders: number }>;
    topItems: Array<{ name: string; count: number }>;
    topStudent: { name: string; totalSpent: number } | null;
}

const CHART_COLORS = ["#1e3a5f", "#d4a017", "#0d9488", "#60a5fa", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [canteenOpen, setCanteenOpen] = useState(true);
    const [toggling, setToggling] = useState(false);

    const getHeaders = () => {
        const token = localStorage.getItem("adminToken");
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };
    };

    useEffect(() => {
        fetchStats();
        fetchCanteenStatus();
    }, []);

    const fetchCanteenStatus = async () => {
        try {
            const res = await fetch("/api/admin/settings", { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setCanteenOpen(data.isOpen ?? true);
            }
        } catch { /* ignore */ }
    };

    const toggleCanteen = async () => {
        setToggling(true);
        try {
            const newState = !canteenOpen;
            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify({ isOpen: newState }),
            });
            if (res.ok) {
                setCanteenOpen(newState);
                toast.success(newState ? "Canteen is now OPEN ✅" : "Canteen is now CLOSED 🔴");
            } else {
                toast.error("Failed to update canteen status");
            }
        } catch {
            toast.error("Error toggling canteen");
        }
        setToggling(false);
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch("/api/admin/stats", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error("Failed to fetch stats:", err);
        }
        setLoading(false);
    };

    const adminLinks = [
        { href: "/admin/orders", label: "Manage Orders", icon: "📋", color: "from-blue-500 to-blue-600" },
        { href: "/admin/menu", label: "Manage Menu", icon: "🍽️", color: "from-teal-500 to-teal-600" },
        { href: "/admin/auto-orders-forecast", label: "Forecast", icon: "📊", color: "from-amber-500 to-amber-600" },
        { href: "/admin/settings", label: "Settings", icon: "⚙️", color: "from-purple-500 to-purple-600" },
    ];

    return (
        <AdminGuard>
            <div className="min-h-screen bg-zayko-900 pb-12">
                {/* ─── Header & Nav ─── */}
                <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gold-500/20 flex items-center justify-center text-xl">⚡</div>
                            <div>
                                <h1 className="text-lg font-display font-bold text-white">Admin Dashboard</h1>
                                <p className="text-xs text-zayko-400">Zayko Management</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto scrollbar-hide">
                            <Link href="/admin/orders" className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm rounded-xl transition-all whitespace-nowrap">
                                📋 Orders
                            </Link>
                            <Link href="/admin/menu" className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm rounded-xl transition-all whitespace-nowrap">
                                🍔 Menu
                            </Link>
                            <Link href="/admin/wallet" className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm rounded-xl transition-all whitespace-nowrap">
                                💰 Wallet
                            </Link>
                            <Link href="/admin/settings" className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm rounded-xl transition-all whitespace-nowrap">
                                ⚙️ Settings
                            </Link>
                            <button
                                onClick={() => { localStorage.removeItem("adminToken"); window.location.href = "/admin"; }}
                                className="px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-all ml-auto sm:ml-2 whitespace-nowrap"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : stats ? (
                        <>
                            {/* Canteen Toggle + Stats Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8 animate-fade-in">
                                {/* Canteen Toggle Card */}
                                <div className="col-span-2 lg:col-span-1 bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-3">
                                    <span className="text-xs text-zayko-400 font-semibold">Canteen</span>
                                    <button
                                        onClick={toggleCanteen}
                                        disabled={toggling}
                                        className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors ${canteenOpen ? "bg-emerald-500" : "bg-gray-500"}`}
                                    >
                                        <span className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-md transition-transform ${canteenOpen ? "translate-x-11" : "translate-x-1"}`} />
                                    </button>
                                    <span className={`text-xs font-bold ${canteenOpen ? "text-emerald-400" : "text-red-400"}`}>
                                        {canteenOpen ? "🟢 OPEN" : "🔴 CLOSED"}
                                    </span>
                                </div>

                                {[
                                    { label: "Total Revenue", value: `₹${stats.summary.totalRevenue.toLocaleString()}`, icon: "💰", color: "text-gold-400" },
                                    { label: "Total Orders", value: stats.summary.totalOrders, icon: "📦", color: "text-blue-400" },
                                    { label: "Pending", value: stats.summary.pendingOrders, icon: "⏳", color: "text-yellow-400" },
                                    { label: "Completed", value: stats.summary.completedOrders, icon: "✅", color: "text-emerald-400" },
                                ].map((stat) => (
                                    <div key={stat.label} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">{stat.icon}</span>
                                            <span className="text-xs text-zayko-400">{stat.label}</span>
                                        </div>
                                        <p className={`text-2xl font-display font-bold ${stat.color}`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Avg Order Value */}
                            <div className="grid grid-cols-1 gap-4 mb-8 animate-slide-up">
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">📊</span>
                                        <span className="text-xs text-zayko-400">Avg Order Value</span>
                                    </div>
                                    <p className="text-2xl font-display font-bold text-purple-400">₹{stats.summary.averageOrderValue}</p>
                                </div>
                            </div>

                            {/* Charts Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                {/* Daily Revenue Chart */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                                    <h3 className="text-lg font-display font-bold text-white mb-4">📈 Daily Revenue</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={stats.dailySales.slice(-14)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                                            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                                            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                            <Tooltip
                                                contentStyle={{ background: "#0f2035", border: "1px solid #1e3a5f", borderRadius: "12px", color: "#fff" }}
                                                labelFormatter={(v) => `Date: ${v}`}
                                            />
                                            <Bar dataKey="revenue" fill="#d4a017" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Daily Orders Chart */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                                    <h3 className="text-lg font-display font-bold text-white mb-4">📊 Daily Orders</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={stats.dailySales.slice(-14)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                                            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                                            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                            <Tooltip
                                                contentStyle={{ background: "#0f2035", border: "1px solid #1e3a5f", borderRadius: "12px", color: "#fff" }}
                                            />
                                            <Line type="monotone" dataKey="orders" stroke="#0d9488" strokeWidth={3} dot={{ fill: "#0d9488", r: 5 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Top Items Pie Chart */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                                    <h3 className="text-lg font-display font-bold text-white mb-4">🔥 Popular Items</h3>
                                    {stats.topItems.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={stats.topItems.slice(0, 6)}
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={100}
                                                    dataKey="count"
                                                    nameKey="name"
                                                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                                                >
                                                    {stats.topItems.slice(0, 6).map((_, idx) => (
                                                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ background: "#0f2035", border: "1px solid #1e3a5f", borderRadius: "12px", color: "#fff" }} />
                                                <Legend wrapperStyle={{ color: "#94a3b8" }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-[300px] text-zayko-500">No data yet</div>
                                    )}
                                </div>

                                {/* Monthly Revenue */}
                                <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 animate-slide-up">
                                    <h3 className="text-lg font-display font-bold text-white mb-4">📅 Monthly Revenue</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={stats.monthlySales}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                                            <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                            <Tooltip contentStyle={{ background: "#0f2035", border: "1px solid #1e3a5f", borderRadius: "12px", color: "#fff" }} />
                                            <Bar dataKey="revenue" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                                            <Bar dataKey="orders" fill="#d4a017" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-20 text-zayko-400">Failed to load stats</div>
                    )}
                </div>
            </div>
        </AdminGuard >
    );
}
