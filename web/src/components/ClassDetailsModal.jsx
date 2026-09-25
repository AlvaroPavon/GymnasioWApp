import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL, getApiErrorMessage, reservationStatusClass, reservationStatusLabel } from '../lib/api';
import { effectiveClassImageUrl } from '../lib/classCalendar';

export default function ClassDetailsModal({ isOpen, onClose, cls, onUserClick, onChanged }) {
  const { user } = useAuth();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [privacyPending, setPrivacyPending] = useState(false);
  const imageUrl = effectiveClassImageUrl(cls);

  useEffect(() => {
    setImageFailed(false);
  }, [cls?.id, imageUrl]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
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

  if (!isOpen || !cls) return null;

  const isFull = (cls._count?.reservations || 0) >= cls.max_capacity;
  const canManageReservations = user?.role === 'ADMIN' || user?.role === 'TEACHER';
  const confirmedReservations = (cls.reservations || []).filter((reservation) => ['CONFIRMADA', 'ASISTENCIA_VALIDADA'].includes(reservation.status));
  const waitlistReservations = (cls.reservations || []).filter((reservation) => reservation.status === 'EN_ESPERA');
  const noShowReservations = (cls.reservations || []).filter((reservation) => reservation.status === 'NO_ASISTE');
  const ownReservation = (cls.reservations || []).find((reservation) => (
    reservation.userId === user?.id
    || reservation.user_id === user?.id
    || reservation.user?.id === user?.id
  ));
  const ownReservationHidden = ownReservation?.hideName
    ?? ownReservation?.hide_name
    ?? ownReservation?.ocultar_nombre
    ?? false;

  const removeReservation = async (event, targetUserId) => {
    event.stopPropagation();
    if (!confirm('¿Quitar este usuario de la clase? Si hay lista de espera, se promociona automáticamente.')) return;
    try {
      await axios.delete(`${API_URL}/classes/${cls.id}/reservations/${targetUserId}`);
      await onChanged?.();
      onClose();
    } catch (error) {
      alert(getApiErrorMessage(error, 'No se pudo quitar la reserva.'));
    }
  };

  const updateReservationPrivacy = async (hideName) => {
    if (!ownReservation) return;
    try {
      setPrivacyPending(true);
      await axios.patch(`${API_URL}/classes/${cls.id}/reservations/privacy`, { hideName });
      await onChanged?.();
    } catch (error) {
      alert(getApiErrorMessage(error, 'No se pudo actualizar la privacidad de la reserva.'));
    } finally {
      setPrivacyPending(false);
    }
  };

  const renderReservationUser = (reservation) => {
    const attendee = reservation.user || { id: null, name: 'Usuario', profile_picture: null };
    const anonymous = attendee.id === null;
    const content = (
      <>
        <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-900">
          {attendee.profile_picture ? (
            <img src={attendee.profile_picture} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-slate-400" aria-hidden="true">{attendee.name.charAt(0)}</span>
          )}
        </span>
        <span className="w-full truncate text-center text-xs font-semibold text-white" title={attendee.name}>
          {anonymous ? attendee.name : attendee.name.split(' ')[0]}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${reservationStatusClass(reservation.status)}`}>
          {reservationStatusLabel(reservation.status)}
        </span>
        {canManageReservations && (reservation.fixedEnrollment || reservation.fixed_enrollment || reservation.inscripcion_fija) && (
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">Fijo</span>
        )}
      </>
    );

    return (
    <div key={`${reservation.status}-${reservation.id}`} className="relative rounded-lg border border-transparent bg-slate-800 p-2 hover:border-slate-500">
      {canManageReservations && reservation.status !== 'NO_ASISTE' && (
        <button
          type="button"
          onClick={(event) => removeReservation(event, attendee.id)}
          className="absolute -right-2 -top-3 z-10 rounded-full bg-red-500 px-2 py-1 text-[10px] font-black text-white shadow-lg hover:bg-red-400 focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          Quitar
        </button>
      )}
      {canManageReservations ? (
        <button
          type="button"
          onClick={() => onUserClick(attendee)}
          className="flex w-full flex-col items-center gap-2 rounded-md p-1 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          {content}
        </button>
      ) : (
        <div className="flex w-full flex-col items-center gap-2 rounded-md p-1">{content}</div>
      )}
    </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="class-details-title"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="relative z-50 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl md:flex-row"
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-50 rounded-full bg-black/80 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            Cerrar
          </button>

          <div className="flex bg-black md:w-5/12 md:flex-col">
            {imageUrl && !imageFailed ? (
              <img
                src={imageUrl}
                alt={`Actividad ${cls.title}`}
                onError={() => setImageFailed(true)}
                className="h-48 w-2/5 object-cover md:h-60 md:w-full"
              />
            ) : (
              <div
                role="img"
                aria-label={`Imagen no disponible para ${cls.title}`}
                className="relative flex h-48 w-2/5 items-center justify-center overflow-hidden border-r border-white/5 bg-gradient-to-br from-slate-800 via-slate-900 to-amber-950/60 p-5 text-center md:h-60 md:w-full md:border-b md:border-r-0"
              >
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" aria-hidden="true" />
                <div className="relative rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-4 shadow-xl backdrop-blur-sm">
                  <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 10v4m3-7v10m10-10v10m3-7v4M7 12h10" strokeLinecap="round" />
                    </svg>
                  </span>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Actividad</p>
                  <p className="mt-1 text-sm font-semibold text-slate-300">Imagen no disponible</p>
                </div>
              </div>
            )}
            <div className="flex-1 p-5">
              <span className="mb-3 inline-block rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
                {isFull ? 'Aforo completo' : 'Plazas disponibles'}
              </span>
              <h2 id="class-details-title" className="mb-2 text-2xl font-extrabold text-white">{cls.title}</h2>
              <p className="mb-5 line-clamp-3 text-sm text-slate-300">{cls.description || 'Sin descripción adicional.'}</p>
              {cls.teacher && (
                <button type="button" onClick={() => onUserClick(cls.teacher)} className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-amber-400">
                  <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400 bg-slate-800">
                    {cls.teacher.profile_picture ? (
                      <img src={cls.teacher.profile_picture} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-bold text-amber-300" aria-hidden="true">{cls.teacher.name?.charAt(0)}</span>
                    )}
                  </span>
                  <span>
                    <span className="block text-xs text-slate-400">Profesor asignado</span>
                    <span className="block text-sm font-bold text-white">{cls.teacher.name}</span>
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="custom-scrollbar flex h-auto flex-1 flex-col overflow-y-auto p-6">
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4">
                <p className="mb-1 text-xs font-bold uppercase text-slate-400">Fecha y hora</p>
                <p className="font-bold text-white">{new Date(cls.start_time).toLocaleDateString()}</p>
                <p className="font-semibold text-amber-300">
                  {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(cls.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4">
                <p className="mb-1 text-xs font-bold uppercase text-slate-400">Ocupación</p>
                <p className="text-2xl font-bold text-white">{cls._count?.reservations || 0} / <span className="text-slate-500">{cls.max_capacity}</span></p>
              </div>
            </div>

            {user?.role === 'CLIENT' && ownReservation && (
              <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <input
                  type="checkbox"
                  checked={ownReservationHidden}
                  disabled={privacyPending}
                  onChange={(event) => updateReservationPrivacy(event.target.checked)}
                  className="mt-1 h-5 w-5 accent-emerald-400"
                />
                <span>
                  <span className="block font-bold text-white">Ocultar mi nombre</span>
                  <span className="block text-xs text-slate-400">Solo el administrador y el profesor podrán identificarte.</span>
                </span>
              </label>
            )}

            {canManageReservations && (
              <>
                <ReservationSection title="Asistentes confirmados" reservations={confirmedReservations} renderUser={renderReservationUser} />
                {waitlistReservations.length > 0 && <ReservationSection title="Lista de espera" reservations={waitlistReservations} renderUser={renderReservationUser} tone="amber" />}
                {noShowReservations.length > 0 && <ReservationSection title="No asistieron" reservations={noShowReservations} renderUser={renderReservationUser} tone="red" />}
              </>
            )}
            {user?.role === 'CLIENT' && (
              <ReservationSection title="Asistentes" reservations={confirmedReservations} renderUser={renderReservationUser} />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ReservationSection({ title, reservations, renderUser, tone = 'slate' }) {
  const titleClass = tone === 'amber' ? 'text-amber-300 border-amber-500/20' : tone === 'red' ? 'text-red-300 border-red-500/20' : 'text-slate-300 border-white/10';
  return (
    <section className="mb-6">
      <h3 className={`mb-4 border-b pb-2 text-sm font-bold uppercase tracking-widest ${titleClass}`}>{title}</h3>
      {reservations.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{reservations.map(renderUser)}</div>
      ) : (
        <p className="py-7 text-center text-sm text-slate-500">Aún no hay reservas.</p>
      )}
    </section>
  );
}
