import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { getApiBaseUrl } from '../api/config';
import { connectRealtime } from '../api/realtime';
import { openPrivacyPolicy } from '../utils/privacyPolicy';
import { prepareClassTypeImageAsset } from '../utils/classTypeImageUpload';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  activeMembership,
  canCancelReservation,
  canValidate,
  canViewParticipantIdentities,
  capOf,
  dateInput,
  endOf,
  expiryOf,
  filterActivities,
  formatDate as fmtDate,
  formatDateTime as fmt,
  getWeekDays,
  imgOf,
  imageOverrideOf,
  isPastClass,
  nearestClassDate,
  pad,
  RESERVATION_STATUS_OPTIONS,
  reservationFor,
  reservationLabel,
  reservationStatus,
  shiftDays,
  startOf,
  statusOf,
  teacherOf,
  toIso as iso,
  typeOf,
  withExplicitImageOverride
} from '../utils/activityCalendar';
import {
  ActivityCard,
  ActivityMessage,
  ActivitySegments,
  ActivitySiteRow,
  ActivityWeekStrip
} from '../components/activities/ActivityCalendar';

const COPYRIGHT_TEXT = 'Creada por Álvaro Pavón. Derechos reservados.';

const ROLES = { ADMIN: 'Administrador', TEACHER: 'Profesor', CLIENT: 'Cliente' };
const roleTabs = {
  ADMIN: [['classes', 'Clases'], ['users', 'Usuarios'], ['payments', 'Pagos'], ['images', 'Imágenes'], ['settings', 'Ajustes'], ['stats', 'Métricas']],
  TEACHER: [['classes', 'Mis clases']],
  CLIENT: [['classes', 'Reservas']]
};
const url = (path) => `${getApiBaseUrl()}${path}`;
const errorText = (e, fallback) => e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || fallback;
const nextHourForm = () => {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { title: '', description: '', type: '', teacher: '', cap: '12', start: dateInput(start), end: dateInput(end), image: '' };
};
const emptyUser = () => ({ name: '', email: '', password: '', role: 'CLIENT', monthly: 'IMPAGADO', expires: '', phone: '', photo: '' });

function Input({ label, value, onChangeText, keyboardType, secureTextEntry, multiline, placeholder }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.area]}
        placeholder={placeholder || label}
        placeholderTextColor="#64748b"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        blurOnSubmit={false}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}
function Btn({ title, onPress, tone = 'blue', disabled }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.btn, styles[`btn_${tone}`], disabled && styles.disabled]}><Text style={[styles.btnText, (tone === 'yellow' || tone === 'light') && styles.dark]}>{title}</Text></TouchableOpacity>;
}
function Chip({ text, onPress }) {
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.chip}><Text style={styles.chipText}>{text}</Text></TouchableOpacity>;
}

