import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Nota: en móvil (Android emulador) localhost puede ser 10.0.2.2. Usa tu IP local aquí.
const API_URL = 'http://10.0.2.2:3000/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
      navigation.replace('Dashboard');
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Credenciales inválidas");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>GymManager</Text>
        <Text style={styles.subtitle}>Acceso Móvil</Text>
        
        <TextInput 
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput 
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#64748b"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Ingresar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#1e293b', padding: 24, borderRadius: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6', textAlign: 'center', marginBottom: 5 },
  subtitle: { color: '#94a3b8', textAlign: 'center', marginBottom: 24 },
  input: { backgroundColor: '#0f172a', color: '#f1f5f9', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
