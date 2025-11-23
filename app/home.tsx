import {
    getUserProfileById,
    startDirectThreadByEmail,
    subscribeToThreads,
    ThreadDoc,
    UserProfile,
} from '@/src/services/firebaseService';
import { AuthContext } from '@/src/storage/AuthContext';
import { useRouter } from 'expo-router';
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

type ThreadListItem = ThreadDoc & { otherUser?: UserProfile | null };

const formatTimestamp = (value?: Timestamp | null) => {
  if (!value) return '';
  return value.toDate().toLocaleTimeString();
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useContext(AuthContext);
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [startingChat, setStartingChat] = useState(false);
  const profileCache = useRef<Record<string, UserProfile>>({});

  useEffect(() => {
    if (!user) {
      setThreads([]);
      return;
    }

    profileCache.current = {};
    let isMounted = true;
    setLoadingThreads(true);

    const fetchProfile = async (uid: string) => {
      if (profileCache.current[uid]) return profileCache.current[uid];
      const profile = await getUserProfileById(uid);
      if (profile) {
        profileCache.current[uid] = profile;
      }
      return profile;
    };

    const hydrateThreads = async (docs: ThreadDoc[]) => {
      const enriched: ThreadListItem[] = [];
      for (const thread of docs) {
        const otherId = thread.participants.find((id) => id !== user.uid) || user.uid;
        let otherProfile: UserProfile | null = null;
        if (otherId === user.uid) {
          otherProfile = {
            uid: user.uid,
            email: user.email,
            emailLower: user.email ? user.email.toLowerCase() : null,
            displayName: user.displayName,
          } as UserProfile;
        } else {
          otherProfile = await fetchProfile(otherId);
        }
        enriched.push({ ...thread, otherUser: otherProfile });
      }
      if (isMounted) {
        setThreads(enriched);
        setLoadingThreads(false);
      }
    };

    const unsubscribe = subscribeToThreads(user.uid, (docs) => {
      hydrateThreads(docs).catch((err) => console.error('Gagal memuat thread', err));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user]);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Apakah Anda yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('login' as any);
        },
      },
    ]);
  };

  const handleStartChat = async () => {
    if (!user) {
      Alert.alert('Error', 'Silakan login terlebih dahulu');
      return;
    }
    if (!newChatEmail.trim()) {
      Alert.alert('Error', 'Email lawan bicara wajib diisi');
      return;
    }
    setStartingChat(true);
    try {
      const { thread } = await startDirectThreadByEmail(user, newChatEmail);
      setNewChatEmail('');
      router.push({ pathname: 'chat/[threadId]', params: { threadId: thread.id } });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Gagal memulai chat');
    } finally {
      setStartingChat(false);
    }
  };

  const renderThread = ({ item }: { item: ThreadListItem }) => {
    const otherName = item.otherUser?.displayName || 'Teman';
    const lastMessage = item.lastMessage || 'Belum ada pesan';
    const updatedAt = item.updatedAt instanceof Timestamp ? formatTimestamp(item.updatedAt) : '';

    return (
      <TouchableOpacity
        style={styles.threadCard}
        onPress={() => router.push({ pathname: 'chat/[threadId]', params: { threadId: item.id } })}
      >
        <View style={styles.threadHeader}>
          <Text style={styles.threadName}>{otherName}</Text>
          {updatedAt ? <Text style={styles.threadTime}>{updatedAt}</Text> : null}
        </View>
        <Text style={styles.threadLastMessage} numberOfLines={1}>
          {lastMessage}
        </Text>
      </TouchableOpacity>
    );
  };

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Silakan login untuk mulai chat.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MeChat</Text>
          <Text style={styles.headerSubtitle}>{user.displayName}</Text>
          <Text style={styles.headerSubtitleSmall}>{user.email || '-'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.newChatContainer}>
        <Text style={styles.sectionTitle}>Mulai chat baru</Text>
        <View style={styles.newChatRow}>
          <TextInput
            style={styles.input}
            placeholder="Masukkan email orang lain"
            placeholderTextColor="#999"
            value={newChatEmail}
            onChangeText={setNewChatEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.startChatButton, startingChat && styles.buttonDisabled]}
            onPress={handleStartChat}
            disabled={startingChat}
          >
            {startingChat ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startChatText}>Mulai</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loadingThreads ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Memuat chat...</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={threads.length ? styles.listContainer : styles.emptyContainer}
          renderItem={renderThread}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Belum ada chat. Mulai chat baru di atas.</Text>
          }
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#145E29D3',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 4,
  },
  headerSubtitleSmall: {
    fontSize: 12,
    color: '#f0f0f0',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
  },
  newChatContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  newChatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#f7f7f7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
    color: '#333',
  },
  startChatButton: {
    backgroundColor: '#0CAC39DF',
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startChatText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  listContainer: {
    padding: 20,
  },
  threadCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  threadName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  threadTime: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  threadLastMessage: {
    color: '#555',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
  },
});
