import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL, getApiErrorMessage } from '../lib/api';
import { buildClassUpdatePayload, instantToLocalDateTimeInput } from '../lib/classPayload';

export default function EditClassModal({ isOpen, onClose, classData, onUpdate, users = [], classTypes = [] }) {
  const { user } = useAuth();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [title, setTitle] = useState('');
  const [classTypeId, setClassTypeId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [imageOverride, setImageOverride] = useState({ classId: null, value: '', dirty: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setImageOverride({ classId: null, value: '', dirty: false });
      return;
    }
    if (!classData) return;
    setTitle(classData.title || '');
    setClassTypeId(classData.tipo_clase_id || classData.classTypeId || '');
    setTeacherId(classData.teacher_id || classData.teacherId || '');
    setMaxCapacity(classData.max_capacity || classData.maxCapacity || '');
    setStartTime(instantToLocalDateTimeInput(classData.start_time));
    setEndTime(instantToLocalDateTimeInput(classData.end_time));
    setImageOverride((current) => {
      if (current.classId === classData.id && current.dirty) return current;
      return {
        classId: classData.id,
        value: classData.imageOverrideUrl ?? classData.image_override_url ?? '',
        dirty: false
      };
    });
  }, [classData, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button, input, select')].filter((element) => !element.disabled);
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!classData) return;
    try {
      setLoading(true);
      const payload = buildClassUpdatePayload({
        title,
        classTypeId,
        classTypes,
        teacherId: user.role === 'ADMIN' ? teacherId : '',
        maxCapacity,
        startTime,
        endTime,
        originalStartTime: classData.start_time,
        originalEndTime: classData.end_time,
        imageOverrideUrl: imageOverride.value,
        imageOverrideDirty: imageOverride.dirty
      });
      await axios.put(`${API_URL}/classes/${classData.id}`, payload);
      await onUpdate();
      onClose();
    } catch (error) {
      alert(getApiErrorMessage(error, 'No se pudo actualizar la clase.'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !classData) return null;
  const teachers = users.filter((candidate) => candidate.role === 'TEACHER');

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
          aria-labelledby="edit-class-title"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        >
          <button ref={closeButtonRef} type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400">
            Cerrar
          </button>

          <h2 id="edit-class-title" className="mb-2 text-2xl font-bold text-blue-300">Editar clase</h2>
          <p className="mb-5 pr-16 text-xs text-slate-500">La imagen del tipo de actividad se usa salvo que definas una URL específica para esta clase.</p>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              Título de la clase
              <input type="text" required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400" />
            </label>

            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              Tipo de clase
              <select value={classTypeId} onChange={(event) => setClassTypeId(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-slate-300 focus-visible:outline-2 focus-visible:outline-blue-400">
                <option value="">General automático</option>
                {classTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </label>

            {user.role === 'ADMIN' && (
              <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
                Profesor
                <select required value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-slate-300 focus-visible:outline-2 focus-visible:outline-blue-400">
                  <option value="">Selecciona un profesor</option>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                </select>
              </label>
            )}

            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              Capacidad máxima
              <input type="number" min="1" required value={maxCapacity} onChange={(event) => setMaxCapacity(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400" />
            </label>

            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              URL de imagen específica
              <input
                type="url"
                value={imageOverride.value}
                onChange={(event) => setImageOverride((current) => ({ ...current, value: event.target.value, dirty: true }))}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400"
              />
              <span className="text-[11px] text-slate-500">Borrá la URL para volver a usar la imagen del tipo de actividad.</span>
            </label>

            <label className="grid gap-1 text-xs text-slate-400">
              Inicio
              <input type="datetime-local" step="0.001" required value={startTime} onChange={(event) => setStartTime(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400" />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              Fin
              <input type="datetime-local" step="0.001" required value={endTime} onChange={(event) => setEndTime(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400" />
            </label>

            <button type="submit" disabled={loading} className="mt-3 rounded-lg bg-emerald-400 p-3 font-bold text-slate-950 shadow-lg transition-colors hover:bg-emerald-300 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-400 md:col-span-2">
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
