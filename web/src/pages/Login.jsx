import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

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
    <div className="min-h-screen flex items-center justify-center bg-gym-dark relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-gym-accent/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-gym-highlight/20 rounded-full blur-3xl pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass p-10 rounded-3xl w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gym-accent to-gym-highlight mb-2">
            GymManager
          </h1>
          <p className="text-slate-400">Accede a tu cuenta de gimnasio</p>
        </div>

        {error && (
          <div className="bg-gym-warning/20 text-gym-warning border border-gym-warning/50 rounded-lg p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gym-accent transition-all"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gym-accent transition-all"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-gym-accent to-blue-600 hover:from-blue-600 hover:to-gym-accent text-white font-bold py-3 px-4 rounded-xl shadow-lg transform transition hover:-translate-y-1"
          >
            Ingresar
          </button>
        </form>
      </motion.div>
    </div>
  );
}
