import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ActivitiesCalendar from './activities/ActivitiesCalendar';
import ClassDetailsModal from './ClassDetailsModal';
import {
  API_URL,
  getApiErrorMessage,
  isClientMembershipActive
} from '../lib/api';
import { selectedClassById } from '../lib/classPayload';

export default function ClientCalendar({
  user,
  userId,
  siteName,
  onUserClick,
  realtimeVersion = 0
}) {
  const [classes, setClasses] = useState([]);
  const [classTypes, setClassTypes] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionPendingId, setActionPendingId] = useState(null);
  const [hideNameOnReserve, setHideNameOnReserve] = useState(
    () => localStorage.getItem('hideNameOnReserve') === 'true'
  );

  const fetchCalendar = async () => {
    setLoading(true);
    setError('');
    try {
      const [classesResponse, classTypesResponse] = await Promise.all([
        axios.get(`${API_URL}/classes`),
        axios.get(`${API_URL}/class-types`)
      ]);
      setClasses(classesResponse.data);
      setClassTypes(classTypesResponse.data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No se pudieron cargar las actividades.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [realtimeVersion]);

  const runReservationAction = async (gymClass, endpoint) => {
    setActionPendingId(gymClass.id);
    try {
      const result = await axios.post(
        `${API_URL}/classes/${gymClass.id}/${endpoint}`,
        endpoint === 'reserve' ? { hideName: hideNameOnReserve } : undefined
      );
      if (endpoint === 'reserve' && result.data?.status === 'EN_ESPERA') {
        alert('Clase completa: quedaste en lista de espera.');
      }
      await fetchCalendar();
    } catch (requestError) {
      alert(getApiErrorMessage(requestError, 'No se pudo completar la acción.'));
    } finally {
      setActionPendingId(null);
    }
  };

  const handleValidateAttendance = async (gymClass) => {
    setActionPendingId(gymClass.id);
    try {
      await axios.post(`${API_URL}/classes/${gymClass.id}/attendance/validate`);
      alert('Asistencia validada.');
      await fetchCalendar();
    } catch (requestError) {
      alert(getApiErrorMessage(requestError, 'No se pudo validar la asistencia.'));
    } finally {
      setActionPendingId(null);
    }
  };

  const handleReportPayment = async () => {
    try {
      await axios.post(`${API_URL}/membership/payments`, { notes: 'Payment reported from web client dashboard' });
      alert('Pago notificado al administrador. Te activarán la cuenta al confirmarlo.');
    } catch (requestError) {
      alert(getApiErrorMessage(requestError, 'No se pudo notificar el pago.'));
    }
  };

  const membershipActive = isClientMembershipActive(user);
  const selectedClass = selectedClassById(classes, selectedClassId);
  const updateHideNameDefault = (checked) => {
    setHideNameOnReserve(checked);
    localStorage.setItem('hideNameOnReserve', String(checked));
  };

  return (
    <div className="space-y-6">
      {!membershipActive && (
        <div className="glass border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3" role="status">
          <div>
            <p className="text-amber-300 font-bold">Tu cuota no está activa</p>
            <p className="text-slate-400 text-sm">Puedes consultar las actividades, pero no reservar hasta renovar la fecha de validez.</p>
          </div>
          <button onClick={handleReportPayment} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
            Notificar pago
          </button>
        </div>
      )}

      <label className="glass flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-4">
        <input
          type="checkbox"
          checked={hideNameOnReserve}
          onChange={(event) => updateHideNameDefault(event.target.checked)}
          className="mt-1 h-5 w-5 accent-emerald-400"
        />
        <span>
          <span className="block font-bold text-white">Ocultar mi nombre al reservar</span>
          <span className="block text-sm text-slate-400">Los demás clientes verán “Usuario anónimo”. El administrador y el profesor seguirán viendo tu identidad.</span>
        </span>
      </label>

      <ActivitiesCalendar
        role="CLIENT"
        userId={userId}
        siteName={siteName}
        classes={classes}
        classTypes={classTypes}
        loading={loading}
        error={error}
        onRetry={fetchCalendar}
        membershipActive={membershipActive}
        onOpenClass={(gymClass) => setSelectedClassId(gymClass.id)}
        onReserve={(gymClass) => runReservationAction(gymClass, 'reserve')}
        onCancel={(gymClass) => runReservationAction(gymClass, 'cancel')}
        onValidateAttendance={handleValidateAttendance}
        actionPendingId={actionPendingId}
      />

      <ClassDetailsModal
        isOpen={!!selectedClass}
        onClose={() => setSelectedClassId(null)}
        cls={selectedClass}
        onUserClick={(targetUser) => {
          setSelectedClassId(null);
          onUserClick(targetUser);
        }}
        onChanged={fetchCalendar}
      />
    </div>
  );
}
