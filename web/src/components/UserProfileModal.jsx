import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL, dateInputValue, getApiErrorMessage, membershipExpiresAtEndOfDay } from '../lib/api';

export default function UserProfileModal({ isOpen, onClose, viewUser = null }) {
  const { user, setUser } = useAuth();

  const targetUser = viewUser || user;
  const isMe = !viewUser || viewUser.id === user.id;
  const isAdmin = user.role === 'ADMIN';
  const canEdit = isMe || isAdmin;

  const [selectedFile, setSelectedFile] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('CLIENT');
  const [monthlyStatus, setMonthlyStatus] = useState('IMPAGADO');
  const [membershipExpiresAt, setMembershipExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [classReminderEnabled, setClassReminderEnabled] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);

  // Al abrir/cambiar objetivo, hidratar datos
  React.useEffect(() => {
    if (targetUser) {
      setName(targetUser.name || '');
      setEmail(targetUser.email || '');
      setPhone(targetUser.phone || '');
      setRole(targetUser.role || 'CLIENT');
      setMonthlyStatus(targetUser.estado_mensualidad || targetUser.monthlyStatus || 'IMPAGADO');
      setMembershipExpiresAt(dateInputValue(targetUser.membership_expires_at || targetUser.membershipExpiresAt));
      setClassReminderEnabled(Boolean(targetUser.classReminderEnabled ?? targetUser.class_reminder_enabled));
      setNewPassword('');
    }
  }, [targetUser]);

  const handleUpdate = async () => {
    try {
      setLoading(true);
      const formData = new FormData();
      if (selectedFile) formData.append('profile', selectedFile);
      if (name) formData.append('name', name);
      if (email) formData.append('email', email);
      if (phone !== undefined) formData.append('phone', phone);
      if (isAdmin && !isMe) {
        formData.append('role', role);
        if (role === 'CLIENT') {
          formData.append('estado_mensualidad', monthlyStatus);
          const expiry = membershipExpiresAtEndOfDay(membershipExpiresAt);
          if (expiry) formData.append('membership_expires_at', expiry);
        }
      }

      const endpoint = isMe ? `${API_URL}/users/profile` : `${API_URL}/users/${targetUser.id}`;

      const res = await axios.put(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (isMe) {
        const updatedUser = { ...user, ...res.data };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        onClose();
      } else {
        alert("Perfil actualizado");
        window.location.reload();
      }
    } catch (error) {
      alert(getApiErrorMessage(error, "Error al actualizar el perfil"));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!targetUser) return;
    const password = newPassword.trim();
    if (password.length < 8) {
      alert('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!window.confirm(`¿Cambiar la contraseña de ${targetUser.name}?`)) return;

    try {
      setPasswordLoading(true);
      await axios.put(`${API_URL}/users/${targetUser.id}/password`, { password });
      setNewPassword('');
      alert('Contraseña actualizada. El usuario ya puede iniciar sesión con la nueva contraseña.');
    } catch (error) {
      alert(getApiErrorMessage(error, 'No se pudo cambiar la contraseña'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleReminderPreference = async (enabled) => {
    try {
      setReminderLoading(true);
      const response = await axios.patch(`${API_URL}/users/me/preferences`, {
        classReminderEnabled: enabled
      });
      setClassReminderEnabled(enabled);
      const updatedUser = { ...user, ...response.data };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      alert(getApiErrorMessage(error, 'No se pudo actualizar el recordatorio.'));
    } finally {
      setReminderLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="glass border border-white/10 rounded-2xl p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>

          <div className="flex flex-col items-center mb-6 mt-4">
            <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-gym-accent overflow-hidden shadow-xl mb-4 relative flex items-center justify-center">
              {targetUser.profile_picture ? (
                <img src={targetUser.profile_picture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-gym-accent">{targetUser.name.charAt(0)}</span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white">{targetUser.name}</h2>
            <p className="text-gym-highlight uppercase text-xs font-bold tracking-wider mb-2">{targetUser.role}</p>

            {!canEdit && (
              <div className="text-center mt-2 p-3 bg-slate-800/50 rounded-lg border border-white/5 w-full">
                <p className="text-slate-300 text-sm mb-1 flex items-center justify-center gap-2">✉️ {targetUser.email}</p>
                {targetUser.phone && (user.role === 'ADMIN' || user.role === 'TEACHER') && (
                  <p className="text-slate-300 text-sm flex items-center justify-center gap-2">📞 {targetUser.phone}</p>
                )}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 p-2 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 p-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+34 600..."
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 p-2 rounded-lg text-sm"
                  />
                </div>
              </div>
              {isAdmin && !isMe && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Rol</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 p-2 rounded-lg text-sm"
                    >
                      <option value="CLIENT">CLIENT</option>
                      <option value="TEACHER">TEACHER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  {role === 'CLIENT' && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Estado</label>
                    <select
                      value={monthlyStatus}
                      onChange={(e) => setMonthlyStatus(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 p-2 rounded-lg text-sm"
                    >
                      <option value="PAGADO">PAGADO</option>
                      <option value="IMPAGADO">IMPAGADO</option>
                    </select>
                  </div>
                  )}
                </div>
              )}
              {isAdmin && !isMe && role === 'CLIENT' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cuota válida hasta</label>
                  <input
                    type="date"
                    value={membershipExpiresAt}
                    onChange={(e) => setMembershipExpiresAt(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 p-2 rounded-lg text-sm"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Si queda en blanco y marcás PAGADO, el backend renueva 1 mes.</p>
                </div>
              )}
              {isAdmin && !isMe && (
                <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3">
                  <label className="block text-xs text-red-200 mb-1">Restablecer contraseña</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nueva contraseña"
                    className="w-full bg-slate-950 border border-red-400/30 text-slate-100 p-2 rounded-lg text-sm"
                  />
                  <p className="text-[11px] text-red-100/70 mt-2">Usalo solo cuando el usuario no pueda acceder a su cuenta.</p>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={passwordLoading || newPassword.trim().length < 8}
                    className="mt-3 w-full bg-red-400 hover:bg-red-300 disabled:opacity-50 font-bold p-2 rounded-lg text-slate-950 transition-colors"
                  >
                    {passwordLoading ? 'Cambiando...' : 'Cambiar contraseña'}
                  </button>
                </div>
              )}
              {isMe && targetUser.role === 'CLIENT' && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                  <input
                    type="checkbox"
                    checked={classReminderEnabled}
                    disabled={reminderLoading}
                    onChange={(event) => handleReminderPreference(event.target.checked)}
                    className="mt-1 h-5 w-5 accent-emerald-400"
                  />
                  <span>
                    <span className="block text-sm font-bold text-white">Avisarme una hora antes</span>
                    <span className="block text-xs text-slate-400">Recibirás una notificación push por cada clase reservada.</span>
                  </span>
                </label>
              )}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Subir Foto de Perfil (Local)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 p-2 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gym-accent file:text-white hover:file:bg-red-500"
                />
              </div>
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="w-full bg-gym-accent hover:bg-red-500 disabled:opacity-50 font-bold p-3 rounded-lg text-white transition-colors"
              >
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
