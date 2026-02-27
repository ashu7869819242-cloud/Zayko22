"use client";
import React from "react";

interface ChatBubbleProps {
    role: "user" | "assistant";
    content: string;
    timestamp?: string;
}

export default function ChatBubble({ role, content, timestamp }: ChatBubbleProps) {
    const isUser = role === "user";

    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 animate-slide-up`}>
            <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[70%] ${isUser ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${isUser
                            ? "bg-zayko-500 text-white"
                            : "bg-gradient-to-br from-gold-400 to-gold-500 text-zayko-900"
                        }`}
                >
                    {isUser ? "👤" : "🤖"}
                </div>

                {/* Message */}
                <div
                    className={`px-4 py-3 rounded-2xl ${isUser
                            ? "bg-zayko-500 text-white rounded-br-md"
                            : "bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm"
                        }`}
                >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                    {timestamp && (
                        <p className={`text-xs mt-1 ${isUser ? "text-zayko-200" : "text-gray-400"}`}>
                            {timestamp}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
