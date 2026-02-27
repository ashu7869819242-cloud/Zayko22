/**
 * AdminGuard — Server-Verified Admin Route Protection
 * 
 * SECURITY CHANGES:
 * - No longer trusts any string in localStorage as valid auth
 * - Calls GET /api/admin/verify to confirm JWT validity on mount
 * - Redirects to /admin login if token is invalid or expired
 */

"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("adminToken");

        if (!token) {
            router.push("/admin");
            setChecking(false);
            return;
        }

        // SECURITY: Verify the token server-side instead of trusting localStorage
        fetch("/api/admin/verify", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.valid) {
                    setAuthorized(true);
                } else {
                    localStorage.removeItem("adminToken");
                    router.push("/admin");
                }
            })
            .catch(() => {
                localStorage.removeItem("adminToken");
                router.push("/admin");
            })
            .finally(() => setChecking(false));
    }, [router]);

    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zayko-900">
                <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!authorized) return null;

    return <>{children}</>;
}
