"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import MenuCard from "@/components/MenuCard";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface MenuItem {
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

interface CanteenConfig {
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

interface CategoryDoc {
  id: string;
  name: string;
  slug: string;
  order: number;
}

export default function MenuPage() {
  const { user, profile, loading } = useAuth();
  const { itemCount, total } = useCart();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [menuLoading, setMenuLoading] = useState(true);
  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [user, loading, router]);

  // Real-time Firestore subscription for menu
  useEffect(() => {
    const q = query(collection(db, "menuItems"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MenuItem[];
      setMenuItems(items);
      setMenuLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time canteen config subscription
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "canteenConfig"), (snap) => {
      if (snap.exists()) {
        setCanteenConfig(snap.data() as CanteenConfig);
      }
    });
    return () => unsub();
  }, []);

  // Real-time categories subscription
  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CategoryDoc[]);
    });
    return () => unsub();
  }, []);

  // Compute minutes until canteen closes
  const getMinutesUntilClose = (): number | null => {
    if (!canteenConfig?.endTime) return null;
    const now = new Date();
    const [h, m] = canteenConfig.endTime.split(":").map(Number);
    const closeTime = new Date();
    closeTime.setHours(h, m, 0, 0);
    const diff = (closeTime.getTime() - now.getTime()) / 60000;
    return Math.max(0, Math.round(diff));
  };

  const minutesUntilClose = getMinutesUntilClose();
  const isCanteenOpen = canteenConfig?.isOpen !== false;

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || item.category === category;
    // Only hide items by prep time if canteen is open AND closing soon
    const canPrepare = !item.preparationTime
      || minutesUntilClose === null
      || minutesUntilClose === 0
      || item.preparationTime <= minutesUntilClose;
    return matchesSearch && matchesCategory && canPrepare;
  });

  const availableCount = menuItems.filter((i) => i.available).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zayko-900">
        <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zayko-900 pb-24">
      {/* ─── Canteen Closed Banner ─── */}
      <AnimatePresence>
        {!isCanteenOpen && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="bg-red-500/90 text-white text-center py-3 px-4 font-bold text-sm backdrop-blur-md"
          >
            🔴 The canteen is currently closed. Orders are not being accepted right now.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Closing Soon Warning ─── */}
      <AnimatePresence>
        {isCanteenOpen && minutesUntilClose !== null && minutesUntilClose <= 30 && minutesUntilClose > 0 && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white text-center py-2.5 px-4 font-semibold text-sm backdrop-blur-md"
          >
            ⚠️ Canteen closing in {minutesUntilClose} minutes — some items may be unavailable
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Sticky Frosted Glass Navbar ─── */}
      <nav className="sticky top-0 z-50 glass-navbar">
        <div className="page-container !py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl">⚡</span>
            <span className="font-display font-bold text-lg text-white tracking-tight group-hover:text-gold-400 transition-colors">
              Zayko
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/orders"
              className="px-3 py-2 text-sm text-zayko-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              📋 Orders
            </Link>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <span className="text-zayko-400 text-sm">Wallet:</span>
              <span className="font-bold text-gold-400 text-sm">₹{profile?.walletBalance || 0}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section (Radial Gradient) ─── */}
      <div className="gradient-primary relative overflow-hidden">
        {/* Decorative glow orbs */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-gold-400/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-10 w-60 h-60 bg-teal-400/5 rounded-full blur-3xl pointer-events-none" />

        <div className="page-container py-10 sm:py-14 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
                Hey {profile?.name?.split(" ")[0] || "there"}! 👋
              </h1>
              <p className="text-zayko-300 mt-2 text-lg">What are you craving today?</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="flex items-center gap-3"
            >
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 text-sm text-emerald-400 font-medium">
                🟢 {availableCount} items available
              </div>
            </motion.div>
          </div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-8 relative"
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search for dishes..."
              className="search-glow w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zayko-400 focus:outline-none text-lg font-medium transition-all duration-300"
            />
          </motion.div>

          {/* Category Filter Pills */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-5 flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
          >
            <button
              onClick={() => setCategory("all")}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap capitalize transition-all duration-200 ${category === "all"
                ? "bg-gradient-to-r from-gold-400 to-gold-500 text-zayko-900 shadow-[0_0_20px_rgba(251,191,36,0.25)]"
                : "bg-white/5 text-zayko-300 hover:bg-white/10 border border-white/5 hover:border-white/10"
                }`}
            >
              🍽️ All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.slug)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap capitalize transition-all duration-200 ${category === cat.slug
                  ? "bg-gradient-to-r from-gold-400 to-gold-500 text-zayko-900 shadow-[0_0_20px_rgba(251,191,36,0.25)]"
                  : "bg-white/5 text-zayko-300 hover:bg-white/10 border border-white/5 hover:border-white/10"
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ─── Menu Grid ─── */}
      <div className="page-container">
        {menuLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-zayko-400">Loading menu...</p>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-xl font-display font-bold text-white mb-2">No items found</h3>
            <p className="text-zayko-400">
              {search ? `No results for "${search}"` : "The menu is empty right now"}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
              >
                <MenuCard {...item} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Floating Cart Bar ─── */}
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-40"
          >
            <Link
              href="/cart"
              className="flex items-center justify-between gap-6 bg-gradient-to-r from-gold-500 to-gold-400 text-zayko-900 px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(251,191,36,0.3)] hover:shadow-[0_15px_50px_rgba(251,191,36,0.4)] transition-all hover:scale-[1.02] active:scale-95"
            >
              <div className="flex items-center gap-3">
                <span className="bg-zayko-900/20 w-10 h-10 rounded-xl flex items-center justify-center text-lg">
                  🛒
                </span>
                <div>
                  <p className="font-bold">{itemCount} item{itemCount > 1 ? "s" : ""}</p>
                  <p className="text-xs text-zayko-900/70">View your cart</p>
                </div>
              </div>
              <span className="font-display font-bold text-lg">₹{total}</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
