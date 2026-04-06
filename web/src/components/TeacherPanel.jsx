import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import EditClassModal from './EditClassModal';

export default function TeacherPanel({ onUserClick }) {
  const [classes, setClasses] = useState([]);
  const [tab, setTab] = useState('upcoming'); // 'upcoming' | 'past'
  const [classToEdit, setClassToEdit] = useState(null);

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
        <h2 className="text-xl font-bold text-white px-4">Tus Clases</h2>
        <div className="flex bg-black rounded-lg p-1">
          <button 
            onClick={() => setTab('upcoming')}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${tab === 'upcoming' ? 'bg-gym-highlight text-slate-900' : 'text-slate-400 hover:text-white'}`}
          >
            Actuales / Futuras
          </button>
          <button 
            onClick={() => setTab('past')}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${tab === 'past' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Histórico Antiguo
          </button>
        </div>
      </div>

      {scheduleMap.length === 0 ? (
        <div className="text-center py-20 glass rounded-xl">
          <p className="text-slate-400 text-lg">No hay clases {tab === 'upcoming' ? 'programadas' : 'pasadas'}.</p>
        </div>
      ) : (
        <div className="flex flex-row gap-6 overflow-x-auto pb-4 custom-scrollbar">
          {scheduleMap.map(({ date, classes: dayClasses }) => (
            <div key={date} className="min-w-[320px] flex-shrink-0">
              <div className="bg-slate-900 border border-slate-800 rounded-t-xl p-3 text-center">
                <h3 className="text-lg font-bold text-slate-100 capitalize">{date}</h3>
              </div>
              <div className="glass rounded-b-xl border-t-0 p-4 space-y-4 min-h-[300px]">
                {dayClasses.map(c => (
                  <motion.div 
                    key={c.id} 
                    className={`bg-slate-800/50 p-4 rounded-xl border border-white/5 shadow-sm relative overflow-hidden ${tab === 'past' ? 'opacity-80 grayscale-[30%]' : ''}`}
                  >
                    {/* Imagen de fondo disimulada */}
                    {c.image_url && (
                      <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    
                    <div className="relative z-10 cursor-pointer" onClick={() => setSelectedClass(c)}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-xs font-bold text-gym-highlight">
                          {new Date(c.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        {tab === 'upcoming' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setClassToEdit(c); }}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded transition-colors"
                          >
                            Editar
                          </button>
                        )}
                      </div>
                      <h4 className="font-bold text-white mb-2 hover:text-gym-accent transition-colors">{c.title}</h4>
                      <div className="flex justify-between items-center text-xs text-slate-400 mb-4">
                        <span>Aforo: {c._count?.reservations}/{c.max_capacity}</span>
                        <span>{new Date(c.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                    
                    <div className="bg-slate-900/50 rounded-xl p-3 border border-white/5 relative z-10">
                      <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Alumnos Apuntados</h4>
                      {c.reservations && c.reservations.length > 0 ? (
                        <ul className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                          {c.reservations.map(res => (
                            <li key={res.user.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors" onClick={() => onUserClick(res.user)}>
                              <div className="w-6 h-6 rounded-full bg-slate-800 border border-gym-accent overflow-hidden flex items-center justify-center text-gym-accent text-xs font-bold">
                                {res.user.profile_picture ? (
                                  <img src={res.user.profile_picture} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  res.user.name.charAt(0)
                                )}
                              </div>
                              <div className="flex-1 truncate">
                                <p className="text-xs text-slate-100 font-semibold truncate">{res.user.name}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-500 text-xs italic">Aún vacío.</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT CLASS MODAL */}
      <EditClassModal 
        isOpen={!!classToEdit} 
        onClose={() => setClassToEdit(null)} 
        classData={classToEdit} 
        onUpdate={fetchClasses} 
      />
    </div>
  );
}
