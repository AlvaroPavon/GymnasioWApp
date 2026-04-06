import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function UserProfileModal({ isOpen, onClose, viewUser = null }) {
  const { user, login } = useAuth();
  
  const targetUser = viewUser || user;
  const isMe = !viewUser || viewUser.id === user.id;
  const isAdmin = user.role === 'ADMIN';
  const canEdit = isMe || isAdmin;

  const [selectedFile, setSelectedFile] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Al abrir/cambiar objetivo, hidratar datos
  React.useEffect(() => {
    if (targetUser) {
      setEmail(targetUser.email || '');
      setPhone(targetUser.phone || '');
    }
  }, [targetUser]);

  const handleUpdate = async () => {
    try {
      setLoading(true);
      const formData = new FormData();
      if (selectedFile) formData.append('profile', selectedFile);
      if (email) formData.append('email', email);
      if (phone !== undefined) formData.append('phone', phone);

      const endpoint = isMe ? 'http://localhost:3000/api/users/profile' : `http://localhost:3000/api/users/${targetUser.id}`;

      const res = await axios.put(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (isMe) {
        const updatedUser = { ...user, profile_picture: res.data.profile_picture, email: res.data.email, phone: res.data.phone };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.location.reload(); // Quick refresh to cascade new context
      } else {
        alert("Foto actualizada");
      }
    } catch (error) {
      alert("Error al actualizar la foto");
    } finally {
      setLoading(false);
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
          className="glass border border-white/10 rounded-2xl p-6 w-full max-w-md relative"
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
              <div>
                <label className="block text-xs text-slate-400 mb-1">Subir Foto de Perfil (Local)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 p-2 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gym-accent file:text-white hover:file:bg-blue-600"
                />
              </div>
              <button 
                onClick={handleUpdate}
                disabled={loading}
                className="w-full bg-gym-accent hover:bg-blue-600 disabled:opacity-50 font-bold p-3 rounded-lg text-white transition-colors"
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
