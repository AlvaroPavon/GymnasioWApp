import React from 'react';
import { localDateKey } from '../../lib/classCalendar';

const weekdayFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
const dayFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric' });

export default function WeekStrip({ days, selectedDate, onSelectDate, onShiftWeek }) {
  return (
    <div className="week-strip-wrap">
      <button type="button" className="week-shift" onClick={() => onShiftWeek(-1)} aria-label="Mostrar la semana anterior">
        <span className="week-shift__full">Anterior</span>
        <span className="week-shift__short" aria-hidden="true">Ant.</span>
      </button>
      <div className="week-strip" aria-label="Seleccionar día">
        {days.map((day) => {
          const key = localDateKey(day);
          const selected = key === selectedDate;
          return (
            <button
              type="button"
              key={key}
              className={`week-day ${selected ? 'week-day--selected' : ''}`}
              aria-pressed={selected}
              aria-label={day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              onClick={() => onSelectDate(key)}
            >
              <span>{weekdayFormatter.format(day).replace('.', '')}</span>
              <strong>{dayFormatter.format(day)}</strong>
            </button>
          );
        })}
      </div>
      <button type="button" className="week-shift" onClick={() => onShiftWeek(1)} aria-label="Mostrar la semana siguiente">
        <span className="week-shift__full">Siguiente</span>
        <span className="week-shift__short" aria-hidden="true">Sig.</span>
      </button>
    </div>
  );
}
