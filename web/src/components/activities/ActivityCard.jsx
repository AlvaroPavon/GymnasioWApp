import React, { useEffect, useState } from 'react';
import { canValidateAttendance, reservationStatusLabel } from '../../lib/api';
import {
  activityStatus,
  classCapacity,
  clientReservationActions,
  effectiveClassImageUrl,
} from '../../lib/classCalendar';

const timeFormatter = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit'
});

export default function ActivityCard({
  gymClass,
  role,
  userId,
  membershipActive = true,
  now = new Date(),
  onOpen,
  onEdit,
  onDelete,
  onReserve,
  onCancel,
  onValidateAttendance,
  actionPending = false
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = effectiveClassImageUrl(gymClass);
  const start = new Date(gymClass.start_time || gymClass.startsAt);
  const end = new Date(gymClass.end_time || gymClass.endsAt);
  const capacity = classCapacity(gymClass);
  const {
    reservation: ownReservation,
    canCancel,
    canReserve
  } = clientReservationActions(gymClass, userId);
  const state = activityStatus(gymClass, { role, userId, now });
  const isPast = end.getTime() <= now.getTime();
  const canValidate = canValidateAttendance(ownReservation, start, now);
  const classType = gymClass.classType?.name || gymClass.classType?.nombre || 'Actividad dirigida';

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <article className={`activity-card activity-card--${state.tone} ${!imageUrl || imageFailed ? 'activity-card--without-image' : ''}`}>
      {imageUrl && !imageFailed && (
        <div className="activity-card__media">
          <img
            src={imageUrl}
            alt={`Actividad ${gymClass.title}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        </div>
      )}

      <div className="activity-card__body">
        <div className="activity-card__heading">
          <div>
            <p className="activity-card__type">{classType}</p>
            <button type="button" className="activity-card__title" onClick={() => onOpen?.(gymClass)}>
              {gymClass.title}
            </button>
          </div>
          <time className="activity-card__time" dateTime={start.toISOString()}>
            {timeFormatter.format(start)} – {timeFormatter.format(end)}
          </time>
        </div>

        <dl className="activity-card__meta">
          <div>
            <dt>Profesor</dt>
            <dd>{gymClass.teacher?.name || 'Por asignar'}</dd>
          </div>
          <div>
            <dt>Ocupación</dt>
            <dd>{capacity.occupied}/{capacity.maximum} plazas</dd>
          </div>
        </dl>

        <div className="activity-card__footer">
          <span className="activity-card__status">{state.label}</span>

          <div className="activity-card__actions" aria-label={`Acciones para ${gymClass.title}`}>
            {(role === 'ADMIN' || role === 'TEACHER') && (
              <button type="button" className="activity-action activity-action--secondary" onClick={() => onOpen?.(gymClass)}>
                Participantes
              </button>
            )}

            {(role === 'ADMIN' || role === 'TEACHER') && !isPast && onEdit && (
              <button type="button" className="activity-action activity-action--primary" onClick={() => onEdit(gymClass)}>
                Editar
              </button>
            )}

            {role === 'ADMIN' && onDelete && (
              <button type="button" className="activity-action activity-action--danger" onClick={() => onDelete(gymClass)}>
                Eliminar
              </button>
            )}

            {role === 'CLIENT' && !isPast && canCancel && (
              <>
                {canValidate && ownReservation.status === 'CONFIRMADA' && (
                  <button
                    type="button"
                    className="activity-action activity-action--primary"
                    disabled={actionPending}
                    onClick={() => onValidateAttendance?.(gymClass)}
                  >
                    Validar asistencia
                  </button>
                )}
                <button
                  type="button"
                  className="activity-action activity-action--danger"
                  disabled={actionPending}
                  onClick={() => onCancel?.(gymClass)}
                >
                  {ownReservation.status === 'EN_ESPERA' ? 'Salir de la lista' : 'Cancelar reserva'}
                </button>
              </>
            )}

            {role === 'CLIENT' && !isPast && canReserve && (
              <button
                type="button"
                className="activity-action activity-action--primary"
                disabled={!membershipActive || actionPending}
                onClick={() => onReserve?.(gymClass)}
              >
                {!membershipActive ? 'Cuota no activa' : capacity.isFull ? 'Unirme a espera' : 'Reservar plaza'}
              </button>
            )}

            {role === 'CLIENT' && ownReservation && (
              <span className="sr-only">Estado de tu reserva: {reservationStatusLabel(ownReservation.status)}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
