import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://10.0.2.2:3000/api';

export default function DashboardScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const token = await AsyncStorage.getItem('token');
    const userData = await AsyncStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchClasses();
    } else {
      navigation.replace('Login');
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await axios.get(`${API_URL}/classes`);
      setClasses(res.data);
    } catch (error) {
      console.log('Error fetching classes', error);
    }
  };

  const reserveClass = async (classId) => {
    try {
      await axios.post(`${API_URL}/classes/${classId}/reserve`);
      Alert.alert("Éxito", "Reserva confirmada");
      fetchClasses();
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "No se pudo reservar");
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    navigation.replace('Login');
  };

  const renderClass = ({ item }) => (
    <View style={styles.classCard}>
      <View style={styles.header}>
        <Text style={styles.classTitle}>{item.title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item._count?.reservations || 0}/{item.max_capacity}</Text>
        </View>
      </View>
      <Text style={styles.details}>Profesor: {item.teacher?.name}</Text>
      
      {user?.role === 'CLIENT' && (
        <TouchableOpacity 
          style={styles.reserveBtn} 
          onPress={() => reserveClass(item.id)}
        >
          <Text style={styles.reserveText}>Reservar</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topNav}>
        <Text style={styles.headerTitle}>Hola, {user?.name}</Text>
        <TouchableOpacity onPress={logout}><Text style={styles.logout}>Salir</Text></TouchableOpacity>
      </View>
      <FlatList
        data={classes}
        keyExtractor={item => item.id.toString()}
        renderItem={renderClass}
        contentContainerStyle={{ padding: 20 }}
        refreshing={false}
        onRefresh={fetchClasses}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 40, backgroundColor: '#1e293b' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  logout: { color: '#f43f5e', fontSize: 16 },
  classCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  classTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  badge: { backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#10b981', fontWeight: 'bold' },
  details: { color: '#94a3b8', marginBottom: 16 },
  reserveBtn: { backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  reserveText: { color: 'white', fontWeight: 'bold' }
});
