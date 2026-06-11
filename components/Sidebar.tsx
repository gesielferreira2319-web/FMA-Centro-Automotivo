import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

const navItems = [
  { name: 'Dashboard', icon: 'dashboard', path: '/' },
  { name: 'Ordens de Serviço', icon: 'assignment', path: '/service-orders' },
  { name: 'Venda de Peças', icon: 'shopping_cart', path: '/parts-sales' },
  { name: 'Desmanche', icon: 'recycling', path: '/dismantling' },
  { name: 'Peças & Estoque', icon: 'inventory_2', path: '/inventory' },
  { name: 'Financeiro', icon: 'payments', path: '/financial' },
  { name: 'Clientes', icon: 'people', path: '/clients' },
  { name: 'Configurações', icon: 'settings', path: '/settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isDarkMode, onToggleTheme }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, role: userRole } = useAuth();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        <div className="p-6 flex items-center space-x-3">
          <div className="w-12 h-12 flex items-center justify-center rounded-lg overflow-hidden bg-slate-900 shadow-sm p-1">
            <Logo className="w-full h-full" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-primary dark:text-white leading-tight">FMA</h1>
            <p className="text-[10px] uppercase tracking-widest text-secondary font-semibold">Centro Automotivo</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {navItems.filter(item => {
            if (userRole === 'owner') return true;
            // If role is null/undefined (loading or error), default to restricted view (Safety)
            // Employee only sees: OS, Venda Peças, Desmanche
            return ['/service-orders', '/parts-sales', '/dismantling', '/clients'].includes(item.path);
          }).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center px-4 py-2.5 rounded-xl transition-all group ${isActive(item.path)
                ? 'bg-primary text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              <span className={`material-icons-round mr-3 ${isActive(item.path) ? '' : 'group-hover:text-primary transition-colors'}`}>
                {item.icon}
              </span>
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 mt-auto">
          {user && (
            <div className="mb-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">Logado como</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={onToggleTheme}
            className="flex items-center justify-between w-full px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all group"
          >
            <div className="flex items-center">
              <span className="material-icons-round mr-3 text-sm">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
              <span className="font-medium text-xs">Modo {isDarkMode ? 'Claro' : 'Escuro'}</span>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="mt-2 flex items-center justify-center w-full px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all text-xs font-medium"
          >
            <span className="material-icons-round mr-2 text-sm">logout</span>
            Sair
          </button>
        </div>
      </aside>

      {/* Overlay para mobile */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden glass" onClick={onClose} />
      )}
    </>
  );
};

