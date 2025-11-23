import {
    getThreadById,
    getUserProfileById,
    MessageDoc,
    sendMessage,
    subscribeToMessages,
    UserProfile,
} from '@/src/services/firebaseService';
import { AuthContext } from '@/src/storage/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type Params = {
  threadId?: string;
};

const formatMessageTime = (value?: Timestamp | null) => {
  if (!value) return '';
  return value.toDate().toLocaleTimeString();
};

export default function ChatRoomScreen() {
  const { threadId } = useLocalSearchParams<Params>();
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList<MessageDoc>>(null);

  const parsedThreadId = typeof threadId === 'string' ? threadId : null;

  useEffect(() => {
    if (!user || !parsedThreadId) return;
    let isMounted = true;

    const unsubscribe = subscribeToMessages(parsedThreadId, (docs) => {
      if (!isMounted) return;
      setMessages(docs);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [parsedThreadId, user]);

  useEffect(() => {
    if (!user || !parsedThreadId) return;
    let isMounted = true;

    const loadMeta = async () => {
      const thread = await getThreadById(parsedThreadId);
      if (!thread || !isMounted) return;
      const otherId = thread.participants.find((id) => id !== user.uid);
      if (!otherId) return;
      const profile = await getUserProfileById(otherId);
      if (isMounted) setOtherUser(profile);
    };

    loadMeta().catch((err) => console.error('Gagal memuat info thread', err));

    return () => {
      isMounted = false;
    };
  }, [parsedThreadId, user]);

  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  const handleSend = async () => {
    if (!user || !parsedThreadId || !inputValue.trim()) {
      return;
    }
    setSending(true);
    try {
      await sendMessage(parsedThreadId, user.uid, inputValue);
      setInputValue('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: MessageDoc }) => {
    const isMine = item.senderId === user?.uid;
    const timeLabel = item.createdAt instanceof Timestamp ? formatMessageTime(item.createdAt) : '';
    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowRight : styles.messageRowLeft]}>
        <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.messageText, isMine && styles.messageTextLight]}>{item.text}</Text>
          <Text style={[styles.messageTime, isMine && styles.messageTimeLight]}>{timeLabel}</Text>
        </View>
      </View>
    );
  };

  if (!parsedThreadId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Thread tidak ditemukan.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{otherUser?.displayName || 'Percakapan'}</Text>
          {otherUser?.email ? <Text style={styles.headerSubtitle}>{otherUser.email}</Text> : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          placeholder="Tulis pesan..."
          placeholderTextColor="#999"
          value={inputValue}
          onChangeText={setInputValue}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputValue.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputValue.trim() || sending}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendButtonText}>Kirim</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#007AFF',
  },
  backButton: {
    marginRight: 12,
    padding: 8,
  },
  backText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#f0f0f0',
    fontSize: 12,
    marginTop: 2,
  },
  messageList: {
    padding: 16,
    paddingBottom: 80,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#111',
  },
  messageTextLight: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#777',
    marginTop: 6,
    textAlign: 'right',
  },
  messageTimeLight: {
    color: '#e0e0e0',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  messageInput: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#666',
    marginBottom: 12,
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
