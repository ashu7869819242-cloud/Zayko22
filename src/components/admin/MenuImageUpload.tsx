"use client";

import React, { useState, useCallback, useRef } from "react";

/**
 * MenuImageUpload — Drag-and-drop / click-to-upload component for menu images.
 * Converts the image to base64, calls the AI parse endpoint, and passes
 * the parsed results to the parent via onItemsParsed callback.
 */

interface ParsedMenuItem {
    name: string;
    price: number;
    category: "meals" | "snacks" | "beverages" | "desserts" | "other";
}

interface MenuImageUploadProps {
    /** Called when items are successfully parsed from the image */
    onItemsParsed: (items: ParsedMenuItem[]) => void;
    /** Called to close the upload modal */
    onClose: () => void;
}

export default function MenuImageUpload({ onItemsParsed, onClose }: MenuImageUploadProps) {
    const [dragOver, setDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Convert file to base64 and extract MIME type
    const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                // Remove "data:image/jpeg;base64," prefix to get raw base64
                const base64 = dataUrl.split(",")[1];
                resolve({ base64, mimeType: file.type });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // Process the selected/dropped image file
    const processFile = useCallback(async (file: File) => {
        // Validate file type
        if (!file.type.startsWith("image/")) {
            setError("Please upload an image file (JPEG, PNG, etc.)");
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError("Image too large. Maximum size is 10MB.");
            return;
        }

        setError(null);
        setUploading(true);

        try {
            // Show image preview
            const previewUrl = URL.createObjectURL(file);
            setPreview(previewUrl);

            // Convert to base64
            const { base64, mimeType } = await fileToBase64(file);

            // Get admin auth token
            const token = localStorage.getItem("adminToken");

            // Call the AI parse endpoint
            const response = await fetch("/api/admin/menu/parse-image", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ image: base64, mimeType }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to parse menu image");
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                setError("No menu items could be detected in this image. Try a clearer photo.");
                setUploading(false);
                return;
            }

            // Pass parsed items to parent
            onItemsParsed(data.items);
        } catch (err) {
            console.error("Upload error:", err);
            setError(err instanceof Error ? err.message : "Failed to process image");
        } finally {
            setUploading(false);
        }
    }, [onItemsParsed]);

    // Drag & drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zayko-800 border border-zayko-700 rounded-2xl p-6 w-full max-w-lg animate-scale-in">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-display font-bold text-white">
                        🤖 AI Menu Scanner
                    </h3>
                    <button
                        onClick={onClose}
                        disabled={uploading}
                        className="text-zayko-400 hover:text-white transition-colors text-xl"
                    >
                        ✕
                    </button>
                </div>

                <p className="text-zayko-400 text-sm mb-4">
                    Upload a photo of a menu board, paper menu, or screen. Our AI will automatically
                    detect food items, prices, and categories.
                </p>

                {/* Upload Area */}
                {!uploading ? (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver
                                ? "border-gold-400 bg-gold-400/10"
                                : "border-zayko-600 hover:border-zayko-500 hover:bg-zayko-700/50"
                            }`}
                    >
                        {preview ? (
                            <img
                                src={preview}
                                alt="Menu preview"
                                className="max-h-48 mx-auto rounded-lg mb-3 object-contain"
                            />
                        ) : (
                            <div className="text-5xl mb-3">📸</div>
                        )}
                        <p className="text-zayko-300 font-medium">
                            {preview ? "Click to choose a different image" : "Drop menu image here or click to upload"}
                        </p>
                        <p className="text-zayko-500 text-xs mt-1">
                            JPEG, PNG, WebP — Max 10MB
                        </p>
                    </div>
                ) : (
                    /* Loading State */
                    <div className="border-2 border-gold-400/30 rounded-xl p-8 text-center bg-gold-400/5">
                        {preview && (
                            <img
                                src={preview}
                                alt="Processing..."
                                className="max-h-32 mx-auto rounded-lg mb-4 object-contain opacity-60"
                            />
                        )}
                        <div className="flex items-center justify-center gap-3 mb-3">
                            <div className="w-8 h-8 border-3 border-gold-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-gold-400 font-semibold">Analyzing menu...</span>
                        </div>
                        <p className="text-zayko-500 text-xs">
                            AI is extracting items, prices, and categories from your image
                        </p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                />

                {/* Footer */}
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={onClose}
                        disabled={uploading}
                        className="px-4 py-2 bg-zayko-700 text-zayko-300 rounded-xl hover:bg-zayko-600 transition-all text-sm"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
