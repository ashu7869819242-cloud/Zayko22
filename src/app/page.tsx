"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import MenuCard from "@/components/MenuCard";
import { useCart } from "@/context/CartContext";
import Link from "next/link";

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Canteen Closed Banner */}
      {!isCanteenOpen && (
        <div className="bg-red-500 text-white text-center py-3 px-4 font-bold text-sm animate-fade-in">
          🔴 The canteen is currently closed. Orders are not being accepted right now.
        </div>
      )}

      {/* Closing Soon Warning */}
      {isCanteenOpen && minutesUntilClose !== null && minutesUntilClose <= 30 && minutesUntilClose > 0 && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 font-semibold text-sm">
          ⚠️ Canteen closing in {minutesUntilClose} minutes — some items may be unavailable
        </div>
      )}

      {/* Hero Section */}
      <div className="gradient-primary text-white">
        <div className="page-container py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="animate-fade-in">
              <h1 className="text-3xl sm:text-4xl font-display font-bold">
                Hey {profile?.name?.split(" ")[0] || "there"}! 👋
              </h1>
              <p className="text-zayko-200 mt-1">What are you craving today?</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-3 text-sm">
                <span className="text-zayko-200">Wallet:</span>{" "}
                <span className="font-bold text-gold-300">₹{profile?.walletBalance || 0}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-3 text-sm">
                🟢 {availableCount} items available
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-6 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search for dishes..."
              className="w-full px-5 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder:text-zayko-300 focus:outline-none focus:ring-2 focus:ring-gold-400 text-lg"
            />
          </div>

          {/* Category Filters */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setCategory("all")}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap capitalize transition-all ${category === "all"
                ? "bg-gold-400 text-zayko-900 shadow-gold-glow"
                : "bg-white/10 text-white hover:bg-white/20"
                }`}
            >
              🍽️ All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.slug)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap capitalize transition-all ${category === cat.slug
                  ? "bg-gold-400 text-zayko-900 shadow-gold-glow"
                  : "bg-white/10 text-white hover:bg-white/20"
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="page-container -mt-2">
        {menuLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">Loading menu...</p>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-xl font-display font-bold text-gray-700 mb-2">No items found</h3>
            <p className="text-gray-500">
              {search ? `No results for "${search}"` : "The menu is empty right now"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
            {filteredItems.map((item) => (
              <MenuCard key={item.id} {...item} />
            ))}
          </div>
        )}
      </div>

      {/* Floating Cart Bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-40 animate-slide-up">
          <Link
            href="/cart"
            className="flex items-center justify-between gap-4 bg-zayko-500 text-white px-6 py-4 rounded-2xl shadow-2xl hover:shadow-glow transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center text-lg">
                🛒
              </span>
              <div>
                <p className="font-bold">{itemCount} item{itemCount > 1 ? "s" : ""}</p>
                <p className="text-xs text-zayko-200">View your cart</p>
              </div>
            </div>
            <span className="font-display font-bold text-lg text-gold-300">₹{total}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
