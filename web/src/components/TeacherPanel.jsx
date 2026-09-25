import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ActivitiesCalendar from './activities/ActivitiesCalendar';
import ClassDetailsModal from './ClassDetailsModal';
import CreateClassModal from './CreateClassModal';
import EditClassModal from './EditClassModal';
import { API_URL, getApiErrorMessage } from '../lib/api';
import { selectedClassById } from '../lib/classPayload';

export default function TeacherPanel({ siteName, onUserClick, realtimeVersion = 0 }) {
  const [classes, setClasses] = useState([]);
  const [classTypes, setClassTypes] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classToEdit, setClassToEdit] = useState(null);
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setError(getApiErrorMessage(requestError, 'No se pudieron cargar tus actividades.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [realtimeVersion]);

  useEffect(() => {
    setClassToEdit((current) => current
      ? classes.find((gymClass) => gymClass.id === current.id) ?? null
      : null);
  }, [classes]);

  const selectedClass = selectedClassById(classes, selectedClassId);

  return (
    <div className="space-y-6">
      <section className="glass flex flex-col items-start justify-between gap-4 rounded-[1.5rem] p-5 sm:flex-row sm:items-center" aria-labelledby="teacher-schedule-heading">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4a621]">Programación</p>
          <h2 id="teacher-schedule-heading" className="text-xl font-black tracking-[-.025em] text-white">Gestiona tus clases</h2>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateClassOpen(true)}
          className="gold-button rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[.06em] transition-transform hover:-translate-y-0.5"
        >
          Crear clase
        </button>
      </section>

      <ActivitiesCalendar
        role="TEACHER"
        siteName={siteName}
        classes={classes}
        classTypes={classTypes}
        loading={loading}
        error={error}
        onRetry={fetchCalendar}
        onOpenClass={(gymClass) => setSelectedClassId(gymClass.id)}
        onEditClass={setClassToEdit}
      />

      <CreateClassModal
        isOpen={isCreateClassOpen}
        onClose={() => setIsCreateClassOpen(false)}
        onCreated={fetchCalendar}
        classTypes={classTypes}
      />

      <EditClassModal
        isOpen={!!classToEdit}
        onClose={() => setClassToEdit(null)}
        classData={classToEdit}
        onUpdate={fetchCalendar}
        classTypes={classTypes}
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
