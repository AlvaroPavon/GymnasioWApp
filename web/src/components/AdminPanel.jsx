import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EditClassModal from './EditClassModal';
import CreateUserModal from './CreateUserModal';
import ClassDetailsModal from './ClassDetailsModal';
import ActivitiesCalendar from './activities/ActivitiesCalendar';
import ClassTypeImageManager from './activities/ClassTypeImageManager';
import { useAuth } from '../context/AuthContext';
import { API_URL, getApiErrorMessage } from '../lib/api';
import { buildClassCreatePayload, selectedClassById } from '../lib/classPayload';

export default function AdminPanel({ siteName, onUserClick, realtimeVersion = 0 }) {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('classes'); // 'classes' | 'users' | 'images'

  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [images, setImages] = useState([]);
  const [classTypes, setClassTypes] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState('');

  const [selectedClassToEdit, setSelectedClassToEdit] = useState(null);
  const [selectedClassToViewId, setSelectedClassToViewId] = useState(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [appSettings, setAppSettings] = useState({ app_name: '' });
  const [heroImageFile, setHeroImageFile] = useState(null);

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);

  // Class form
  const [title, setTitle] = useState('');
  const [classTypeId, setClassTypeId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [repeatWeeks, setRepeatWeeks] = useState('1');
  const [fixedUserIds, setFixedUserIds] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchClasses();
    fetchImages();
    fetchClassTypes();
    fetchMembershipDashboard();
    fetchSettings();
  }, [realtimeVersion]);

  useEffect(() => {
    setSelectedClassToEdit((current) => current
      ? classes.find((gymClass) => gymClass.id === current.id) ?? null
      : null);
  }, [classes]);

  const selectedClassToView = selectedClassById(classes, selectedClassToViewId);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/settings`);
      if(res.data) setAppSettings(res.data);
    } catch(err) {
      console.error(err);
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('app_name', appSettings.app_name);
      if(heroImageFile) {
        formData.append('hero', heroImageFile);
      }
      await axios.put(`${API_URL}/settings`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert("Ajustes guardados. Recarga la página para ver los cambios.");
    } catch(err) {
      alert("Error guardando ajustes.");
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    const res = await axios.get(`${API_URL}/users`);
    setUsers(res.data);
  };

  const fetchClasses = async () => {
    setClassesLoading(true);
    setClassesError('');
    try {
      const res = await axios.get(`${API_URL}/classes`);
      setClasses(res.data);
    } catch (error) {
      setClassesError(getApiErrorMessage(error, 'No se pudieron cargar las actividades.'));
    } finally {
      setClassesLoading(false);
    }
  };

  const fetchImages = async () => {
    const res = await axios.get(`${API_URL}/image-bank`);
    setImages(res.data);
  };

  const fetchClassTypes = async () => {
    const res = await axios.get(`${API_URL}/class-types`);
    setClassTypes(res.data);
  };

  const fetchMembershipDashboard = async () => {
    const [paymentsRes, notificationsRes] = await Promise.all([
      axios.get(`${API_URL}/membership/payments/pending`),
      axios.get(`${API_URL}/admin-notifications`)
    ]);
    setPendingPayments(paymentsRes.data);
    setAdminNotifications(notificationsRes.data);
  };

  const unreadNotifications = adminNotifications.filter(n => !n.read_at);

  const confirmPayment = async (paymentId) => {
    try {
      await axios.post(`${API_URL}/membership/payments/${paymentId}/confirm`, { months: 1 });
      await Promise.all([fetchUsers(), fetchMembershipDashboard()]);
      alert('Pago confirmado y cuota renovada 1 mes.');
    } catch (err) {
      alert(getApiErrorMessage(err, 'No se pudo confirmar el pago'));
    }
  };

  const renewMembership = async (userId) => {
    try {
      await axios.post(`${API_URL}/membership/users/${userId}/renew`, { months: 1 });
      await fetchUsers();
      alert('Cuota renovada 1 mes.');
    } catch (err) {
      alert(getApiErrorMessage(err, 'No se pudo renovar la cuota'));
    }
  };

  const markNotificationRead = async (id) => {
    await axios.patch(`${API_URL}/admin-notifications/${id}/read`);
    fetchMembershipDashboard();
  };

  const deleteUser = async (id) => {
    if(confirm('¿Eliminar usuario?')) {
      await axios.delete(`${API_URL}/users/${id}`);
      fetchUsers();
    }
  };

  const openPasswordReset = (targetUser) => {
    if (currentUser?.role !== 'ADMIN') {
      alert('Solo un administrador puede cambiar contraseñas.');
      return;
    }
    setPasswordUser(targetUser);
    setPasswordValue('');
  };

  const closePasswordReset = () => {
    setPasswordUser(null);
    setPasswordValue('');
    setPasswordLoading(false);
  };

  const resetUserPassword = async (event) => {
    event.preventDefault();
    if (currentUser?.role !== 'ADMIN') {
      alert('Solo un administrador puede cambiar contraseñas.');
      return;
    }
    const password = passwordValue.trim();
    if (!passwordUser || password.length < 8) {
      alert('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    try {
      setPasswordLoading(true);
      await axios.put(`${API_URL}/users/${passwordUser.id}/password`, { password });
      alert('Contraseña actualizada. El usuario ya puede iniciar sesión con la nueva contraseña.');
      closePasswordReset();
    } catch (err) {
      alert(getApiErrorMessage(err, 'No se pudo cambiar la contraseña'));
      setPasswordLoading(false);
    }
  };

  const deleteClass = async (gymClassOrId) => {
    const id = typeof gymClassOrId === 'object' ? gymClassOrId.id : gymClassOrId;
    if(confirm('¿Cancelar y borrar clase?')) {
      try {
        await axios.delete(`${API_URL}/classes/${id}`);
        await fetchClasses();
      } catch (error) {
        alert(getApiErrorMessage(error, 'No se pudo eliminar la clase.'));
      }
    }
  };

  const uploadClassTypeImage = async (classTypeId, file) => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const response = await axios.put(`${API_URL}/class-types/${classTypeId}`, formData);
      setClassTypes((current) => current.map((classType) => (
        classType.id === classTypeId ? response.data : classType
      )));
      await fetchClasses();
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'No se pudo actualizar la imagen.'));
    }
  };

  const createClass = async (e) => {
    e.preventDefault();
    try {
      const payload = buildClassCreatePayload({
        title,
        classTypeId,
        teacherId,
        maxCapacity,
        startTime,
        endTime,
        repeatWeeks,
        fixedUserIds
      });
      const response = await axios.post(`${API_URL}/classes`, payload);
      alert(response.data?.createdCount > 1 ? `${response.data.createdCount} clases creadas` : 'Clase creada');
      setTitle('');
      setClassTypeId('');
      setTeacherId('');
      setMaxCapacity('');
      setStartTime('');
      setEndTime('');
      setRepeatWeeks('1');
      setFixedUserIds([]);
      fetchClasses();
    } catch(err) {
      alert(getApiErrorMessage(err, 'Error creando clase'));
    }
  };

  const teachers = users.filter(u => u.role === 'TEACHER');
  const eligibleClients = users.filter((candidate) => {
    if (candidate.role !== 'CLIENT') return false;
    const status = candidate.monthlyStatus || candidate.estado_mensualidad;
    const expiry = candidate.membershipExpiresAt || candidate.membership_expires_at;
    return status === 'PAGADO' && expiry && new Date(expiry).getTime() > Date.now();
  });
  const toggleFixedUser = (userId) => {
    setFixedUserIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  };

  const nowTime = new Date();
  const upcomingClasses = classes.filter(c => new Date(c.start_time) >= nowTime);
  const pastClasses = classes.filter(c => new Date(c.start_time) < nowTime);

  // === BI ALGORITHMS (STATS) ===
  const categoryStatsRaw = pastClasses.reduce((acc, c) => {
    const title = c.title.toLowerCase().trim();
    const displayTitle = title.charAt(0).toUpperCase() + title.slice(1);
    if (!acc[title]) {
      acc[title] = { name: displayTitle, classesCount: 0, attendeesCount: 0, maxCapacityCount: 0 };
    }
    acc[title].classesCount++;
    acc[title].attendeesCount += (c._count?.reservations || 0);
    acc[title].maxCapacityCount += c.max_capacity;
    return acc;
  }, {});
  const categoryStats = Object.values(categoryStatsRaw).sort((a,b) => b.attendeesCount - a.attendeesCount);

  const teacherStatsRaw = pastClasses.reduce((acc, c) => {
    const cMonth = `${new Date(c.start_time).getFullYear()}-${String(new Date(c.start_time).getMonth()+1).padStart(2,'0')}`;
    if (cMonth !== filterMonth) return acc;

    const tId = c.teacher?.id;
    if (!tId) return acc;

    if (!acc[tId]) {
      acc[tId] = { name: c.teacher?.name || 'Desconocido', hours: 0, classesCount: 0, attendeesCount: 0 };
    }
    const diffMs = new Date(c.end_time) - new Date(c.start_time);
    const hours = diffMs / (1000 * 60 * 60);

    acc[tId].hours += hours;
    acc[tId].classesCount++;
    acc[tId].attendeesCount += (c._count?.reservations || 0);
    return acc;
  }, {});
  const teacherStats = Object.values(teacherStatsRaw).sort((a,b) => b.hours - a.hours);

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-fade-in pb-10">

      {/* NAVEGACIÓN LATERAL (SIDEBAR) */}
      <div className="w-full lg:w-72 flex-shrink-0">
        <div className="glass rounded-2xl p-6 sticky top-28 border-t border-l border-white/10">
          <h2 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-6">Administración</h2>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setTab('classes')}
              className={`text-left px-5 py-3 rounded-xl font-bold transition-all w-full flex items-center justify-between ${tab === 'classes' ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <span>Gestión de Clases</span>
              {tab === 'classes' && <span className="w-2 h-2 rounded-full bg-white"></span>}
            </button>
            <button
              onClick={() => setTab('users')}
              className={`text-left px-5 py-3 rounded-xl font-bold transition-all w-full flex items-center justify-between ${tab === 'users' ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <span>Directorio Usuarios</span>
              {tab === 'users' && <span className="w-2 h-2 rounded-full bg-white"></span>}
            </button>
            <button
              onClick={() => setTab('images')}
              className={`text-left px-5 py-3 rounded-xl font-bold transition-all w-full flex items-center justify-between ${tab === 'images' ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <span>Imágenes de Actividad</span>
              {tab === 'images' && <span className="w-2 h-2 rounded-full bg-white"></span>}
            </button>

            <div className="h-px bg-white/10 my-2"></div>

            <button
              onClick={() => setTab('stats')}
              className={`text-left px-5 py-3 rounded-xl font-bold transition-all w-full flex items-center justify-between ${tab === 'stats' ? 'bg-emerald-500 text-slate-900 shadow-[0_4px_15px_rgba(16,185,129,0.3)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <span>Métricas BI</span>
              {tab === 'stats' && <span className="w-2 h-2 rounded-full bg-slate-900"></span>}
            </button>
            <button
              onClick={() => setTab('payments')}
              className={`text-left px-5 py-3 rounded-xl font-bold transition-all w-full flex items-center justify-between ${tab === 'payments' ? 'bg-cyan-500 text-slate-900 shadow-[0_4px_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <span>Pagos & Avisos</span>
              <span className={`text-xs px-2 py-1 rounded-full ${unreadNotifications.length > 0 ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {unreadNotifications.length}
              </span>
            </button>
            <button
              onClick={() => setTab('settings')}
              className={`text-left px-5 py-3 rounded-xl font-bold transition-all w-full flex items-center justify-between ${tab === 'settings' ? 'bg-amber-500 text-slate-900 shadow-[0_4px_15px_rgba(245,158,11,0.3)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <span>Personalización</span>
              {tab === 'settings' && <span className="w-2 h-2 rounded-full bg-slate-900"></span>}
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <div className="flex-1 min-w-0 glass rounded-2xl p-6 relative border-t border-white/5 min-h-[500px]">

      {/* VIEW: CLASES */}
      {tab === 'classes' && (
        <div className="space-y-8">
          <section className="glass rounded-xl p-6" aria-labelledby="create-class-heading">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Programación</p>
              <h2 id="create-class-heading" className="text-2xl font-bold text-white">Crear nueva clase</h2>
            </div>
            <form onSubmit={createClass} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Título
                <input type="text" required value={title} onChange={event => setTitle(event.target.value)} className="bg-slate-900 border border-slate-700 p-3 rounded text-white" />
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Tipo de actividad
                <select value={classTypeId} onChange={event => setClassTypeId(event.target.value)} className="bg-slate-900 border border-slate-700 p-3 rounded text-slate-300">
                  <option value="">General automático</option>
                  {classTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Profesor
                <select required value={teacherId} onChange={event => setTeacherId(event.target.value)} className="bg-slate-900 border border-slate-700 p-3 rounded text-slate-300">
                  <option value="">Selecciona un profesor</option>
                  {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Capacidad máxima
                <input type="number" min="1" required value={maxCapacity} onChange={event => setMaxCapacity(event.target.value)} className="bg-slate-900 border border-slate-700 p-3 rounded text-white" />
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400 md:col-span-2">
                Repetir cada semana
                <input type="number" min="1" max="52" required value={repeatWeeks} onChange={event => setRepeatWeeks(event.target.value)} className="bg-slate-900 border border-slate-700 p-3 rounded text-white" />
                <span className="font-normal text-slate-500">Indicá cuántas semanas consecutivas querés crear.</span>
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Inicio
                <input type="datetime-local" required value={startTime} onChange={event => setStartTime(event.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-white" />
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Fin
                <input type="datetime-local" required value={endTime} onChange={event => setEndTime(event.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-white" />
              </label>
              <fieldset className="rounded-xl border border-slate-700 bg-slate-950/50 p-4 md:col-span-2">
                <legend className="px-2 text-xs font-bold text-emerald-300">Alumnos fijos</legend>
                <p className="mb-3 text-xs text-slate-500">Quedarán confirmados automáticamente en cada semana creada.</p>
                {eligibleClients.length > 0 ? (
                  <div className="grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                    {eligibleClients.map((client) => (
                      <label key={client.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 p-2 text-xs text-slate-200">
                        <input
                          type="checkbox"
                          checked={fixedUserIds.includes(client.id)}
                          onChange={() => toggleFixedUser(client.id)}
                          className="h-4 w-4 accent-emerald-400"
                        />
                        <span className="truncate">{client.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No hay clientes con cuota activa.</p>
                )}
              </fieldset>
              <button type="submit" className="md:col-span-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold p-3 rounded-lg shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
                {Number(repeatWeeks) > 1 ? `Crear ${repeatWeeks} clases` : 'Crear clase'}
              </button>
            </form>
          </section>

          <ActivitiesCalendar
            role="ADMIN"
            siteName={siteName}
            classes={classes}
            classTypes={classTypes}
            loading={classesLoading}
            error={classesError}
            onRetry={fetchClasses}
            onOpenClass={(gymClass) => setSelectedClassToViewId(gymClass.id)}
            onEditClass={setSelectedClassToEdit}
            onDeleteClass={deleteClass}
          />
        </div>
      )}

      {/* VIEW: BANCO DE IMÁGENES */}
      {tab === 'images' && (
        <div className="space-y-8">
          <section className="glass rounded-xl p-6">
            <ClassTypeImageManager classTypes={classTypes} onUpload={uploadClassTypeImage} />
          </section>

          <section className="glass rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-2 text-purple-400">Banco de imágenes heredado</h2>
          <p className="text-sm text-slate-400 mb-5">Conserva las reglas por palabra clave para clases antiguas que todavía no tengan imagen de tipo.</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const obj = { keyword: e.target.kw.value, image_url: e.target.url.value };
            try { await axios.post(`${API_URL}/image-bank`, obj); fetchImages(); e.target.reset(); }
            catch(err) { alert('Error añadiendo imagen (¿keyword duplicada?)'); }
          }} className="flex flex-col sm:flex-row gap-4 mb-6">
            <input name="kw" type="text" placeholder="Keyword (ej. yoga)" required className="flex-1 bg-slate-900 border border-slate-700 p-3 rounded" />
            <input name="url" type="url" placeholder="https://unsplash..." required className="flex-[2] bg-slate-900 border border-slate-700 p-3 rounded" />
            <button type="submit" className="bg-purple-600 hover:bg-purple-500 font-bold p-3 rounded-lg text-white shadow">Añadir Master Image</button>
          </form>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map(img => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                <img src={img.image_url} alt={img.keyword} className="w-full h-24 object-cover" />
                <div className="absolute inset-0 bg-black/60 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <span className="text-white font-bold text-sm uppercase truncate mb-1">{img.keyword}</span>
                  <button onClick={async() => {await axios.delete(`${API_URL}/image-bank/${img.id}`); fetchImages();}} className="text-xs bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-white font-bold">Borrar</button>
                </div>
              </div>
            ))}
          </div>
          </section>
        </div>
      )}

      {/* VIEW: USUARIOS */}
      {tab === 'users' && (
        <section className="glass rounded-xl p-6 overflow-x-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gym-accent">Directorio de Usuarios</h2>
            <button
              onClick={() => setIsCreateUserOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors flex items-center gap-2"
            >
              <span>+</span> Nuevo Usuario
            </button>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Rol</th>
                  <th className="py-2">Mensualidad</th>
                  <th className="py-2">Vence</th>
                  <th className="py-2">Registro</th>
                  <th className="py-2">Acción</th>
                </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 font-semibold">{u.name}</td>
                  <td className="py-3 text-slate-400">{u.email}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.role==='ADMIN'?'bg-red-500/20 text-red-500':u.role==='TEACHER'?'bg-blue-500/20 text-blue-500':'bg-gym-highlight/20 text-gym-highlight'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.estado_mensualidad === 'PAGADO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {u.role === 'CLIENT' ? u.estado_mensualidad : 'EXENTO'}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400 text-sm">
                    {u.role === 'CLIENT' && u.membership_expires_at ? new Date(u.membership_expires_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 text-slate-400 text-sm">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                  <td className="py-3 flex gap-2">
                    <button onClick={() => onUserClick(u)} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded hover:bg-blue-500 hover:text-white transition-colors">Editar</button>
                    <button onClick={() => openPasswordReset(u)} className="bg-amber-500/20 text-amber-300 px-3 py-1 rounded hover:bg-amber-500 hover:text-slate-950 transition-colors">Cambiar contraseña</button>
                    {u.role === 'CLIENT' && (
                      <button onClick={() => renewMembership(u.id)} className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded hover:bg-emerald-500 hover:text-white transition-colors">Renovar</button>
                    )}
                    <button onClick={() => deleteUser(u.id)} className="bg-gym-warning/20 text-gym-warning px-3 py-1 rounded hover:bg-gym-warning hover:text-white transition-colors">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* VIEW: STATS */}
      {tab === 'stats' && (
        <div className="space-y-8">

          {/* Rentabilidad por Categoría */}
          <section className="glass rounded-xl p-6 overflow-x-auto">
            <h2 className="text-2xl font-bold mb-4 text-green-400">Rentabilidad por Categoría (Histórico Acumulado)</h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2">Categoría de Clase</th>
                  <th className="py-2">Clases Impartidas</th>
                  <th className="py-2">Asistencia Total</th>
                  <th className="py-2">Rentabilidad / Aforo Medio</th>
                </tr>
              </thead>
              <tbody>
                {categoryStats.length === 0 && <tr><td colSpan="4" className="py-4 text-slate-500 text-center">No hay datos históricos para calcular métricas.</td></tr>}
                {categoryStats.map((st, i) => {
                  const percent = Math.round((st.attendeesCount / (st.maxCapacityCount || 1)) * 100);
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 font-bold text-white capitalize">{st.name}</td>
                      <td className="py-3 text-slate-400">{st.classesCount} módulos</td>
                      <td className="py-3 text-slate-300 font-bold">{st.attendeesCount} clientes</td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <span className={`font-bold ${percent >= 75 ? 'text-green-500' : percent >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{percent}%</span>
                          <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div className={`h-full ${percent >= 75 ? 'bg-green-500' : percent >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${percent}%`}}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          {/* Control de Horas del Profesor */}
          <section className="glass rounded-xl p-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-blue-400">Control de Horas del Profesor</h2>
              <input
                type="month"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2">Profesor</th>
                  <th className="py-2">Horas Impartidas</th>
                  <th className="py-2">Clases Dados</th>
                  <th className="py-2">Volumen de Alumnos</th>
                </tr>
              </thead>
              <tbody>
                {teacherStats.length === 0 && <tr><td colSpan="4" className="py-4 text-slate-500 text-center">No hay registros de clases para este mes.</td></tr>}
                {teacherStats.map((st, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 font-bold text-white">{st.name}</td>
                    <td className="py-3 text-blue-400 font-extrabold">{st.hours.toFixed(1)} h</td>
                    <td className="py-3 text-slate-400">{st.classesCount} módulos terminados</td>
                    <td className="py-3 text-slate-400">{st.attendeesCount} asientos</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

        </div>
      )}

      {/* VIEW: PAYMENTS */}
      {tab === 'payments' && (
        <div className="space-y-8">
          <section className="glass rounded-xl p-6 overflow-x-auto">
            <h2 className="text-2xl font-bold mb-4 text-cyan-400">Pagos Pendientes de Revisión</h2>
            {pendingPayments.length === 0 ? (
              <p className="text-slate-500">No hay pagos pendientes.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2">Usuario</th>
                    <th className="py-2">Notas</th>
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayments.map(payment => (
                    <tr key={payment.id} className="border-b border-white/5">
                      <td className="py-3 font-semibold">{payment.user?.name}</td>
                      <td className="py-3 text-slate-400">{payment.notes || 'Pago notificado por el cliente'}</td>
                      <td className="py-3 text-slate-500 text-sm">{new Date(payment.created_at).toLocaleString()}</td>
                      <td className="py-3">
                        <button onClick={() => confirmPayment(payment.id)} className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded hover:bg-emerald-500 hover:text-white transition-colors">
                          Confirmar +1 mes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="glass rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-amber-400">Avisos del Sistema</h2>
            {adminNotifications.length === 0 ? (
              <p className="text-slate-500">Sin avisos.</p>
            ) : (
              <div className="space-y-3">
                {adminNotifications.map(notification => (
                  <div key={notification.id} className={`p-4 rounded-xl border ${notification.read_at ? 'bg-slate-900/40 border-white/5 opacity-70' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{notification.title}</p>
                        <p className="text-sm text-slate-300">{notification.message}</p>
                        <p className="text-xs text-slate-500 mt-1">{new Date(notification.created_at).toLocaleString()}</p>
                      </div>
                      {!notification.read_at && (
                        <button onClick={() => markNotificationRead(notification.id)} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded">
                          Marcar leído
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* VIEW: SETTINGS (WHITE LABELING) */}
      {tab === 'settings' && (
        <section className="glass rounded-xl p-8 max-w-2xl mx-auto animate-fade-in relative z-10">
          <h2 className="text-3xl font-extrabold text-amber-500 mb-6 tracking-tight">Marca Blanca & UI</h2>
          <p className="text-slate-400 mb-8 font-medium">Personaliza la identidad corporativa de la aplicación para adaptar el sistema a tu modelo de negocio.</p>

          <form onSubmit={handleUpdateSettings} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Nombre del Sistema</label>
              <input
                type="text"
                value={appSettings.app_name}
                onChange={e => setAppSettings({...appSettings, app_name: e.target.value})}
                placeholder="Ej. Titanium Fitness"
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Imagen Hero (Portada Login)</label>
              <input
                type="file"
                accept="image/*"
                onChange={e => setHeroImageFile(e.target.files[0])}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-slate-900 hover:file:bg-amber-400 focus:outline-none transition-all cursor-pointer"
              />
              {appSettings.hero_image && !heroImageFile && (
                <div className="mt-4">
                  <p className="text-xs text-slate-400 mb-2">Portada en uso:</p>
                  <img src={appSettings.hero_image} alt="Portada global" className="h-32 rounded-lg object-cover border border-slate-700/50" />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 tracking-wide text-gray-900 font-extrabold py-4 px-4 rounded-xl shadow-[0_10px_30px_rgba(245,158,11,0.2)] transition-transform transform hover:scale-[1.02]"
            >
              Guardar Configuración Global
            </button>
          </form>
        </section>
      )}

      </div>

      <EditClassModal
        isOpen={!!selectedClassToEdit}
        onClose={() => setSelectedClassToEdit(null)}
        classData={selectedClassToEdit}
        onUpdate={fetchClasses}
        users={users}
        classTypes={classTypes}
      />

      <ClassDetailsModal
        isOpen={!!selectedClassToView}
        onClose={() => setSelectedClassToViewId(null)}
        cls={selectedClassToView}
        onUserClick={(usr) => { setSelectedClassToViewId(null); onUserClick(usr); }}
        onChanged={fetchClasses}
      />

      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        onUpdate={() => {
          fetchUsers();
        }}
      />

      {passwordUser && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closePasswordReset}></div>
          <form onSubmit={resetUserPassword} className="relative w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl">
            <button type="button" onClick={closePasswordReset} className="absolute top-4 right-4 text-slate-400 hover:text-white">x</button>
            <h2 className="text-2xl font-bold text-amber-300 mb-2">Cambiar contraseña</h2>
            <p className="text-sm text-slate-400 mb-5">
              Usuario: <span className="font-bold text-white">{passwordUser.name}</span>
            </p>
            <label className="block text-xs text-slate-400 mb-1">Nueva contraseña</label>
            <input
              type="password"
              autoComplete="new-password"
              value={passwordValue}
              onChange={(event) => setPasswordValue(event.target.value)}
              minLength={8}
              required
              className="w-full bg-slate-950 border border-slate-700 text-slate-100 p-3 rounded-lg"
            />
            <p className="text-[11px] text-slate-500 mt-2">Mínimo 8 caracteres. No se muestra ni se guarda en texto plano.</p>
            <button
              type="submit"
              disabled={passwordLoading || passwordValue.trim().length < 8}
              className="mt-5 w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold p-3 rounded-lg transition-colors"
            >
              {passwordLoading ? 'Cambiando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
