// app/index.tsx (atau app/(tabs)/index.tsx)
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { db } from '/Users/indramec/ReactNative/login/src/firebaseConfig';
import { AuthContext } from '/Users/indramec/ReactNative/login/src/storage/AuthContext';

type Mahasiswa = {
  id: string;
  nim: string;
  nama: string;
  prodi: string;
};

export default function IndexScreen() {
  const { user, loading, login, register, logout } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Memuat...</Text>
      </View>
    );
  }

  // Kalau belum login → tampilkan form login/register
  if (!user) {
    return <AuthScreen onLogin={login} onRegister={register} />;
  }

  // Kalau sudah login → tampilkan fitur data mahasiswa
  return <MahasiswaScreen userEmail={user.email} onLogout={logout} />;
}

// ================== SCREEN LOGIN / REGISTER ==================
type AuthScreenProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
};

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await onLogin(email.trim(), password);
    } catch (e: any) {
      Alert.alert('Login gagal', e.message ?? 'Periksa email/password');
    }
  };

  const handleRegister = async () => {
    try {
      await onRegister(email.trim(), password);
      Alert.alert('Registrasi berhasil', 'Sekarang kamu sudah login.');
    } catch (e: any) {
      Alert.alert('Registrasi gagal', e.message ?? 'Periksa data yang diinput');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login Firebase</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View style={{ marginBottom: 8 }}>
        <Button title="Login" onPress={handleLogin} />
      </View>
      <Button title="Register" onPress={handleRegister} />
    </View>
  );
};

// ================== SCREEN DATA MAHASISWA ==================
type MahasiswaScreenProps = {
  userEmail: string | null;
  onLogout: () => Promise<void>;
};

const MahasiswaScreen: React.FC<MahasiswaScreenProps> = ({ userEmail, onLogout }) => {
  const [nim, setNim] = useState('');
  const [nama, setNama] = useState('');
  const [prodi, setProdi] = useState('');
  const [saving, setSaving] = useState(false);

  const [list, setList] = useState<Mahasiswa[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // === TUGAS 3: Fetch data mahasiswa (real-time listener) ===
  useEffect(() => {
    // referensi koleksi "mahasiswa"
    const colRef = collection(db, 'mahasiswa');

    // query: urutkan berdasarkan NIM
    const q = query(colRef, orderBy('nim', 'asc'));

    // onSnapshot = akan dipanggil setiap kali data berubah
    const unsub = onSnapshot(q, snapshot => {
      const data: Mahasiswa[] = snapshot.docs.map(doc => {
        const d = doc.data() as any;
        return {
          id: doc.id,
          nim: d.nim ?? '',
          nama: d.nama ?? '',
          prodi: d.prodi ?? '',
        };
      });
      setList(data);
      setLoadingList(false);
    });

    // unsubscribe saat component unmount
    return () => unsub();
  }, []);

  // === TUGAS 2: Tambah data mahasiswa ke Firestore ===
  const handleTambah = async () => {
    if (!nim || !nama || !prodi) {
      Alert.alert('Validasi', 'NIM, Nama, dan Prodi wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const colRef = collection(db, 'mahasiswa');
      await addDoc(colRef, {
        nim,
        nama,
        prodi,
      });

      // reset form
      setNim('');
      setNama('');
      setProdi('');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Gagal menambah data mahasiswa');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await onLogout();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Gagal logout');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Data Mahasiswa</Text>
      <Text style={styles.subtitle}>Login sebagai: {userEmail}</Text>

      <View style={{ marginBottom: 8 }}>
        <Button title="Logout" onPress={handleLogout} />
      </View>

      <Text style={{ marginTop: 16, marginBottom: 4, fontWeight: '600' }}>
        Tambah Mahasiswa
      </Text>

      <TextInput
        style={styles.input}
        placeholder="NIM"
        value={nim}
        onChangeText={setNim}
      />
      <TextInput
        style={styles.input}
        placeholder="Nama"
        value={nama}
        onChangeText={setNama}
      />
      <TextInput
        style={styles.input}
        placeholder="Prodi"
        value={prodi}
        onChangeText={setProdi}
      />

      <View style={{ marginBottom: 16 }}>
        <Button
          title={saving ? 'Menyimpan...' : 'Simpan'}
          onPress={handleTambah}
          disabled={saving}
        />
      </View>

      <Text style={{ marginBottom: 8, fontWeight: '600' }}>List Mahasiswa</Text>

      {loadingList ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text>Memuat data mahasiswa...</Text>
        </View>
      ) : list.length === 0 ? (
        <Text>Belum ada data.</Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.nama}</Text>
              <Text>NIM: {item.nim}</Text>
              <Text>Prodi: {item.prodi}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 16, paddingTop: 60, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: { fontWeight: '600', marginBottom: 4 },
});