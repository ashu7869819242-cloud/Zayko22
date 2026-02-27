/**
 * Admin Settings Page — Canteen hours + open/close toggle
 */

"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface CanteenConfig {
    isOpen: boolean;
    startTime: string;
    endTime: string;
}

export default function AdminSettingsPage() {
    const router = useRouter();
    const [config, setConfig] = useState<CanteenConfig>({ isOpen: true, startTime: "09:00", endTime: "17:00" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const getHeaders = () => {
        const token = localStorage.getItem("adminToken");
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };
    };

    useEffect(() => {
        const token = localStorage.getItem("adminToken");
        if (!token) { router.push("/admin"); return; }

        fetch("/api/admin/settings", { headers: getHeaders() })
            .then((res) => res.json())
            .then((data) => {
                setConfig(data);
                setLoading(false);
            })
            .catch(() => {
                toast.error("Failed to load settings");
                setLoading(false);
            });
    }, [router]);

    const saveConfig = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify(config),
            });
            if (res.ok) {
                toast.success("Settings saved! ✅");
            } else {
                toast.error("Failed to save");
            }
        } catch {
            toast.error("Error saving settings");
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="page-container max-w-2xl">
                <div className="flex items-center gap-3 mb-8">
                    <button onClick={() => router.push("/admin/dashboard")} className="text-zayko-600 hover:text-zayko-800">
                        ← Back
                    </button>
                    <h1 className="section-title">⚙️ Canteen Settings</h1>
                </div>

                <div className="glass-card p-8 space-y-8 animate-fade-in">
                    {/* Open/Close Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-display font-bold text-lg text-zayko-700">Canteen Status</h3>
                            <p className="text-sm text-gray-500">Toggle the canteen open or closed</p>
                        </div>
                        <button
                            onClick={() => setConfig({ ...config, isOpen: !config.isOpen })}
                            className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors ${config.isOpen ? "bg-emerald-500" : "bg-gray-300"
                                }`}
                        >
                            <span
                                className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-md transition-transform ${config.isOpen ? "translate-x-11" : "translate-x-1"
                                    }`}
                            />
                        </button>
                    </div>

                    <div className={`text-center py-3 rounded-xl font-bold text-sm ${config.isOpen ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}>
                        {config.isOpen ? "🟢 Canteen is OPEN" : "🔴 Canteen is CLOSED"}
                    </div>

                    {/* Operating Hours */}
                    <div>
                        <h3 className="font-display font-bold text-lg text-zayko-700 mb-4">🕐 Operating Hours</h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Opening Time</label>
                                <input
                                    type="time"
                                    value={config.startTime}
                                    onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
                                    className="input-field text-lg font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Closing Time</label>
                                <input
                                    type="time"
                                    value={config.endTime}
                                    onChange={(e) => setConfig({ ...config, endTime: e.target.value })}
                                    className="input-field text-lg font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="btn-primary w-full py-4 text-lg"
                    >
                        {saving ? "Saving..." : "Save Settings 💾"}
                    </button>
                </div>
            </div>
        </div>
    );
}
