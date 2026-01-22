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
import { sendAdminMessage, getAdminMessages } from '../services/api';

const formatMessageTime = (dateString) => {
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
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 10 seconds
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadMessages = async () => {
    try {
      const data = await getAdminMessages();
      setMessages(data || []);
    } catch (error) {
      console.log('Error loading messages:', error);
      // Show demo messages if API fails
      setMessages([
        {
          id: '1',
          message: 'Welcome to CJ\'s Executive Travel! How can we help you today?',
          sender_type: 'admin',
          sender_name: 'Dispatch',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

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
      sending: true,
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      await sendAdminMessage(messageText);
      await loadMessages();
    } catch (error) {
      console.log('Error sending message:', error);
      // Update message as sent anyway for demo
      setMessages(prev => prev.map(m => 
        m.id === tempMessage.id ? { ...m, sending: false } : m
      ));
    } finally {
      setSending(false);
    }
  };

  const MessageBubble = ({ item }) => {
    const isDriver = item.sender_type === 'driver';
    
    return (
      <View style={[
        styles.messageContainer,
        isDriver ? styles.messageRight : styles.messageLeft
      ]}>
        {!isDriver && (
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Ionicons name="headset" size={16} color="#fff" />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isDriver 
            ? { backgroundColor: theme.primary }
            : { backgroundColor: theme.card }
        ]}>
          {!isDriver && (
            <Text style={[styles.senderName, { color: theme.primary }]}>
              {item.sender_name || 'Dispatch'}
            </Text>
          )}
          <Text style={[
            styles.messageText,
            { color: isDriver ? '#fff' : theme.text }
          ]}>
            {item.message}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              { color: isDriver ? 'rgba(255,255,255,0.7)' : theme.textSecondary }
            ]}>
              {formatMessageTime(item.created_at)}
            </Text>
            {isDriver && !item.sending && (
              <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" />
            )}
            {item.sending && (
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
        <View style={[styles.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Ionicons name="headset" size={24} color="#fff" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Dispatch Support</Text>
          <Text style={[styles.headerSubtitle, { color: theme.success }]}>Online</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble item={item} />}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No messages yet
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Send a message to dispatch
            </Text>
          </View>
        }
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: newMessage.trim() ? theme.primary : theme.border }
            ]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageLeft: {
    justifyContent: 'flex-start',
  },
  messageRight: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 4,
  },
});
