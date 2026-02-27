/**
 * Admin Auto-Orders Forecast API
 * 
 * Provides aggregated demand data, 7-day forecasting, and stock comparison
 * for all active auto-orders. Uses batched Firestore reads for performance.
 * 
 * SECURITY: Protected by admin JWT verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import type { DayOfWeek } from "@/types";

export const runtime = "nodejs";

// ─── Constants ──────────────────────────────────

const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_MAP: Record<number, DayOfWeek> = {
    0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed",
    4: "Thu", 5: "Fri", 6: "Sat",
};

// IST offset = UTC + 5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// ─── Helpers ────────────────────────────────────

function getISTDate(date: Date) {
    const ist = new Date(date.getTime() + IST_OFFSET_MS);
    const yyyy = ist.getUTCFullYear();
    const mo = (ist.getUTCMonth() + 1).toString().padStart(2, "0");
    const dd = ist.getUTCDate().toString().padStart(2, "0");
    return {
        dateStr: `${yyyy}-${mo}-${dd}`,
        dayOfWeek: DAY_MAP[ist.getUTCDay()],
        dayIndex: ist.getUTCDay(),
    };
}

/** Get the days an auto-order is scheduled to run on */
function getScheduledDays(
    frequency: string,
    customDays?: DayOfWeek[]
): DayOfWeek[] {
    if (frequency === "daily") return ALL_DAYS;
    if (frequency === "weekdays") return WEEKDAYS;
    if (frequency === "custom" && Array.isArray(customDays)) return customDays;
    return [];
}

// ─── GET Handler ────────────────────────────────

