import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { HouseLine, SignOut, UserCircle, WifiHigh, WifiSlash } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import AdminPanel from '../components/AdminPanel';
import TeacherPanel from '../components/TeacherPanel';
import ClientCalendar from '../components/ClientCalendar';
import UserProfileModal from '../components/UserProfileModal';
import { API_URL } from '../lib/api';
import { subscribeToRealtime } from '../lib/realtime';
import ronquilloLogo from '../assets/ronquillo-logo.jpg';

const COPYRIGHT_TEXT = 'Creada por Álvaro Pavón. Derechos reservados.';
const PRIVACY_POLICY_URL = '/privacy-policy.html';
const ROLE_LABELS = { ADMIN: 'Administrador', TEACHER: 'Profesor', CLIENT: 'Cliente' };

export default function Dashboard() {
  const { user, logout, refreshCurrentUser } = useAuth();
  const reduceMotion = useReducedMotion();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [settings, setSettings] = useState({ app_name: 'Ronquillo Te Cuida' });
  const [realtimeVersion, setRealtimeVersion] = useState(0);
  const [syncStatus, setSyncStatus] = useState('disconnected');

  useEffect(() => {
    axios.get(`${API_URL}/settings`)
      .then((response) => {
        if (response.data) setSettings(response.data);
      })
      .catch((error) => console.error('Error cargando ajustes', error));
  }, [realtimeVersion]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribeToRealtime(
      (event) => {
        setRealtimeVersion((version) => version + 1);
        if (['users', 'membership', 'global'].includes(event?.scope)) {
          refreshCurrentUser().catch((error) => console.error('Error refreshing the current user', error));
        }
      },
      setSyncStatus
    );
  }, [user?.id, refreshCurrentUser]);

  const openProfile = (targetUser = null) => {
    setViewingUser(targetUser);
    setProfileModalOpen(true);
  };

  const syncConnected = syncStatus === 'connected';
  const syncLabel = syncConnected ? 'En tiempo real' : syncStatus === 'connecting' ? 'Reconectando' : 'Sin conexión';

  return (
    <div className="app-shell min-h-[100dvh] overflow-x-hidden bg-[#09090b] px-3 py-3 font-sans sm:px-6 sm:py-5">
      <div className="ambient-orb ambient-orb--gold" />
      <div className="ambient-orb ambient-orb--navy" />

      <motion.header
        initial={reduceMotion ? false : { y: -26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="nav-surface sticky top-3 z-50 mx-auto mb-6 flex max-w-7xl items-center gap-3 rounded-[1.6rem] px-3 py-3 sm:top-5 sm:px-4"
      >
        <div className="brand-logo-frame shrink-0 rounded-2xl p-1.5">
          <img src={ronquilloLogo} alt="Ronquillo Te Cuida" className="h-11 w-16 rounded-xl object-contain sm:h-12 sm:w-20" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <HouseLine size={16} weight="fill" className="shrink-0 text-[#ff5a47]" aria-hidden="true" />
            <p className="truncate text-[10px] font-black uppercase tracking-[.18em] text-[#ff5a47] sm:text-xs">Panel principal</p>
          </div>
          <h1 className="truncate text-lg font-black tracking-[-.025em] text-white sm:text-2xl">{settings.app_name}</h1>
        </div>

        <div
          className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-xs font-black md:flex ${
            syncConnected
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
              : 'border-zinc-700 bg-zinc-900/80 text-zinc-400'
          }`}
          title="Sincronización en tiempo real"
        >
          {syncConnected ? <WifiHigh size={16} weight="bold" /> : <WifiSlash size={16} weight="bold" />}
          {syncLabel}
        </div>

        <button
          type="button"
          onClick={() => openProfile(null)}
          className="group flex min-h-12 items-center gap-2 rounded-2xl px-2 transition-colors hover:bg-white/[.05] sm:px-3"
          title="Editar mi perfil"
        >
          <span className="hidden text-right sm:block">
            <span className="block max-w-36 truncate text-sm font-black text-zinc-100">{user?.name}</span>
            <span className="block text-[10px] font-black uppercase tracking-[.12em] text-zinc-500">{ROLE_LABELS[user?.role] || user?.role}</span>
          </span>
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[#ff5a47]/35 bg-[#211a10] text-[#ff8a7d] shadow-[0_0_24px_rgba(255,90,71,.13)]">
            {user?.profile_picture ? (
              <img src={user.profile_picture} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <UserCircle size={27} weight="duotone" aria-hidden="true" />
            )}
          </span>
        </button>

        <motion.button
          whileHover={reduceMotion ? undefined : { scale: 1.035 }}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          type="button"
          onClick={logout}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-400/15 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-3"
          aria-label="Cerrar sesión"
        >
          <SignOut size={19} weight="bold" />
          <span className="hidden text-xs font-black uppercase tracking-[.08em] sm:inline">Salir</span>
        </motion.button>
      </motion.header>

      <motion.main
        initial={reduceMotion ? false : { opacity: 0, scale: 0.985, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.48, delay: 0.08 }}
        className="content-stage relative z-10 mx-auto max-w-7xl"
      >
        {user?.role === 'ADMIN' && <AdminPanel siteName={settings.app_name} onUserClick={openProfile} realtimeVersion={realtimeVersion} />}
        {user?.role === 'TEACHER' && <TeacherPanel siteName={settings.app_name} onUserClick={openProfile} realtimeVersion={realtimeVersion} />}
        {user?.role === 'CLIENT' && <ClientCalendar user={user} userId={user.id} siteName={settings.app_name} onUserClick={openProfile} realtimeVersion={realtimeVersion} />}
      </motion.main>

      <footer className="relative z-10 mx-auto mt-10 max-w-7xl pb-3 text-center text-[11px] font-semibold leading-5 text-zinc-400">
        {COPYRIGHT_TEXT}
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-2 text-zinc-400 underline decoration-zinc-600 underline-offset-4 transition-colors hover:text-[#ff8a7d]"
        >
          Política de privacidad
        </a>
      </footer>

      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        viewUser={viewingUser}
      />
    </div>
  );
}
