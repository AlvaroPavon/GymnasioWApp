import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import { API_URL, getApiErrorMessage } from '../lib/api';

export default function CreateClassModal({ isOpen, onClose, onCreated, classTypes = [] }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [title, setTitle] = useState('');
  const [classTypeId, setClassTypeId] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button, input, select')]
        .filter((element) => !element.disabled);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  const resetForm = () => {
    setTitle('');
    setClassTypeId('');
    setMaxCapacity('');
    setStartTime('');
    setEndTime('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      await axios.post(`${API_URL}/classes`, {
        title,
        tipo_clase_id: classTypeId ? Number(classTypeId) : undefined,
        max_capacity: Number(maxCapacity),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString()
      });
      resetForm();
      await onCreated?.();
      onClose();
    } catch (error) {
      alert(getApiErrorMessage(error, 'No se pudo crear la clase.'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-class-title"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            Cerrar
          </button>

          <h2 id="create-class-title" className="mb-2 text-2xl font-bold text-emerald-300">Crear clase</h2>
          <p className="mb-5 pr-16 text-xs text-slate-500">La clase quedará asignada a tu perfil de profesor.</p>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              Título de la clase
              <input type="text" required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400" />
            </label>

            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              Tipo de clase
              <select value={classTypeId} onChange={(event) => setClassTypeId(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-slate-300 focus-visible:outline-2 focus-visible:outline-blue-400">
                <option value="">General automático</option>
                {classTypes.map((type) => <option key={type.id} value={type.id}>{type.name || type.nombre}</option>)}
              </select>
            </label>

            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              Capacidad máxima
              <input type="number" min="1" required value={maxCapacity} onChange={(event) => setMaxCapacity(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400" />
            </label>

            <label className="grid gap-1 text-xs text-slate-400">
              Inicio
              <input type="datetime-local" required value={startTime} onChange={(event) => setStartTime(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400" />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              Fin
              <input type="datetime-local" required value={endTime} onChange={(event) => setEndTime(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400" />
            </label>

            <button type="submit" disabled={loading} className="mt-3 rounded-lg bg-emerald-400 p-3 font-bold text-slate-950 shadow-lg transition-colors hover:bg-emerald-300 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-400 md:col-span-2">
              {loading ? 'Creando…' : 'Crear clase'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
