import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPanel from '../components/AdminPanel';
import TeacherPanel from '../components/TeacherPanel';
import ClientCalendar from '../components/ClientCalendar';
import UserProfileModal from '../components/UserProfileModal';

const API_URL = 'http://localhost:3000/api';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [settings, setSettings] = useState({ app_name: 'GymSystem Pro' });

  useEffect(() => {
    axios.get(`${API_URL}/settings`)
      .then(res => {
        if(res.data) setSettings(res.data);
      })
      .catch(err => console.error("Error cargando ajustes", err));
  }, []);

  const openProfile = (targetUser = null) => {
    setViewingUser(targetUser);
    setProfileModalOpen(true);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 p-4 sm:p-6 overflow-x-hidden font-sans relative">
      
      {/* Background Decoration */}
      <div className="fixed top-[-10%] right-[-5%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <motion.nav 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center glass px-6 py-4 rounded-2xl mb-8 relative z-50 sticky top-4 sm:top-6"
      >
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500 mb-4 sm:mb-0 tracking-tight">
          {settings.app_name}
        </h1>
        <div className="flex items-center gap-4">
          <div 
            onClick={() => openProfile(null)} 
            className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors"
            title="Editar mi perfil"
          >
            <div className="text-right hidden sm:block">
              <p className="text-slate-100 font-bold">{user?.name}</p>
              <p className="text-gym-accent text-xs uppercase tracking-widest">{user?.role}</p>
            </div>
            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-emerald-400 font-bold text-lg">{user?.name?.charAt(0)}</span>
              )}
            </div>
          </div>
          <motion.button  
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={logout}
            className="bg-red-500/20 border border-red-500/40 hover:bg-red-500 hover:text-white transition-all px-5 py-2 rounded-xl text-sm font-bold text-red-400 ml-2 shadow-[0_4px_14px_rgba(239,68,68,0.1)]"
          >
            Salir
          </motion.button>
        </div>
      </motion.nav>

      <motion.div 
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="max-w-7xl mx-auto relative z-10"
      >
        {user?.role === 'ADMIN' && <AdminPanel onUserClick={openProfile} />}
        {user?.role === 'TEACHER' && <TeacherPanel onUserClick={openProfile} />}
        {user?.role === 'CLIENT' && <ClientCalendar userId={user.id} onUserClick={openProfile} />}
      </motion.div>

      <UserProfileModal 
        isOpen={profileModalOpen} 
        onClose={() => setProfileModalOpen(false)} 
        viewUser={viewingUser} 
      />
    </div>
  );
}
