import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

interface DashboardStats {
  servicesOpen: number;
  monthlyRevenue: number;
  criticalStock: number;
  recentOrders: any[];
  stockAlerts: any[];
}

export default function Dashboard() {
  const { role } = useAuth();

  // State declarations moved to top to prevent ReferenceError
  const [stats, setStats] = useState<DashboardStats>({
    servicesOpen: 0,
    monthlyRevenue: 0,
    criticalStock: 0,
    recentOrders: [],
    stockAlerts: [],
  });
  const [loading, setLoading] = useState(true);
  const [companyPhone, setCompanyPhone] = useState('(11) 99999-9999');

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);

      try {
        // Carregar configurações (telefone) - Loading for everyone
        const { data: settings } = await supabase
          .from('settings')
          .select('phone')
          .maybeSingle(); // Changed to maybeSingle to handle 0 rows gracefully without error if not using RLS strictness or if empty

        if (settings?.phone) {
          setCompanyPhone(settings.phone);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }

      // Se não for owner, não precisamos carregar o resto das estatísticas
      if (role !== 'owner') {
        setLoading(false);
        return;
      }

      try {
        // Carregar ordens de serviço em aberto
        const { data: orders } = await supabase
          .from('service_orders')
          .select('*, clients(name)')
          .order('created_at', { ascending: false })
          .limit(5);

        // Contar OS em aberto (não concluídas)
        const { count: openCount } = await supabase
          .from('service_orders')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'Concluído');

        // Carregar vendas e serviços dos últimos 30 dias
        const startOfPeriod = new Date();
        startOfPeriod.setDate(startOfPeriod.getDate() - 30);
        startOfPeriod.setHours(0, 0, 0, 0);

        const { data: salesData } = await supabase
          .from('sales')
          .select('total')
          .gte('created_at', startOfPeriod.toISOString());

        const salesTotal = salesData?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;

        // Carregar OS do período
        const { data: osData } = await supabase
          .from('service_orders')
          .select('value, status, payment_method')
          .gte('created_at', startOfPeriod.toISOString());

        const osTotal = osData?.reduce((sum, os) => {
          if (os.payment_method || os.status === 'Concluído') {
            return sum + (os.value || 0);
          }
          return sum;
        }, 0) || 0;

        const monthlyRevenue = salesTotal + osTotal;

        // Carregar itens com estoque baixo
        const { data: lowStock, count: lowStockCount } = await supabase
          .from('inventory')
          .select('*', { count: 'exact' })
          .lte('quantity', 5)
          .order('quantity', { ascending: true })
          .limit(3);

        setStats({
          servicesOpen: openCount || 0,
          monthlyRevenue,
          criticalStock: lowStockCount || 0,
          recentOrders: orders || [],
          stockAlerts: lowStock || [],
        });
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [role]);

  // OWNER VIEW: Full Dashboard
  // If role is NOT 'owner' (e.g. 'employee', null, or loading), show the Splash Screen (Safe Default)
  if (role === 'owner') {
    // Fall through to render dashboard below
  } else {
    // EMPLOYEE / UNAUTHORIZED VIEW
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] animate-in fade-in duration-700">
        <div className="w-48 h-48 mb-6 drop-shadow-[0_0_25px_rgba(0,0,0,0.1)]">
          <Logo className="w-full h-full" />
        </div>
        <h1 className="text-4xl font-display font-bold text-slate-800 dark:text-white tracking-widest uppercase mb-4 text-center">
          FMA Centro Automotivo
        </h1>
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-6 py-3 rounded-full border border-slate-200 dark:border-slate-700">
          <span className="material-icons-round text-primary text-2xl">phone</span>
          <span className="text-xl font-bold tracking-wider">{companyPhone}</span>
        </div>
        <p className="mt-8 text-sm text-slate-400 max-w-md text-center">
          Bem-vindo ao sistema. Utilize o menu lateral para acessar suas funções.
        </p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em Andamento': return 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800';
      case 'Concluído': return 'bg-green-100 text-green-600 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800';
      case 'Aguardando Peças': return 'bg-orange-100 text-secondary border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800';
      default: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="animate-in fade-in duration-500 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-800 dark:text-white">Resumo Geral</h2>
          <p className="text-slate-500 dark:text-slate-400">Bem-vindo de volta, Administrador.</p>
        </div>

        <div className="flex items-center space-x-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              placeholder="Buscar placa, cliente..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
          </div>
          <button className="p-2 text-slate-400 hover:text-primary dark:hover:text-white relative">
            <span className="material-icons-round">notifications</span>
            {stats.criticalStock > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border-2 border-white dark:border-slate-900"></span>
            )}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-white dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-none flex items-center group hover:scale-[1.02] transition-transform">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mr-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <span className="material-icons-round text-3xl">car_repair</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Serviços em Aberto</p>
            <h3 className="text-2xl font-bold mt-1 dark:text-white">{stats.servicesOpen}</h3>
            <p className="text-xs text-primary flex items-center mt-1 font-medium">
              <span className="material-icons-round text-xs mr-1">pending</span>
              Ordens não concluídas
            </p>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-white dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-none flex items-center group hover:scale-[1.02] transition-transform">
          <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center mr-5 group-hover:bg-green-600 group-hover:text-white transition-colors">
            <span className="material-icons-round text-3xl">account_balance_wallet</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Faturamento Mensal</p>
            <h3 className="text-2xl font-bold mt-1 dark:text-white">R$ {stats.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-green-500 flex items-center mt-1 font-medium">
              <span className="material-icons-round text-xs mr-1">calendar_today</span>
              Últimos 30 dias
            </p>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-white dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-none flex items-center group hover:scale-[1.02] transition-transform">
          <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 text-secondary rounded-2xl flex items-center justify-center mr-5 group-hover:bg-secondary group-hover:text-white transition-colors">
            <span className="material-icons-round text-3xl">warning</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Estoque Crítico</p>
            <h3 className="text-2xl font-bold mt-1 dark:text-white">{stats.criticalStock} {stats.criticalStock === 1 ? 'Item' : 'Itens'}</h3>
            <Link to="/inventory" className="text-xs text-secondary flex items-center mt-1 underline cursor-pointer hover:text-orange-600">
              Verificar estoque
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold font-display dark:text-white">Atividades Recentes</h3>
            <Link to="/service-orders" className="text-sm font-semibold text-primary hover:text-blue-700 dark:text-blue-400">Ver todas</Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <span className="material-icons-round text-4xl mb-2">inbox</span>
              <p>Nenhuma ordem de serviço ainda</p>
              <Link to="/service-orders/new" className="text-primary font-bold mt-2 inline-block hover:underline">
                Criar primeira OS
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-4 font-semibold">Ordem / Placa</th>
                    <th className="pb-4 font-semibold">Cliente</th>
                    <th className="pb-4 font-semibold">Serviço</th>
                    <th className="pb-4 font-semibold">Status</th>
                    <th className="pb-4 font-semibold text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.recentOrders.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-4">
                        <div className="font-bold text-slate-700 dark:text-slate-300">#{item.order_number || 'N/A'}</div>
                        <div className="text-xs text-slate-500 font-mono">{item.plate}</div>
                      </td>
                      <td className="py-4 text-slate-600 dark:text-slate-400">{item.clients?.name || 'Cliente não informado'}</td>
                      <td className="py-4 text-sm text-slate-600 dark:text-slate-400 max-w-[200px] truncate">{item.service}</td>
                      <td className="py-4">
                        <span className={`px-3 py-1 text-[11px] font-bold rounded-full border ${getStatusColor(item.status)}`}>
                          {item.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 font-medium text-slate-700 dark:text-slate-300 text-right">R$ {item.value?.toFixed(2) || '0,00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-8">
          <div className="bg-primary p-6 rounded-2xl text-white relative overflow-hidden group shadow-lg shadow-blue-900/20 transform transition-all hover:shadow-xl">
            <div className="relative z-10">
              <h4 className="text-lg font-bold mb-2">Nova Ordem de Serviço</h4>
              <p className="text-blue-100 text-sm mb-4">Inicie um novo atendimento rapidamente.</p>
              <Link to="/service-orders/new" className="bg-white text-primary px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors flex items-center w-fit shadow-md">
                <span className="material-icons-round text-sm mr-2">add</span>
                Criar Agora
              </Link>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500">
              <span className="material-icons-round text-9xl">build_circle</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-bold mb-4 font-display dark:text-white">Estoque em Alerta</h3>
            {stats.stockAlerts.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                <span className="material-icons-round text-3xl mb-2">check_circle</span>
                <p className="text-sm">Estoque OK</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.stockAlerts.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center mr-3 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                        <span className="material-icons-round text-slate-500 text-sm">inventory_2</span>
                      </div>
                      <span className="text-sm font-medium dark:text-slate-300">{item.name}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${item.quantity === 0 ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      }`}>
                      {item.quantity} unid.
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link to="/inventory" className="block w-full text-center mt-6 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Ir para Inventário
            </Link>
          </div>
        </section>
      </div>

      <Link to="/service-orders/new" className="fixed bottom-8 right-8 w-14 h-14 bg-secondary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 hover:shadow-orange-500/30">
        <span className="material-icons-round text-3xl">add</span>
      </Link>
    </div>
  );
}
