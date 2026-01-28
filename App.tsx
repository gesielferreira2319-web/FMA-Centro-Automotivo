import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ServiceOrders from './pages/ServiceOrders';
import NewServiceOrder from './pages/NewServiceOrder';
import Inventory from './pages/Inventory';
import Financial from './pages/Financial';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import NewPartsSales from './pages/NewPartsSales';
import Dismantling from './pages/Dismantling';
import Install from './pages/Install';
import { Sidebar } from './components/Sidebar';
import { ClientProvider } from './contexts/ClientContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 min-w-0 bg-background-light dark:bg-background-dark overflow-auto">
        <div className="lg:hidden p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="material-icons-round text-slate-600 dark:text-slate-300">menu</span>
            </button>
            <span className="font-display font-bold text-lg text-primary dark:text-white">FMA</span>
          </div>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

// Componente de rota protegida
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Componente para redirecionar usuários logados
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <ClientProvider>
        <HashRouter>
          <Routes>
            <Route path="/install" element={<Install />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/service-orders" element={<ProtectedRoute><Layout><ServiceOrders /></Layout></ProtectedRoute>} />
            <Route path="/service-orders/new" element={<ProtectedRoute><Layout><NewServiceOrder /></Layout></ProtectedRoute>} />
            <Route path="/parts-sales" element={<ProtectedRoute><Layout><NewPartsSales /></Layout></ProtectedRoute>} />
            <Route path="/dismantling" element={<ProtectedRoute><Layout><Dismantling /></Layout></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Layout><Inventory /></Layout></ProtectedRoute>} />
            <Route path="/financial" element={<ProtectedRoute><Layout><Financial /></Layout></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Layout><Clients /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ClientProvider>
    </AuthProvider>
  );
}