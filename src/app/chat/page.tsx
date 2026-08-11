"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

import { useUser } from "@clerk/nextjs";

import {
  Plus,
  ArrowUp,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Trash2,
  MessageSquare,
} from "lucide-react";

type Chat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
};

function Avatar({
  role,
  user,
}: {
  role: "user" | "ai";
  user?: {
    imageUrl?: string;
    fullName?: string | null;
    firstName?: string | null;
    emailAddresses?: { emailAddress: string }[];
  };
}) {
  if (role === "ai") {
    return (
      <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br from-purple-400 via-violet-400 to-teal-300 flex items-center justify-center shadow-lg">
        <Sparkles className="w-4 h-4 text-zinc-950" strokeWidth={2.5} />
      </div>
    );
  }

  const name =
    user?.fullName ||
    user?.firstName ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "User";

  const initial = name.charAt(0).toUpperCase();

  if (user?.imageUrl) {
    return (
      <img
        src={user.imageUrl}
        alt={name}
        className="w-8 h-8 shrink-0 rounded-xl object-cover border border-zinc-700"
      />
    );
  }

  return (
    <div className="w-8 h-8 shrink-0 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-semibold text-zinc-300">
      {initial}
    </div>
  );
}

function MessageBubble({
  msg,
  delay,
  user,
}: {
  msg: Message;
  delay: number;
  user?: any;
}) {
  const isUser = msg.role === "USER";

  return (
    <div
      className={`msg-fade flex gap-3 max-w-2xl ${
        isUser ? "ml-auto flex-row-reverse" : ""
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Avatar role={isUser ? "user" : "ai"} user={user} />

      <div
        className={`px-4 py-3 text-base leading-relaxed rounded-2xl ${
          isUser
            ? "bg-gradient-to-br from-purple-500 to-violet-600 text-white rounded-tr-sm shadow-lg"
            : "bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-tl-sm"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function AISmartChat() {
  const { user } = useUser();

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [typing, setTyping] = useState(false);

  const [loadingChats, setLoadingChats] = useState(true);

  const [loadingMessages, setLoadingMessages] = useState(false);

  const [search, setSearch] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ------------------------------------------------------------
  // Scroll to bottom
  // ------------------------------------------------------------

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  // ------------------------------------------------------------
  // Load user's chats
  // ------------------------------------------------------------

  const loadChats = useCallback(async () => {
    try {
      setLoadingChats(true);

      const response = await fetch("/api/chats");

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load chats");
      }

      setChats(data.chats || []);
    } catch (error) {
      console.error("Load chats error:", error);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // ------------------------------------------------------------
  // Load messages for selected chat
  // ------------------------------------------------------------

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      setLoadingMessages(true);

      const response = await fetch(`/api/chats/${chatId}/messages`);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load messages");
      }

      setMessages(data.messages || []);
    } catch (error) {
      console.error("Load messages error:", error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    loadMessages(selectedChatId);
  }, [selectedChatId, loadMessages]);

  // ------------------------------------------------------------
  // Create new chat
  // ------------------------------------------------------------

  const handleNewChat = () => {
    // Just start a fresh conversation in the UI.
    // Do not create an empty chat in the database.

    setSelectedChatId(null);
    setMessages([]);
    setInput("");
    setTyping(false);
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not delete chat");
      }

      // Remove from sidebar immediately
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));

      // If this was the currently open chat,
      // switch to an empty conversation.
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
        setMessages([]);
        setInput("");
      }
    } catch (error) {
      console.error("Delete chat error:", error);
    }
  };

  // ------------------------------------------------------------
  // Send message
  // ------------------------------------------------------------

  const handleSend = async () => {
    const content = input.trim();

    if (!content || typing) return;

    let chatId = selectedChatId;
    let isNewChat = false;

    try {
      setTyping(true);

      // -----------------------------------------
      // Create chat ONLY when first message is sent
      // -----------------------------------------
      if (!chatId) {
        const createResponse = await fetch("/api/chats", {
          method: "POST",
        });

        const createData = await createResponse.json();

        if (!createResponse.ok || !createData.success) {
          throw new Error(createData.message || "Could not create chat");
        }

        chatId = createData.chat.id;
        isNewChat = true;

        setChats((prev) => [createData.chat, ...prev]);
      }

      // -----------------------------------------
      // Optimistic user message
      // -----------------------------------------
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "USER",
        content,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setInput("");

      // -----------------------------------------
      // Send message to API
      // -----------------------------------------
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not send message");
      }

      // -----------------------------------------
      // Replace optimistic message with
      // actual database messages
      // -----------------------------------------
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== optimisticMessage.id),
        data.userMessage,
        data.assistantMessage,
      ]);

      // NOW select the chat
      setSelectedChatId(chatId);

      // Refresh sidebar
      await loadChats();
    } catch (error) {
      console.error("Send message error:", error);

      // Remove optimistic message if sending failed
      setMessages((prev) =>
        prev.filter((message) => !message.id.startsWith("temp-")),
      );
    } finally {
      setTyping(false);
    }
  };

  // ------------------------------------------------------------
  // Keyboard
  // ------------------------------------------------------------

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ------------------------------------------------------------
  // Search chats
  // ------------------------------------------------------------

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(search.toLowerCase()),
  );

  // ------------------------------------------------------------
  // Format chat date
  // ------------------------------------------------------------

  const formatChatTime = (dateString: string) => {
    const date = new Date(dateString);

    const now = new Date();

    const today = date.toDateString() === now.toDateString();

    if (today) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const yesterday = new Date();

    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    const diff = now.getTime() - date.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 7) {
      return `${days} days ago`;
    }

    return date.toLocaleDateString();
  };

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  return (
    <div className="relative w-full h-screen overflow-hidden bg-zinc-950 text-zinc-100 flex">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes blobFloat1 {
          0%,100% {
            transform: translate(0,0) scale(1);
          }

          50% {
            transform: translate(30px,-20px) scale(1.08);
          }
        }

        @keyframes blobFloat2 {
          0%,100% {
            transform: translate(0,0) scale(1);
          }

          50% {
            transform: translate(-20px,30px) scale(1.1);
          }
        }

        @keyframes bounceDot {
          0%,80%,100% {
            transform: translateY(0);
            opacity:0.4;
          }

          40% {
            transform: translateY(-4px);
            opacity:1;
          }
        }

        .msg-fade {
          opacity: 0;
          animation: fadeInUp 0.5s ease forwards;
        }

        .blob-1 {
          animation: blobFloat1 14s ease-in-out infinite;
        }

        .blob-2 {
          animation: blobFloat2 16s ease-in-out infinite;
        }

        .dot-bounce-0 {
          animation: bounceDot 1.2s ease-in-out 0s infinite;
        }

        .dot-bounce-1 {
          animation: bounceDot 1.2s ease-in-out 0.15s infinite;
        }

        .dot-bounce-2 {
          animation: bounceDot 1.2s ease-in-out 0.3s infinite;
        }

        .chat-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .chat-scroll::-webkit-scrollbar-thumb {
          background: rgb(51 65 85);
          border-radius: 999px;
        }
      `}</style>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob-1 absolute -top-24 -left-20 w-[28rem] h-[28rem] rounded-full bg-purple-500 opacity-20 blur-3xl" />

        <div className="blob-2 absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-teal-400 opacity-15 blur-3xl" />

        <div
          className="blob-1 absolute top-1/3 left-1/4 w-72 h-72 rounded-full bg-fuchsia-500 opacity-10 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
      </div>

      {/* ------------------------------------------------------ */}
      {/* Sidebar */}
      {/* ------------------------------------------------------ */}

      <aside
        className={`relative z-20 h-full shrink-0 border-r border-zinc-100/10 bg-zinc-900/40 backdrop-blur-2xl flex flex-col transition-all duration-300 shadow-2xl shadow-black/40 ${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        {/* subtle top glow accent */}
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-40 bg-purple-500/20 blur-3xl rounded-full" />

        {/* New chat */}
        <div className="relative p-4 border-b border-zinc-100/10">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-purple-500/90 to-violet-600/90 hover:from-purple-500 hover:to-violet-600 border border-white/10 text-base py-2.5 font-medium text-white shadow-lg shadow-purple-500/20 transition-all duration-200 hover:shadow-purple-500/40 hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-4 h-4" />
            New chat
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md focus-within:border-purple-400/50 transition-colors duration-200">
            <Search className="w-3 h-3 text-zinc-500" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions..."
              className="w-full bg-transparent outline-none text-sm text-zinc-300 placeholder-zinc-500"
            />
          </div>
        </div>

        {/* Sessions */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 chat-scroll">
          <div className="text-sm font-mono uppercase tracking-widest text-zinc-600 px-3 pb-2 pt-1">
            Sessions
          </div>

          {loadingChats ? (
            <div className="px-3 py-4 text-sm text-zinc-500">
              Loading chats...
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="px-3 py-4 text-sm text-zinc-500">
              No conversations yet.
            </div>
          ) : (
            filteredChats.map((chat) => {
              const active = chat.id === selectedChatId;

              return (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`relative w-full text-left group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 overflow-hidden ${
                    active
                      ? "bg-white/[0.07] border border-white/10 shadow-lg shadow-purple-500/10"
                      : "hover:bg-white/[0.04] border border-transparent hover:translate-x-0.5"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-purple-400 to-teal-300" />
                  )}

                  <MessageSquare className="w-3 h-3 mt-1 text-zinc-500 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-base truncate ${
                        active ? "text-zinc-100" : "text-zinc-400"
                      }`}
                    >
                      {chat.title}
                    </div>

                    <div className="text-sm font-mono text-zinc-600 mt-0.5">
                      {formatChatTime(chat.updatedAt)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(chat.id);
                    }}
                    className="p-1 rounded-md text-zinc-600 hover:text-red-400 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                    title="Delete chat"
                    aria-label={`Delete ${chat.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* User */}
        <div className="relative p-3 border-t border-zinc-100/10 flex items-center gap-2 bg-white/[0.02]">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-teal-300 ring-2 ring-white/10 shadow-lg shadow-purple-500/20" />
          )}

          <div className="min-w-0">
            <div className="text-base text-zinc-200 truncate">
              {user?.fullName || user?.firstName || "User"}
            </div>

            <div className="text-sm font-mono text-teal-400">
              workspace synced
            </div>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------ */}
      {/* Main */}
      {/* ------------------------------------------------------ */}

      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="relative shrink-0 flex items-center justify-between px-6 py-4 border-b border-zinc-100/10 bg-zinc-900/40 backdrop-blur-2xl shadow-lg shadow-black/20">
          {/* gradient underline accent */}
          <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="text-zinc-500 hover:text-zinc-200 transition-all duration-200 hover:scale-110 active:scale-95"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeftOpen className="w-5 h-5" />
              )}
            </button>

            <div>
              <div className="text-sm font-mono uppercase tracking-widest text-teal-400">
                Talk it through
              </div>

              <h1 className="text-lg font-semibold bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-300 bg-clip-text text-transparent leading-tight">
                AI Smart Chat
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-sm font-mono text-zinc-400 shadow-inner">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-400" />
            </span>
            AI connected
          </div>
        </header>

        {/* -------------------------------------------------- */}
        {/* Messages */}
        {/* -------------------------------------------------- */}

        <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
            {loadingMessages ? (
              <div className="text-center text-base text-zinc-500 py-10">
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 via-violet-400 to-teal-300 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-zinc-950" />
                </div>

                <h2 className="text-xl font-semibold text-zinc-200">
                  Start a conversation
                </h2>

                <p className="text-base text-zinc-500 mt-2">
                  Ask anything and your conversation will be saved
                  automatically.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  msg={message}
                  delay={index * 60}
                  user={user}
                />
              ))
            )}

            {typing && (
              <div className="flex gap-3 max-w-2xl">
                <Avatar role="ai" />

                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-zinc-800 border border-zinc-700 flex items-center gap-1.5">
                  <span className="dot-bounce-0 w-1.5 h-1.5 rounded-full bg-zinc-400" />

                  <span className="dot-bounce-1 w-1.5 h-1.5 rounded-full bg-zinc-400" />

                  <span className="dot-bounce-2 w-1.5 h-1.5 rounded-full bg-zinc-400" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* -------------------------------------------------- */}
        {/* Input */}
        {/* -------------------------------------------------- */}

        <div className="shrink-0 px-6 pb-6 pt-2">
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-end gap-2 rounded-2xl bg-zinc-800 border border-zinc-700 px-3 py-2 shadow-lg focus-within:border-purple-400 transition-colors">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message AI Smart Chat..."
                disabled={typing}
                className="flex-1 bg-transparent resize-none outline-none text-base text-zinc-100 placeholder-zinc-500 py-2 max-h-32 disabled:opacity-50"
              />

              <button
                onClick={handleSend}
                disabled={!input.trim() || typing}
                className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-teal-400 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shadow-lg"
              >
                <ArrowUp className="w-4 h-4 text-zinc-950" strokeWidth={2.5} />
              </button>
            </div>

            <div className="text-center text-sm font-mono text-zinc-600 mt-2">
              Conversations are securely saved to your workspace
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
