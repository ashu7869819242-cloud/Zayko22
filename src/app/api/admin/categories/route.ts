/**
 * Admin Categories API — CRUD for dynamic menu categories
 *
 * GET    → List all categories ordered by `order` field
 * POST   → Create category (duplicate check, auto-slug)
 * PUT    → Rename category (cascades slug to menuItems)
 * DELETE → Delete category (blocked if items exist)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

function requireAdmin(req: NextRequest): NextResponse | null {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
}

/** Generate URL-safe slug from display name */
function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

// ─── GET: List all categories ───────────────────

export async function GET(req: NextRequest) {
    const authError = requireAdmin(req);
    if (authError) return authError;

    try {
        const snapshot = await adminDb
            .collection("categories")
            .orderBy("order", "asc")
            .get();
        const categories = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        return NextResponse.json({ categories });
    } catch (error) {
        console.error("Failed to fetch categories:", error);
        return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }
}

// ─── POST: Create new category ──────────────────

export async function POST(req: NextRequest) {
    const authError = requireAdmin(req);
    if (authError) return authError;

    try {
        const { name } = await req.json();
        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Category name is required" }, { status: 400 });
        }

        const slug = slugify(name);

        // Check for duplicate slug
        const existing = await adminDb
            .collection("categories")
            .where("slug", "==", slug)
            .get();

        if (!existing.empty) {
            return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
        }

        // Get next order position
        const allCats = await adminDb
            .collection("categories")
            .orderBy("order", "desc")
            .limit(1)
            .get();
        const nextOrder = allCats.empty ? 0 : (allCats.docs[0].data().order || 0) + 1;

        const now = new Date().toISOString();
        const docRef = await adminDb.collection("categories").add({
            name: name.trim(),
            slug,
            order: nextOrder,
            createdAt: now,
            updatedAt: now,
        });

        return NextResponse.json({ id: docRef.id, slug, success: true });
    } catch (error) {
        console.error("Failed to create category:", error);
        return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
    }
}

// ─── PUT: Rename category ───────────────────────

export async function PUT(req: NextRequest) {
    const authError = requireAdmin(req);
    if (authError) return authError;

    try {
        const { id, name } = await req.json();
        if (!id || !name?.trim()) {
            return NextResponse.json({ error: "Category ID and name are required" }, { status: 400 });
        }

        const newSlug = slugify(name);

        // Check for duplicate slug (excluding self)
        const existing = await adminDb
            .collection("categories")
            .where("slug", "==", newSlug)
            .get();

        const isDuplicate = existing.docs.some((doc) => doc.id !== id);
        if (isDuplicate) {
            return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
        }

        // Get old slug for cascade
        const catDoc = await adminDb.collection("categories").doc(id).get();
        if (!catDoc.exists) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }
        const oldSlug = catDoc.data()!.slug;

        // Update category
        await adminDb.collection("categories").doc(id).update({
            name: name.trim(),
            slug: newSlug,
            updatedAt: new Date().toISOString(),
        });

        // Cascade: update all menuItems with old slug → new slug
        if (oldSlug !== newSlug) {
            const itemsToUpdate = await adminDb
                .collection("menuItems")
                .where("category", "==", oldSlug)
                .get();

            const batch = adminDb.batch();
            itemsToUpdate.docs.forEach((doc) => {
                batch.update(doc.ref, { category: newSlug, updatedAt: new Date().toISOString() });
            });
            await batch.commit();
        }

        return NextResponse.json({ success: true, slug: newSlug, itemsUpdated: oldSlug !== newSlug });
    } catch (error) {
        console.error("Failed to update category:", error);
        return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
    }
}

// ─── DELETE: Remove category ────────────────────

export async function DELETE(req: NextRequest) {
    const authError = requireAdmin(req);
    if (authError) return authError;

    try {
        const { id } = await req.json();
        if (!id) {
            return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
        }

        // Get category slug to check menu items
        const catDoc = await adminDb.collection("categories").doc(id).get();
        if (!catDoc.exists) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        const slug = catDoc.data()!.slug;

        // Block deletion if items exist
        const itemsInCategory = await adminDb
            .collection("menuItems")
            .where("category", "==", slug)
            .limit(1)
            .get();

        if (!itemsInCategory.empty) {
            return NextResponse.json(
                { error: "Cannot delete category — menu items still exist in it. Move or delete them first." },
                { status: 400 }
            );
        }

        await adminDb.collection("categories").doc(id).delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete category:", error);
        return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
    }
}
