import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_URL, getApiErrorMessage, membershipExpiresAtEndOfDay } from '../lib/api';

export default function CreateUserModal({ isOpen, onClose, onUpdate, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('CLIENT');
  const [monthlyStatus, setMonthlyStatus] = useState('PAGADO');
  const [membershipExpiresAt, setMembershipExpiresAt] = useState('');

  // Camera & File state
  const [file, setFile] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [loading, setLoading] = useState(false);

  // === MÉTODOS DE CÁMARA (WebRTC) ===
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('No se pudo acceder a la cámara. Revisa los permisos o asegúrate de usar HTTPS/localhost.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

    canvasRef.current.toBlob((blob) => {
      if (blob) {
        // Create a File object from the Blob
        const capturedFile = new File([blob], "captured_photo.jpg", { type: "image/jpeg" });
        setFile(capturedFile);
      }
      stopCamera();
      setIsCapturing(false);
    }, 'image/jpeg', 0.9);
  };

  // Limpiar recursos al cerrar modal
  const handleClose = () => {
    stopCamera();
    setName(''); setEmail(''); setPassword(''); setPhone(''); setRole('CLIENT'); setMonthlyStatus('PAGADO'); setMembershipExpiresAt(''); setFile(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('role', role);
      formData.append('estado_mensualidad', monthlyStatus);
      const expiry = membershipExpiresAtEndOfDay(membershipExpiresAt);
      if (role === 'CLIENT' && expiry) formData.append('membership_expires_at', expiry);
      if (phone) formData.append('phone', phone);
      if (file) formData.append('profile', file);

      await axios.post(`${API_URL}/users`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      (onUpdate || onSuccess)?.();
      handleClose();
    } catch (err) {
      alert(getApiErrorMessage(err, 'Error creando usuario. Revisa los campos.'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={handleClose}
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          <button onClick={handleClose} className="absolute top-4 right-4 text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center bg-slate-800 rounded-full pb-1">x</button>

          <h2 className="text-2xl font-bold mb-6 text-amber-500">Alta de Nuevo Miembro</h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ====== SECCIÓN DE FOTO O CÁMARA ====== */}
            <div className="md:col-span-2 glass p-4 rounded-xl border border-white/5 flex flex-col items-center">
              <h3 className="text-sm font-bold text-slate-300 mb-4 tracking-wider uppercase">Foto de Perfil WebRTC</h3>

              {isCameraActive ? (
                <div className="flex flex-col items-center space-y-4 w-full">
                  <div className="relative w-full max-w-sm aspect-video bg-black rounded-lg overflow-hidden border-2 border-gym-accent">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                  </div>
                  <canvas ref={canvasRef} className="hidden"></canvas>
                  <div className="flex gap-4 w-full justify-center">
                    <button type="button" onClick={capturePhoto} disabled={isCapturing} className="bg-amber-400 hover:bg-amber-300 text-[#19120a] font-bold py-2 px-6 rounded shadow-lg shadow-amber-500/10 transition-colors">
                      {isCapturing ? 'Procesando...' : '📸 Tomar Foto'}
                    </button>
                    <button type="button" onClick={stopCamera} className="bg-slate-700 hover:bg-red-500 text-white font-bold py-2 px-6 rounded transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4 w-full">
                  {file ? (
                    <div className="text-center">
                      <div className="w-24 h-24 rounded-full mx-auto bg-gym-highlight/20 border border-gym-highlight overflow-hidden mb-2">
                        <img src={URL.createObjectURL(file)} alt="Captura/Archivo" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-gym-highlight font-semibold">Imagen lista para procesar</p>
                      <button type="button" onClick={() => setFile(null)} className="text-xs text-red-400 hover:text-red-300 mt-2 underline">Quitar Imagen</button>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="w-20 h-20 rounded-full mx-auto bg-slate-800 flex items-center justify-center text-3xl">👤</div>
                      <p className="text-xs text-slate-400">Sin foto. Usa la cámara de la recepción o sube un archivo.</p>
                      <div className="flex gap-2 justify-center mt-2">
                        <button type="button" onClick={startCamera} className="bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold py-2 px-4 rounded transition-colors">
                          📷 Usar Cámara
                        </button>
                        <label className="bg-slate-700 hover:bg-slate-600 cursor-pointer text-white text-xs font-bold py-2 px-4 rounded transition-colors">
                          📁 Subir Archivo
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files[0]) setFile(e.target.files[0]); }} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ====== SECCIÓN DE DATOS ====== */}
            <div>
              <label className="text-xs text-slate-400">Nombre Completo</label>
              <input type="text" required value={name} onChange={e=>setName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-white" />
            </div>

            <div>
              <label className="text-xs text-slate-400">Correo Electrónico</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-white" />
            </div>

            <div>
              <label className="text-xs text-slate-400">Contraseña (Temporal)</label>
              <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} minLength="8" className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-white" />
            </div>

            <div>
              <label className="text-xs text-slate-400">Teléfono (Opcional)</label>
              <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-white" />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">Asignar Cargo Militar</label>
              <select required value={role} onChange={e=>setRole(e.target.value)} className="w-full bg-slate-800 border border-gym-accent border-l-4 p-3 rounded text-gym-accent font-bold">
                <option value="CLIENT">CLIENT - Socio Normal</option>
                <option value="TEACHER">TEACHER - Profesor</option>
                <option value="ADMIN">ADMIN - Administrador</option>
              </select>
            </div>

            {role === 'CLIENT' && (
            <div>
              <label className="text-xs text-slate-400">Estado de Mensualidad</label>
              <select value={monthlyStatus} onChange={e=>setMonthlyStatus(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-slate-300 font-bold">
                <option value="PAGADO">PAGADO - Puede reservar clases</option>
                <option value="IMPAGADO">IMPAGADO - Reserva bloqueada</option>
              </select>
            </div>
            )}

            {role === 'CLIENT' && monthlyStatus === 'PAGADO' && (
            <div>
              <label className="text-xs text-slate-400">Válido hasta</label>
              <input
                type="date"
                value={membershipExpiresAt}
                onChange={e=>setMembershipExpiresAt(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">Si lo dejás vacío, se asigna 1 mes automáticamente.</p>
            </div>
            )}

            <button type="submit" disabled={loading || isCameraActive} className="md:col-span-2 mt-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold p-3 rounded-lg shadow-lg transition-colors">
              {loading ? 'Subiendo datos y foto...' : 'Dar de Alta Inmediata'}
            </button>
          </form>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
