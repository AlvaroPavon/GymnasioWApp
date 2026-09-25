import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import { API_URL, getApiErrorMessage } from '../lib/api';
import { buildClassCreatePayload } from '../lib/classPayload';

export default function CreateClassModal({ isOpen, onClose, onCreated, classTypes = [] }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [title, setTitle] = useState('');
  const [classTypeId, setClassTypeId] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [repeatWeeks, setRepeatWeeks] = useState('1');
  const [eligibleClients, setEligibleClients] = useState([]);
  const [fixedUserIds, setFixedUserIds] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setClientsLoading(true);
    axios.get(`${API_URL}/users/eligible-clients`)
      .then((response) => {
        if (active) setEligibleClients(response.data || []);
      })
      .catch(() => {
        if (active) setEligibleClients([]);
      })
      .finally(() => {
        if (active) setClientsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

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
    setRepeatWeeks('1');
    setFixedUserIds([]);
  };

  const toggleFixedUser = (userId) => {
    setFixedUserIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      const payload = buildClassCreatePayload({
        title,
        classTypeId,
        maxCapacity,
        startTime,
        endTime,
        repeatWeeks,
        fixedUserIds
      });
      await axios.post(`${API_URL}/classes`, payload);
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
          className="custom-scrollbar relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white focus-visible:outline-2 focus-visible:outline-red-400"
          >
            Cerrar
          </button>

          <h2 id="create-class-title" className="mb-2 text-2xl font-bold text-red-300">Crear clase</h2>
          <p className="mb-5 pr-16 text-xs text-slate-500">La clase quedará asignada a tu perfil de profesor.</p>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              Título de la clase
              <input type="text" required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-red-400" />
            </label>

            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              Tipo de clase
              <select value={classTypeId} onChange={(event) => setClassTypeId(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-slate-300 focus-visible:outline-2 focus-visible:outline-red-400">
                <option value="">General automático</option>
                {classTypes.map((type) => <option key={type.id} value={type.id}>{type.name || type.nombre}</option>)}
              </select>
            </label>

            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              Capacidad máxima
              <input type="number" min="1" required value={maxCapacity} onChange={(event) => setMaxCapacity(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-red-400" />
            </label>

            <label className="grid gap-1 text-xs text-slate-400 md:col-span-2">
              Repetición semanal
              <input type="number" min="1" max="52" required value={repeatWeeks} onChange={(event) => setRepeatWeeks(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-red-400" />
              <span className="text-[11px] text-slate-500">1 crea solo esta clase; un valor mayor repite el mismo horario cada semana.</span>
            </label>

            <label className="grid gap-1 text-xs text-slate-400">
              Inicio
              <input type="datetime-local" required value={startTime} onChange={(event) => setStartTime(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-red-400" />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              Fin
              <input type="datetime-local" required value={endTime} onChange={(event) => setEndTime(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-3 text-white focus-visible:outline-2 focus-visible:outline-red-400" />
            </label>

            <fieldset className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 md:col-span-2">
              <legend className="px-2 text-xs font-bold text-red-300">Alumnos fijos</legend>
              <p className="mb-3 text-[11px] text-slate-500">Se reservarán automáticamente en todas las semanas creadas.</p>
              {clientsLoading ? (
                <p className="text-xs text-slate-400">Cargando alumnos…</p>
              ) : eligibleClients.length > 0 ? (
                <div className="grid max-h-40 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {eligibleClients.map((client) => (
                    <label key={client.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-800 p-2 text-xs text-slate-200">
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

            <button type="submit" disabled={loading} className="mt-3 rounded-lg bg-gradient-to-r from-red-300 to-red-500 p-3 font-bold text-[#19120a] shadow-lg shadow-red-500/10 transition-all hover:from-red-200 hover:to-red-400 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-400 md:col-span-2">
              {loading ? 'Creando…' : Number(repeatWeeks) > 1 ? `Crear ${repeatWeeks} clases` : 'Crear clase'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
