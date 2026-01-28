import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth, UserRole } from '../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isSignUp) {
      // Validar senhas
      if (password !== confirmPassword) {
        setError('As senhas não coincidem');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter no mínimo 6 caracteres');
        setLoading(false);
        return;
      }

      const { error } = await signUp(email, password, selectedRole, name);

      if (error) {
        setError(getErrorMessage(error.message));
        setLoading(false);
      } else {
        setSuccess(`Conta de ${selectedRole === 'owner' ? 'Proprietário' : 'Funcionário'} criada! Verifique seu email.`);
        setLoading(false);
        setIsSignUp(false);
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } else {
      console.log('Tentando login com:', email);
      const { error } = await signIn(email, password);

      if (error) {
        console.error('Login error:', error);
        setError(getErrorMessage(error.message));
        setLoading(false);
      } else {
        navigate('/');
      }
    }
  };

  const getErrorMessage = (message: string): string => {
    if (message.includes('Invalid login credentials')) return 'Email ou senha incorretos';
    if (message.includes('Email not confirmed')) return 'Email não confirmado. Verifique sua caixa de entrada.';
    if (message.includes('Too many requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
    if (message.includes('User already registered')) return 'Este email já está cadastrado.';
    if (message.includes('Password should be')) return 'A senha deve ter no mínimo 6 caracteres.';
    return 'Erro ao processar. Tente novamente.';
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#0a0f1d]">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,hsla(210,80%,15%,1)_0,transparent_50%),radial-gradient(at_50%_50%,hsla(25,90%,8%,1)_0,transparent_60%),radial-gradient(at_100%_0%,hsla(210,80%,15%,1)_0,transparent_50%)]"></div>
      </div>

      <main className="relative z-10 w-full max-w-md p-4 animate-[fadeIn_0.5s_ease-out]">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6 w-40 h-40 flex justify-center items-center transform hover:scale-105 transition-transform duration-300">
            <Logo className="w-full h-full drop-shadow-[0_0_15px_rgba(0,242,255,0.3)]" />
          </div>
          <h1 className="font-display text-xl font-bold tracking-[0.2em] text-white/90 text-center uppercase">
            Sistema de Gestão
          </h1>
        </div>

        <div className="bg-[#111827]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl ring-1 ring-white/5">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Header: Title + Role Toggles */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex bg-slate-800/80 p-1 rounded-xl w-full border border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setSelectedRole('owner')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${selectedRole === 'owner'
                    ? 'bg-secondary text-white shadow-lg shadow-orange-900/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  Proprietário
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('employee')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${selectedRole === 'employee'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  Funcionário
                </button>
              </div>
              <h2 className="text-sm text-slate-400 font-medium">
                {isSignUp
                  ? `Criar conta de ${selectedRole === 'owner' ? 'Proprietário' : 'Funcionário'}`
                  : 'Acesse sua conta'
                }
              </h2>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-3">
                <span className="material-symbols-outlined text-xl">error</span>
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-center gap-3">
                <span className="material-symbols-outlined text-xl">check_circle</span>
                {success}
              </div>
            )}

            <div className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Nome Completo</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors text-xl">person</span>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Digite seu nome"
                      required
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Email</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors text-xl">mail</span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Digite seu email"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-400">Senha</label>
                  {!isSignUp && (
                    <a href="#" className="text-xs font-medium text-slate-500 hover:text-white transition-colors">Esqueceu?</a>
                  )}
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors text-xl">lock</span>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                  />
                </div>
              </div>

              {/* Campo de confirmar senha - apenas no signup */}
              {isSignUp && (
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Confirmar Senha</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors text-xl">lock</span>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {!isSignUp && (
              <div className="flex items-center space-x-2 px-1">
                <input id="remember" type="checkbox" className="w-4 h-4 rounded border-slate-700 text-secondary focus:ring-secondary bg-slate-800" />
                <label htmlFor="remember" className="text-sm text-slate-400 cursor-pointer select-none">Lembrar de mim</label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-display font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                ${selectedRole === 'owner' ? 'bg-gradient-to-r from-orange-600 to-amber-600 shadow-orange-900/50' : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-900/50'}
              `}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </>
              ) : (
                <>
                  {isSignUp ? 'Criar Conta' : 'Entrar na Conta'}
                  <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_right_alt</span>
                </>
              )}
            </button>

            {/* Link para alternar entre login e signup */}
            <div className="text-center pt-2 border-t border-white/5 mt-6">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-slate-400 hover:text-white transition-colors mt-4"
              >
                {isSignUp ? (
                  <>Já tem conta? <span className={`font-bold ${selectedRole === 'owner' ? 'text-secondary' : 'text-blue-400'}`}>Fazer Login</span></>
                ) : (
                  <>Não tem conta? <span className={`font-bold ${selectedRole === 'owner' ? 'text-secondary' : 'text-blue-400'}`}>Criar Nova Conta</span></>
                )}
              </button>
            </div>
          </form>
        </div>

        <footer className="mt-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">
            © FMA Centro Automotivo
          </p>
        </footer>
      </main>
    </div>
  );
}