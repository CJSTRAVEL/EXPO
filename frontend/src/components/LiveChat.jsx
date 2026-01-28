import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { MessageCircle, X, Send, Loader2, ChevronDown, User, Car, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const LiveChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState([]); // Active chats with unread messages
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);

  // Fetch active chats with unread messages
  const fetchActiveChats = async () => {
    try {
      const response = await axios.get(`${API}/api/dispatch/active-chats`);
      const activeChats = response.data || [];
      setChats(activeChats);
      
      // Calculate total unread
      const totalUnread = activeChats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
      
      // Play sound if new unread messages
      if (totalUnread > unreadCount && unreadCount > 0) {
        playNotificationSound();
      }
      
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error("Error fetching active chats:", error);
    }
  };

  // Fetch messages for selected chat
  const fetchMessages = async (bookingId) => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/dispatch/chat/${bookingId}`);
      setMessages(response.data || []);
      
      // Mark as read
      await axios.post(`${API}/api/dispatch/chat/${bookingId}/mark-read`);
      fetchActiveChats(); // Refresh unread count
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    setSending(true);
    try {
      await axios.post(`${API}/api/dispatch/chat/send`, {
        booking_id: selectedChat.booking_id,
        message: newMessage,
        sender_type: "dispatch"
      });
      
      setNewMessage("");
      fetchMessages(selectedChat.booking_id);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  // Delete chat
  const deleteChat = async () => {
    if (!selectedChat) return;
    
    if (!window.confirm(`Delete all messages for ${selectedChat.booking_id_short}?`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/api/dispatch/chat/${selectedChat.booking_id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      toast.success("Chat deleted");
      setSelectedChat(null);
      setMessages([]);
      fetchActiveChats();
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast.error("Failed to delete chat");
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  // Poll for new messages
  useEffect(() => {
    fetchActiveChats();
    const interval = setInterval(fetchActiveChats, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch messages when chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.booking_id);
    }
  }, [selectedChat]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Refresh messages for selected chat periodically
  useEffect(() => {
    if (!selectedChat || !isOpen) return;
    
    const interval = setInterval(() => {
      fetchMessages(selectedChat.booking_id);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [selectedChat, isOpen]);

  return (
    <>
      {/* Notification Sound */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+dnZyam5ydnp+goaGhoaGhoKCfnp2cnJubm5ydnp+goaKio6OjoqGgnpybmpmZmZqbnZ+ho6Slpqalpnx0ZVtVUE5MT05QVFhcYGRnamxxdXl8f4GDhIWFhYWEg4F/fXt5eHd3d3h5e36Bg4WHiYqLi4uKiYeEgX56dnJuamdjX1xZV1VTUlFRUVJTVVdZXGBka29zenqFcmxjW1JJQjw4NTM0Njo/Q0dNUlleZGttcHN2eXx+gIKDhISDg4KBf318enl4d3d3eHp8f4KFh4mLjIyMi4qIhYJ+e3ZyblpVT0lDPjo4Nzc5Oz9DTldqa4FuaGBYUEhAOTQxLy8xNDlASE5WXGJnanBzdnl7foCChIWFhIOCgH98enl4eHh5e36BhIeKjI6PkI+OjIqGg396dnJuamZhXVpXVVRUVFVXWl1hZWxxdIBzb2hgWE9GPjgzMC8wMzg+RU1UW2JpbnJ2eXx+gIKDhISEg4KAfnx6eHd3d3h5fH+DhomMj5GSkpGPjYqGg355dXFtaGRgXFpYV1ZWV1ldYWVrcHWAc25nX1dORj44My8uLzI3PUVNVVxjam9zdnl8f4GDhIWFhIKAf3x6eHd3d3h6fYCEh4qNj5GSkpGPjYqGgn55dXBsaGRgXFpYVlVVVldaXmJnbHJ4gXNuZ19XTkY+ODMvLi8yNz1FTVZdZGtwd3t+gYOFhoaFg4F+e3l3dnd3eXt+goaJjI+RkpKRj42KhoJ9eXRwbGhjX1xZV1VVVVZYXGBkaW90eoFzbWZeVk1FODMvLS4xNjtCSlJaYWdtcnh7fn+BgoODgoF/fXt5eHd3eHp9gISHio2PkZKSkI+NiYWBfHh0cGxoZGBcWlhXV1dYW19jZ21ye4FybGVdVUxEPDUwLC0vMzlASU9XX2Zrc3d6fH6AgoODg4KAf3x6eHd3eHp9gISHi46QkpOTkY+MiYWBfHd0cGxoY19cWVdXV1hbX2Nmam91fIBvamJaUklBOjMuKywtMTY9RU1VXGNpbnR3en1/gYKDg4KBf317eXh4eHl7foGFiIuOkJKTk5GPjImFgXx4dHBsaGReW1lXV1dYW19jZ2xxd36AbmliWVBIPzgyLSoqLDE2PURMVFthZ21zdnh7foCCg4OCgYB+fHp4eHh5e36BhYiLjpCSkpKQj4yJhYF8eHRwbGhjX1xZV1dXWFtfY2dscXh/gG5pYVlQSD84Mi0qKiwxNj1ETFRbYWdtc3Z5fH6AgoODgoGAfnx6eHh4eXt+gYWIi46QkpKSkI+MiYWBfHh0cGxoY19cWVdXV1hbX2NnbHF4f4BuaWFZUEg/ODItKiosL3dz" preload="auto" />

      {/* Floating Chat Button */}
      <div className="fixed bottom-20 right-6 z-50">
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full shadow-lg bg-[#D4A853] hover:bg-[#c49843] text-black relative"
            data-testid="live-chat-btn"
          >
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        )}

        {/* Chat Panel */}
        {isOpen && (
          <div className="bg-white rounded-lg shadow-2xl w-[380px] h-[500px] flex flex-col border border-gray-200 overflow-hidden" data-testid="live-chat-panel">
            {/* Header */}
            <div className="bg-[#1a3a5c] text-white p-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#D4A853]" />
                <span className="font-semibold">Driver Chat</span>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 flex min-h-0">
              {!selectedChat ? (
                // Chat List
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="p-2 border-b bg-gray-50">
                    <p className="text-xs text-gray-500 font-medium">Active Conversations</p>
                  </div>
                  <ScrollArea className="flex-1">
                    {chats.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full p-6 text-gray-400">
                        <MessageCircle className="h-12 w-12 mb-2 opacity-30" />
                        <p className="text-sm">No active chats</p>
                        <p className="text-xs">Driver messages will appear here</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {chats.map((chat) => (
                          <button
                            key={chat.booking_id}
                            onClick={() => setSelectedChat(chat)}
                            className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-start gap-3"
                            data-testid={`chat-item-${chat.booking_id}`}
                          >
                            <div className="h-10 w-10 rounded-full bg-[#1a3a5c] flex items-center justify-center flex-shrink-0">
                              <Car className="h-5 w-5 text-[#D4A853]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm truncate">
                                  {chat.driver_name || "Driver"}
                                </span>
                                {chat.unread_count > 0 && (
                                  <Badge variant="destructive" className="h-5 px-1.5 text-xs ml-2">
                                    {chat.unread_count}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">
                                {chat.booking_id_short || chat.booking_id}
                              </p>
                              {chat.last_message && (
                                <p className="text-xs text-gray-400 truncate mt-0.5">
                                  {chat.last_message}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              ) : (
                // Message View
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Chat Header */}
                  <div className="p-2 border-b bg-gray-50 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedChat(null)}
                      className="h-8 w-8"
                    >
                      <ChevronDown className="h-4 w-4 rotate-90" />
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedChat.driver_name}</p>
                      <p className="text-xs text-gray-500">{selectedChat.booking_id_short}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={deleteChat}
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      title="Delete chat"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-3">
                    {loading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <MessageCircle className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">No messages yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((msg, index) => (
                          <div
                            key={msg.id || index}
                            className={cn(
                              "flex flex-col max-w-[85%] rounded-lg p-2.5",
                              msg.sender_type === "dispatch"
                                ? "ml-auto bg-[#D4A853] text-black"
                                : "mr-auto bg-gray-100"
                            )}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-medium opacity-70">
                                {msg.sender_type === "dispatch" ? "You" : msg.sender_name || "Driver"}
                              </span>
                              <span className="text-[10px] opacity-50">
                                {msg.created_at ? format(new Date(msg.created_at), "HH:mm") : ""}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-2 border-t flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      disabled={sending}
                      className="flex-1 h-9"
                      data-testid="live-chat-input"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      size="icon"
                      className="h-9 w-9 bg-[#D4A853] hover:bg-[#c49843] text-black"
                      data-testid="live-chat-send"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LiveChat;
