import React, { useEffect, useMemo, useRef, useState } from 'react';
import ActivityCard from './ActivityCard';
import WeekStrip from './WeekStrip';
import {
  filterCalendarClasses,
  localDateKey,
  nearestUpcomingClassDate,
  weekForDate
} from '../../lib/classCalendar';
import './activities.css';

const VIEW_TABS = [
  { id: 'calendar', label: 'Calendario' },
  { id: 'reservations', label: 'Reservas' },
  { id: 'waitlist', label: 'Lista de espera' }
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
  { value: 'EN_ESPERA', label: 'En espera' },
  { value: 'ASISTENCIA_VALIDADA', label: 'Asistencia validada' },
  { value: 'NO_ASISTE', label: 'No asiste' }
];

export default function ActivitiesCalendar({
  role,
  userId,
  siteName = 'Ronquillo Te Cuida',
  classes,
  classTypes = [],
  loading = false,
  error = '',
  onRetry,
  membershipActive = true,
  onOpenClass,
  onEditClass,
  onDeleteClass,
  onReserve,
  onCancel,
  onValidateAttendance,
  actionPendingId = null
}) {
  const [view, setView] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [typeId, setTypeId] = useState('all');
  const [status, setStatus] = useState('all');
  const autoSelected = useRef(false);
  const tabRefs = useRef([]);

  useEffect(() => {
    if (!autoSelected.current && classes.length > 0) {
      setSelectedDate(nearestUpcomingClassDate(classes));
      autoSelected.current = true;
    }
  }, [classes]);

  const weekDays = useMemo(() => weekForDate(selectedDate), [selectedDate]);
  const monthLabel = useMemo(() => {
    const date = new Date(`${selectedDate}T12:00:00`);
    const value = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return value.charAt(0).toUpperCase() + value.slice(1);
  }, [selectedDate]);

  const visibleClasses = useMemo(() => filterCalendarClasses(classes, {
    mode: view,
    selectedDate,
    typeId,
    status,
    role,
    userId
  }), [classes, role, selectedDate, status, typeId, userId, view]);

  const activeFilters = Number(typeId !== 'all') + Number(status !== 'all');

  const shiftWeek = (amount) => {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + amount * 7);
    setSelectedDate(localDateKey(next));
  };

  const onTabKeyDown = (event, index) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % VIEW_TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + VIEW_TABS.length) % VIEW_TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = VIEW_TABS.length - 1;
    if (nextIndex === index) return;
    event.preventDefault();
    setView(VIEW_TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section className="activities-shell" aria-labelledby="activities-heading">
      <header className="activities-header">
        <p className="activities-eyebrow">Agenda del centro</p>
        <h2 id="activities-heading">Actividades</h2>
      </header>

      <div className="activities-tabs" role="tablist" aria-label="Vistas de actividades">
        {VIEW_TABS.map((tab, index) => (
          <button
            type="button"
            key={tab.id}
            ref={(node) => { tabRefs.current[index] = node; }}
            role="tab"
            aria-selected={view === tab.id}
            tabIndex={view === tab.id ? 0 : -1}
            className={view === tab.id ? 'activities-tab activities-tab--selected' : 'activities-tab'}
            onClick={() => setView(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="activities-controls">
        <label className="site-select">
          <span className="sr-only">Centro deportivo</span>
          <select value={siteName} onChange={() => undefined} aria-label="Centro deportivo">
            <option value={siteName}>{siteName}</option>
          </select>
        </label>

        <details className="filter-control">
          <summary>Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}</summary>
          <div className="filter-panel">
            <label>
              Tipo de actividad
              <select value={typeId} onChange={(event) => setTypeId(event.target.value)}>
                <option value="all">Todos los tipos</option>
                {classTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name || type.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              Estado de reserva
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => { setTypeId('all'); setStatus('all'); }} disabled={activeFilters === 0}>
              Limpiar filtros
            </button>
          </div>
        </details>
      </div>

      <div className="activities-date-heading">
        <h3>{monthLabel}</h3>
        {view !== 'calendar' && <p>Mostrando actividades de todas las fechas</p>}
      </div>

      <WeekStrip
        days={weekDays}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onShiftWeek={shiftWeek}
      />

      <div className="activities-results" role="tabpanel">
        {loading && (
          <div className="activities-state" role="status" aria-live="polite">
            <strong>Cargando actividades…</strong>
            <p>Estamos sincronizando el calendario.</p>
          </div>
        )}

        {!loading && error && (
          <div className="activities-state activities-state--error" role="alert">
            <strong>No se pudo cargar el calendario</strong>
            <p>{error}</p>
            {onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}
          </div>
        )}

        {!loading && !error && visibleClasses.length === 0 && (
          <div className="activities-state">
            <strong>No hay actividades en esta vista</strong>
            <p>Cambia de día, pestaña o limpia los filtros para seguir buscando.</p>
          </div>
        )}

        {!loading && !error && visibleClasses.length > 0 && (
          <div className="activity-list">
            {visibleClasses.map((gymClass) => (
              <ActivityCard
                key={gymClass.id}
                gymClass={gymClass}
                role={role}
                userId={userId}
                membershipActive={membershipActive}
                onOpen={onOpenClass}
                onEdit={onEditClass}
                onDelete={onDeleteClass}
                onReserve={onReserve}
                onCancel={onCancel}
                onValidateAttendance={onValidateAttendance}
                actionPending={actionPendingId === gymClass.id}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
