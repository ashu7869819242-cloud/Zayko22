"use client";
import React, { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import toast from "react-hot-toast";
import type { Feedback } from "@/types";

export default function AdminFeedbackPage() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch("/api/feedbacks", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFeedbacks(data);
            } else {
                toast.error("Failed to fetch feedbacks");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error loading feedbacks");
        } finally {
            setLoading(false);
        }
    };

    const avgRating = feedbacks.length > 0
        ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1)
        : "0";

    return (
        <AdminGuard>
            <div className="min-h-screen bg-zayko-900 pb-12">
                {/* ─── Header ─── */}
                <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/admin/dashboard" className="text-zayko-400 hover:text-white transition-colors">
                                ← Back
                            </Link>
                            <h1 className="text-lg font-display font-bold text-white">Customer Feedback ⭐</h1>
                        </div>
                        <div className="bg-gold-500/10 border border-gold-500/20 px-4 py-1.5 rounded-full">
                            <span className="text-xs text-gold-400 font-bold uppercase tracking-wider">Avg Rating: {avgRating} ★</span>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : feedbacks.length === 0 ? (
                        <div className="text-center py-20 bg-zayko-800/30 border border-zayko-700 border-dashed rounded-3xl">
                            <span className="text-5xl mb-4 block">💬</span>
                            <h3 className="text-white font-bold text-xl">No feedback yet</h3>
                            <p className="text-zayko-400">Customer reviews will appear here</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {feedbacks.map((f) => (
                                <div key={f.id} className="bg-zayko-800/50 border border-zayko-700 p-6 rounded-3xl animate-fade-in">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-zayko-700 flex items-center justify-center text-xs font-bold text-white uppercase">
                                                {f.userName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">{f.userName}</p>
                                                <p className="text-[10px] text-zayko-500">{new Date(f.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-0.5 text-gold-400">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <span key={i} className={i < f.rating ? "opacity-100" : "opacity-20"}>★</span>
                                            ))}
                                        </div>
                                    </div>

                                    <p className="text-sm text-zayko-300 leading-relaxed italic">
                                        "{f.comment || "No comment provided."}"
                                    </p>

                                    <div className="mt-4 pt-4 border-t border-zayko-700/50 flex items-center justify-between">
                                        <span className="text-[10px] text-zayko-500 uppercase tracking-widest font-bold">Order #{f.orderId.slice(-6).toUpperCase()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminGuard>
    );
}
