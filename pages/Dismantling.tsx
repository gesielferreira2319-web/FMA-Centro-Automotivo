import React, { useState, useEffect } from 'react';
import { useDismantling, DismantlingVehicle } from '../hooks/useDismantling';
import { useAuth } from '../contexts/AuthContext';
import { useInventory, uploadImage } from '../hooks/useInventory';
import { useSales } from '../hooks/useSales';
import { UsedPartsSales } from '../components/UsedPartsSales';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';

// KPI Card Component (Local)
const KpiCard = ({ icon, label, value, color, sub, isAlert }: any) => (
    <div className={`p-5 rounded-xl border border-slate-200 shadow-sm bg-white relative overflow-hidden ${isAlert ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}>
        <div className={`absolute top-0 right-0 p-3 opacity-10 text-${color}-600`}>
            <span className="material-icons-round text-6xl">{icon}</span>
        </div>
        <div className={`w-10 h-10 rounded-lg bg-${color}-50 text-${color}-600 flex items-center justify-center mb-3`}>
            <span className="material-icons-round">{icon}</span>
        </div>
        <p className="text-slate-500 text-xs uppercase font-bold tracking-wider">{label}</p>
        <p className={`text-2xl font-bold text-slate-800 mt-1`}>
            {typeof value === 'number' ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : value}
        </p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
);

export default function Dismantling() {
    const [activeTab, setActiveTab] = useState('geral');
    const { role } = useAuth();
    const { vehicles, loading: loadingVehicles, addVehicle, updateVehicle, deleteVehicle } = useDismantling();
    const { items: inventoryItems, loading: loadingInventory, addItem, fetchItems, deleteItem } = useInventory(true);
    const { fetchDismantlingSales, updateSalePaymentStatus } = useSales();
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // EMPLOYEE VIEW: Only Counter Sales
    if (role === 'employee') {
        return (
            <div className="animate-in fade-in duration-500 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-3xl font-display font-bold text-primary dark:text-white">Venda de Peças</h2>
                        <p className="text-slate-500 dark:text-slate-400">Ponto de Venda (PDV) - Balcão</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <UsedPartsSales onClose={() => { }} isStandalone={true} />
                </div>
            </div>
        );
    }

    const [salesData, setSalesData] = useState<any[]>([]);
    const [realizedRevenue, setRealizedRevenue] = useState(0);
    const [vehicleRevenueMap, setVehicleRevenueMap] = useState<Record<string, number>>({});

    // Financial Dashboard State
    const [dailyFlow, setDailyFlow] = useState<any[]>([]);
    const [salesByMethod, setSalesByMethod] = useState<any[]>([]);
    const [pendingPayablesValue, setPendingPayablesValue] = useState(0);
    const [pendingReceivables, setPendingReceivables] = useState<any[]>([]);

    // Filters for Financial Tab
    const [receivablesFilter, setReceivablesFilter] = useState({
        searchClient: '',
        period: 'all' as 'this_month' | 'last_month' | 'this_year' | 'quarter' | 'all'
    });

    // Reports State
    const [reportStats, setReportStats] = useState({
        totalItems: 0,
        topProducts: [] as { name: string, quantity: number, revenue: number }[],
        allProducts: [] as { name: string, quantity: number, revenue: number }[]
    });

    // Components State
    const [showNewVehicleModal, setShowNewVehicleModal] = useState(false);
    const [showSalesModal, setShowSalesModal] = useState(false);
    const [viewingVehicle, setViewingVehicle] = useState<DismantlingVehicle | null>(null);
    const [addingPartToVehicle, setAddingPartToVehicle] = useState<DismantlingVehicle | null>(null);

    // Form States
    const [newVehicle, setNewVehicle] = useState<Partial<DismantlingVehicle>>({
        status: 'disponivel',
        payment_status: 'pendente'
    });

    // New Part State
    const [newPart, setNewPart] = useState({
        name: '',
        quantity: 1,
        unit_price: '',
        category: 'Motor',
        sku: ''
    });
    const [partImages, setPartImages] = useState<{file: File, previewUrl: string}[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // Fetch Sales & Calc Metrics
    useEffect(() => {
        const loadSales = async () => {
            const sales = await fetchDismantlingSales();
            setSalesData(sales);

            let total = 0;
            const revenueMap: Record<string, number> = {};
            const methods: Record<string, number> = {};
            const flow: Record<string, { date: string, income: number, expense: number }> = {};

            // Report Vars
            const partsMap = new Map<string, { quantity: number, revenue: number }>();
            let totalItemsSold = 0;

            // Process Sales
            sales.forEach(sale => {
                total += sale.total;

                // Revenue Map (Vehicle attribution) & Report Stats
                sale.sale_items?.forEach((item: any) => {
                    const origin = item.inventory?.origin_vehicle;
                    const name = item.inventory?.name || 'Peça Desmanche';
                    const rev = (item.unit_price * item.quantity);

                    if (origin) {
                        revenueMap[origin] = (revenueMap[origin] || 0) + rev;
                    }

                    // Report Aggregation
                    const curr = partsMap.get(name) || { quantity: 0, revenue: 0 };
                    curr.quantity += item.quantity;
                    curr.revenue += rev;
                    partsMap.set(name, curr);
                    totalItemsSold += item.quantity;
                });

                // Methods
                const m = sale.payment_method || 'Outros';
                methods[m] = (methods[m] || 0) + sale.total;

                // Daily Flow (Income)
                const dateKey = sale.created_at.split('T')[0];
                if (!flow[dateKey]) flow[dateKey] = { date: dateKey, income: 0, expense: 0 };
                flow[dateKey].income += sale.total;
            });

            // Set Report Stats
            const allProducts = Array.from(partsMap.entries()).map(([name, val]) => ({ name, ...val })).sort((a, b) => b.revenue - a.revenue);
            setReportStats({
                totalItems: totalItemsSold,
                topProducts: allProducts.slice(0, 5),
                allProducts
            });

            setRealizedRevenue(total);
            setVehicleRevenueMap(revenueMap);
            setSalesByMethod(Object.entries(methods).map(([k, v]) => ({ name: k, value: v })));

            // Filter Pending Receivables (All pending sales)
            const pending = sales.filter(s => s.payment_status === 'pendente');
            setPendingReceivables(pending);

            // Process Vehicles (Expenses)
            let pendingPayables = 0;
            vehicles.forEach(v => {
                if (v.payment_status === 'pendente') {
                    pendingPayables += Number(v.purchase_price);
                }

                // Daily Flow (Expense)
                const dateKey = v.purchase_date;
                if (dateKey) {
                    if (!flow[dateKey]) flow[dateKey] = { date: dateKey, income: 0, expense: 0 };
                    flow[dateKey].expense += Number(v.purchase_price);
                }
            });
            setPendingPayablesValue(pendingPayables);

            // Sort Daily Flow
            setDailyFlow(Object.values(flow).sort((a, b) => a.date.localeCompare(b.date)).map(f => ({
                ...f,
                date: new Date(f.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            })));
        };
        loadSales();
    }, [vehicles, refreshTrigger]);

    // Metrics for Cards
    const totalInvested = vehicles.reduce((sum, v) => sum + Number(v.purchase_price || 0), 0);
    const potentialRevenueInventory = inventoryItems.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
    const netCashflow = realizedRevenue - totalInvested;
    const globalROI = totalInvested > 0 ? (netCashflow / totalInvested) * 100 : 0;

    // Handlers
    const handleUpdatePayment = async (id: string) => {
        try {
            await updateVehicle(id, { payment_status: 'pago' });
            alert('Pagamento confirmado!');
        } catch (error) {
            alert('Erro ao atualizar pagamento');
        }
    };

    const handleWriteOff = async (id: string) => {
        try {
            await updateVehicle(id, { status: 'finalizado' });
            alert('Veículo baixado/finalizado com sucesso!');
        } catch (error) {
            alert('Erro ao finalizar veículo');
        }
    };

    const handleSubmitVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addVehicle({
                model: newVehicle.model!,
                plate: newVehicle.plate || '',
                purchase_price: Number(newVehicle.purchase_price),
                cost_price: Number(newVehicle.purchase_price),
                status: 'disponivel',
                payment_status: newVehicle.payment_status as any || 'pendente',
                purchase_date: new Date().toISOString().split('T')[0],
                supplier: newVehicle.supplier || '',
                payment_method: newVehicle.payment_method || '',
                notes: newVehicle.notes || ''
            });
            setShowNewVehicleModal(false);
            setNewVehicle({ status: 'disponivel', payment_status: 'pendente' });
        } catch (error) {
            alert('Erro ao salvar veículo');
        }
    };

    const handleAddPart = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addingPartToVehicle || !newPart.name) return;
        
        setIsUploading(true);
        try {
            const imageUrls: string[] = [];
            for (const item of partImages) {
                const url = await uploadImage(item.file);
                if (url) imageUrls.push(url);
            }

            await addItem({
                name: newPart.name,
                category: newPart.category,
                quantity: newPart.quantity,
                unit_price: Number(newPart.unit_price),
                is_used: true,
                origin_vehicle: `${addingPartToVehicle.model} ${addingPartToVehicle.plate || ''}`.trim(),
                sku: newPart.sku,
                images: imageUrls
            });
            setAddingPartToVehicle(null);
            setNewPart({ name: '', quantity: 1, unit_price: '', category: 'Motor', sku: '' });
            partImages.forEach(item => URL.revokeObjectURL(item.previewUrl));
            setPartImages([]);
            alert('Peça adicionada ao estoque com sucesso!');
        } catch (error) {
            alert('Erro ao adicionar peça');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteVehicle = async (v: DismantlingVehicle) => {
        const originDesc = `${v.model} ${v.plate || ''}`.trim();
        const confirmMsg = `ATENÇÃO: Isso excluirá o veículo "${v.model}" e TODAS as peças cadastradas dele (Estoque).\n\nTem certeza que deseja continuar?`;

        if (confirm(confirmMsg)) {
            try {
                await deleteVehicle(v.id, originDesc);
                alert('Veículo e peças excluídos com sucesso.');
            } catch (error) {
                alert('Erro ao excluir veículo.');
            }
        }
    };

    const handleDeletePart = async (partId: string, partName: string) => {
        if (confirm(`Excluir a peça "${partName}" do estoque?`)) {
            try {
                await deleteItem(partId);
                alert('Peça excluída.');
            } catch (error) {
                alert('Erro ao excluir peça.');
            }
        }
    };


    const handleSaleComplete = () => {
        setRefreshTrigger(prev => prev + 1);
        fetchItems();
    };

    const checkMatch = (origin: string, v: DismantlingVehicle) => {
        if (!origin) return false;
        const o = origin.toLowerCase();
        const m = v.model?.toLowerCase().trim();
        const p = v.plate?.toLowerCase().trim();

        if (!m && !p) return false;

        const matchModel = m ? o.includes(m) : false;
        const matchPlate = p ? o.includes(p) : false;

        // Strict Logic: If Vehicle has both Model and Plate, 
        // we generally require matching Model to avoid mixing cars with duplicate plates.
        if (m && p) {
            // Exception: If part origin seems to lack plate (length heuristic), allow Model-only match.
            // Assumption: "Model" (len N) vs "Model Plate" (len N + K). 
            // If origin is short, it probably has no plate.
            const seemsToLackPlate = o.length <= m.length + 3;

            return matchModel && (matchPlate || seemsToLackPlate);
        }

        return matchModel || matchPlate;
    };

    const vehicleParts = viewingVehicle
        ? inventoryItems.filter(i => checkMatch(i.origin_vehicle || '', viewingVehicle))
        : [];

    // Stats
    const stockValue = vehicleParts.reduce((sum, p) => sum + (p.unit_price * p.quantity), 0);
    const soldValue = viewingVehicle
        ? salesData.reduce((sum, sale) => {
            const vehicleSaleItems = sale.sale_items?.filter((i: any) => checkMatch(i.inventory?.origin_vehicle || '', viewingVehicle)) || [];
            return sum + vehicleSaleItems.reduce((acc: number, i: any) => acc + (i.unit_price * i.quantity), 0);
        }, 0)
        : 0;
    const vehicleTotalPartsValue = stockValue + soldValue;

    // Filter Logic for Receivables
    const getFilteredReceivables = () => {
        let filtered = [...pendingReceivables];

        // Client Search
        if (receivablesFilter.searchClient) {
            const term = receivablesFilter.searchClient.toLowerCase();
            filtered = filtered.filter(s =>
                s.clients?.name?.toLowerCase().includes(term) ||
                s.total.toString().includes(term)
            );
        }

        // Period Filter
        if (receivablesFilter.period !== 'all') {
            const now = new Date();
            filtered = filtered.filter(s => {
                const d = new Date(s.created_at);
                if (receivablesFilter.period === 'this_month') {
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }
                if (receivablesFilter.period === 'last_month') {
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
                }
                if (receivablesFilter.period === 'this_year') {
                    return d.getFullYear() === now.getFullYear();
                }
                if (receivablesFilter.period === 'quarter') {
                    // Last 3 months
                    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                    return d >= threeMonthsAgo;
                }
                return true;
            });
        }

        return filtered;
    };

    const displayedReceivables = getFilteredReceivables();

    return (
        <div className="animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-primary dark:text-white">Desmanche</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gestão completa de compras, vendas e desmontagem.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowSalesModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition flex items-center gap-2">
                        <span className="material-icons-round">point_of_sale</span>
                        Venda Balcão
                    </button>
                    <button onClick={() => setShowNewVehicleModal(true)} className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-dark transition flex items-center gap-2">
                        <span className="material-icons-round">add</span>
                        Nova Compra
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-6 overflow-x-auto">
                {['geral', 'veiculos', 'relatorios', 'financeiro'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`pb-2 px-4 font-medium transition-colors whitespace-nowrap capitalize ${activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}>
                        {tab === 'veiculos' ? 'Veículos' : tab === 'geral' ? 'Visão Geral' : tab === 'financeiro' ? 'Financeiro' : 'Relatórios'}
                    </button>
                ))}
            </div>

            {loadingVehicles || loadingInventory ? (
                <div className="p-12 text-center text-slate-500">Carregando dados...</div>
            ) : (
                <>
                    {/* FINANCE DASHBOARD (Matches Main Financial Style) */}
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            {/* KPI Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <KpiCard icon="trending_up" label="Receita Total" value={realizedRevenue} color="emerald" />
                                <KpiCard icon="trending_down" label="Despesas Pagas" value={totalInvested} color="rose" />
                                <KpiCard icon="account_balance_wallet" label="Lucro Líquido" value={netCashflow} color={netCashflow >= 0 ? 'blue' : 'rose'} />
                                <KpiCard icon="pending_actions" label="A Pagar (Pendente)" value={pendingPayablesValue} color="orange"
                                    sub="(Veículos Pendentes)"
                                    isAlert={pendingPayablesValue > 0}
                                />
                            </div>

                            {/* Info Card: Inventory Potential (Dismantling Specific) */}
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="material-icons-round text-blue-500 text-3xl">inventory_2</span>
                                    <div>
                                        <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Valor em Estoque (Peças)</p>
                                        <p className="text-xs text-blue-600 dark:text-blue-400">Potencial de receita futura</p>
                                    </div>
                                </div>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-200">
                                    {potentialRevenueInventory.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>


                            {/* Charts Area */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Cash Flow Chart */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-80">
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-white mb-4">Fluxo de Caixa (Diário)</h3>
                                    <ResponsiveContainer width="100%" height="90%">
                                        <AreaChart data={dailyFlow}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                            <XAxis dataKey="date" fontSize={11} stroke="#94a3b8" />
                                            <YAxis fontSize={11} stroke="#94a3b8" />
                                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Area type="monotone" dataKey="income" stroke="#10b981" fill="#d1fae5" name="Receita" fillOpacity={0.5} />
                                            <Area type="monotone" dataKey="expense" stroke="#f43f5e" fill="#ffe4e6" name="Despesa" fillOpacity={0.5} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Payment Methods Chart */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-80">
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-white mb-4">Receita por Pagamento</h3>
                                    {salesByMethod.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="90%">
                                            <PieChart>
                                                <Pie data={salesByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                                    {salesByMethod.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][index % 4]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip formatter={(val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sem dados de vendas</div>
                                    )}
                                </div>
                            </div>



                            {/* Profitable Vehicles Table */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                        <span className="material-icons-round text-yellow-500">emoji_events</span>
                                        Top Veículos (Rentabilidade)
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-xs text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                                            <tr>
                                                <th className="pb-3 pl-2">Veículo</th>
                                                <th className="pb-3">Custo</th>
                                                <th className="pb-3">Vendas</th>
                                                <th className="pb-3 text-right">Lucro Real</th>
                                                <th className="pb-3 text-right pr-2">ROI</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {vehicles
                                                .map(v => {
                                                    const rev = vehicleRevenueMap[`${v.model} ${v.plate || ''}`.trim()] || 0;
                                                    const cost = Number(v.purchase_price);
                                                    return { ...v, profit: rev - cost, revenue: rev, roi: cost > 0 ? ((rev - cost) / cost) * 100 : 0 };
                                                })
                                                .sort((a, b) => b.profit - a.profit)
                                                .slice(0, 5)
                                                .map(v => (
                                                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="py-3 pl-2">
                                                            <div className="font-bold dark:text-white">{v.model}</div>
                                                            <div className="text-xs text-slate-500">{v.plate}</div>
                                                        </td>
                                                        <td className="py-3 text-slate-600 dark:text-slate-400">R$ {Number(v.purchase_price).toLocaleString('pt-BR')}</td>
                                                        <td className="py-3 text-green-600">R$ {v.revenue.toLocaleString('pt-BR')}</td>
                                                        <td className={`py-3 text-right font-bold ${v.profit > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                            R$ {v.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className={`py-3 text-right pr-2 font-bold ${v.roi > 0 ? 'text-green-500' : 'text-slate-400'}`}>
                                                            {v.roi.toFixed(0)}%
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'veiculos' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto animate-in fade-in">
                            <table className="w-full text-left block md:table">
                                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold text-sm hidden md:table-header-group">
                                    <tr>
                                        <th className="p-4">Veículo</th>
                                        <th className="p-4">Detalhes</th>
                                        <th className="p-4">Financeiro</th>
                                        <th className="p-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="block md:table-row-group divide-y divide-slate-100 dark:divide-slate-700">
                                    {vehicles.map(v => (
                                        <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 block md:table-row">
                                            <td className="p-4 block md:table-cell">
                                                <div className="font-bold text-slate-800 dark:text-white">{v.model}</div>
                                                {v.plate && <div className="text-xs text-slate-500 font-mono mt-1">{v.plate}</div>}
                                            </td>
                                            <td className="px-4 pb-2 md:p-4 text-sm text-slate-600 dark:text-slate-400 block md:table-cell">
                                                <div className="text-xs text-slate-500 mb-1">{new Date(v.purchase_date).toLocaleDateString('pt-BR')}</div>
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${v.status === 'disponivel' ? 'bg-blue-100 text-blue-700' :
                                                    v.status === 'finalizado' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {v.status}
                                                </span>
                                            </td>
                                            <td className="px-4 pb-4 md:p-4 block md:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500 text-xs">Custo:</span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">R$ {Number(v.purchase_price).toLocaleString('pt-BR')}</span>
                                                </div>
                                                <div className="mt-1">
                                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${v.payment_status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {v.payment_status}
                                                    </span>
                                                    {v.payment_status === 'pendente' && (
                                                        <button
                                                            onClick={() => confirm('Pagar?') && handleUpdatePayment(v.id)}
                                                            className="ml-2 text-[10px] underline text-blue-600 hover:text-blue-800"
                                                        >
                                                            Marcar Pago
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 pb-4 md:p-4 block md:table-cell border-t border-slate-100 md:border-0">
                                                <div className="flex gap-2 justify-start md:justify-end mt-2 md:mt-0">
                                                    {/* Delete Vehicle Button */}
                                                    <button title="Excluir Veículo" className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded bg-slate-50 md:bg-transparent" onClick={() => handleDeleteVehicle(v)}>
                                                        <span className="material-icons-round">delete</span>
                                                    </button>

                                                    {v.status !== 'finalizado' && (
                                                        <button title="Dar Baixa" className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded bg-slate-50 md:bg-transparent" onClick={() => confirm('Finalizar?') && handleWriteOff(v.id)}>
                                                            <span className="material-icons-round">archive</span>
                                                        </button>
                                                    )}
                                                    <button onClick={() => setViewingVehicle(v)} className="p-2 text-blue-600 hover:bg-blue-50 rounded bg-blue-50/50 md:bg-transparent" title="Ver Peças">
                                                        <span className="material-icons-round">visibility</span>
                                                    </button>
                                                    <button onClick={() => setAddingPartToVehicle(v)} className="p-2 text-green-600 hover:bg-green-50 rounded bg-green-50/50 md:bg-transparent" title="Add Peça">
                                                        <span className="material-icons-round">add_circle</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )
            }

            {activeTab === 'financeiro' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Pending Receivables Table (Moved Here) */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                <span className="material-icons-round text-orange-500">account_balance_wallet</span>
                                Contas a Receber (Vendas)
                            </h3>

                            {/* Filters */}
                            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                                <div className="relative">
                                    <span className="material-icons-round absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                                    <input
                                        type="text"
                                        placeholder="Buscar cliente..."
                                        className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 dark:text-white w-full md:w-64 outline-none focus:ring-2 focus:ring-primary/20"
                                        value={receivablesFilter.searchClient}
                                        onChange={e => setReceivablesFilter(prev => ({ ...prev, searchClient: e.target.value }))}
                                    />
                                </div>
                                <select
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                                    value={receivablesFilter.period}
                                    onChange={e => setReceivablesFilter(prev => ({ ...prev, period: e.target.value as any }))}
                                >
                                    <option value="this_month">Este Mês</option>
                                    <option value="last_month">Mês Passado</option>
                                    <option value="quarter">Últimos 3 Meses</option>
                                    <option value="this_year">Este Ano</option>
                                    <option value="all">Tudo</option>
                                </select>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                                    <tr>
                                        <th className="pb-3 pl-2">Data</th>
                                        <th className="pb-3">Cliente</th>
                                        <th className="pb-3">Método</th>
                                        <th className="pb-3">Vencimento</th>
                                        <th className="pb-3 text-right pr-2">Valor</th>
                                        <th className="pb-3 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {displayedReceivables.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-slate-500">
                                                {receivablesFilter.searchClient || receivablesFilter.period !== 'all'
                                                    ? 'Nenhum resultado encontrado para os filtros.'
                                                    : 'Nenhuma conta a receber pendente.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedReceivables.map(sale => (
                                            <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="py-3 pl-2 text-slate-600 dark:text-slate-400">
                                                    {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="py-3 font-bold text-slate-700 dark:text-white">
                                                    {sale.clients?.name || 'Não informado'}
                                                </td>
                                                <td className="py-3 text-slate-600 dark:text-slate-400">
                                                    {sale.payment_method}
                                                </td>
                                                <td className="py-3">
                                                    <span className={`text-xs font-bold ${sale.payment_due_date && new Date(sale.payment_due_date) < new Date() ? 'text-rose-500' : 'text-slate-500'}`}>
                                                        {sale.payment_due_date ? new Date(sale.payment_due_date).toLocaleDateString('pt-BR') : '-'}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right pr-2 font-bold text-slate-800 dark:text-slate-200">
                                                    {sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="py-3 text-center">
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('Confirmar recebimento deste valor?')) {
                                                                try {
                                                                    await updateSalePaymentStatus(sale.id, 'pago');
                                                                    setRefreshTrigger(prev => prev + 1); // Refresh data
                                                                    alert('Pagamento confirmado com sucesso!');
                                                                } catch (e) {
                                                                    alert('Erro ao confirmar pagamento.');
                                                                }
                                                            }
                                                        }}
                                                        className="text-emerald-600 hover:text-emerald-800 text-xs font-bold uppercase border border-emerald-200 hover:bg-emerald-50 rounded px-2 py-1 transition-colors"
                                                    >
                                                        Dar Baixa
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'relatorios' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <KpiCard icon="category" label="Itens Vendidos" value={reportStats.totalItems} color="indigo" />
                        <KpiCard icon="attach_money" label="Receita de Peças" value={realizedRevenue} color="emerald" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Products Chart */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-80">
                            <h3 className="text-lg font-bold text-slate-700 dark:text-white mb-4">Top 5 Peças (Receita)</h3>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart data={reportStats.topProducts} layout="vertical" margin={{ left: 40, right: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <RechartsTooltip formatter={(val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                                    <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} name="Receita" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Inventory Table */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-80 flex flex-col">
                            <h3 className="text-lg font-bold text-slate-700 dark:text-white mb-4">Detalhamento</h3>
                            <div className="flex-1 overflow-y-auto pr-2">
                                <table className="w-full text-sm text-left">
                                    <thead className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-400 text-xs uppercase">
                                        <tr>
                                            <th className="py-2">Peça</th>
                                            <th className="py-2 text-center">Qtd</th>
                                            <th className="py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                        {reportStats.allProducts.map((p, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <td className="py-2 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={p.name}>{p.name}</td>
                                                <td className="py-2 text-center text-slate-500">{p.quantity}</td>
                                                <td className="py-2 text-right font-bold text-slate-700 dark:text-slate-300">{p.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: New Vehicle */}
            {
                showNewVehicleModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in zoom-in-95">
                            <div className="p-4 sm:p-6 border-b border-slate-100 shrink-0">
                                <h3 className="text-xl font-bold dark:text-white">Registrar Compra de Veículo</h3>
                            </div>
                            <form onSubmit={handleSubmitVehicle} className="p-4 sm:p-6 space-y-4 overflow-y-auto grow">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Modelo do Veículo</label>
                                    <input required type="text" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="Ex: Fiat Uno 2010" value={newVehicle.model || ''} onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Placa</label>
                                        <input type="text" className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 border rounded-lg p-2.5 dark:text-white uppercase"
                                            placeholder="ABC-1234" value={newVehicle.plate || ''} onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço Pago (R$)</label>
                                        <input required type="number" step="0.01" className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 border rounded-lg p-2.5 dark:text-white"
                                            placeholder="0,00" value={newVehicle.purchase_price || ''} onChange={e => setNewVehicle({ ...newVehicle, purchase_price: Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status Pagamento</label>
                                        <select className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 border rounded-lg p-2.5 dark:text-white"
                                            value={newVehicle.payment_status} onChange={e => setNewVehicle({ ...newVehicle, payment_status: e.target.value as any })}>
                                            <option value="pendente">Pendente</option>
                                            <option value="pago">Pago</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método</label>
                                        <input type="text" className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 border rounded-lg p-2.5 dark:text-white"
                                            placeholder="Dinheiro, Pix..." value={newVehicle.payment_method || ''} onChange={e => setNewVehicle({ ...newVehicle, payment_method: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <button type="button" onClick={() => setShowNewVehicleModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                    <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark">Salvar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Modal: Sales */}
            {
                showSalesModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <UsedPartsSales onClose={() => setShowSalesModal(false)} onSaleComplete={handleSaleComplete} />
                    </div>
                )
            }

            {/* Modal: Adding Part, Viewing Part - Simplified for brevity in this update, keeping functionality */}
            {
                addingPartToVehicle && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-in zoom-in-95">
                            <div className="p-4 sm:p-6 border-b border-slate-100 shrink-0">
                                <h3 className="text-xl font-bold dark:text-white">Adicionar Peça: {addingPartToVehicle.model}</h3>
                            </div>
                            <form onSubmit={handleAddPart} className="p-4 sm:p-6 space-y-4 overflow-y-auto grow">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Peça</label>
                                    <input required type="text" className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-2.5 dark:text-white"
                                        value={newPart.name} onChange={e => setNewPart({ ...newPart, name: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <select className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-2.5 dark:text-white"
                                        value={newPart.category} onChange={e => setNewPart({ ...newPart, category: e.target.value })}>
                                        <option value="Motor">Motor</option>
                                        <option value="Câmbio">Câmbio</option>
                                        <option value="Lataria">Lataria</option>
                                        <option value="Elétrica">Elétrica</option>
                                        <option value="Suspensão">Suspensão</option>
                                        <option value="Interior">Interior</option>
                                        <option value="Outros">Outros</option>
                                    </select>
                                    <input required type="number" step="0.01" className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-2.5 dark:text-white"
                                        value={newPart.unit_price} onChange={e => setNewPart({ ...newPart, unit_price: e.target.value })} placeholder="Preço" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fotos (Máx 5)</label>
                                    <div className="flex gap-2">
                                        <label className="cursor-pointer flex-1 flex items-center justify-center gap-1 py-2 px-4 rounded-full text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                            <span className="material-icons-round text-[18px]">photo_library</span>
                                            Galeria
                                            <input type="file" multiple accept="image/*, image/jpeg, image/png, image/webp" className="hidden"
                                                onChange={(e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    if (files.length + partImages.length > 5) {
                                                        alert('Máximo de 5 imagens permitido.');
                                                        return;
                                                    }
                                                    const newItems = files.map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }));
                                                    setPartImages(prev => [...prev, ...newItems].slice(0, 5));
                                                    e.target.value = '';
                                                }} />
                                        </label>
                                        <label className="cursor-pointer flex-1 flex items-center justify-center gap-1 py-2 px-4 rounded-full text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                            <span className="material-icons-round text-[18px]">photo_camera</span>
                                            Câmera
                                            <input type="file" accept="image/*, image/jpeg, image/png, image/webp" capture="environment" className="hidden"
                                                onChange={(e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    if (files.length + partImages.length > 5) {
                                                        alert('Máximo de 5 imagens permitido.');
                                                        return;
                                                    }
                                                    const newItems = files.map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }));
                                                    setPartImages(prev => [...prev, ...newItems].slice(0, 5));
                                                    e.target.value = '';
                                                }} />
                                        </label>
                                    </div>
                                    {partImages.length > 0 && (
                                        <div className="flex gap-2 mt-2 flex-wrap">
                                            {partImages.map((item, idx) => (
                                                <div key={idx} className="relative w-12 h-12 rounded border overflow-hidden">
                                                    <img src={item.previewUrl} alt="preview" className="w-full h-full object-cover" />
                                                    <button type="button" onClick={() => {
                                                        URL.revokeObjectURL(item.previewUrl);
                                                        setPartImages(prev => prev.filter((_, i) => i !== idx));
                                                    }} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
                                                        &times;
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button type="button" onClick={() => { 
                                        setAddingPartToVehicle(null); 
                                        partImages.forEach(item => URL.revokeObjectURL(item.previewUrl));
                                        setPartImages([]); 
                                    }} className="px-4 py-2 text-slate-500">Cancelar</button>
                                    <button type="submit" disabled={isUploading} className="px-4 py-2 bg-primary text-white rounded-lg font-bold flex items-center gap-2">
                                        {isUploading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Salvando...</> : 'Salvar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                viewingVehicle && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col animate-in zoom-in-95">
                            <div className="flex flex-col p-4 sm:p-6 border-b border-slate-100 shrink-0">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-bold dark:text-white">{viewingVehicle.model} - Peças</h3>
                                    <p className="font-bold text-green-600">Total Geral: R$ {vehicleTotalPartsValue.toFixed(2)}</p>
                                </div>

                            </div>
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 sticky top-0">
                                        <tr><th className="p-3">Peça</th><th className="p-3 text-right">Preço</th><th className="p-3 text-center">Qtd</th><th className="p-3 text-center">Ações</th></tr>
                                    </thead>
                                    <tbody>
                                        {vehicleParts.map(p => (
                                            <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700">
                                                <td className="p-3 dark:text-slate-200">
                                                    {p.name}
                                                    {p.images && p.images.length > 0 && (
                                                        <div className="flex gap-2 mt-2 flex-wrap">
                                                            {p.images.map((url, idx) => (
                                                                <div key={idx} className="relative group w-12 h-12 rounded border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                                                                    <a href={url} target="_blank" rel="noreferrer" title="Ver Imagem Original">
                                                                        <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                                                                    </a>
                                                                    <a href={`${url}?download=foto_peca_${idx + 1}.jpg`} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 text-white" title="Baixar Imagem">
                                                                        <span className="material-icons-round text-lg drop-shadow-md">file_download</span>
                                                                    </a>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-bold">R$ {p.unit_price.toFixed(2)}</td>
                                                <td className="p-3 text-center">{p.quantity}</td>
                                                <td className="p-3 text-center">
                                                    <button onClick={() => handleDeletePart(p.id, p.name)} className="text-red-400 hover:text-red-600" title="Excluir Peça">
                                                        <span className="material-icons-round text-lg">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end p-4 sm:p-6 border-t border-slate-100 shrink-0 gap-2">
                                <button onClick={() => setViewingVehicle(null)} className="px-4 py-2 border rounded-lg">Fechar</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
