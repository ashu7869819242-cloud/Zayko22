import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc } from "firebase/firestore";

// ─── POST /api/feedbacks (Submit Feedback) ────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orderId, userId, userName, rating, comment } = body;

        if (!orderId || !userId || !rating) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Verify order exists (optional but good)
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        const feedbackData = {
            orderId,
            userId,
            userName: userName || "Anonymous",
            rating: Number(rating),
            comment: comment || "",
            createdAt: new Date().toISOString(),
            serverTimestamp: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "feedbacks"), feedbackData);

        return NextResponse.json({
            success: true,
            id: docRef.id
        }, { status: 201 });

    } catch (error: any) {
        console.error("[Feedback API] POST Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ─── GET /api/feedbacks (Admin View All) ─────────────
export async function GET(req: NextRequest) {
    try {
        // Simple auth check (in production use JWT/Admin token)
        const authHeader = req.headers.get("authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const q = query(
            collection(db, "feedbacks"),
            orderBy("serverTimestamp", "desc")
        );

        const snapshot = await getDocs(q);
        const feedbacks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json(feedbacks);
    } catch (error: any) {
        console.error("[Feedback API] GET Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
