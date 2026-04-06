import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EditClassModal from './EditClassModal';
import CreateUserModal from './CreateUserModal';

const API_URL = 'http://localhost:3000/api';

export default function AdminPanel({ onUserClick }) {
  const [tab, setTab] = useState('classes'); // 'classes' | 'users' | 'images'
  
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [images, setImages] = useState([]);
  
  const [selectedClassToEdit, setSelectedClassToEdit] = useState(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  
  const [appSettings, setAppSettings] = useState({ app_name: '' });
  const [heroImageFile, setHeroImageFile] = useState(null);

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  
  // Class form
  const [title, setTitle] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchClasses();
    fetchImages();
    fetchSettings();
  }, []);

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
    const res = await axios.get(`${API_URL}/classes`);
    setClasses(res.data);
  };

  const fetchImages = async () => {
    const res = await axios.get(`${API_URL}/image-bank`);
    setImages(res.data);
  };

  const deleteUser = async (id) => {
    if(confirm('¿Eliminar usuario?')) {
      await axios.delete(`${API_URL}/users/${id}`);
      fetchUsers();
    }
  };

  const deleteClass = async (id) => {
    if(confirm('¿Cancelar y borrar clase?')) {
      await axios.delete(`http://localhost:3000/api/classes/${id}`);
      fetchClasses();
    }
  };

  const createClass = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/classes', {
        title,
        teacher_id: Number(teacherId),
        max_capacity: Number(maxCapacity),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString()
      });
      alert('Clase creada');
      fetchClasses();
    } catch(err) {
      alert(err.response?.data?.message || 'Error creando clase');
    }
  };

  const teachers = users.filter(u => u.role === 'TEACHER');

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
              <span>Banco de Imágenes</span>
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
          <section className="glass rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-gym-accent">Crear Nueva Clase</h2>
            <form onSubmit={createClass} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Título" required value={title} onChange={e=>setTitle(e.target.value)} className="bg-slate-900 border border-slate-700 p-3 rounded" />
              <select required value={teacherId} onChange={e=>setTeacherId(e.target.value)} className="bg-slate-900 border border-slate-700 p-3 rounded text-slate-300">
                <option value="">Selecciona Profesor</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input type="number" placeholder="Capacidad Máxima" required value={maxCapacity} onChange={e=>setMaxCapacity(e.target.value)} className="bg-slate-900 border border-slate-700 p-3 rounded" />
              <div>
                <label className="text-xs text-slate-400">Inicio (YYYY-MM-DD THH:MM)</label>
                <input type="datetime-local" required value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Fin (YYYY-MM-DD THH:MM)</label>
                <input type="datetime-local" required value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded" />
              </div>
              <button type="submit" className="md:col-span-2 bg-gym-highlight hover:bg-green-600 text-slate-900 font-bold p-3 rounded-lg shadow-lg">Lanzar Clase</button>
            </form>
          </section>

          <section className="glass rounded-xl p-6 overflow-x-auto">
            <h2 className="text-2xl font-bold mb-4 text-gym-highlight">Próximas Clases & Activas</h2>
            <table className="w-full text-left border-collapse mb-8">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2">Clase</th>
                  <th className="py-2">Profesor</th>
                  <th className="py-2">Ocupación</th>
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {upcomingClasses.length === 0 && <tr><td colSpan="5" className="py-4 text-slate-500 text-center">No hay clases futuras programadas.</td></tr>}
                {upcomingClasses.map(c => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 font-semibold">{c.title}</td>
                    <td className="py-3 text-slate-300">{c.teacher?.name}</td>
                    <td className="py-3 text-gym-highlight">{c._count?.reservations}/{c.max_capacity}</td>
                    <td className="py-3 text-slate-400 text-sm">{new Date(c.start_time).toLocaleString()}</td>
                    <td className="py-3 flex gap-2">
                      <button onClick={() => setSelectedClassToEdit(c)} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded hover:bg-blue-500 hover:text-white transition-colors">Editar</button>
                      <button onClick={() => deleteClass(c.id)} className="bg-gym-warning/20 text-gym-warning px-3 py-1 rounded hover:bg-gym-warning hover:text-white transition-colors">Cancelar Módulo</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className="text-2xl font-bold mb-4 text-slate-400">Histórico de Clases Pasadas</h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-500">
                  <th className="py-2">Clase</th>
                  <th className="py-2">Profesor</th>
                  <th className="py-2">Ocupación</th>
                  <th className="py-2">Fecha Finalizada</th>
                  <th className="py-2">Admin Acción</th>
                </tr>
              </thead>
              <tbody>
                {pastClasses.length === 0 && <tr><td colSpan="5" className="py-4 text-slate-600 text-center">No hay registro en el histórico.</td></tr>}
                {pastClasses.map(c => (
                  <tr key={c.id} className="border-b border-white/5 opacity-60 hover:opacity-100 transition-opacity">
                    <td className="py-3 font-semibold text-slate-300">{c.title}</td>
                    <td className="py-3 text-slate-400">{c.teacher?.name}</td>
                    <td className="py-3 text-blue-400">{c._count?.reservations}/{c.max_capacity}</td>
                    <td className="py-3 text-slate-500 text-sm">{new Date(c.start_time).toLocaleString()}</td>
                    <td className="py-3">
                      <button onClick={() => deleteClass(c.id)} className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 rounded hover:bg-red-500 hover:text-white transition-colors text-xs">Borrar Registro</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* VIEW: BANCO DE IMÁGENES */}
      {tab === 'images' && (
        <section className="glass rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-4 text-purple-400">Banco de Imágenes de Clase</h2>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const obj = { keyword: e.target.kw.value, image_url: e.target.url.value };
            try { await axios.post('http://localhost:3000/api/image-bank', obj); fetchData(); e.target.reset(); }
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
                <div className="absolute inset-0 bg-black/60 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-bold text-sm uppercase truncate mb-1">{img.keyword}</span>
                  <button onClick={async() => {await axios.delete(`http://localhost:3000/api/image-bank/${img.id}`); fetchData();}} className="text-xs bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-white font-bold">Borrar</button>
                </div>
              </div>
            ))}
          </div>
        </section>
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
                  <td className="py-3 text-slate-400 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-3 flex gap-2">
                    <button onClick={() => onUserClick(u)} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded hover:bg-blue-500 hover:text-white transition-colors">Editar</button>
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
      />

      <CreateUserModal 
        isOpen={isCreateUserOpen} 
        onClose={() => setIsCreateUserOpen(false)} 
        onSuccess={() => {
          fetchUsers();
        }} 
      />
    </div>
  );
}
