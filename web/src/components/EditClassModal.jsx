import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function EditClassModal({ isOpen, onClose, classData, onUpdate, users = [] }) {
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (classData) {
      setTitle(classData.title || '');
      setTeacherId(classData.teacher_id || '');
      setMaxCapacity(classData.max_capacity || '');
      // Format to YYYY-MM-DDTHH:mm
      setStartTime(classData.start_time ? new Date(classData.start_time).toISOString().slice(0, 16) : '');
      setEndTime(classData.end_time ? new Date(classData.end_time).toISOString().slice(0, 16) : '');
    }
  }, [classData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!classData) return;
    try {
      setLoading(true);
      await axios.put(`http://localhost:3000/api/classes/${classData.id}`, {
        title,
        teacher_id: Number(teacherId),
        max_capacity: Number(maxCapacity),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString()
      });
      onUpdate();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Error actualizando clase');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !classData) return null;

  const teachers = users.filter(u => u.role === 'TEACHER');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl z-10"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white pb-1 w-8 h-8 flex items-center justify-center bg-slate-800 rounded-full">x</button>
          
          <h2 className="text-2xl font-bold mb-4 text-gym-accent">Editar Clase</h2>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">Título de la Clase</label>
              <input type="text" required value={title} onChange={e=>setTitle(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-white" />
            </div>
            
            {user.role === 'ADMIN' && (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400">Profesor (Solo Admin)</label>
                <select required value={teacherId} onChange={e=>setTeacherId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-slate-300">
                  <option value="">Selecciona Profesor</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400">Capacidad Máxima (Aforo)</label>
              <input type="number" required value={maxCapacity} onChange={e=>setMaxCapacity(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-white" />
            </div>

            <div></div>

            <div>
              <label className="text-xs text-slate-400">Inicio (Local)</label>
              <input type="datetime-local" required value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-white sm:text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Fin (Local)</label>
              <input type="datetime-local" required value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-white sm:text-sm" />
            </div>
            
            <button type="submit" disabled={loading} className="md:col-span-2 mt-4 bg-gym-highlight hover:bg-green-600 disabled:opacity-50 text-slate-900 font-bold p-3 rounded-lg shadow-lg transition-colors">
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
