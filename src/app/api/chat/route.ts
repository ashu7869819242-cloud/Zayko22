/**
 * Chat API — AI chat assistant for order placement
 * 
 * SECURITY CHANGES:
 * - Requires Firebase ID token verification
 * - Rate limited (20 req/min per IP)
 * - Order ID uses UUID format instead of 6-digit random
 */

import { NextRequest, NextResponse } from "next/server";
import { chatWithFallback, ChatMessage } from "@/lib/llm";
import { getAuthenticatedUser } from "@/lib/user-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { adminDb } from "@/lib/firebase-admin";
import { generateOrderId } from "@/lib/orderIdUtils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    // SECURITY: Rate limit chat requests (20 per minute)
    const rateLimitResponse = checkRateLimit(req, 20, 60_000);
    if (rateLimitResponse) return rateLimitResponse;

    // SECURITY: Require Firebase ID token
    const uid = await getAuthenticatedUser(req);
    if (!uid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { messages, cart, userProfile, action } = await req.json();

        // SECURITY: Zayko-format order ID (replaces UUID-based ID)
        const generateId = () => generateOrderId();

        // Fetch canteen status for AI context
        let canteenIsOpen = true;
        let canteenTiming = "9AM – 6PM";
        try {
            const configDoc = await adminDb.doc("settings/canteenConfig").get();
            if (configDoc.exists) {
                const config = configDoc.data();
                canteenIsOpen = config?.isOpen !== false;
                if (config?.startTime && config?.endTime) {
                    canteenTiming = `${config.startTime} – ${config.endTime}`;
                }
            }
        } catch (e) {
            console.error("Failed to fetch canteen config for chat:", e);
        }

        // Build user context string
        const userName = userProfile?.name || "";
        const userContextBlock = userName
            ? `\n\nCURRENT USER INFO:\n- Name: ${userName}\n- Email: ${userProfile?.email || "N/A"}\n- Roll Number: ${userProfile?.rollNumber || "N/A"}`
            : "";

        const canteenStatusBlock = canteenIsOpen
            ? `\n\nCANTEEN STATUS: OPEN (Timing: ${canteenTiming})`
            : `\n\nCANTEEN STATUS: CLOSED (Timing: ${canteenTiming})\nIMPORTANT: Canteen is currently closed. Do NOT suggest any food items. Respond to any food/order request with: "Canteen abhi band hai 😔 Timing: ${canteenTiming}"`;

        let systemPrompt = `You are the official AI Assistant of Zayko – a Smart Food Ordering Platform.

Your job is ONLY to assist users with canteen-related tasks.

------------------------------------------
LANGUAGE RULES
------------------------------------------

- Default language: Hinglish (friendly tone).
- Start conversations in Hinglish.
- If user switches to full English, reply in English.
- Keep tone friendly, short, helpful.
- Use light emojis (not too many).
- Address user by their name (provided in user profile).

------------------------------------------
STRICT DOMAIN RULE
------------------------------------------

You are ONLY allowed to talk about:
- Menu items
- Availability
- Prices
- Preparation time
- Cart
- Orders
- Wallet
- Transfers
- Canteen timings
- Tracking orders
- Modifying profile name

If user asks anything unrelated to canteen:
- Politely say: "Main sirf canteen related help kar sakta hoon 😊"
If user repeats off-topic request multiple times:
- Respond strictly:
  "Ye platform sirf canteen services ke liye hai. Kripya canteen related hi baat karein."

------------------------------------------
MENU RULES
------------------------------------------

- Only suggest items that are currently available in menu data.
- Never invent items.
- Never assume availability.
- Only use items provided in the real-time menu data.
- If item quantity is low (<=3), say:
  "Only X left 👀"
- If item is unavailable, clearly say:
  "Ye item abhi available nahi hai."

------------------------------------------
FAST PREPARATION RULE
------------------------------------------

If user asks for quick items:
- Suggest only items with lowest preparation time.
- Never suggest slow items.

------------------------------------------
BIRTHDAY / BUDGET SUGGESTION RULE
------------------------------------------

If user gives budget and number of people:
- Suggest combination ONLY from available menu.
- Stay within budget.
- Calculate properly.

------------------------------------------
ORDER CONFIRMATION RULE
------------------------------------------

When user clicks "Place Order":

- Read cart data.
- Show short friendly confirmation message.
- Include:
    User Name
    Registered Email
    Items with quantity
    Total amount
    Unique 6-digit Order ID
- Use emojis but keep message clean.

Example style:

"Ravi bhai 😄
Yeh raha aapka order summary 👇
🍔 Burger ×2
☕ Chai ×1
Total: ₹80
Order ID: ZKO4F7X

Confirm karein?"

------------------------------------------
TRACK ORDER RULE
------------------------------------------

If user asks to track order:
- Fetch most recent active order.
- Show:
   Order ID
   Status
   Estimated remaining time
Example:
"Order #482913 abhi prepare ho raha hai 🍳
Approx 7 minutes lagega ⏳"

------------------------------------------
CANCEL ORDER RULE
------------------------------------------

If user asks to cancel order:
- Always respond:

"Sorry 😔 order yahan se cancel nahi ho sakta.
Kripya canteen owner se contact karein:
📞 9302593483"

------------------------------------------
WALLET RULES
------------------------------------------

If user says "Check wallet":
- Fetch walletBalance.
- Reply:
   "Aapke wallet me ₹XXX available hai 💰"

If wallet transfer:
- Confirm recipient name before transfer.
- Never assume.

------------------------------------------
PROFILE UPDATE RULE
------------------------------------------

If user modifies name:
- Update profile.
- Confirm:
  "Aapka naam successfully update ho gaya 👍"

------------------------------------------
CANTEEN TIME RULE
------------------------------------------

If canteen is closed:
- Clearly say:
  "Canteen abhi band hai 😔
   Timing: 9AM – 6PM"

------------------------------------------
SAFETY RULES
------------------------------------------

- Never expose internal IDs except Order ID.
- Never expose payment secrets.
- Never expose API keys.
- Never fabricate wallet balances or order data.
- Always rely on provided backend data.

------------------------------------------
PERSONALITY STYLE
------------------------------------------

- Friendly college vibe
- Slightly casual but respectful
- Not overly dramatic
- Clear & short responses
- Helpful suggestions

You must strictly follow these rules.
Never break character.
Never go outside canteen domain.`;

        // Append dynamic context to system prompt
        systemPrompt += userContextBlock;
        systemPrompt += canteenStatusBlock;

        if (action === "place_order" && cart && cart.length > 0 && userProfile) {
            const orderId = generateId();
            const cartSummary = cart
                .map((item: { name: string; quantity: number; price: number }) => `• ${item.name} x${item.quantity} — ₹${item.price * item.quantity}`)
                .join("\n");
            const total = cart.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0);

            systemPrompt += `\n\nThe user wants to place an order. Here are the details:
Student Name: ${userProfile.name}
Email: ${userProfile.email}
Roll Number: ${userProfile.rollNumber}

Cart Items:
${cartSummary}

Total: ₹${total}
Order ID: #${orderId}

Generate a short, friendly order confirmation message that:
1. Greets the student by name
2. Lists all items with quantities and prices
3. Shows the total amount
4. Shows the Order ID #${orderId}
5. Asks if they want to confirm the order
6. Mentions the amount will be deducted from their wallet
Keep it concise and fun with emojis!`;

            const chatMessages: ChatMessage[] = [
                { role: "user", content: "I want to place my order" },
            ];

            const { response, provider } = await chatWithFallback(chatMessages, systemPrompt);

            return NextResponse.json({
                message: response,
                provider,
                orderId,
                total,
                action: "confirm_order",
            });
        }

        // Regular chat flow
        const chatMessages: ChatMessage[] = (messages || []).map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
        }));

        // ── FAQ check: match the last user message against static FAQs ──
        const lastUserMsg = chatMessages.filter((m) => m.role === "user").pop();
        if (lastUserMsg) {
            const { matchFaq } = await import("@/lib/faq");
            const faqResult = matchFaq(lastUserMsg.content);

            if (faqResult.matched) {
                // Static FAQ — return answer directly
                if (faqResult.answer) {
                    return NextResponse.json({ message: faqResult.answer, provider: "faq" });
                }

                // Dynamic FAQ — fetch menu data and build response
                if (faqResult.dynamic === "fastest_items") {
                    try {
                        const menuSnap = await adminDb.collection("menuItems")
                            .where("available", "==", true)
                            .orderBy("preparationTime", "asc")
                            .limit(5)
                            .get();
                        const items = menuSnap.docs.map((d) => d.data());
                        if (items.length === 0) {
                            return NextResponse.json({ message: "Abhi koi fast item available nahi hai 😔", provider: "faq" });
                        }
                        const list = items
                            .map((it) => `• ${it.name} — ₹${it.price} (${it.preparationTime} min)`)
                            .join("\n");
                        return NextResponse.json({
                            message: `Yeh sabse jaldi milne wale items hain 🚀\n\n${list}\n\nOrder karna hai toh cart mein add karo!`,
                            provider: "faq",
                        });
                    } catch (e) {
                        console.error("Dynamic FAQ (fastest) error:", e);
                    }
                }

                if (faqResult.dynamic === "combo_suggestion") {
                    try {
                        const menuSnap = await adminDb.collection("menuItems")
                            .where("available", "==", true)
                            .orderBy("preparationTime", "asc")
                            .limit(10)
                            .get();
                        const items = menuSnap.docs.map((d) => d.data());
                        if (items.length < 2) {
                            return NextResponse.json({ message: "Abhi combo ke liye enough items available nahi hain 😔", provider: "faq" });
                        }
                        // Pick 2-3 items with low prep time for a combo
                        const combo = items.slice(0, 3);
                        const total = combo.reduce((s, it) => s + (it.price || 0), 0);
                        const maxPrep = Math.max(...combo.map((it) => it.preparationTime || 0));
                        const list = combo
                            .map((it) => `• ${it.name} — ₹${it.price}`)
                            .join("\n");
                        return NextResponse.json({
                            message: `Here's a quick combo suggestion 🍽️\n\n${list}\n\n💰 Total: ₹${total}\n⏱️ Ready in ~${maxPrep} min\n\nCart mein add karo aur order place karo!`,
                            provider: "faq",
                        });
                    } catch (e) {
                        console.error("Dynamic FAQ (combo) error:", e);
                    }
                }
            }
        }

        // ── LLM fallback ──
        const { response, provider } = await chatWithFallback(chatMessages, systemPrompt);

        return NextResponse.json({ message: response, provider });
    } catch (error) {
        console.error("Chat error:", error);
        return NextResponse.json(
            { message: "Oops! Something went wrong. Please try again! 🙏", provider: "error" },
            { status: 500 }
        );
    }
}
