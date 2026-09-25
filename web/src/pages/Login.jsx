import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRight, EnvelopeSimple, Eye, EyeSlash, LockKey } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/api';
import ronquilloLogo from '../assets/ronquillo-logo.jpg';

const COPYRIGHT_TEXT = 'Creada por Álvaro Pavón. Derechos reservados.';
const PRIVACY_POLICY_URL = '/privacy-policy.html';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [settings, setSettings] = useState({
    app_name: 'Ronquillo Te Cuida',
    hero_image: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=86'
  });

  useEffect(() => {
    axios.get(`${API_URL}/settings`)
      .then((response) => {
        if (response.data) setSettings(response.data);
      })
      .catch((requestError) => console.error('Error cargando ajustes White Label', requestError));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    if (!email.trim() || !password) {
      setError('Debes completar el email y la contraseña.');
      return;
    }

    setSubmitting(true);
    const { success, message } = await login(email.trim().toLowerCase(), password);
    if (success) {
      navigate('/dashboard');
      return;
    }
    setError(message);
    setSubmitting(false);
  };

  const reveal = reduceMotion
    ? { initial: false, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 } };

  return (
    <main className="app-shell min-h-screen overflow-hidden bg-[#09090b] lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section
        className="brand-panel relative hidden min-h-screen overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
        style={{ '--brand-panel-image': `url("${settings.hero_image}")` }}
        aria-label="Presentación de Ronquillo Te Cuida"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_16%,rgba(244,166,33,.24),transparent_32%)]" />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="brand-logo-frame rounded-2xl p-2">
            <img src={ronquilloLogo} alt="" className="h-12 w-20 rounded-xl object-contain" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[.18em] text-[#ffc65c]">Centro deportivo</p>
            <p className="text-sm font-semibold text-zinc-300">Fuerza · equilibrio · bienestar</p>
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.75, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative z-10 max-w-2xl"
        >
          <div className="mb-6 h-1 w-20 rounded-full bg-[#f4a621]" />
          <h2 className="max-w-xl text-6xl font-black leading-[.94] tracking-[-.055em] text-white xl:text-7xl">
            Tu centro,
            <span className="mt-2 block text-[#ffc65c]">siempre contigo.</span>
          </h2>
          <p className="mt-6 max-w-lg text-lg font-medium leading-8 text-zinc-300">
            Reserva actividades, valida tu asistencia y sigue tu agenda desde una experiencia rápida y sencilla.
          </p>
        </motion.div>

        <p className="relative z-10 text-xs font-bold uppercase tracking-[.16em] text-zinc-500">
          {settings.app_name}
        </p>
      </section>

      <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
        <div className="absolute -right-32 -top-36 h-96 w-96 rounded-full bg-[#f4a621]/15 blur-[110px]" />
        <div className="absolute -bottom-44 -left-40 h-[28rem] w-[28rem] rounded-full bg-[#0a4c7a]/20 blur-[130px]" />

        <motion.div
          {...reveal}
          transition={{ duration: 0.58, ease: [0.2, 0.8, 0.2, 1] }}
          className="glass relative z-10 w-full max-w-[31rem] overflow-hidden rounded-[2rem] p-6 shadow-2xl sm:p-9"
        >
          <motion.div
            initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 140, damping: 17 }}
            className="brand-logo-frame mb-7 rounded-[1.4rem] p-3"
          >
            <img src={ronquilloLogo} alt="Ronquillo Te Cuida" className="h-28 w-full rounded-xl object-contain sm:h-32" />
          </motion.div>

          <div className="mb-7">
            <p className="mb-2 text-xs font-black uppercase tracking-[.2em] text-[#f4a621]">Acceso seguro</p>
            <h1 className="text-4xl font-black tracking-[-.045em] text-white">Bienvenido de nuevo</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-zinc-400">
              Inicia sesión para gestionar tus clases y reservas.
            </p>
          </div>

          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -6 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 overflow-hidden rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
                role="alert"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[.14em] text-zinc-400">Email</span>
              <span className="dark-input flex min-h-14 items-center gap-3 rounded-2xl px-4">
                <EnvelopeSimple size={21} weight="bold" className="shrink-0 text-[#f4a621]" aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  className="min-w-0 flex-1 bg-transparent py-4 text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
                  placeholder="tu@email.com"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[.14em] text-zinc-400">Contraseña</span>
              <span className="dark-input flex min-h-14 items-center gap-3 rounded-2xl px-4">
                <LockKey size={21} weight="bold" className="shrink-0 text-[#f4a621]" aria-hidden="true" />
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent py-4 text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
                  placeholder="Tu contraseña"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {passwordVisible ? <EyeSlash size={20} weight="bold" /> : <Eye size={20} weight="bold" />}
                </button>
              </span>
            </label>

            <motion.button
              whileHover={reduceMotion ? undefined : { scale: 1.012 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
              type="submit"
              disabled={submitting}
              className="gold-button mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black uppercase tracking-[.08em] transition disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? 'Entrando…' : 'Iniciar sesión'}
              {!submitting && <ArrowRight size={20} weight="bold" aria-hidden="true" />}
            </motion.button>
          </form>

          <div className="mt-7 border-t border-white/[.07] pt-5 text-center text-[11px] font-semibold leading-5 text-zinc-400">
            <p>{COPYRIGHT_TEXT}</p>
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-zinc-400 underline decoration-zinc-600 underline-offset-4 transition-colors hover:text-[#ffc65c]"
            >
              Política de privacidad
            </a>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
