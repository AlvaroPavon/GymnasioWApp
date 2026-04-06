import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = 'http://localhost:3000/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState({
    app_name: 'GymSystem Pro',
    hero_image: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'
  });

  useEffect(() => {
    // Configuración Marca Blanca PÚBLICA
    axios.get(`${API_URL}/settings`)
      .then(res => {
        if(res.data) setSettings(res.data);
      })
      .catch(err => console.error("Error cargando ajustes White Label", err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Aquí podrías usar Zod para validar antes de enviar
    if (!email || !password) {
      return setError('Debes llenar todos los campos');
    }

    const { success, message } = await login(email, password);
    if (success) {
      navigate('/dashboard');
    } else {
      setError(message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-950 overflow-x-hidden overflow-y-auto font-sans">
      
      {/* LEFT SIDE - IMAGE SECTION */}
      <motion.div 
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-10"></div>
        <div className="absolute inset-0 bg-blue-900/40 mix-blend-overlay z-10"></div>
        <img 
          src={settings.hero_image} 
          alt="Gym Hero" 
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute bottom-20 left-16 z-20">
          <motion.div initial={{opacity:0, y:30}} animate={{opacity:1, y:0}} transition={{delay:0.5, duration: 0.8}}>
            <h2 className="text-6xl font-black text-white mb-4 tracking-tighter">Domina <br/>tu Potencial.</h2>
            <p className="text-xl text-slate-300 max-w-md font-light">
              Bienvenido a {settings.app_name}. La plataforma más avanzada del sector.
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* RIGHT SIDE - FORM SECTION */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 relative min-h-[100dvh]">
        
        {/* Glass Orbs Decoration */}
        <div className="absolute top-[10%] right-[10%] w-72 h-72 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[10%] left-[10%] w-72 h-72 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="glass p-12 rounded-[2rem] w-full max-w-lg z-10 relative border-t border-l border-white/20"
        >
          <div className="text-left mb-10">
            <h1 className="text-5xl font-black text-gradient mb-3 tracking-tighter">
              {settings.app_name}
            </h1>
            <p className="text-slate-400 font-medium">Bienvenido de nuevo. Control de accesos.</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl p-4 mb-6 text-sm font-semibold"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 tracking-wide uppercase">Email Corporativo</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all focus:bg-slate-800"
                placeholder="usuario@tuempresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 tracking-wide uppercase">Contraseña</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all focus:bg-slate-800"
                placeholder="••••••••"
              />
            </div>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 px-4 rounded-xl shadow-[0_10px_30px_rgba(59,130,246,0.3)] transition-all mt-4 text-lg"
            >
              Acceder al Panel
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
