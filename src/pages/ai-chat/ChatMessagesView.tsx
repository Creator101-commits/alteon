/**
 * ChatMessagesView — Renders the scrollable list of chat messages
 * with avatar, formatted content, copy buttons, and loading indicator.
 */
import React from "react";
import { Bot, Copy } from "lucide-react";
import { FormattedMessage } from "@/components/ui/FormattedMessage";
import type { ChatMessage } from "./types";

interface ChatMessagesViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesEndRef: React.Ref<HTMLDivElement>;
  copyToClipboard: (text: string) => void;
}

export function ChatMessagesView({
  messages,
  isLoading,
  messagesEndRef,
  copyToClipboard,
}: ChatMessagesViewProps) {
  const chatMessages = messages.filter((msg) => !msg.summaryType);

  return (
    <>
      {chatMessages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.type === "user" ? "justify-end" : "justify-start"} my-2`}
        >
          <div
            className={`flex ${message.type === "user" ? "flex-row-reverse" : "flex-row"} items-start gap-3 max-w-[85%] group`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.type === "user" ? "bg-primary" : "bg-muted"
              }`}
            >
              {message.type === "user" ? (
                <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-primary-foreground" />
              ) : (
                <Bot className="h-4 w-4 text-foreground" />
              )}
            </div>

            {/* Message Content */}
            <div className="flex-1 min-w-0">
              <div
                className={`px-3 py-2 ${
                  message.type === "user"
                    ? "bg-primary/10 text-foreground"
                    : "text-foreground"
                }`}
              >
                {message.type === "user" ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                ) : (
                  <div className="text-sm">
                    <FormattedMessage
                      content={message.content}
                      animated={true}
                      animationSpeed={4}
                    />
                  </div>
                )}
              </div>
              {message.type === "assistant" && (
                <button
                  onClick={() => copyToClipboard(message.content)}
                  className="mt-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy message"
                >
                  <Copy className="h-3 w-3 inline mr-1" />
                  Copy
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex justify-start my-2">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-foreground" />
            </div>
            <div className="px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  Thinking...
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </>
  );
}
