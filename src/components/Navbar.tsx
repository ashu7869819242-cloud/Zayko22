"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { usePathname } from "next/navigation";

export default function Navbar() {
    const { user, profile, signOut } = useAuth();
    const { itemCount } = useCart();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    if (pathname?.startsWith("/admin")) return null;

    const navLinks = [
        { href: "/", label: "Menu", icon: "🍽️" },
        { href: "/cart", label: "Cart", icon: "🛒", badge: itemCount },
        { href: "/orders", label: "Orders", icon: "📋" },
        { href: "/auto-orders", label: "Auto Orders", icon: "🔄" },
        { href: "/wallet", label: "Wallet", icon: "💰" },
        { href: "/chat", label: "AI Chat", icon: "🤖" },
    ];

    return (
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-lg group-hover:scale-110 transition-transform">
                            ⚡
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-lg font-display font-bold text-zayko-500">Zayko</h1>
                            <p className="text-xs text-gray-400 -mt-1">Order Smart. Eat Fresh.</p>
                        </div>
                    </Link>

                    {/* Desktop Nav */}
                    {user && (
                        <div className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${pathname === link.href
                                        ? "bg-zayko-500 text-white shadow-glow"
                                        : "text-gray-600 hover:bg-zayko-50 hover:text-zayko-600"
                                        }`}
                                >
                                    <span>{link.icon}</span>
                                    <span>{link.label}</span>
                                    {link.badge ? (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-scale-in">
                                            {link.badge}
                                        </span>
                                    ) : null}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Right Section */}
                    <div className="flex items-center gap-3">
                        {user && profile && (
                            <div className="hidden sm:flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-zayko-600">{profile.name}</p>
                                    <p className="text-xs text-gray-400">{profile.rollNumber}</p>
                                </div>
                                <button
                                    onClick={signOut}
                                    className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                    Logout
                                </button>
                            </div>
                        )}

                        {/* Mobile menu button */}
                        {user && (
                            <button
                                onClick={() => setMobileOpen(!mobileOpen)}
                                className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {mobileOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Nav */}
                {mobileOpen && user && (
                    <div className="md:hidden pb-4 animate-slide-down">
                        <div className="flex flex-col gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === link.href
                                        ? "bg-zayko-500 text-white"
                                        : "text-gray-600 hover:bg-zayko-50"
                                        }`}
                                >
                                    <span className="text-lg">{link.icon}</span>
                                    <span>{link.label}</span>
                                    {link.badge ? (
                                        <span className="ml-auto w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                            {link.badge}
                                        </span>
                                    ) : null}
                                </Link>
                            ))}
                            {profile && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                    <div className="px-4 py-2">
                                        <p className="text-sm font-semibold">{profile.name}</p>
                                        <p className="text-xs text-gray-400">{profile.rollNumber}</p>
                                    </div>
                                    <button
                                        onClick={signOut}
                                        className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 rounded-xl"
                                    >
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
