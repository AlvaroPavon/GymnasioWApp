import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/classes');
      setClasses(res.data);
    } catch (error) {
      console.error("Error fetching classes", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (classId) => {
    try {
      await axios.post(`http://localhost:3000/api/classes/${classId}/reserve`);
      alert("Reserva confirmada con éxito");
      fetchClasses(); // Update capacities
    } catch (error) {
      alert(error.response?.data?.message || "Error al reservar");
    }
  };

  return (
    <div className="min-h-screen bg-gym-dark p-6">
      <nav className="flex justify-between items-center glass px-6 py-4 rounded-2xl mb-8">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gym-highlight to-gym-accent">
          Panel de {user.role === 'ADMIN' ? 'Administración' : user.role === 'TEACHER' ? 'Profesor' : 'Cliente'}
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-slate-300">Hola, {user.name}</span>
          <button 
            onClick={logout}
            className="bg-slate-700 hover:bg-gym-warning transition-colors px-4 py-2 rounded-lg text-sm font-semibold text-white"
          >
            Salir
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-slate-100">Clases Disponibles</h2>
        
        {loading ? (
          <p className="text-slate-400">Cargando clases...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls, idx) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                key={cls.id} 
                className="glass p-6 rounded-2xl hover:border-gym-accent/50 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white group-hover:text-gym-accent transition-colors">{cls.title}</h3>
                  <span className="bg-gym-card text-gym-highlight px-3 py-1 rounded-full text-xs font-semibold border border-gym-highlight/20">
                    {cls._count?.reservations || 0} / {cls.max_capacity}
                  </span>
                </div>
                {cls.description && <p className="text-slate-400 text-sm mb-4 line-clamp-2">{cls.description}</p>}
                
                <div className="text-sm text-slate-300 mb-6 space-y-1">
                  <p>🗓 {new Date(cls.start_time).toLocaleDateString()} - {new Date(cls.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  <p>👤 Profesor: {cls.teacher?.name}</p>
                </div>

                {user.role === 'CLIENT' && (
                  <button 
                    onClick={() => handleReserve(cls.id)}
                    disabled={(cls._count?.reservations || 0) >= cls.max_capacity}
                    className="w-full bg-gym-accent hover:bg-blue-600 disabled:opacity-50 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-xl transition-all"
                  >
                    {(cls._count?.reservations || 0) >= cls.max_capacity ? 'Clase Llena' : 'Reservar Plaza'}
                  </button>
                )}
              </motion.div>
            ))}
            
            {classes.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-500">
                No hay clases programadas en este momento.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
