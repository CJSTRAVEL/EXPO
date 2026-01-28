import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAllDriverChats, getAdminMessages, sendAdminMessage, markChatAsRead } from '../services/api';

const formatMessageTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + 
         date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

export default function AdminChatScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const flatListRef = useRef(null);

  // Load all chats
  const loadChats = async () => {
    try {
      const data = await getAllDriverChats();
      setChats(data || []);
    } catch (error) {
      console.log('Error loading chats:', error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  // Load messages for selected chat
  const loadMessages = async (bookingId) => {
    if (!bookingId) return;
    setLoadingMessages(true);
    try {
      const data = await getAdminMessages(bookingId);
      setMessages(data || []);
      // Mark as read
      await markChatAsRead(bookingId);
      loadChats(); // Refresh unread counts
    } catch (error) {
      console.log('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.booking_id);
      const interval = setInterval(() => loadMessages(selectedChat.booking_id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Optimistically add message
    const tempMessage = {
      id: Date.now().toString(),
      message: messageText,
      sender_type: 'driver',
      sender_name: user?.name || 'Driver',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      await sendAdminMessage(selectedChat.booking_id, messageText);
      await loadMessages(selectedChat.booking_id);
    } catch (error) {
      console.log('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
    } finally {
      setSending(false);
    }
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.chatItem, { backgroundColor: theme.cardBg }]}
      onPress={() => setSelectedChat(item)}
    >
      <View style={[styles.chatAvatar, { backgroundColor: theme.primary }]}>
        <Ionicons name="car" size={20} color={theme.secondary} />
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={[styles.chatName, { color: theme.text }]} numberOfLines={1}>
            {item.booking_id_short}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.chatCustomer, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.customer_name}
        </Text>
        <Text style={[styles.chatPreview, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.last_sender_type === 'driver' ? 'You: ' : 'Dispatch: '}{item.last_message}
        </Text>
      </View>
      <Text style={[styles.chatTime, { color: theme.textSecondary }]}>
        {formatMessageTime(item.last_message_at)}
      </Text>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender_type === 'driver';
    return (
      <View style={[styles.messageRow, isMyMessage ? styles.myMessageRow : styles.theirMessageRow]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? [styles.myBubble, { backgroundColor: theme.secondary }] : [styles.theirBubble, { backgroundColor: theme.cardBg }]
        ]}>
          {!isMyMessage && (
            <Text style={[styles.senderName, { color: theme.primary }]}>
              {item.sender_name || 'Dispatch'}
            </Text>
          )}
          <Text style={[styles.messageText, isMyMessage ? { color: theme.primary } : { color: theme.text }]}>
            {item.message}
          </Text>
          <Text style={[styles.messageTime, isMyMessage ? { color: theme.primary, opacity: 0.7 } : { color: theme.textSecondary }]}>
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading chats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show chat list
  if (!selectedChat) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Text style={[styles.headerTitle, { color: '#fff', flex: 1 }]}>Dispatch Chat</Text>
          <TouchableOpacity 
            style={styles.newChatHeaderButton}
            onPress={() => navigation.navigate('Bookings')}
          >
            <View style={styles.newChatHeaderButtonInner}>
              <Ionicons name="add" size={18} color={theme.primary} />
              <Text style={[styles.newChatHeaderButtonText, { color: theme.primary }]}>New</Text>
            </View>
          </TouchableOpacity>
        </View>
        
        {chats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Active Chats</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Chat with dispatch will appear here when you have active bookings
            </Text>
            <TouchableOpacity 
              style={[styles.newChatActionButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('Bookings')}
            >
              <Ionicons name="car-outline" size={20} color="#fff" />
              <Text style={styles.newChatActionText}>View My Bookings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={chats}
              keyExtractor={(item) => item.booking_id}
              renderItem={renderChatItem}
              contentContainerStyle={styles.chatList}
            />
            {/* Floating New Chat Button */}
            <TouchableOpacity 
              style={[styles.floatingNewChatButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('Bookings')}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    );
  }

  // Show messages for selected chat
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: '#fff' }]}>{selectedChat.booking_id_short}</Text>
            <Text style={[styles.headerSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>
              {selectedChat.customer_name}
            </Text>
          </View>
        </View>

        {/* Messages */}
        {loadingMessages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.secondary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Ionicons name="chatbubble-outline" size={40} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No messages yet. Start the conversation!
                </Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textSecondary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: theme.secondary, opacity: newMessage.trim() ? 1 : 0.5 }]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="send" size={20} color={theme.primary} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
  },
  newChatButton: {
    padding: 4,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  // Chat list styles
  chatList: {
    padding: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    borderRadius: 12,
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatCustomer: {
    fontSize: 13,
    marginTop: 2,
  },
  chatPreview: {
    fontSize: 12,
    marginTop: 4,
  },
  chatTime: {
    fontSize: 11,
    marginLeft: 8,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  newChatActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
    gap: 8,
  },
  newChatActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  // Messages styles
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageRow: {
    marginVertical: 4,
  },
  myMessageRow: {
    alignItems: 'flex-end',
  },
  theirMessageRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  // Input styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
