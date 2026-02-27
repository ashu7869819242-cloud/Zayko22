/**
 * InvoiceModal — A4-optimized printable invoice for admin panel.
 *
 * Opens a full-screen modal showing the invoice. Clicking "Print" triggers
 * the browser's native print dialog, which uses @media print CSS to show
 * only the invoice content.
 */

"use client";
import React from "react";

interface OrderItem {
    name: string;
    price: number;
    quantity: number;
}

interface InvoiceOrder {
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

interface InvoiceModalProps {
    order: InvoiceOrder;
    onClose: () => void;
}

export default function InvoiceModal({ order, onClose }: InvoiceModalProps) {
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            {/* Close area */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Invoice container */}
            <div className="relative z-10 w-full max-w-[210mm] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl mx-4">
                {/* Action buttons (hidden on print) */}
                <div className="no-print flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
                    <h2 className="font-bold text-lg text-gray-800">Invoice Preview</h2>
                    <div className="flex gap-3">
                        <button
                            onClick={handlePrint}
                            className="px-5 py-2.5 bg-zayko-500 text-white rounded-xl font-semibold text-sm hover:bg-zayko-600 transition-all flex items-center gap-2"
                        >
                            🖨️ Print Invoice
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-300 transition-all"
                        >
                            ✕ Close
                        </button>
                    </div>
                </div>

                {/* Printable Invoice Area */}
                <div className="invoice-print-area p-8 sm:p-12" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {/* Header */}
                    <div className="text-center mb-8 pb-6 border-b-2 border-gray-800">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-wide">Zayko</h1>
                        <p className="text-sm text-gray-600 mt-1 font-medium">Order Smart. Eat Fresh.</p>
                        <p className="text-xs text-gray-400 mt-2">Tax Invoice / Receipt</p>
                    </div>

                    {/* Order Info Grid */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Order ID</p>
                            <p className="text-lg font-bold text-gray-900 font-mono">#{order.orderId}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Order Date & Time</p>
                            <p className="text-sm font-medium text-gray-800">
                                {new Date(order.createdAt).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </p>
                            <p className="text-sm text-gray-600">
                                {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                })}
                            </p>
                        </div>
                    </div>

                    {/* Student Details */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-8 border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Student Details</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-xs text-gray-500">Name</p>
                                <p className="text-sm font-semibold text-gray-800">{order.userName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Roll Number</p>
                                <p className="text-sm font-semibold text-gray-800">{order.userRollNumber || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Email</p>
                                <p className="text-sm text-gray-700">{order.userEmail}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Payment Mode</p>
                                <p className="text-sm font-semibold text-gray-800">{order.paymentMode || "Wallet"}</p>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-8">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-gray-800">
                                    <th className="text-left py-2 font-semibold text-gray-700 uppercase text-xs tracking-wider">#</th>
                                    <th className="text-left py-2 font-semibold text-gray-700 uppercase text-xs tracking-wider">Item</th>
                                    <th className="text-center py-2 font-semibold text-gray-700 uppercase text-xs tracking-wider">Qty</th>
                                    <th className="text-right py-2 font-semibold text-gray-700 uppercase text-xs tracking-wider">Price</th>
                                    <th className="text-right py-2 font-semibold text-gray-700 uppercase text-xs tracking-wider">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-200">
                                        <td className="py-2.5 text-gray-600">{idx + 1}</td>
                                        <td className="py-2.5 font-medium text-gray-800">{item.name}</td>
                                        <td className="py-2.5 text-center text-gray-700">{item.quantity}</td>
                                        <td className="py-2.5 text-right text-gray-700">₹{item.price.toFixed(2)}</td>
                                        <td className="py-2.5 text-right font-semibold text-gray-800">₹{(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-800">
                                    <td colSpan={4} className="py-3 text-right font-bold text-gray-900 uppercase text-sm">Total Amount</td>
                                    <td className="py-3 text-right font-bold text-lg text-gray-900">₹{order.total.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Order Meta */}
                    <div className="grid grid-cols-3 gap-4 mb-10 bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div>
                            <p className="text-xs text-gray-500">Status</p>
                            <p className="text-sm font-semibold text-gray-800 capitalize">{order.status}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Prep Time</p>
                            <p className="text-sm font-semibold text-gray-800">{order.prepTime ? `${order.prepTime} min` : "TBD"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Payment</p>
                            <p className="text-sm font-semibold text-emerald-700">✅ Paid via {order.paymentMode || "Wallet"}</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center pt-6 border-t border-gray-300">
                        <p className="text-xs text-gray-400 italic">This is a computer-generated invoice and does not require a signature.</p>
                        <p className="text-xs text-gray-400 mt-1">Zayko • Order Smart. Eat Fresh.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
