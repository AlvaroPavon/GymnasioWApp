import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert, ScrollView, Image } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://10.0.2.2:3000/api';

export default function DashboardScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const token = await AsyncStorage.getItem('token');
    const userData = await AsyncStorage.getItem('user');
    if (token && userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchData(parsedUser.role);
    } else {
      navigation.replace('Login');
    }
  };

  const fetchData = async (role) => {
    try {
      const resClasses = await axios.get(`${API_URL}/classes`);
      setClasses(resClasses.data);
      if (role === 'ADMIN') {
        const resUsers = await axios.get(`${API_URL}/users`);
        setUsers(resUsers.data);
      }
    } catch (error) {
      console.log('Error fetching data', error);
    }
  };

  const handleReservation = async (classId, isReserved) => {
    const endpoint = isReserved ? 'cancel' : 'reserve';
    try {
      await axios.post(`${API_URL}/classes/${classId}/${endpoint}`);
      Alert.alert("Éxito", isReserved ? "Reserva cancelada" : "Reserva confirmada");
      fetchData(user.role);
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Operación fallida");
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    navigation.replace('Login');
  };

  const renderClass = ({ item }) => {
    const isFull = (item._count?.reservations || 0) >= item.max_capacity;
    const myReservation = item.reservations?.find(r => r.user.id === user.id);
    const isReservedByMe = !!myReservation;

    return (
      <View style={styles.classCard}>
        {item.image_url && (
          <Image source={{uri: item.image_url}} style={{width: '100%', height: 120, borderRadius: 8, marginBottom: 10}} />
        )}
        <View style={styles.header}>
          <Text style={styles.classTitle}>{item.title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item._count?.reservations || 0}/{item.max_capacity}</Text>
          </View>
        </View>
        
        <Text style={styles.details}>
          {new Date(item.start_time).toLocaleString()}
        </Text>

        {user?.role === 'TEACHER' && (
          <View style={styles.teacherView}>
            <Text style={{color: '#fff', fontWeight:'bold', marginBottom:5}}>Alumnos:</Text>
            {item.reservations?.map(r => (
              <View key={r.user.id} style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                {r.user.profile_picture ? (
                  <Image source={{uri: r.user.profile_picture}} style={{width: 24, height: 24, borderRadius: 12, marginRight: 8}} />
                ) : (
                  <View style={{width: 24, height: 24, borderRadius: 12, backgroundColor: '#3b82f6', marginRight: 8, justifyContent:'center', alignItems:'center'}}>
                    <Text style={{color:'white', fontSize: 10, fontWeight:'bold'}}>{r.user.name.charAt(0)}</Text>
                  </View>
                )}
                <Text style={{color: '#94a3b8'}}>{r.user.name}</Text>
              </View>
            ))}
          </View>
        )}
        
        {user?.role === 'CLIENT' && new Date(item.start_time) >= new Date() && (
          <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
            {isReservedByMe ? (
              <TouchableOpacity 
                style={[styles.btn, {backgroundColor: '#f43f5e'}]} 
                onPress={() => handleReservation(item.id, true)}
              >
                <Text style={styles.btnText}>Cancelar Reserva</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.btn, isFull ? {backgroundColor: '#475569'} : {backgroundColor: '#3b82f6'}]} 
                onPress={() => handleReservation(item.id, false)}
                disabled={isFull}
              >
                <Text style={styles.btnText}>{isFull ? 'Aforo Completo' : 'Reservar Plaza'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderAdminView = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Usuarios del Gym</Text>
      {users.map(u => (
        <View key={u.id} style={styles.classCard}>
          <Text style={styles.classTitle}>{u.name}</Text>
          <Text style={{color:'#94a3b8'}}>{u.email} - Rol: {u.role}</Text>
        </View>
      ))}
    </ScrollView>
  );

  const now = new Date();
  const displayClasses = classes.filter(c => {
    const d = new Date(c.start_time);
    return tab === 'upcoming' ? d >= now : d < now;
  });

  return (
    <View style={styles.container}>
      <View style={styles.topNav}>
        <Text style={styles.headerTitle}>Activo: {user?.role}</Text>
        <TouchableOpacity onPress={logout}><Text style={styles.logout}>Salir</Text></TouchableOpacity>
      </View>
      
      {user?.role === 'ADMIN' ? renderAdminView() : (
        <>
          {(user?.role === 'TEACHER' || user?.role === 'CLIENT') && (
            <View style={{flexDirection: 'row', padding: 20, paddingBottom: 0}}>
              <TouchableOpacity onPress={() => setTab('upcoming')} style={{flex: 1, padding: 10, borderBottomWidth: 2, borderBottomColor: tab==='upcoming'?'#3b82f6':'transparent'}}>
                <Text style={{color:'white', textAlign:'center', fontWeight:'bold'}}>Futuras</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTab('past')} style={{flex: 1, padding: 10, borderBottomWidth: 2, borderBottomColor: tab==='past'?'#f43f5e':'transparent'}}>
                <Text style={{color:'white', textAlign:'center', fontWeight:'bold'}}>Pasadas (Historial)</Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={displayClasses}
            keyExtractor={item => item.id.toString()}
            renderItem={renderClass}
            contentContainerStyle={{ padding: 20 }}
            refreshing={false}
            onRefresh={() => fetchData(user.role)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 40, backgroundColor: '#1e293b' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', margin: 20 },
  logout: { color: '#f43f5e', fontSize: 16 },
  classCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 16, marginHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  classTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  badge: { backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#10b981', fontWeight: 'bold' },
  details: { color: '#94a3b8', marginBottom: 6 },
  teacherView: { marginTop: 10, padding: 10, backgroundColor: '#0f172a', borderRadius: 8 },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold' }
});