function Sheet({ visible, title, onClose, children, compact = false, insets, bottomInset }) {
  const safeTop = (insets?.top || 0) + 12;
  const safeBottom = bottomInset || 16;
  const SheetContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <SheetContainer
        {...(Platform.OS === 'ios' ? { behavior: 'padding' } : {})}
        style={[styles.modalOverlay, { paddingTop: safeTop, paddingBottom: safeBottom }]}
      >
        <Pressable accessibilityLabel="Cerrar panel" style={styles.backdropPressable} onPress={onClose} />
        <View style={[styles.sheet, compact && styles.sheetCompact]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity accessibilityLabel="Cerrar" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>X</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.sheetBody, { paddingBottom: safeBottom + 18 }]}
          >
            {children}
          </ScrollView>
        </View>
      </SheetContainer>
    </Modal>
  );
}

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [types, setTypes] = useState([]);
  const [images, setImages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('classes');
  const [menuOpen, setMenuOpen] = useState(false);
  const [classFormOpen, setClassFormOpen] = useState(false);
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [imageFormOpen, setImageFormOpen] = useState(false);
  const [settingsFormOpen, setSettingsFormOpen] = useState(false);
  const [activityView, setActivityView] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [syncStatus, setSyncStatus] = useState('disconnected');
  const [notice, setNotice] = useState(null);
  const noticeTimerRef = useRef(null);
  const activityDateAutoSelectedRef = useRef(false);
  const [classForm, setClassForm] = useState(nextHourForm());
  const [originalClassImageOverride, setOriginalClassImageOverride] = useState('');
  const [editingClass, setEditingClass] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [typeName, setTypeName] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [typeImageAsset, setTypeImageAsset] = useState(null);
  const [typeImageFeedback, setTypeImageFeedback] = useState(null);
  const [typeImageUploading, setTypeImageUploading] = useState(false);
  const [userForm, setUserForm] = useState(emptyUser());
  const [editingUser, setEditingUser] = useState(null);
  const [passwordReset, setPasswordReset] = useState('');
  const [imageForm, setImageForm] = useState({ keyword: '', image: '' });
  const [settingsForm, setSettingsForm] = useState({ appName: '', heroImage: '' });
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; });

  useEffect(() => { loadSession(); }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!me?.id) return undefined;

    let cleanupRealtime;
    let cancelled = false;

    AsyncStorage.getItem('token')
      .then((token) => {
        if (cancelled || !token) return;
        cleanupRealtime = connectRealtime(
          token,
          () => fetchAll(me.role, true),
          setSyncStatus
        );
      })
      .catch(() => setSyncStatus('disconnected'));

    return () => {
      cancelled = true;
      cleanupRealtime?.();
    };
  }, [me?.id, me?.role]);

  useEffect(() => {
    if (activityDateAutoSelectedRef.current || classes.length === 0) return;
    setSelectedDate(nearestClassDate(classes));
    activityDateAutoSelectedRef.current = true;
  }, [classes]);

  const logout = async () => {
    delete axios.defaults.headers.common.Authorization;
    await AsyncStorage.multiRemove(['token', 'user', 'rememberLogin']);
    navigation.replace('Login');
  };

  const loadSession = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const rawUser = await AsyncStorage.getItem('user');
      if (!token || !rawUser) return navigation.replace('Login');
      const storedUser = JSON.parse(rawUser);
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      setMe(storedUser);
      await fetchAll(storedUser.role, true);
    } catch {
      Alert.alert('Sesión inválida', 'Inicia sesión de nuevo.');
      await logout();
    } finally {
      setLoading(false);
    }
  };

  const fetchAll = async (role = me?.role, silent = false) => {
    if (!role) return;
    try {
      if (!silent) setLoading(true);
      const [classRes, typeRes, settingsRes] = await Promise.all([
        axios.get(url('/classes')),
        axios.get(url('/class-types')),
        axios.get(url('/settings'))
      ]);
      setClasses(classRes.data || []);
      setTypes(typeRes.data || []);
      setSettings(settingsRes.data || null);
      setLoadError('');
      setSettingsForm({ appName: settingsRes.data?.app_name || settingsRes.data?.appName || 'Ronquillo Te Cuida', heroImage: settingsRes.data?.hero_image || settingsRes.data?.heroImage || '' });
      if (role === 'ADMIN') {
        const [userRes, imageRes, payRes, noteRes] = await Promise.all([
          axios.get(url('/users')),
          axios.get(url('/image-bank')),
          axios.get(url('/membership/payments/pending')),
          axios.get(url('/admin-notifications'))
        ]);
        setUsers(userRes.data || []); setImages(imageRes.data || []); setPayments(payRes.data || []); setNotes(noteRes.data || []);
      }
    } catch (e) {
      if (e?.response?.status === 401) return logout();
      const message = errorText(e, 'No se pudieron cargar los datos.');
      setLoadError(message);
      if (!silent || classes.length === 0) Alert.alert('Error', message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const showNotice = (message, tone = 'success') => {
    const id = Date.now();
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ id, message, tone });
    noticeTimerRef.current = setTimeout(() => {
      setNotice((current) => (current?.id === id ? null : current));
    }, 2600);
  };

  const refresh = async () => { setRefreshing(true); await fetchAll(me?.role, true); setRefreshing(false); };
  const refreshClassesAndTypes = async () => {
    const [classRes, typeRes] = await Promise.all([
      axios.get(url('/classes')),
      axios.get(url('/class-types'))
    ]);
    setClasses(classRes.data || []);
    setTypes(typeRes.data || []);
  };
  const openNewClass = () => { setEditingClass(null); setOriginalClassImageOverride(''); setClassForm(nextHourForm()); setClassFormOpen(true); };
  const resetClass = () => { setEditingClass(null); setOriginalClassImageOverride(''); setClassForm(nextHourForm()); setClassFormOpen(false); };
  const openNewUser = () => { setEditingUser(null); setUserForm(emptyUser()); setPasswordReset(''); setUserFormOpen(true); };
  const resetUser = () => { setEditingUser(null); setUserForm(emptyUser()); setPasswordReset(''); setUserFormOpen(false); };
  const openTab = (nextTab) => {
    setMenuOpen(false);
    setTimeout(() => setTab(nextTab), 90);
  };

  const saveClass = async () => {
    try {
      let payload = {
        title: classForm.title.trim(), description: classForm.description.trim() || undefined,
        tipo_clase_id: classForm.type ? Number(classForm.type) : undefined,
        max_capacity: Number(classForm.cap), start_time: iso(classForm.start, 'Inicio'), end_time: iso(classForm.end, 'Fin')
      };
      payload = withExplicitImageOverride(payload, {
        isEditing: !!editingClass,
        value: classForm.image,
        originalValue: originalClassImageOverride
      });
      if (!payload.title || !payload.max_capacity) throw new Error('Título y aforo son obligatorios.');
      if (new Date(payload.end_time) <= new Date(payload.start_time)) throw new Error('La hora de fin debe ser posterior al inicio.');
      if (me?.role === 'ADMIN') payload.teacher_id = Number(classForm.teacher);
      if (me?.role === 'ADMIN' && !payload.teacher_id) throw new Error('Selecciona un profesor.');
      if (editingClass) await axios.put(url(`/classes/${editingClass}`), payload); else await axios.post(url('/classes'), payload);
      showNotice(editingClass ? 'Clase actualizada.' : 'Clase creada.');
      resetClass(); await fetchAll(me?.role, true);
    } catch (e) { Alert.alert('Error', errorText(e, e.message || 'No se pudo guardar la clase.')); }
  };

  const fillClass = (c) => {
    const imageOverride = imageOverrideOf(c);
    setEditingClass(c.id);
    setOriginalClassImageOverride(imageOverride);
    setClassForm({ title: c.title || '', description: c.description || '', type: typeOf(c) ? String(typeOf(c)) : '', teacher: teacherOf(c) ? String(teacherOf(c)) : '', cap: String(capOf(c)), start: dateInput(startOf(c)), end: dateInput(endOf(c)), image: imageOverride });
    setClassFormOpen(true);
  };
  const deleteClass = (id) => Alert.alert('Eliminar clase', '¿Seguro?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await axios.delete(url(`/classes/${id}`)); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo eliminar.')); } } }]);
  const removeStudent = (classId, userId) => Alert.alert('Quitar alumno', '¿Seguro?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Quitar', style: 'destructive', onPress: async () => { try { await axios.delete(url(`/classes/${classId}/reservations/${userId}`)); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo quitar.')); } } }]);

  const saveUser = async () => {
    try {
      const payload = { name: userForm.name.trim(), email: userForm.email.trim().toLowerCase(), role: userForm.role, phone: userForm.phone.trim() || undefined, profile_picture: userForm.photo.trim() || undefined };
      if (!payload.name || !payload.email) throw new Error('Nombre y email son obligatorios.');
      if (!editingUser) { if (userForm.password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.'); payload.password = userForm.password; }
      if (userForm.role === 'CLIENT') { payload.estado_mensualidad = userForm.monthly; if (userForm.expires) payload.membership_expires_at = iso(userForm.expires, 'Vencimiento'); }
      if (editingUser) await axios.put(url(`/users/${editingUser}`), payload); else await axios.post(url('/users'), payload);
      showNotice(editingUser ? 'Usuario actualizado.' : 'Usuario creado.');
      resetUser(); await fetchAll(me?.role, true);
    } catch (e) { Alert.alert('Error', errorText(e, e.message || 'No se pudo guardar el usuario.')); }
  };

  const resetUserPassword = async () => {
    try {
      if (me?.role !== 'ADMIN') throw new Error('Solo un administrador puede cambiar contraseñas.');
      if (!editingUser) throw new Error('Selecciona un usuario.');
      const password = passwordReset.trim();
      if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      await axios.put(url(`/users/${editingUser}/password`), { password });
      setPasswordReset('');
      showNotice('Contraseña actualizada.');
    } catch (e) {
      Alert.alert('Error', errorText(e, e.message || 'No se pudo cambiar la contraseña.'));
    }
  };

  const fillUser = (u) => { setEditingUser(u.id); setPasswordReset(''); setUserForm({ name: u.name || '', email: u.email || '', password: '', role: u.role || 'CLIENT', monthly: statusOf(u), expires: dateInput(expiryOf(u)), phone: u.phone || '', photo: imgOf(u) }); setUserFormOpen(true); };
  const deleteUser = (id) => Alert.alert('Eliminar usuario', '¿Seguro?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await axios.delete(url(`/users/${id}`)); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo eliminar.')); } } }]);
  const renewUser = async (id) => { try { await axios.post(url(`/membership/users/${id}/renew`), { months: 1 }); showNotice('Cuota renovada 1 mes.'); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo renovar.')); } };
  const confirmPayment = async (id) => { try { await axios.post(url(`/membership/payments/${id}/confirm`), { months: 1 }); showNotice('Pago confirmado y cuota renovada.'); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo confirmar.')); } };
  const readNote = async (id) => { try { await axios.patch(url(`/admin-notifications/${id}/read`)); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo marcar leído.')); } };
  const saveImage = async () => { try { await axios.post(url('/image-bank'), { keyword: imageForm.keyword.trim(), image_url: imageForm.image.trim() }); setImageForm({ keyword: '', image: '' }); setImageFormOpen(false); showNotice('Imagen guardada.'); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo guardar la imagen.')); } };
  const deleteImage = async (id) => { try { await axios.delete(url(`/image-bank/${id}`)); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo eliminar la imagen.')); } };
  const saveSettings = async () => { try { await axios.put(url('/settings'), { app_name: settingsForm.appName.trim(), hero_image: settingsForm.heroImage.trim() || undefined }); setSettingsFormOpen(false); showNotice('Personalización actualizada.'); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo guardar.')); } };
  const resetTypeForm = () => {
    setTypeName('');
    setSelectedTypeId(null);
    setTypeImageAsset(null);
    setTypeImageFeedback(null);
    setTypeFormOpen(false);
  };
  const openTypeForm = () => {
    setTypeImageAsset(null);
    setTypeImageFeedback(null);
    setTypeFormOpen(true);
  };
  const createType = async () => { try { await axios.post(url('/class-types'), { name: typeName.trim() }); showNotice('Tipo de clase creado.'); resetTypeForm(); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo crear el tipo.')); } };
  const selectTypeForImage = (classType) => {
    setSelectedTypeId(classType.id);
    setTypeImageAsset(null);
    setTypeImageFeedback({ tone: 'info', message: `Tipo seleccionado: ${classType.name || classType.nombre}.` });
  };
  const selectTypeImage = async () => {
    if (me?.role !== 'ADMIN') return;
    if (!selectedTypeId) {
      setTypeImageFeedback({ tone: 'error', message: 'Seleccioná primero un tipo de clase.' });
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        const message = permission.canAskAgain === false
          ? 'El acceso a la biblioteca está desactivado. Podés habilitarlo desde los ajustes del dispositivo.'
          : 'Necesitamos acceso a la biblioteca para que puedas seleccionar una imagen.';
        setTypeImageFeedback({ tone: 'error', message });
        const actions = [{ text: 'Cerrar', style: 'cancel' }];
        if (permission.canAskAgain === false) actions.push({ text: 'Abrir ajustes', onPress: () => Linking.openSettings() });
        Alert.alert('Permiso de biblioteca', message, actions);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
        selectionLimit: 1
      });
      if (result.canceled) {
        setTypeImageFeedback({
          tone: 'info',
          message: typeImageAsset
            ? 'Selección cancelada. Se conserva la imagen pendiente.'
            : 'Selección cancelada. No se realizó ningún cambio.'
        });
        return;
      }

      const prepared = prepareClassTypeImageAsset(result.assets?.[0], selectedTypeId);
      setTypeImageAsset(prepared);
      setTypeImageFeedback({ tone: 'success', message: 'Imagen lista para subir. Revisá la vista previa.' });
    } catch (e) {
      const message = errorText(e, e?.message || 'No se pudo seleccionar la imagen.');
      setTypeImageFeedback({ tone: 'error', message });
      Alert.alert('Error al seleccionar', message);
    }
  };
  const uploadTypeImage = async () => {
    if (me?.role !== 'ADMIN' || !selectedTypeId || !typeImageAsset || typeImageUploading) return;
    let uploaded = false;
    try {
      setTypeImageUploading(true);
      setTypeImageFeedback({ tone: 'info', message: 'Subiendo imagen...' });
      const formData = new FormData();
      formData.append('image', {
        uri: typeImageAsset.uri,
        name: typeImageAsset.name,
        type: typeImageAsset.type
      });
      // Axios must set the multipart boundary for React Native FormData.
      await axios.put(url(`/class-types/${selectedTypeId}`), formData, { headers: { Accept: 'application/json' } });
      uploaded = true;
      await refreshClassesAndTypes();
      setTypeImageAsset(null);
      setTypeImageFeedback({ tone: 'success', message: 'Imagen actualizada y calendario sincronizado.' });
      showNotice('Imagen del tipo actualizada.');
    } catch (e) {
      const fallback = uploaded
        ? 'La imagen se guardó, pero no pudimos actualizar las clases. Deslizá para reintentar.'
        : 'No se pudo subir la imagen del tipo.';
      const message = errorText(e, fallback);
      setTypeImageFeedback({ tone: 'error', message });
      Alert.alert(uploaded ? 'Actualización pendiente' : 'Error al subir', message);
    } finally {
      setTypeImageUploading(false);
    }
  };
  const reserve = async (classId, cancel) => { try { const r = await axios.post(url(`/classes/${classId}/${cancel ? 'cancel' : 'reserve'}`)); showNotice(cancel ? 'Reserva cancelada.' : r.data?.status === 'EN_ESPERA' ? 'Quedaste en lista de espera.' : 'Reserva confirmada.'); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'Operación fallida.')); } };
  const validateAttendance = async (classId) => { try { await axios.post(url(`/classes/${classId}/attendance/validate`)); showNotice('Asistencia validada.'); await fetchAll(me?.role, true); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo validar.')); } };
  const reportPayment = async () => { try { await axios.post(url('/membership/payments'), { notes: 'Payment reported from mobile app' }); showNotice('Pago notificado al administrador.'); } catch (e) { Alert.alert('Error', errorText(e, 'No se pudo notificar.')); } };

  const isAdmin = me?.role === 'ADMIN';
  const isTeacher = me?.role === 'TEACHER';
  const isClient = me?.role === 'CLIENT';
  const canManageParticipants = canViewParticipantIdentities(me?.role);
  const teachers = users.filter((u) => u.role === 'TEACHER');
  const unread = notes.filter((n) => !n.read_at && !n.readAt).length;
  const currentTabs = roleTabs[me?.role] || roleTabs.CLIENT;
  const activeTabLabel = currentTabs.find(([id]) => id === tab)?.[1] || 'Menú';
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const activeFilterCount = (typeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
  const shownClasses = useMemo(() => filterActivities({
    classes,
    selectedDate,
    view: activityView,
    typeFilter,
    statusFilter,
    role: me?.role,
    userId: me?.id,
    isClient
  }), [classes, selectedDate, activityView, typeFilter, statusFilter, me?.id, me?.role, isClient]);
  const typeStats = useMemo(() => Object.values(classes.filter((c) => new Date(startOf(c)).getTime() < Date.now()).reduce((a, c) => { const k = c.classType?.name || c.title || 'General'; a[k] ||= { name: k, classes: 0, reservations: 0, capacity: 0 }; a[k].classes++; a[k].reservations += c._count?.reservations || 0; a[k].capacity += capOf(c); return a; }, {})).sort((a, b) => b.reservations - a.reservations), [classes]);
  const teacherStats = useMemo(() => Object.values(classes.filter((c) => new Date(startOf(c)).getTime() < Date.now()).reduce((a, c) => { const s = new Date(startOf(c)); const m = `${s.getFullYear()}-${pad(s.getMonth() + 1)}`; if (m !== month || !c.teacher?.id) return a; const e = new Date(endOf(c)); const id = c.teacher.id; a[id] ||= { name: c.teacher.name, hours: 0, classes: 0, reservations: 0 }; a[id].hours += Math.max(0, e - s) / 3600000; a[id].classes++; a[id].reservations += c._count?.reservations || 0; return a; }, {})).sort((a, b) => b.hours - a.hours), [classes, month]);
  const selectedClassDetails = selectedClass ? classes.find((c) => c.id === selectedClass.id) || selectedClass : null;
  const closeClassDetails = () => setSelectedClass(null);
  const openReservationUser = (targetUser) => {
    if (!canManageParticipants || !targetUser) return;
    if (isAdmin) { closeClassDetails(); fillUser(targetUser); return; }
    const details = [targetUser.email, targetUser.phone].filter(Boolean).join('\n');
    Alert.alert(targetUser.name || 'Usuario', details || 'Sin datos de contacto visibles.');
  };

  const MenuSheet = () => <Sheet insets={insets} bottomInset={bottomInset} visible={menuOpen} title="Menú" compact onClose={() => setMenuOpen(false)}>{currentTabs.map(([id, label]) => <TouchableOpacity key={id} onPress={() => openTab(id)} style={[styles.menuItem, tab === id && styles.menuItemActive]}><Text style={[styles.menuText, tab === id && styles.menuTextActive]}>{label}{id === 'payments' && unread ? ` (${unread})` : ''}</Text></TouchableOpacity>)}</Sheet>;

  const resetActivityFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
  };

  const FiltersSheet = () => (
    <Sheet
      insets={insets}
      bottomInset={bottomInset}
      visible={filtersOpen}
      title="Filtros de actividades"
      compact
      onClose={() => setFiltersOpen(false)}
    >
      <Text style={styles.filterLabel}>Tipo de actividad</Text>
      <View style={styles.filterOptions}>
        <Btn title="Todos" tone={typeFilter === 'all' ? 'light' : 'gray'} onPress={() => setTypeFilter('all')} />
        {types.map((type) => (
          <Btn
            key={type.id}
            title={type.name || type.nombre}
            tone={String(typeFilter) === String(type.id) ? 'light' : 'gray'}
            onPress={() => setTypeFilter(String(type.id))}
          />
        ))}
      </View>
      <Text style={styles.filterLabel}>Estado de reserva</Text>
      <View style={styles.filterOptions}>
        {RESERVATION_STATUS_OPTIONS.map(([id, label]) => (
          <Btn key={id} title={label} tone={statusFilter === id ? 'light' : 'gray'} onPress={() => setStatusFilter(id)} />
        ))}
      </View>
      <View style={styles.row}>
        <Btn title="Restablecer" tone="gray" disabled={!activeFilterCount} onPress={resetActivityFilters} />
        <Btn title="Ver actividades" tone="coral" onPress={() => setFiltersOpen(false)} />
      </View>
    </Sheet>
  );

  const activityStatusFor = (gymClass) => {
    const past = isPastClass(gymClass);
    const reservation = reservationFor(gymClass, me?.id);
    const status = reservationStatus(reservation);
    const waitlistCount = (gymClass.reservations || []).filter((item) => reservationStatus(item) === 'EN_ESPERA').length;

    if (isClient && status === 'ASISTENCIA_VALIDADA') return { label: 'Asistencia validada', accent: '#35c98b' };
    if (isClient && status === 'EN_ESPERA') return { label: 'En lista de espera', accent: '#f5c44d' };
    if (isClient && status === 'CONFIRMADA') return { label: 'Reserva confirmada', accent: '#63a8ff' };
    if (isClient && status === 'NO_ASISTE') return { label: 'No asististe', accent: '#a33b4b' };
    if (past) return { label: 'Finalizada', accent: '#85858a' };
    if (!activeMembership(me) && isClient) return { label: 'Cuota no activa', accent: '#a33b4b' };
    if (waitlistCount) return { label: `${waitlistCount} en espera`, accent: '#f5c44d' };
    return { label: 'Disponible', accent: '#ff5a47' };
  };

  const activityActionsFor = (gymClass) => {
    const startsAt = startOf(gymClass);
    const reservation = reservationFor(gymClass, me?.id);
    const status = reservationStatus(reservation);
    const full = (gymClass._count?.reservations || 0) >= capOf(gymClass);

    if (isPastClass(gymClass)) {
      return { action: { label: 'Ver detalles', tone: 'outline', onPress: () => setSelectedClass(gymClass) } };
    }

    if (isAdmin || isTeacher) {
      return {
        action: { label: 'Gestionar', tone: 'outline', onPress: () => setSelectedClass(gymClass) },
        secondaryAction: { label: 'Editar', onPress: () => fillClass(gymClass) }
      };
    }

    if (!isClient) return {};
    if (reservation) {
      if (!canCancelReservation(reservation)) {
        return { action: { label: 'Ver detalles', tone: 'outline', onPress: () => setSelectedClass(gymClass) } };
      }
      if (canValidate(reservation, startsAt)) {
        return {
          action: { label: 'Validar asistencia', tone: 'success', onPress: () => validateAttendance(gymClass.id) },
          secondaryAction: { label: status === 'EN_ESPERA' ? 'Salir de espera' : 'Cancelar', onPress: () => reserve(gymClass.id, true) }
        };
      }
      return {
        action: {
          label: status === 'EN_ESPERA' ? 'Salir de espera' : 'Cancelar reserva',
          tone: 'danger',
          onPress: () => reserve(gymClass.id, true)
        }
      };
    }

    if (!activeMembership(me)) {
      return { action: { label: 'Renueva tu cuota', tone: 'outline', disabled: true } };
    }

    return {
      action: {
        label: full ? 'Unirse a lista de espera' : 'Reservar plaza',
        tone: full ? 'warning' : 'default',
        onPress: () => reserve(gymClass.id, false)
      }
    };
  };


  const ClassDetailsSheet = () => {
    const gymClass = selectedClassDetails;
    if (!gymClass) return null;
    const startsAt = startOf(gymClass);
    const reserved = reservationFor(gymClass, me?.id);
    const canCancelOwnReservation = canCancelReservation(reserved);
    const full = (gymClass._count?.reservations || 0) >= capOf(gymClass);
    const image = imgOf(gymClass);
    const upcoming = new Date(startsAt).getTime() >= Date.now();
    const participantReservations = canManageParticipants && Array.isArray(gymClass.reservations) ? gymClass.reservations : [];
    const confirmed = participantReservations.filter((r) => ['CONFIRMADA', 'ASISTENCIA_VALIDADA'].includes(reservationStatus(r)));
    const waitlist = participantReservations.filter((r) => reservationStatus(r) === 'EN_ESPERA');
    const noShows = participantReservations.filter((r) => reservationStatus(r) === 'NO_ASISTE');
    const renderReservations = (title, data) => <View style={styles.box}><Text style={styles.subtitle}>{title}</Text>{data.length ? data.map((r) => <TouchableOpacity key={`${title}-${r.id ?? r.user?.id ?? r.userId}-${reservationStatus(r)}`} onPress={() => openReservationUser(r.user)} style={styles.student}><View style={styles.avatar}><Text style={styles.avatarText}>{(r.user?.name || '?').charAt(0)}</Text></View><View style={{ flex: 1 }}><Text style={styles.text}>{r.user?.name || 'Usuario'}</Text><Text style={styles.muted}>{reservationLabel(reservationStatus(r))}</Text></View>{reservationStatus(r) !== 'NO_ASISTE' && (r.user?.id ?? r.userId ?? r.user_id) ? <Btn title="Quitar" tone="red" onPress={() => removeStudent(gymClass.id, r.user?.id ?? r.userId ?? r.user_id)} /> : null}</TouchableOpacity>) : <Text style={styles.muted}>Sin registros.</Text>}</View>;
    return <Sheet insets={insets} bottomInset={bottomInset} visible={!!gymClass} title="Detalle de clase" onClose={closeClassDetails}>
      <View style={styles.card}>
        {!!image && <Image source={{ uri: image }} style={styles.classImage} />}
        <Text style={styles.title}>{gymClass.title || gymClass.titulo}</Text>
        <Text style={styles.muted}>{gymClass.classType?.name || 'General'} · {gymClass.teacher?.name || 'Sin profesor'}</Text>
        {!!gymClass.description && <Text style={styles.text}>{gymClass.description}</Text>}
        <View style={styles.infoGrid}><View style={styles.infoBox}><Text style={styles.subtitle}>Horario</Text><Text style={styles.text}>{fmt(startsAt)}</Text><Text style={styles.muted}>Fin: {fmt(endOf(gymClass))}</Text></View><View style={styles.infoBox}><Text style={styles.subtitle}>Ocupación</Text><Text style={styles.classTitle}>{gymClass._count?.reservations || 0}/{capOf(gymClass)}</Text><Text style={styles.muted}>{full ? 'Aforo completo' : 'Plazas disponibles'}</Text></View></View>
        {(isAdmin || isTeacher) && <View style={styles.row}><Btn title="Editar clase" onPress={() => { closeClassDetails(); fillClass(gymClass); }} />{isAdmin && <Btn title="Eliminar" tone="red" onPress={() => { closeClassDetails(); deleteClass(gymClass.id); }} />}</View>}
        {isClient && upcoming && (!reserved || canCancelOwnReservation) ? <View style={styles.row}>{reserved ? <>{canValidate(reserved, startsAt) && <Btn title="Validar asistencia" tone="green" onPress={() => validateAttendance(gymClass.id)} />}<Btn title="Cancelar reserva" tone="red" onPress={() => reserve(gymClass.id, true)} /></> : <Btn title={!activeMembership(me) ? 'Renueva tu cuota' : full ? 'Unirse a lista de espera' : 'Reservar plaza'} tone={full ? 'yellow' : 'blue'} disabled={!activeMembership(me)} onPress={() => reserve(gymClass.id, false)} />}</View> : null}
        {!!reserved && <Text style={styles.pill}>{reservationLabel(reservationStatus(reserved))}</Text>}
      </View>
      {canManageParticipants ? <>
        {renderReservations('Asistentes confirmados', confirmed)}
        {renderReservations('Lista de espera', waitlist)}
        {renderReservations('No asistieron', noShows)}
      </> : null}
    </Sheet>;
  };

  const ClassForm = () => (isAdmin || isTeacher) ? <View style={styles.card}>
    <Text style={styles.title}>{editingClass ? 'Editar clase' : 'Nueva clase'}</Text>
    <Input label="Título" value={classForm.title} onChangeText={(v) => setClassForm({ ...classForm, title: v })} />
    <Input label="Descripción" value={classForm.description} onChangeText={(v) => setClassForm({ ...classForm, description: v })} multiline />
    <Input label="ID tipo" value={classForm.type} onChangeText={(v) => setClassForm({ ...classForm, type: v })} keyboardType="number-pad" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{types.map((t) => <Chip key={t.id} text={`${t.id} · ${t.name || t.nombre}`} onPress={() => setClassForm({ ...classForm, type: String(t.id) })} />)}</ScrollView>
    {isAdmin && <><Input label="ID profesor" value={classForm.teacher} onChangeText={(v) => setClassForm({ ...classForm, teacher: v })} keyboardType="number-pad" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{teachers.map((t) => <Chip key={t.id} text={`${t.id} · ${t.name}`} onPress={() => setClassForm({ ...classForm, teacher: String(t.id) })} />)}</ScrollView></>}
    <Input label="Aforo" value={classForm.cap} onChangeText={(v) => setClassForm({ ...classForm, cap: v })} keyboardType="number-pad" />
    <Input label="Inicio" value={classForm.start} onChangeText={(v) => setClassForm({ ...classForm, start: v })} placeholder="2026-06-01T18:00" />
    <Input label="Fin" value={classForm.end} onChangeText={(v) => setClassForm({ ...classForm, end: v })} placeholder="2026-06-01T19:00" />
    <Input label="URL imagen propia (opcional)" value={classForm.image} onChangeText={(v) => setClassForm({ ...classForm, image: v })} />
    {editingClass ? <Text style={styles.fieldHint}>La imagen efectiva del tipo se usa solo para mostrar. Esta URL se envía únicamente si la cambiás.</Text> : null}
    <View style={styles.row}><Btn title={editingClass ? 'Guardar' : 'Crear'} onPress={saveClass} /><Btn title="Cerrar" tone="gray" onPress={resetClass} /></View>
  </View> : null;

  const selectedType = types.find((classType) => String(classType.id) === String(selectedTypeId)) || null;
  const currentTypeImage = selectedType ? imgOf(selectedType) : '';
  const typeImagePreview = typeImageAsset?.uri || currentTypeImage;

  const TypeForm = () => isAdmin ? <View>
    <View style={styles.smallCard}>
      <Text style={styles.title}>Crear tipo de clase</Text>
      <Input label="Nuevo tipo" value={typeName} onChangeText={setTypeName} />
      <Btn title="Crear tipo" disabled={!typeName.trim()} onPress={createType} />
    </View>
    <View style={styles.smallCard}>
      <Text style={styles.title}>Imagen del tipo</Text>
      <Text style={styles.fieldHint}>Elegí el tipo que querés actualizar. La imagen efectiva actual se muestra solo como vista previa y nunca se reenvía.</Text>
      {types.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeImageTypes}>
          {types.map((classType) => {
            const active = String(classType.id) === String(selectedTypeId);
            const image = imgOf(classType);
            return <TouchableOpacity
              key={classType.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`Tipo ${classType.name || classType.nombre}`}
              onPress={() => selectTypeForImage(classType)}
              style={[styles.typeImageType, active && styles.typeImageTypeActive]}
            >
              {image ? <Image source={{ uri: image }} style={styles.typeImageThumb} /> : <View style={styles.typeImageThumbEmpty}><Text style={styles.typeImageThumbText}>Sin imagen</Text></View>}
              <Text numberOfLines={2} style={styles.typeImageTypeName}>{classType.name || classType.nombre}</Text>
            </TouchableOpacity>;
          })}
        </ScrollView>
      ) : <Text style={styles.empty}>Creá un tipo antes de asignarle una imagen.</Text>}
      {selectedType ? <View style={styles.typeImageEditor}>
        <Text style={styles.subtitle}>{selectedType.name || selectedType.nombre}</Text>
        {typeImagePreview ? <Image source={{ uri: typeImagePreview }} style={styles.typeImagePreview} resizeMode="cover" /> : <View style={[styles.typeImagePreview, styles.typeImagePreviewEmpty]}><Text style={styles.muted}>Este tipo todavía no tiene imagen.</Text></View>}
        {typeImageAsset ? <Text style={styles.typeImageFile}>{typeImageAsset.name}{typeImageAsset.fileSize !== null ? ` · ${(typeImageAsset.fileSize / (1024 * 1024)).toFixed(1)} MB` : ''}</Text> : null}
        <View style={styles.row}>
          <Btn title="Seleccionar imagen" tone="gray" disabled={typeImageUploading} onPress={selectTypeImage} />
          <Btn title={typeImageUploading ? 'Subiendo...' : 'Subir imagen'} disabled={!typeImageAsset || typeImageUploading} onPress={uploadTypeImage} />
        </View>
      </View> : null}
      {typeImageFeedback ? <Text accessibilityRole={typeImageFeedback.tone === 'error' ? 'alert' : 'text'} accessibilityLiveRegion="polite" style={[styles.typeImageFeedback, typeImageFeedback.tone === 'error' && styles.typeImageFeedbackError, typeImageFeedback.tone === 'success' && styles.typeImageFeedbackSuccess]}>{typeImageFeedback.message}</Text> : null}
    </View>
  </View> : null;

  const ClassesTab = () => (
    <View>
      <ActivitySegments value={activityView} onChange={setActivityView} />
      <ActivitySiteRow
        siteName={appName}
        filterCount={activeFilterCount}
        onOpenFilters={() => setFiltersOpen(true)}
      />
      <ActivityWeekStrip
        selectedDate={selectedDate}
        days={weekDays}
        onSelectDate={setSelectedDate}
        onPreviousWeek={() => setSelectedDate((current) => shiftDays(current, -7))}
        onNextWeek={() => setSelectedDate((current) => shiftDays(current, 7))}
        showsAllDates={activityView !== 'calendar'}
      />
      <FiltersSheet />
      {isClient && !activeMembership(me) ? (
        <ActivityMessage
          title="Cuota no activa"
          message="Podés consultar el calendario, pero necesitás renovar la cuota antes de reservar."
          actionLabel="Notificar pago"
          onAction={reportPayment}
          tone="error"
        />
      ) : null}
      {(isAdmin || isTeacher) ? (
        <View style={styles.activityActions}>
          <Btn title="Nueva clase" tone="coral" onPress={openNewClass} />
          {isAdmin ? <Btn title="Tipos e imágenes" tone="gray" onPress={openTypeForm} /> : null}
        </View>
      ) : null}
      <Sheet insets={insets} bottomInset={bottomInset} visible={classFormOpen} title={editingClass ? 'Editar clase' : 'Nueva clase'} onClose={resetClass}>{ClassForm()}</Sheet>
      <Sheet insets={insets} bottomInset={bottomInset} visible={typeFormOpen} title="Tipos de clase" onClose={resetTypeForm}>{TypeForm()}</Sheet>
      {ClassDetailsSheet()}
      {loadError ? (
        <ActivityMessage
          title="No pudimos actualizar todos los datos"
          message={loadError}
          actionLabel="Reintentar"
          onAction={() => fetchAll(me?.role)}
          tone="error"
        />
      ) : null}
      {loading ? (
        <View style={styles.activitiesLoading} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color="#ff5a47" />
          <Text style={styles.activitiesLoadingText}>Cargando actividades...</Text>
        </View>
      ) : loadError && classes.length === 0 ? null : shownClasses.length ? (
        shownClasses.map((gymClass) => {
          const actions = activityActionsFor(gymClass);
          return (
            <ActivityCard
              key={gymClass.id}
              gymClass={gymClass}
              status={activityStatusFor(gymClass)}
              action={actions.action}
              secondaryAction={actions.secondaryAction}
              onOpen={() => setSelectedClass(gymClass)}
            />
          );
        })
      ) : (
        <ActivityMessage
          title="No hay actividades"
          message={activityView === 'calendar'
            ? 'No hay clases programadas para este día y estos filtros.'
            : activityView === 'bookings'
              ? 'No hay reservas para estos filtros.'
              : 'No hay personas en lista de espera para estos filtros.'}
          actionLabel={activityView === 'calendar' ? 'Ir a una fecha con clases' : undefined}
          onAction={activityView === 'calendar' ? () => {
            resetActivityFilters();
            setSelectedDate(nearestClassDate(classes));
          } : undefined}
        />
      )}
    </View>
  );

  const RolePicker = () => <View style={styles.row}>{['CLIENT', 'TEACHER', 'ADMIN'].map((r) => <Btn key={r} title={ROLES[r]} tone={userForm.role === r ? 'blue' : 'gray'} onPress={() => setUserForm({ ...userForm, role: r })} />)}</View>;
  const MonthPicker = () => <View style={styles.row}>{['PAGADO', 'IMPAGADO'].map((s) => <Btn key={s} title={s} tone={userForm.monthly === s ? 'blue' : 'gray'} onPress={() => setUserForm({ ...userForm, monthly: s })} />)}</View>;

  const UserForm = () => <View style={styles.card}><Text style={styles.title}>{editingUser ? 'Editar usuario' : 'Crear usuario'}</Text><Input label="Nombre" value={userForm.name} onChangeText={(v) => setUserForm({ ...userForm, name: v })} /><Input label="Email" value={userForm.email} onChangeText={(v) => setUserForm({ ...userForm, email: v })} keyboardType="email-address" />{!editingUser && <Input label="Contraseña" value={userForm.password} onChangeText={(v) => setUserForm({ ...userForm, password: v })} secureTextEntry />}{isAdmin && editingUser && <View style={styles.warning}><Text style={styles.warnTitle}>Restablecer contraseña</Text><Text style={styles.muted}>Solo visible para ADMIN. Úsalo cuando el usuario no pueda acceder.</Text><Input label="Nueva contraseña" value={passwordReset} onChangeText={setPasswordReset} secureTextEntry /><Btn title="Cambiar contraseña" tone="yellow" disabled={passwordReset.trim().length < 8} onPress={resetUserPassword} /></View>}<Text style={styles.label}>Rol</Text><RolePicker />{userForm.role === 'CLIENT' && <><Text style={styles.label}>Cuota</Text><MonthPicker /><Input label="Vence" value={userForm.expires} onChangeText={(v) => setUserForm({ ...userForm, expires: v })} placeholder="2026-06-30T23:59" /></>}<Input label="Teléfono" value={userForm.phone} onChangeText={(v) => setUserForm({ ...userForm, phone: v })} keyboardType="phone-pad" /><Input label="URL foto" value={userForm.photo} onChangeText={(v) => setUserForm({ ...userForm, photo: v })} /><View style={styles.row}><Btn title={editingUser ? 'Guardar' : 'Crear'} onPress={saveUser} /><Btn title="Cerrar" tone="gray" onPress={resetUser} /></View></View>;

  const UsersTab = () => isAdmin ? <View>
    <View style={styles.actionBar}><Btn title="Crear usuario" onPress={openNewUser} /></View><Sheet insets={insets} bottomInset={bottomInset} visible={userFormOpen} title={editingUser ? 'Editar usuario' : 'Crear usuario'} onClose={resetUser}>{UserForm()}</Sheet>
    <Text style={styles.section}>Directorio de usuarios</Text>{users.map((u) => <View key={u.id} style={styles.smallCard}><View style={styles.header}>{imgOf(u) ? <Image source={{ uri: imgOf(u) }} style={styles.userImg} /> : <View style={styles.userImg}><Text style={styles.avatarText}>{(u.name || '?').charAt(0)}</Text></View>}<View style={{ flex: 1 }}><Text style={styles.classTitle}>{u.name}</Text><Text style={styles.muted}>{u.email}</Text><Text style={styles.muted}>{ROLES[u.role] || u.role}</Text></View></View><Text style={styles.text}>{u.role === 'CLIENT' ? `Cuota: ${statusOf(u)} · vence ${fmtDate(expiryOf(u))}` : 'Cuota: exento'}</Text><View style={styles.row}><Btn title="Editar" onPress={() => fillUser(u)} /><Btn title="Clave" tone="yellow" onPress={() => fillUser(u)} />{u.role === 'CLIENT' && <Btn title="Renovar" tone="green" onPress={() => renewUser(u.id)} />}<Btn title="Eliminar" tone="red" onPress={() => deleteUser(u.id)} /></View></View>)}</View> : null;

  const PaymentsTab = () => isAdmin ? <View><Text style={styles.section}>Pagos pendientes</Text>{payments.length ? payments.map((p) => <View key={p.id} style={styles.smallCard}><Text style={styles.classTitle}>{p.user?.name || 'Usuario'}</Text><Text style={styles.muted}>{p.user?.email}</Text><Text style={styles.muted}>Notificado: {fmt(p.created_at || p.createdAt)}</Text>{!!p.notes && <Text style={styles.text}>{p.notes}</Text>}<Btn title="Confirmar y renovar" tone="green" onPress={() => confirmPayment(p.id)} /></View>) : <Text style={styles.empty}>No hay pagos pendientes.</Text>}<Text style={styles.section}>Avisos</Text>{notes.length ? notes.map((n) => { const read = n.read_at || n.readAt; return <View key={n.id} style={[styles.smallCard, !read && styles.unread]}><Text style={styles.classTitle}>{n.title}</Text><Text style={styles.text}>{n.message}</Text><Text style={styles.muted}>{fmt(n.created_at || n.createdAt)}</Text>{!read && <Btn title="Marcar leído" onPress={() => readNote(n.id)} />}</View>; }) : <Text style={styles.empty}>No hay avisos.</Text>}</View> : null;

  const ImagesTab = () => isAdmin ? <View><View style={styles.actionBar}><Btn title="Añadir imagen" onPress={() => setImageFormOpen(true)} /></View><Sheet insets={insets} bottomInset={bottomInset} visible={imageFormOpen} title="Nueva imagen" onClose={() => setImageFormOpen(false)}><View style={styles.card}><Text style={styles.title}>Banco de imágenes</Text><Input label="Palabra clave" value={imageForm.keyword} onChangeText={(v) => setImageForm({ ...imageForm, keyword: v })} /><Input label="URL imagen" value={imageForm.image} onChangeText={(v) => setImageForm({ ...imageForm, image: v })} /><View style={styles.row}><Btn title="Guardar imagen" onPress={saveImage} /><Btn title="Cerrar" tone="gray" onPress={() => setImageFormOpen(false)} /></View></View></Sheet>{images.map((im) => <View key={im.id} style={styles.smallCard}><Image source={{ uri: imgOf(im) }} style={styles.classImage} /><Text style={styles.classTitle}>{im.keyword}</Text><Text style={styles.muted}>{imgOf(im)}</Text><Btn title="Eliminar" tone="red" onPress={() => deleteImage(im.id)} /></View>)}</View> : null;

  const SettingsTab = () => isAdmin ? <View><View style={styles.actionBar}><Btn title="Editar personalización" onPress={() => setSettingsFormOpen(true)} /></View><Sheet insets={insets} bottomInset={bottomInset} visible={settingsFormOpen} title="Personalización" onClose={() => setSettingsFormOpen(false)}><View style={styles.card}><Text style={styles.title}>Personalización</Text><Input label="Nombre app" value={settingsForm.appName} onChangeText={(v) => setSettingsForm({ ...settingsForm, appName: v })} /><Input label="URL hero" value={settingsForm.heroImage} onChangeText={(v) => setSettingsForm({ ...settingsForm, heroImage: v })} />{!!settingsForm.heroImage && <Image source={{ uri: settingsForm.heroImage }} style={styles.classImage} />}<View style={styles.row}><Btn title="Guardar ajustes" onPress={saveSettings} /><Btn title="Cerrar" tone="gray" onPress={() => setSettingsFormOpen(false)} /></View></View></Sheet><View style={styles.smallCard}><Text style={styles.text}>Nombre actual: {settings?.app_name || settings?.appName || 'Ronquillo Te Cuida'}</Text></View></View> : null;

  const StatsTab = () => isAdmin ? <View><View style={styles.smallCard}><Text style={styles.title}>Métricas BI</Text><Input label="Mes" value={month} onChangeText={setMonth} placeholder="2026-05" /></View><Text style={styles.section}>Por tipo de clase</Text>{typeStats.length ? typeStats.map((s) => <View key={s.name} style={styles.metric}><Text style={styles.classTitle}>{s.name}</Text><Text style={styles.text}>{s.classes} clases · {s.reservations}/{s.capacity} plazas ocupadas</Text></View>) : <Text style={styles.empty}>Aún no hay clases pasadas.</Text>}<Text style={styles.section}>Por profesor</Text>{teacherStats.length ? teacherStats.map((s) => <View key={s.name} style={styles.metric}><Text style={styles.classTitle}>{s.name}</Text><Text style={styles.text}>{s.hours.toFixed(1)} h · {s.classes} clases · {s.reservations} reservas/asistencias</Text></View>) : <Text style={styles.empty}>No hay datos para ese mes.</Text>}</View> : null;

  const Body = () => {
    if (tab === 'users') return UsersTab();
    if (tab === 'payments') return PaymentsTab();
    if (tab === 'images') return ImagesTab();
    if (tab === 'settings') return SettingsTab();
    if (tab === 'stats') return StatsTab();
    return ClassesTab();
  };

  if (loading && !me) return <SafeAreaView style={styles.center} edges={['top', 'bottom', 'left', 'right']}><ActivityIndicator size="large" color="#60a5fa" /><Text style={styles.muted}>Cargando...</Text></SafeAreaView>;
  const appName = settings?.app_name || settings?.appName || 'Ronquillo Te Cuida';
  const syncLabel = syncStatus === 'connected' ? 'En directo' : syncStatus === 'connecting' ? 'Conectando' : 'Desconectado';
  const screenTitle = tab === 'classes' ? 'Actividades' : activeTabLabel;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.activitiesTop}>
        <View style={styles.activitiesIdentity}>
          <Text style={styles.activitiesEyebrow}>{tab === 'classes' ? 'Agenda del centro' : appName}</Text>
          <Text style={styles.activitiesTitle}>{screenTitle}</Text>
          <Text numberOfLines={1} style={styles.activitiesRole}>
            {ROLES[me?.role] || me?.role} · {syncLabel}{isClient ? ` · cuota ${fmtDate(expiryOf(me))}` : ''}
          </Text>
        </View>
        {currentTabs.length > 1 ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setMenuOpen(true)} style={styles.manageButton}>
            <Text style={styles.manageButtonText}>Gestionar{tab === 'payments' && unread ? ` ${unread}` : ''}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity accessibilityRole="button" onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>
      {tab !== 'classes' ? (
        <View style={styles.compactMenu}>
          <TouchableOpacity accessibilityRole="button" onPress={() => setMenuOpen(true)} style={styles.menuButton}>
            <Text style={styles.menuButtonText}>Cambiar sección</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={refresh} style={styles.refreshButton}>
            <Text style={styles.refreshText}>{refreshing ? 'Actualizando' : 'Actualizar'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {MenuSheet()}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.inner, { paddingBottom: 34 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#ff5a47" colors={['#ff5a47']} />}
      >
        {Body()}
        <View style={styles.dashboardFooter}>
          <Text style={styles.dashboardCopyright}>{COPYRIGHT_TEXT}</Text>
          <TouchableOpacity accessibilityRole="link" onPress={openPrivacyPolicy} activeOpacity={0.82}>
            <Text style={styles.dashboardPrivacyLink}>{"Pol\u00edtica de privacidad"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {notice ? (
        <View pointerEvents="none" style={[styles.notice, notice.tone === 'error' && styles.noticeError, { bottom: 10 }]}>
          <Text style={styles.noticeText}>{notice.message}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101010' }, center: { flex: 1, backgroundColor: '#101010', alignItems: 'center', justifyContent: 'center', gap: 12 },
  activitiesTop: { minHeight: 104, paddingTop: 10, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#101010', flexDirection: 'row', alignItems: 'center', gap: 8 },
  activitiesIdentity: { flex: 1, minWidth: 0 },
  activitiesEyebrow: { color: '#ff6b5b', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  activitiesTitle: { color: '#f7f7f8', fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.5 },
  activitiesRole: { color: '#85858a', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  manageButton: { minHeight: 44, borderRadius: 22, backgroundColor: '#242424', justifyContent: 'center', paddingHorizontal: 13 },
  manageButtonText: { color: '#e7e7e9', fontSize: 12, fontWeight: '900' },
  logout: { minHeight: 44, borderRadius: 22, backgroundColor: '#2a191b', justifyContent: 'center', paddingHorizontal: 14 },
  logoutText: { color: '#ff7566', fontWeight: '900', fontSize: 12 },
  tabs: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 }, tab: { backgroundColor: '#1e293b', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }, tabOn: { backgroundColor: '#2563eb' }, tabText: { color: '#94a3b8', fontWeight: '900' }, tabTextOn: { color: '#fff' },
  content: { flex: 1 }, inner: { paddingHorizontal: 20, paddingTop: 4 },
  card: { backgroundColor: '#1e293b', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, smallCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, classCard: { backgroundColor: '#1e293b', borderRadius: 18, padding: 15, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 12 }, section: { color: '#fff', fontSize: 19, fontWeight: '900', marginVertical: 14 }, classTitle: { color: '#fff', fontSize: 17, fontWeight: '900' }, subtitle: { color: '#e2e8f0', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 }, text: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 }, muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18 }, empty: { color: '#94a3b8', textAlign: 'center', padding: 18 }, dashboardFooter: { alignItems: 'center', marginTop: 22, marginBottom: 4 }, dashboardCopyright: { color: '#64748b', fontSize: 11, fontWeight: '700', textAlign: 'center' }, dashboardPrivacyLink: { color: '#94a3b8', fontSize: 11, fontWeight: '800', marginTop: 5, textAlign: 'center', textDecorationLine: 'underline' },
  field: { marginBottom: 11 }, label: { color: '#cbd5e1', fontSize: 12, fontWeight: '900', marginBottom: 6, textTransform: 'uppercase' }, input: { minHeight: 48, backgroundColor: '#0f172a', color: '#f8fafc', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12, fontSize: 15 }, area: { minHeight: 82, textAlignVertical: 'top' }, fieldHint: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: -3, marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, switchRow: { flexDirection: 'row', gap: 8, backgroundColor: '#020617', borderRadius: 14, padding: 4, marginBottom: 14 },
  infoGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  infoBox: { flex: 1, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 14, padding: 12 },
  btn: { minHeight: 46, backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }, btnText: { color: '#fff', fontWeight: '900', fontSize: 13 }, btn_blue: { backgroundColor: '#2563eb' }, btn_red: { backgroundColor: '#8d3040' }, btn_green: { backgroundColor: '#168a62' }, btn_yellow: { backgroundColor: '#f5c44d' }, btn_gray: { backgroundColor: '#303034' }, btn_coral: { backgroundColor: '#ff5a47' }, btn_light: { backgroundColor: '#f5f5f6' }, disabled: { opacity: 0.55 }, dark: { color: '#0f172a' },
  chips: { gap: 8, marginBottom: 10 }, chip: { minHeight: 44, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 999, paddingHorizontal: 12, justifyContent: 'center' }, chipText: { color: '#bfdbfe', fontWeight: '900', fontSize: 12 },
  header: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }, badge: { backgroundColor: '#0f172a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#334155' }, badgeText: { color: '#10b981', fontWeight: '900' }, classImage: { width: '100%', height: 145, borderRadius: 14, marginBottom: 10, backgroundColor: '#0f172a' },
  box: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' }, student: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }, avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontWeight: '900' }, userImg: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },

  compactMenu: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#101010', borderBottomWidth: 1, borderBottomColor: '#242424' },
  menuButton: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#334155' },
  menuButtonText: { color: '#fff', fontWeight: '900' },
  refreshButton: { backgroundColor: '#334155', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: '#bfdbfe', fontWeight: '900', fontSize: 12 },
  actionBar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end', paddingHorizontal: 10 },
  backdropPressable: { ...StyleSheet.absoluteFillObject },
  sheet: { maxHeight: '84%', backgroundColor: '#0f172a', borderRadius: 24, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  sheetCompact: { maxHeight: '58%' },
  sheetHandle: { width: 44, height: 5, borderRadius: 999, backgroundColor: '#475569', alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  sheetBody: { padding: 14 },
  menuItem: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  menuItemActive: { backgroundColor: '#2563eb', borderColor: '#60a5fa' },
  menuText: { color: '#cbd5e1', fontWeight: '900' },
  menuTextActive: { color: '#fff' },
  notice: { position: 'absolute', left: 16, right: 16, backgroundColor: '#059669', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, elevation: 8 },
  noticeError: { backgroundColor: '#dc2626' },
  noticeText: { color: '#fff', fontWeight: '900', textAlign: 'center' },
  tapHint: { color: '#bfdbfe', fontSize: 12, fontWeight: '900', marginTop: 8 },
  pill: { alignSelf: 'flex-start', color: '#fff', backgroundColor: '#2563eb', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8, overflow: 'hidden', fontWeight: '900', fontSize: 12 }, warning: { backgroundColor: 'rgba(217,119,6,0.16)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)', borderRadius: 14, padding: 14, marginBottom: 14 }, warnTitle: { color: '#fbbf24', fontWeight: '900', marginBottom: 4 }, unread: { borderColor: '#38bdf8', backgroundColor: 'rgba(14,116,144,0.22)' }, metric: { backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', borderRadius: 16, padding: 14, marginBottom: 10 },
  activityActions: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 16 },
  filterLabel: { color: '#f4f4f5', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  activitiesLoading: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
  activitiesLoadingText: { color: '#9a9a9f', fontSize: 14, fontWeight: '700' },
  typeImageTypes: { gap: 10, paddingBottom: 14 },
  typeImageType: { width: 132, minHeight: 116, backgroundColor: '#101820', borderWidth: 2, borderColor: '#334155', borderRadius: 14, padding: 8 },
  typeImageTypeActive: { borderColor: '#ff5a47', backgroundColor: '#2a1d1b' },
  typeImageThumb: { width: '100%', height: 68, borderRadius: 9, backgroundColor: '#020617' },
  typeImageThumbEmpty: { width: '100%', height: 68, borderRadius: 9, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' },
  typeImageThumbText: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  typeImageTypeName: { color: '#f8fafc', fontSize: 12, lineHeight: 16, fontWeight: '900', marginTop: 7 },
  typeImageEditor: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 14 },
  typeImagePreview: { width: '100%', height: 190, borderRadius: 14, backgroundColor: '#020617' },
  typeImagePreviewEmpty: { alignItems: 'center', justifyContent: 'center', padding: 18 },
  typeImageFile: { color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginTop: 8 },
  typeImageFeedback: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: '#172033' },
  typeImageFeedbackError: { color: '#fecaca', backgroundColor: '#401b24' },
  typeImageFeedbackSuccess: { color: '#bbf7d0', backgroundColor: '#133529' }
});
