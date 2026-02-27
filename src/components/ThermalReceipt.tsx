/**
 * ThermalReceipt — POS-compatible thermal receipt for admin panel.
 *
 * Supports 58mm and 80mm thermal printers.
 * Features: QR code, GST breakdown, monospace layout, print & PDF.
 */

"use client";
import React, { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

interface OrderItem {
    name: string;
    price: number;
    quantity: number;
}

interface ReceiptOrder {
    orderId: string;
    userName: string;
    userEmail: string;
    userRollNumber?: string;
    items: OrderItem[];
    total: number;
    paymentMode?: string;
    status: string;
    prepTime?: number;
    createdAt: string;
}

interface ThermalReceiptProps {
    order: ReceiptOrder;
    onClose: () => void;
}

const GST_RATE = 0.05; // 5% GST
const DIVIDER = "- - - - - - - - - - - - - - - -";
const THICK_DIVIDER = "================================";

/** Truncate long item names for 32-char POS width */
function truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

/** Pad a line with spaces between left and right text */
function padLine(left: string, right: string, width = 32): string {
    const gap = width - left.length - right.length;
    return left + " ".repeat(Math.max(1, gap)) + right;
}

export default function ThermalReceipt({ order, onClose }: ThermalReceiptProps) {
    const receiptRef = useRef<HTMLDivElement>(null);

    const subtotal = order.total;
    const gstAmount = Math.round((subtotal / (1 + GST_RATE)) * GST_RATE * 100) / 100;
    const baseAmount = Math.round((subtotal - gstAmount) * 100) / 100;

    const orderDate = new Date(order.createdAt);
    const dateStr = orderDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const timeStr = orderDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        if (!receiptRef.current) return;
        try {
            const html2canvas = (await import("html2canvas")).default;
            const jsPDF = (await import("jspdf")).default;

            const canvas = await html2canvas(receiptRef.current, {
                scale: 2,
                backgroundColor: "#ffffff",
                useCORS: true,
            });

            const imgData = canvas.toDataURL("image/png");
            const imgWidth = 80; // mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: [imgWidth, imgHeight + 10],
            });

            pdf.addImage(imgData, "PNG", 0, 5, imgWidth, imgHeight);
            pdf.save(`receipt-${order.orderId}.pdf`);
        } catch (err) {
            console.error("PDF generation failed:", err);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            {/* Backdrop close */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal container */}
            <div className="relative z-10 w-full max-w-[340px] max-h-[95vh] overflow-y-auto mx-4">
                {/* Action buttons (hidden on print) */}
                <div className="no-print flex items-center justify-center gap-2 mb-3">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2.5 bg-zayko-500 text-white rounded-xl font-semibold text-sm hover:bg-zayko-600 transition-all flex items-center gap-2 shadow-lg"
                    >
                        🖨️ Print
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="px-4 py-2.5 bg-gold-500 text-zayko-900 rounded-xl font-semibold text-sm hover:bg-gold-400 transition-all flex items-center gap-2 shadow-lg"
                    >
                        📄 PDF
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 bg-gray-600 text-white rounded-xl font-semibold text-sm hover:bg-gray-500 transition-all shadow-lg"
                    >
                        ✕ Close
                    </button>
                </div>

                {/* ═══ RECEIPT PAPER ═══ */}
                <div
                    ref={receiptRef}
                    className="thermal-receipt-area bg-white text-black mx-auto shadow-2xl"
                    style={{
                        width: "300px",
                        fontFamily: "'Courier New', Courier, monospace",
                        fontSize: "12px",
                        lineHeight: "1.4",
                        padding: "16px 12px",
                    }}
                >
                    {/* ── Header ── */}
                    <div style={{ textAlign: "center", marginBottom: "4px" }}>
                        <div style={{ fontSize: "18px", fontWeight: "bold", letterSpacing: "2px" }}>
                            ⚡ ZAYKO
                        </div>
                        <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
                            Smart Campus Food Ordering
                        </div>
                        <div style={{ fontSize: "9px", color: "#999", marginTop: "1px" }}>
                            SAITM Campus, Bhopal
                        </div>
                    </div>

                    <pre style={{ margin: "6px 0", color: "#999", textAlign: "center", fontSize: "11px" }}>{THICK_DIVIDER}</pre>

                    {/* ── Order Info ── */}
                    <div style={{ fontSize: "11px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Order: <strong>#{order.orderId}</strong></span>
                            <span>{dateStr}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>{order.userName}</span>
                            <span>{timeStr}</span>
                        </div>
                        {order.userRollNumber && (
                            <div style={{ color: "#666" }}>Roll: {order.userRollNumber}</div>
                        )}
                    </div>

                    <pre style={{ margin: "6px 0", color: "#ccc", textAlign: "center", fontSize: "11px" }}>{DIVIDER}</pre>

                    {/* ── Column Headers ── */}
                    <pre style={{ fontSize: "11px", fontWeight: "bold", margin: "0 0 2px 0" }}>
                        {padLine("ITEM", "QTY    AMT")}
                    </pre>
                    <pre style={{ margin: "0 0 4px 0", color: "#ccc", fontSize: "11px" }}>{DIVIDER}</pre>

                    {/* ── Items ── */}
                    {order.items.map((item, idx) => {
                        const itemTotal = item.price * item.quantity;
                        const name = truncate(item.name, 18);
                        const qtyStr = `x${item.quantity}`;
                        const amtStr = `₹${itemTotal}`;
                        return (
                            <pre key={idx} style={{ fontSize: "11px", margin: "1px 0" }}>
                                {padLine(name, `${qtyStr}  ${amtStr}`)}
                            </pre>
                        );
                    })}

                    <pre style={{ margin: "6px 0", color: "#ccc", textAlign: "center", fontSize: "11px" }}>{DIVIDER}</pre>

                    {/* ── Totals ── */}
                    <div style={{ fontSize: "11px" }}>
                        <pre style={{ margin: "1px 0" }}>{padLine("Subtotal", `₹${baseAmount.toFixed(2)}`)}</pre>
                        <pre style={{ margin: "1px 0", color: "#666" }}>{padLine("GST @5%", `₹${gstAmount.toFixed(2)}`)}</pre>
                    </div>

                    <pre style={{ margin: "4px 0", color: "#999", textAlign: "center", fontSize: "11px" }}>{THICK_DIVIDER}</pre>

                    <pre style={{ fontSize: "14px", fontWeight: "bold", margin: "2px 0", textAlign: "center" }}>
                        {`TOTAL: ₹${order.total.toFixed(2)}`}
                    </pre>

                    <pre style={{ margin: "4px 0", color: "#999", textAlign: "center", fontSize: "11px" }}>{THICK_DIVIDER}</pre>

                    {/* ── Payment ── */}
                    <pre style={{ fontSize: "11px", margin: "2px 0" }}>
                        {padLine("Payment", order.paymentMode || "Wallet")}
                    </pre>
                    <pre style={{ fontSize: "11px", margin: "2px 0" }}>
                        {padLine("Status", order.status.toUpperCase())}
                    </pre>

                    <pre style={{ margin: "6px 0", color: "#ccc", textAlign: "center", fontSize: "11px" }}>{DIVIDER}</pre>

                    {/* ── QR Code ── */}
                    <div style={{ textAlign: "center", margin: "8px 0" }}>
                        <QRCodeSVG
                            value={`ZAYKO-ORDER:${order.orderId}`}
                            size={100}
                            level="M"
                            style={{ margin: "0 auto", display: "block" }}
                        />
                        <div style={{ fontSize: "8px", color: "#999", marginTop: "3px" }}>
                            Scan for order details
                        </div>
                    </div>

                    <pre style={{ margin: "4px 0", color: "#ccc", textAlign: "center", fontSize: "11px" }}>{DIVIDER}</pre>

                    {/* ── Footer ── */}
                    <div style={{ textAlign: "center", fontSize: "10px", color: "#666", marginTop: "4px" }}>
                        <div style={{ fontWeight: "bold" }}>Thank you for ordering!</div>
                        <div style={{ marginTop: "2px" }}>Powered by Zayko ⚡</div>
                        <div style={{ fontSize: "8px", color: "#999", marginTop: "3px" }}>
                            {dateStr} {timeStr} • #{order.orderId}
                        </div>
                    </div>

                    {/* Tear-off visual */}
                    <div
                        style={{
                            marginTop: "12px",
                            borderTop: "2px dashed #ccc",
                            height: "8px",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
