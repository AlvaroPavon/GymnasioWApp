import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ClassDetailsModal({ isOpen, onClose, cls, onUserClick }) {
  if (!isOpen || !cls) return null;

  const isFull = (cls._count?.reservations || 0) >= cls.max_capacity;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        {/* Backdrop super oscuro para enfocarnos en la clase */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="relative w-full max-w-3xl bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row z-50 max-h-[90vh]"
        >
          <button onClick={onClose} className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black text-white rounded-full transition-colors">✕</button>

          {/* Columna Izquierda: Foto y Detalles Main */}
          <div className="md:w-1/2 relative bg-black">
            {cls.image_url ? (
              <img src={cls.image_url} alt={cls.title} className="w-full h-48 md:h-full object-cover opacity-80" />
            ) : (
              <div className="w-full h-48 md:h-full bg-gradient-to-tr from-slate-800 to-slate-900 flex items-center justify-center">
                <span className="text-4xl">🏋️‍♂️</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
              <span className="bg-gym-accent text-white text-xs font-bold px-3 py-1 rounded-full mb-2 inline-block">
                {isFull ? 'Aforo Completo' : 'Plazas Disponibles'}
              </span>
              <h2 className="text-3xl font-extrabold text-white mb-1 shadow-black drop-shadow-md">{cls.title}</h2>
              <p className="text-slate-300 shadow-black drop-shadow-sm line-clamp-3 mb-4">{cls.description || 'Sin descripción adicional.'}</p>
              
              <div className="flex items-center gap-3">
                <div 
                  onClick={() => onUserClick(cls.teacher)}
                  className="w-10 h-10 rounded-full border-2 border-gym-highlight overflow-hidden cursor-pointer hover:scale-110 transition-transform" 
                  title="Ver perfil del Profesor"
                >
                  {cls.teacher?.profile_picture ? (
                    <img src={cls.teacher.profile_picture} alt="Teacher" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gym-highlight flex items-center justify-center text-slate-900 font-bold">
                      {cls.teacher?.name?.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-400">Profesor asignado</p>
                  <p className="text-sm font-bold text-white hover:text-gym-highlight cursor-pointer" onClick={() => onUserClick(cls.teacher)}>
                    {cls.teacher?.name}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Información de tiempo y Listado de Usuarios */}
          <div className="md:w-1/2 p-6 flex flex-col h-auto md:max-h-full overflow-y-auto custom-scrollbar">
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Fecha y Hora</p>
                <p className="text-white font-bold">{new Date(cls.start_time).toLocaleDateString()}</p>
                <p className="text-gym-highlight font-semibold">
                  {new Date(cls.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(cls.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Ocupación</p>
                <p className="text-white font-bold text-2xl">{cls._count?.reservations || 0} / <span className="text-slate-500">{cls.max_capacity}</span></p>
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Asistentes Confirmados</h3>
              
              {cls.reservations && cls.reservations.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {cls.reservations.map(res => (
                    <div 
                      key={res.user.id} 
                      onClick={() => onUserClick(res.user)}
                      className="bg-slate-800 rounded-lg p-2 flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors border border-transparent hover:border-slate-500"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-900 flex items-center justify-center">
                        {res.user.profile_picture ? (
                          <img src={res.user.profile_picture} alt="Pupil" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-400 font-bold text-lg">{res.user.name.charAt(0)}</span>
                        )}
                      </div>
                      <p className="text-xs text-white font-semibold text-center truncate w-full" title={res.user.name}>{res.user.name.split(' ')[0]}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <span className="text-3xl block mb-2">🍃</span>
                  Aún no hay reservas.
                </div>
              )}
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
