import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ClassDetailsModal from './ClassDetailsModal';

export default function ClientCalendar({ userId, onUserClick }) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [tab, setTab] = useState('upcoming'); // 'upcoming' | 'past'
  
  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/classes');
      setClasses(res.data);
    } catch(err) {
      console.error(err);
    }
  };

  const handleAction = async (classId, isReserved) => {
    const endpoint = isReserved ? 'cancel' : 'reserve';
    try {
      await axios.post(`http://localhost:3000/api/classes/${classId}/${endpoint}`);
      fetchClasses();
    } catch(err) {
      alert(err.response?.data?.message || 'Error en la acción');
    }
  };

  const now = new Date();
  
  // Custom filter logic
  const filteredClasses = classes.filter(c => {
    const classTime = new Date(c.start_time);
    return tab === 'upcoming' ? classTime >= now : classTime < now;
  });

  // Agrupamos la data filtrada por día
  const getDays = () => {
    const days = {};
    filteredClasses.forEach(c => {
      const date = new Date(c.start_time).toLocaleDateString();
      if (!days[date]) days[date] = [];
      days[date].push(c);
    });
    return Object.keys(days).sort((a,b) => tab === 'upcoming' ? new Date(a) - new Date(b) : new Date(b) - new Date(a)).map(d => ({ date: d, classes: days[d] }));
  };

  const scheduleMap = getDays();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 border border-white/5 rounded-xl p-2 gap-2">
        <h2 className="text-xl font-bold text-white px-4">Calendario</h2>
        <div className="flex bg-black rounded-lg p-1">
          <button 
            onClick={() => setTab('upcoming')}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${tab === 'upcoming' ? 'bg-gym-accent text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Próximas Clases
          </button>
          <button 
            onClick={() => setTab('past')}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${tab === 'past' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Histórico Asistidas
          </button>
        </div>
      </div>

      {scheduleMap.length === 0 ? (
        <div className="text-center py-20 glass rounded-xl">
          <p className="text-slate-400 text-lg">No hay clases {tab === 'upcoming' ? 'disponibles esta semana' : 'en tu historial'}.</p>
        </div>
      ) : (
        <div className="flex flex-row gap-6 overflow-x-auto pb-4 custom-scrollbar">
          {scheduleMap.map(({ date, classes: dayClasses }) => (
            <div key={date} className="min-w-[300px] flex-shrink-0">
              <div className="bg-slate-900 border border-slate-800 rounded-t-xl p-3 text-center">
                <h3 className="text-lg font-bold text-slate-100 capitalize">{date}</h3>
              </div>
              <div className="glass rounded-b-xl border-t-0 p-4 space-y-4 min-h-[300px]">
                {dayClasses.map(c => {
                  // Revisa si yo la tengo reservada
                  // Wait, en Client no nos llega la relación de reservations tan facil desde el backend si no hicimos el query raw, 
                  // pero si sabemos si hay disponibilidad. 
                  const isFull = (c._count?.reservations || 0) >= c.max_capacity;
                  const myReservation = c.reservations?.find(r => r.user.id === userId);
                  const isReservedByMe = !!myReservation;
                  
                  // Si estamos en el historial, solo queremos ver A LAS QUE ASISTIMOS.
                  // Si el tab es 'past' y NO estaba reservada por mí, la escondemos y devolvemos null
                  if (tab === 'past' && !isReservedByMe) return null;

                  return (
                    <motion.div 
                      key={c.id} 
                      className={`bg-slate-800/50 p-4 rounded-xl border border-white/5 shadow-sm relative overflow-hidden ${tab==='past' ? 'opacity-80 grayscale-[30%]' : ''}`}
                    >
                      {/* Imagen de fondo disimulada */}
                      {c.image_url && (
                        <div className="absolute inset-0 opacity-20 pointer-events-none">
                          <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      
                      <div className="relative z-10 cursor-pointer" onClick={() => setSelectedClass(c)}>
                        <div className="text-xs font-bold text-gym-highlight mb-1">
                          {new Date(c.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <h4 className="font-bold text-white mb-2 hover:text-gym-accent transition-colors">{c.title}</h4>
                        <div className="flex justify-between items-center text-xs text-slate-400 mb-4">
                          <span>👤 {c.teacher?.name}</span>
                          <span>{c._count?.reservations}/{c.max_capacity} pl</span>
                        </div>
                      </div>

                      {tab === 'upcoming' && (
                        <div className="relative z-10">
                          {isReservedByMe ? (
                            <button 
                              onClick={() => handleAction(c.id, true)}
                              className="w-full bg-slate-900 border border-gym-warning/50 hover:bg-gym-warning/80 text-gym-warning hover:text-white text-xs font-bold py-2 rounded transition-colors"
                            >
                              Cancelar Reserva
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleAction(c.id, false)}
                              disabled={isFull}
                              className="w-full bg-gym-accent hover:bg-blue-600 disabled:opacity-50 disabled:bg-slate-700 text-white text-xs font-bold py-2 rounded transition-colors"
                            >
                              {isFull ? 'Aforo Completo' : 'Reservar Plaza'}
                            </button>
                          )}
                        </div>
                      )}

                      {tab === 'past' && (
                         <div className="relative z-10 mt-2">
                           <span className="text-xs bg-gym-highlight text-black font-bold px-2 py-1 rounded">Asistida</span>
                         </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CLASE DETALLE */}
      <ClassDetailsModal 
        isOpen={!!selectedClass} 
        onClose={() => setSelectedClass(null)} 
        cls={selectedClass} 
        onUserClick={(usr) => { setSelectedClass(null); onUserClick(usr); }}
      />
    </div>
  );
}