export async function GET(req: NextRequest) {
    // SECURITY: Require valid admin JWT
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("[Forecast] ═══ Starting forecast computation ═══");

        // ── 1. Batched Firestore reads (2 queries, no N+1) ──
        const [autoOrdersSnap, menuItemsSnap] = await Promise.all([
            adminDb.collection("autoOrders").where("status", "==", "active").get(),
            adminDb.collection("menuItems").get(),
        ]);

        console.log(`[Forecast] Fetched ${autoOrdersSnap.size} active auto-orders, ${menuItemsSnap.size} menu items`);

        // Build menu items lookup map: itemId → { name, price, quantity (stock), available }
        const menuMap = new Map<string, {
            id: string;
            name: string;
            price: number;
            stock: number;
            available: boolean;
            category: string;
        }>();
        for (const doc of menuItemsSnap.docs) {
            const d = doc.data();
            menuMap.set(doc.id, {
                id: doc.id,
                name: d.name || "Unknown",
                price: d.price || 0,
                stock: d.quantity ?? 0,
                available: d.available !== false,
                category: d.category || "",
            });
        }

        // ── 2. Batch-fetch user names ──
        const userIds = new Set<string>();
        for (const doc of autoOrdersSnap.docs) {
            userIds.add(doc.data().userId);
        }

        const userMap = new Map<string, string>(); // userId → userName
        if (userIds.size > 0) {
            const userIdArray = Array.from(userIds);
            // Firestore getAll supports up to 100 refs at once; batch if needed
            const batchSize = 100;
            for (let i = 0; i < userIdArray.length; i += batchSize) {
                const batch = userIdArray.slice(i, i + batchSize);
                const refs = batch.map(id => adminDb.collection("users").doc(id));
                const userDocs = await adminDb.getAll(...refs);
                for (const userDoc of userDocs) {
                    if (userDoc.exists) {
                        const data = userDoc.data();
                        userMap.set(userDoc.id, data?.name || "Unknown User");
                    } else {
                        userMap.set(userDoc.id, "Unknown User");
                    }
                }
            }
        }
        console.log(`[Forecast] Resolved ${userMap.size} user names`);

        // ── 3. Build enriched auto-orders list ──
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

        const autoOrders: EnrichedAutoOrder[] = [];
        for (const doc of autoOrdersSnap.docs) {
            const d = doc.data();
            const scheduledDays = getScheduledDays(d.frequency, d.customDays);
            autoOrders.push({
                id: doc.id,
                userId: d.userId,
                userName: userMap.get(d.userId) || "Unknown User",
                itemId: d.itemId,
                itemName: d.itemName || menuMap.get(d.itemId)?.name || "Unknown",
                itemPrice: d.itemPrice || menuMap.get(d.itemId)?.price || 0,
                quantity: d.quantity || 1,
                time: d.time || "00:00",
                frequency: d.frequency || "daily",
                customDays: d.customDays,
                scheduledDays,
                status: d.status,
            });
        }

        // ── 4. Aggregate demand per item per day ──
        // demandMap: Map<`${itemId}::${day}`> → totalQuantity
        const demandMap = new Map<string, { itemId: string; itemName: string; day: DayOfWeek; totalQuantity: number }>();

        for (const order of autoOrders) {
            for (const day of order.scheduledDays) {
                const key = `${order.itemId}::${day}`;
                const existing = demandMap.get(key);
                if (existing) {
                    existing.totalQuantity += order.quantity;
                } else {
                    demandMap.set(key, {
                        itemId: order.itemId,
                        itemName: order.itemName,
                        day,
                        totalQuantity: order.quantity,
                    });
                }
            }
        }

        const aggregateDemand = Array.from(demandMap.values()).sort((a, b) =>
            a.itemName.localeCompare(b.itemName) || ALL_DAYS.indexOf(a.day) - ALL_DAYS.indexOf(b.day)
        );

        console.log(`[Forecast] Computed ${aggregateDemand.length} demand-per-item-per-day entries`);

        // ── 5. Compute daily demand totals per item (average across scheduled days) ──
        const dailyTotalMap = new Map<string, { itemId: string; itemName: string; totalDaily: number }>();
        for (const entry of aggregateDemand) {
            const existing = dailyTotalMap.get(entry.itemId);
            if (existing) {
                // Take the MAX daily demand across days for this item (worst-case planning)
                existing.totalDaily = Math.max(existing.totalDaily, entry.totalQuantity);
            } else {
                dailyTotalMap.set(entry.itemId, {
                    itemId: entry.itemId,
                    itemName: entry.itemName,
                    totalDaily: entry.totalQuantity,
                });
            }
        }

        // ── 6. 7-day forecast with stock comparison ──
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

        const now = new Date();
        const forecast: ForecastDay[] = [];

        // Track cumulative demand per item across the 7 days
        const cumulativeDemandTracker = new Map<string, number>();

        for (let offset = 0; offset < 7; offset++) {
            const futureDate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
            const { dateStr, dayOfWeek } = getISTDate(futureDate);

            const dayItems: ForecastDayItem[] = [];

            // For each menu item, compute demand for this specific day
            for (const [itemId, menuItem] of menuMap.entries()) {
                const demandKey = `${itemId}::${dayOfWeek}`;
                const demandEntry = demandMap.get(demandKey);
                const todayDemand = demandEntry?.totalQuantity || 0;

                if (todayDemand === 0) continue; // Skip items with no demand on this day

                const prevCumulative = cumulativeDemandTracker.get(itemId) || 0;
                const newCumulative = prevCumulative + todayDemand;
                cumulativeDemandTracker.set(itemId, newCumulative);

                const remaining = menuItem.stock - newCumulative;

                dayItems.push({
                    itemId,
                    itemName: menuItem.name,
                    demand: todayDemand,
                    currentStock: menuItem.stock,
                    cumulativeDemand: newCumulative,
                    remaining,
                    risk: remaining < 0,
                });
            }

            // Sort by risk (risky items first), then by name
            dayItems.sort((a, b) => {
                if (a.risk !== b.risk) return a.risk ? -1 : 1;
                return a.itemName.localeCompare(b.itemName);
            });

            forecast.push({ date: dateStr, dayName: dayOfWeek, items: dayItems });
        }

        // ── 7. Count items at risk ──
        const riskItemIds = new Set<string>();
        for (const day of forecast) {
            for (const item of day.items) {
                if (item.risk) riskItemIds.add(item.itemId);
            }
        }

        console.log(`[Forecast] 7-day forecast computed. Items at risk: ${riskItemIds.size}`);
        console.log(`[Forecast] Stock comparison results:`);
        for (const [itemId, menuItem] of menuMap.entries()) {
            const cumDemand = cumulativeDemandTracker.get(itemId);
            if (cumDemand) {
                const remaining = menuItem.stock - cumDemand;
                console.log(`[Forecast]   ${menuItem.name}: stock=${menuItem.stock}, 7-day demand=${cumDemand}, remaining=${remaining} ${remaining < 0 ? "⚠️ RISK" : "✅"}`);
            }
        }

        // ── 8. Build summary ──
        const summary = {
            totalActiveOrders: autoOrders.length,
            itemsAtRisk: riskItemIds.size,
            dailyDemandByItem: Array.from(dailyTotalMap.values()).sort(
                (a, b) => b.totalDaily - a.totalDaily
            ),
        };

        console.log(`[Forecast] ═══ Forecast complete ═══`);

        return NextResponse.json({
            autoOrders,
            aggregateDemand,
            forecast,
            summary,
        });

    } catch (error) {
        console.error("[Forecast] Fatal error:", error);
        return NextResponse.json(
            { error: "Failed to compute forecast" },
            { status: 500 }
        );
    }
}
