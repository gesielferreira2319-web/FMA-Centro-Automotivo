import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '../lib/supabase';

// --- TYPES ---
type ViewMode = 'dashboard' | 'payable' | 'receivable' | 'reports';
type ReportTab = 'dre' | 'parts' | 'services' | 'suppliers'; // Add suppliers tab
type DateRange = 'month' | 'last-month' | 'year' | 'quarter' | 'all';

interface FinancialData {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    cashBalance: number;
    payables: {
        pendingCount: number;
        pendingValue: number;
        overdueCount: number;
        overdueValue: number;
    };
    receivables: {
        count: number;
        value: number;
    };
    salesByMethod: { method: string; total: number; count: number }[];
    dailyFlow: { date: string; income: number; expense: number }[];
    monthlyFlow: { month: string; income: number; expense: number }[];
    receivablesAging: {
        current: number; // 0-30 days
        overdue30: number; // 31-60 days
        overdue60: number; // 61-90 days
        overdue90: number; // 90+ days
    };
    receivablesByClient: ClientGroup[];
    // New Report Data
    partsReport: {
        totalRevenue: number;
        totalCost: number; // New field
        totalItems: number;
        topProducts: { name: string; quantity: number; revenue: number }[];
        allProducts: { name: string; quantity: number; revenue: number }[];
    };
    servicesReport: {
        totalRevenue: number;
        totalJobs: number;
        topServices: { name: string; count: number; revenue: number }[];
        allServices: { name: string; count: number; revenue: number }[];
    };
    suppliersReport: {
        totalPurchases: number;
        totalSuppliers: number;
        topSuppliers: { name: string; count: number; total: number }[];
        allSuppliers: { name: string; count: number; total: number; paid: number; pending: number }[];
    };
}

interface ClientGroup {
    clientName: string;
    totalDebt: number;
    overdueAmount: number;
    oldestDueDate: string;
    count: number;
    items: Receivable[];
}

interface Payable {
    id: string;
    description: string;
    amount: number;
    supplier_name: string;
    supplier_phone?: string;
    payment_type: 'a_vista' | 'faturado';
    due_date?: string;
    status: 'pendente' | 'pago';
    created_at: string;
    paid_at?: string;
}

interface Receivable {
    id: string;
    description: string;
    amount: number;
    type: 'venda' | 'os';
    date: string;
    payment_method: string;
    status: string;
    payment_status: 'pendente' | 'pago';
    client_name?: string;
    due_date?: string;
    vehicle?: string; // New
    plate?: string;   // New
}

// --- HELPERS ---
const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR');

const getStatusColor = (status: string, dueDate?: string) => {
    if (status === 'pago' || status === 'Concluído') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'cancelado') return 'bg-slate-100 text-slate-500 border-slate-200';

    if (dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        if (due < today) return 'bg-rose-100 text-rose-700 border-rose-200'; // Vencido
        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 3) return 'bg-orange-100 text-orange-700 border-orange-200'; // Vence logo
    }

    return 'bg-blue-50 text-blue-700 border-blue-200'; // Pendente normal
};

// --- COMPONENTS ---

export default function Financial() {
    // State
    const [view, setView] = useState<ViewMode>('dashboard');
    const [dateRange, setDateRange] = useState<DateRange>('month');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [receivableViewMode, setReceivableViewMode] = useState<'list' | 'client'>('list');
    const [viewingReceivable, setViewingReceivable] = useState<Receivable | null>(null);

    // Report Sub-tabs
    const [reportTab, setReportTab] = useState<ReportTab>('dre');

    // Data State
    const [payables, setPayables] = useState<Payable[]>([]);
    const [receivables, setReceivables] = useState<Receivable[]>([]);
    const [stats, setStats] = useState<FinancialData>({
        totalRevenue: 0, totalExpenses: 0, netProfit: 0, cashBalance: 0,
        payables: { pendingCount: 0, pendingValue: 0, overdueCount: 0, overdueValue: 0 },
        receivables: { count: 0, value: 0 },
        salesByMethod: [], dailyFlow: [], monthlyFlow: [],
        receivablesAging: { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 },
        receivablesByClient: [],
        partsReport: { totalRevenue: 0, totalCost: 0, totalItems: 0, topProducts: [], allProducts: [] },
        servicesReport: { totalRevenue: 0, totalJobs: 0, topServices: [], allServices: [] },
        suppliersReport: { totalPurchases: 0, totalSuppliers: 0, topSuppliers: [], allSuppliers: [] }
    });

    // Form State (Modal)
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Payable | null>(null);
    const [accountForm, setAccountForm] = useState({
        description: '', amount: 0, supplier_name: '', supplier_phone: '',
        payment_type: 'a_vista' as const, due_date: '', status: 'pendente' as const
    });

    // Initialize
    useEffect(() => {
        loadData();
    }, [dateRange]);

    // Data Loading Logic
    const loadData = async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRangeDates(dateRange);

            // 1. Payables (Contas a Pagar)
            // Fetch items in date range
            let payablesQuery = supabase.from('accounts_payable').select('*');
            if (dateRange !== 'all') {
                payablesQuery = payablesQuery.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
            }
            const { data: rangePayables } = await payablesQuery.order('due_date', { ascending: true });

            // Fetch ALL pending items (regardless of date)
            const { data: pendingPayables } = await supabase
                .from('accounts_payable')
                .select('*')
                .eq('status', 'pendente')
                .order('due_date', { ascending: true });

            // Merge unique payables
            const payablesMap = new Map();
            (rangePayables || []).forEach(p => payablesMap.set(p.id, p));
            (pendingPayables || []).forEach(p => payablesMap.set(p.id, p));
            const dbPayables = Array.from(payablesMap.values());


            // 2. Sales (Vendas) - Only 'balcao' and include items
            // Range Sales
            const { data: rangeSales } = await supabase.from('sales')
                .select('*, clients(name), sale_items(quantity, unit_price, inventory(name, cost_price))')
                .eq('sale_type', 'balcao')
                .gte('created_at', start.toISOString()).lte('created_at', end.toISOString());

            // Pending Sales (All time)
            const { data: pendingSales } = await supabase.from('sales')
                .select('*, clients(name), sale_items(quantity, unit_price, inventory(name, cost_price))')
                .eq('sale_type', 'balcao')
                .neq('payment_status', 'pago'); // Fetch anything not fully paid

            // Merge unique Sales
            const salesMap = new Map();
            (rangeSales || []).forEach(s => salesMap.set(s.id, s));
            (pendingSales || []).forEach(s => salesMap.set(s.id, s));
            const dbSales = Array.from(salesMap.values());


            // 3. Service Orders (OS)
            // Range OS
            const { data: rangeOS } = await supabase.from('service_orders').select('*, clients(name)')
                .gte('created_at', start.toISOString()).lte('created_at', end.toISOString());

            // Pending OS (All time)
            const { data: pendingOS } = await supabase.from('service_orders').select('*, clients(name)')
                .neq('payment_status', 'pago');

            // Merge unique OS
            const osMap = new Map();
            (rangeOS || []).forEach(o => osMap.set(o.id, o));
            (pendingOS || []).forEach(o => osMap.set(o.id, o));
            const dbOS = Array.from(osMap.values());

            // Process Data
            const _payables: Payable[] = dbPayables || [];

            const _receivables: Receivable[] = [
                ...(dbSales || []).map(s => ({
                    id: s.id, description: `Venda #${s.id.substring(0, 6)}`, amount: s.total,
                    type: 'venda' as const, date: s.created_at, payment_method: s.payment_method, status: 'Concluído',
                    payment_status: s.payment_status || 'pago',
                    // @ts-ignore
                    client_name: s.clients?.name || 'Venda Rápida', due_date: s.payment_due_date || s.created_at
                })),
                ...(dbOS || []).flatMap(o => {
                    const items: Receivable[] = [];

                    // 1. Entrada (se houver)
                    if (o.entry_amount && o.entry_amount > 0) {
                        items.push({
                            id: `${o.id}_entry`,
                            description: `Entrada OS #${o.order_number} - ${o.vehicle}`,
                            amount: o.entry_amount,
                            type: 'os',
                            date: o.created_at,
                            payment_method: o.entry_method || 'Dinheiro',
                            status: 'Concluído',
                            payment_status: 'pago',
                            // @ts-ignore
                            client_name: o.clients?.name || o.client_name || 'Cliente',
                            due_date: o.created_at,
                            vehicle: o.vehicle,
                            plate: o.plate
                        });
                    }

                    // 2. Restante (ou total se não houver entrada)
                    const remainingAmount = (o.value || 0) - (o.entry_amount || 0);
                    if (remainingAmount > 0) {
                        const count = o.installment_count || 1;
                        const paidCount = o.installments_paid || 0;
                        const isFullyPaid = o.payment_status === 'pago';
                        const effectivePaidCount = isFullyPaid ? count : paidCount;
                        const installmentValue = remainingAmount / count;

                        for (let i = 0; i < count; i++) {
                            const isPaid = i < effectivePaidCount;
                            const baseDate = new Date(o.payment_due_date || o.created_at);
                            const dueDate = new Date(baseDate);
                            dueDate.setMonth(baseDate.getMonth() + i);

                            items.push({
                                id: `${o.id}_inst_${i + 1}`,
                                description: o.entry_amount
                                    ? `Restante OS #${o.order_number} (${i + 1}/${count})`
                                    : `OS #${o.order_number} (${i + 1}/${count}) - ${o.vehicle || 'Veículo'}`,
                                amount: installmentValue,
                                type: 'os',
                                date: o.created_at,
                                payment_method: o.payment_method || '-',
                                status: isPaid ? 'Concluído' : 'Pendente',
                                payment_status: isPaid ? 'pago' : 'pendente',
                                // @ts-ignore
                                client_name: o.clients?.name || o.client_name || 'Cliente',
                                due_date: dueDate.toISOString(),
                                vehicle: o.vehicle,
                                plate: o.plate
                            });
                        }
                    }
                    return items;
                })
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Calculate Stats
            const revenue = _receivables.reduce((sum, r) => sum + r.amount, 0);
            const expensesPaid = _payables.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.amount, 0);

            // --- Parts and Services Reporting Logic ---
            const partsMap = new Map<string, { quantity: number, revenue: number }>();
            const servicesMap = new Map<string, { count: number, revenue: number }>();
            let totalPartsRevenue = 0;
            let totalPartsCost = 0;
            let totalServicesRevenue = 0;
            let totalItemsSold = 0;
            let totalServiceJobs = 0;

            // Process Sales Items (Parts)
            dbSales?.forEach(sale => {
                sale.sale_items?.forEach((item: any) => {
                    if (item.inventory?.name) {
                        const name = item.inventory.name;
                        const rev = (item.unit_price * item.quantity);
                        const cost = (item.inventory.cost_price || 0) * item.quantity;
                        const curr = partsMap.get(name) || { quantity: 0, revenue: 0 };
                        curr.quantity += item.quantity;
                        curr.revenue += rev;
                        partsMap.set(name, curr);

                        totalPartsRevenue += rev;
                        totalPartsCost += cost;
                        totalItemsSold += item.quantity;
                    }
                });
            });

            // Process OS Items (Parts & Services)
            dbOS?.forEach(os => {
                if (os.items) {
                    try {
                        let items: any[] = typeof os.items === 'string' ? JSON.parse(os.items) : os.items;
                        if (!Array.isArray(items)) items = [];
                        items.forEach(item => {
                            if (item.type === 'part') {
                                const name = item.name || 'Peça Indefinida';
                                const rev = (item.unitPrice * item.qty);
                                const curr = partsMap.get(name) || { quantity: 0, revenue: 0 };
                                curr.quantity += item.qty;
                                curr.revenue += rev;
                                partsMap.set(name, curr);
                                totalPartsRevenue += rev;
                                totalItemsSold += item.qty;
                            } else if (item.type === 'service') {
                                const name = item.name || 'Serviço Indefinido';
                                const rev = (item.unitPrice * item.qty);
                                const curr = servicesMap.get(name) || { count: 0, revenue: 0 };
                                curr.count += item.qty;
                                curr.revenue += rev;
                                servicesMap.set(name, curr);
                                totalServicesRevenue += rev;
                                totalServiceJobs += 1;
                            }
                        });
                    } catch (e) { console.error('Error parsing OS items', e); }
                }
            });

            // Sort Top Lists
            const allProducts = Array.from(partsMap.entries()).map(([name, val]) => ({ name, ...val })).sort((a, b) => b.revenue - a.revenue);
            const allServices = Array.from(servicesMap.entries()).map(([name, val]) => ({ name, ...val })).sort((a, b) => b.revenue - a.revenue);

            const partsReport = {
                totalRevenue: totalPartsRevenue,
                totalCost: totalPartsCost,
                totalItems: totalItemsSold,
                topProducts: allProducts.slice(0, 5),
                allProducts
            };

            const servicesReport = {
                totalRevenue: totalServicesRevenue,
                totalJobs: totalServiceJobs,
                topServices: allServices.slice(0, 5),
                allServices
            };



            // --- Suppliers Reporting Logic ---
            const suppliersMap = new Map<string, { count: number, total: number, paid: number, pending: number }>();
            _payables.forEach(p => {
                const name = p.supplier_name || 'Desconhecido';
                const curr = suppliersMap.get(name) || { count: 0, total: 0, paid: 0, pending: 0 };
                curr.count += 1;
                curr.total += p.amount;
                if (p.status === 'pago') curr.paid += p.amount;
                else curr.pending += p.amount;
                suppliersMap.set(name, curr);
            });
            const allSuppliers = Array.from(suppliersMap.entries()).map(([name, val]) => ({ name, ...val })).sort((a, b) => b.total - a.total);

            const suppliersReport = {
                totalPurchases: _payables.reduce((acc, p) => acc + p.amount, 0),
                totalSuppliers: suppliersMap.size,
                topSuppliers: allSuppliers.slice(0, 5),
                allSuppliers
            };

            // --- Advanced Receivables Metrics ---
            const clientMap = new Map<string, ClientGroup>();
            const aging = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };
            const todayTime = new Date(); todayTime.setHours(0, 0, 0, 0);

            _receivables.forEach(r => {
                if (r.payment_status === 'pago') return;

                // Aging
                const due = r.due_date ? new Date(r.due_date) : new Date(r.date);
                const isOverdue = due.getTime() < todayTime.getTime();
                const diffDays = isOverdue ? Math.ceil((todayTime.getTime() - due.getTime()) / (1000 * 3600 * 24)) : 0;

                if (!isOverdue) aging.current += r.amount;
                else if (diffDays <= 30) aging.overdue30 += r.amount;
                else if (diffDays <= 60) aging.overdue60 += r.amount;
                else aging.overdue90 += r.amount;

                // Client Grouping
                const cName = r.client_name || 'Diversos';
                const grp = clientMap.get(cName) || {
                    clientName: cName, totalDebt: 0, overdueAmount: 0, oldestDueDate: r.due_date || r.date, count: 0, items: []
                };
                grp.totalDebt += r.amount;
                if (isOverdue) grp.overdueAmount += r.amount;
                grp.count++;
                grp.items.push(r);

                // Keep oldest due date
                if (new Date(grp.oldestDueDate) > due) grp.oldestDueDate = r.due_date || r.date;

                clientMap.set(cName, grp);
            });
            const receivablesByClient = Array.from(clientMap.values()).sort((a, b) => b.totalDebt - a.totalDebt);


            // Pending Payables (Always fetch ALL pending regardless of date range? No, respect filter but maybe show warning)
            // Actually for "Command Center" usually Payable Board shows ALL pending.
            // Let's do a separate fetch for "All Pending" if we want that KPI correct.
            // For now, using filtered list:
            const pendingList = _payables.filter(p => p.status === 'pendente');
            const today = new Date(); today.setHours(0, 0, 0, 0);

            const overdue = pendingList.filter(p => p.due_date && new Date(p.due_date) < today);

            // Daily Flow
            const flowMap = new Map<string, { income: number, expense: number }>();
            _receivables.forEach(r => {
                const d = new Date(r.date).toLocaleDateString();
                const curr = flowMap.get(d) || { income: 0, expense: 0 };
                curr.income += r.amount;
                flowMap.set(d, curr);
            });
            _payables.filter(p => p.status === 'pago').forEach(p => {
                const d = new Date(p.paid_at || p.created_at).toLocaleDateString();
                const curr = flowMap.get(d) || { income: 0, expense: 0 };
                curr.expense += p.amount;
                flowMap.set(d, curr);
            });
            const dailyFlow = Array.from(flowMap.entries()).map(([date, val]) => ({ date, ...val }));

            // Payment Methods
            const methodsMap = new Map<string, number>();
            _receivables.forEach(r => {
                const m = r.payment_method || 'Outros';
                methodsMap.set(m, (methodsMap.get(m) || 0) + r.amount);
            });
            const salesByMethod = Array.from(methodsMap.entries()).map(([method, total]) => ({
                method, total, count: 0 // count omitted for brevity
            }));

            setPayables(_payables);
            setReceivables(_receivables);
            setStats({
                totalRevenue: revenue,
                totalExpenses: expensesPaid,
                netProfit: revenue - expensesPaid,
                cashBalance: revenue - expensesPaid,
                payables: {
                    pendingValue: pendingList.reduce((acc, p) => acc + p.amount, 0),
                    pendingCount: pendingList.length,
                    overdueValue: overdue.reduce((acc, p) => acc + p.amount, 0),
                    overdueCount: overdue.length
                },
                receivables: { count: _receivables.length, value: revenue },
                salesByMethod,
                dailyFlow,
                monthlyFlow: [],
                receivablesAging: aging,
                receivablesByClient,

                partsReport,
                servicesReport,
                suppliersReport
            });

        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // Actions
    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...accountForm };
            // If paying immediately, set paid_at
            let extra = {};
            if (payload.status === 'pago' && !editingAccount?.paid_at) {
                // @ts-ignore
                extra.paid_at = new Date().toISOString();
            }

            if (editingAccount) {
                await supabase.from('accounts_payable').update({ ...payload, ...extra }).eq('id', editingAccount.id);
            } else {
                await supabase.from('accounts_payable').insert({ ...payload, ...extra });
            }
            setShowModal(false);
            loadData();
        } catch (e) { alert('Erro ao salvar'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir conta?')) return;
        await supabase.from('accounts_payable').delete().eq('id', id);
        loadData();
    };

    const handlePay = async (id: string) => {
        if (!confirm('Confirmar pagamento desta conta?')) return;
        await supabase.from('accounts_payable').update({
            status: 'pago',
            paid_at: new Date().toISOString()
        }).eq('id', id);
        loadData();
    };

    const handleReceive = async (id: string) => {
        // Handle Installments
        if (id.includes('_inst_')) {
            const [realId, _, instIndexStr] = id.split('_');
            const instIndex = parseInt(instIndexStr);

            if (!confirm(`Confirmar recebimento da parcela ${instIndex}?`)) return;

            // Fetch current OS state
            const { data: os } = await supabase.from('service_orders').select('installments_paid, installment_count, payment_status').eq('id', realId).single();

            if (os) {
                const currentPaid = os.installments_paid || 0;
                const total = os.installment_count || 1;

                // Allow specific installment payment logic or just increment?
                // Using increment logic to ensure progress. 
                // However, user might click "Parcela 3" while 1 and 2 are pending.
                // Strictly speaking we should increment.
                // Assuming intentional click.

                let newPaid = currentPaid + 1;
                // Avoid overflow
                if (newPaid > total) newPaid = total;

                const updatePayload: any = { installments_paid: newPaid };

                if (newPaid >= total) {
                    updatePayload.payment_status = 'pago';
                    updatePayload.payment_date = new Date().toISOString();
                }

                await supabase.from('service_orders').update(updatePayload).eq('id', realId);
                loadData();
            }
            return;
        }

        if (id.includes('_entry')) return; // Entry logic usually handled at creation

        if (!confirm('Confirmar recebimento?')) return;
        await supabase.from('service_orders').update({
            payment_status: 'pago',
            payment_date: new Date().toISOString(),
            installments_paid: 1 // Assume full legacy pay
        }).eq('id', id);
        loadData();
    };

    // Render Helpers
    const getDateRangeDates = (range: DateRange) => {
        const now = new Date();
        const start = new Date();
        const end = new Date();

        switch (range) {
            case 'month':
                start.setDate(1);
                break;
            case 'last-month':
                start.setMonth(start.getMonth() - 1); start.setDate(1);
                end.setDate(0); // Last day of prev month
                break;
            case 'quarter':
                start.setMonth(start.getMonth() - 3);
                break;
            case 'year':
                start.setMonth(0); start.setDate(1);
                break;
            case 'all':
                start.setFullYear(2000);
                break;
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    };

    // --- SUB-VIEWS ---

    const renderDashboard = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard icon="trending_up" label="Receita Total" value={stats.totalRevenue} color="emerald" />
                <KpiCard icon="trending_down" label="Despesas Pagas" value={stats.totalExpenses} color="rose" />
                <KpiCard icon="account_balance_wallet" label="Lucro Líquido" value={stats.netProfit} color="blue" />
                <KpiCard icon="pending_actions" label="A Pagar (Pendente)" value={stats.payables.pendingValue} color="orange"
                    sub={`(Vencido: ${formatCurrency(stats.payables.overdueValue)})`}
                    isAlert={stats.payables.overdueValue > 0} />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
                    <h3 className="text-lg font-bold text-slate-700 mb-4">Fluxo de Caixa (Diário)</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <AreaChart data={stats.dailyFlow}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis dataKey="date" fontSize={11} />
                            <YAxis fontSize={11} />
                            <RechartsTooltip />
                            <Area type="monotone" dataKey="income" stroke="#10b981" fill="#d1fae5" name="Entradas" />
                            <Area type="monotone" dataKey="expense" stroke="#f43f5e" fill="#ffe4e6" name="Saídas" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
                    <h3 className="text-lg font-bold text-slate-700 mb-4">Receita por Pagamento</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                            <Pie data={stats.salesByMethod} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={80}>
                                {stats.salesByMethod.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#6366f1'][index % 4]} />
                                ))}
                            </Pie>
                            <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );

    const renderPayables = () => {
        const filtered = payables.filter(p => p.status === 'pendente' || view === 'reports');
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-700">Contas Pendentes e A Vencer</h3>
                    <button onClick={() => { setEditingAccount(null); setShowModal(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all">
                        <span className="material-icons-round text-sm">add</span> Nova Conta
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">Descrição</th>
                                <th className="px-4 py-3">Fornecedor</th>
                                <th className="px-4 py-3">Vencimento</th>
                                <th className="px-4 py-3">Valor</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhuma conta pendente encontrada.</td></tr>
                            ) : filtered.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-700">{item.description}</td>
                                    <td className="px-4 py-3 text-slate-500">{item.supplier_name || '-'}</td>
                                    <td className="px-4 py-3 text-slate-600">{item.due_date ? formatDate(item.due_date) : '-'}</td>
                                    <td className="px-4 py-3 font-bold text-slate-700">{formatCurrency(item.amount)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${getStatusColor(item.status, item.due_date)}`}>
                                            {item.status === 'pago' ? 'PAGO' :
                                                (item.due_date && new Date(item.due_date) < new Date() ? 'VENCIDO' : 'PENDENTE')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        {item.status === 'pendente' && (
                                            <button onClick={() => handlePay(item.id)} className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded" title="Dar Baixa">
                                                <span className="material-icons-round text-lg">check_circle</span>
                                            </button>
                                        )}
                                        <button onClick={() => {
                                            setEditingAccount(item); setAccountForm({
                                                description: item.description, amount: item.amount, supplier_name: item.supplier_name,
                                                supplier_phone: item.supplier_phone || '', payment_type: item.payment_type, due_date: item.due_date || '', status: item.status
                                            }); setShowModal(true);
                                        }} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded">
                                            <span className="material-icons-round text-lg">edit</span>
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-rose-100 text-rose-600 rounded">
                                            <span className="material-icons-round text-lg">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderReceivables = () => {
        const filteredReceivables = receivables.filter(item => {
            const matchesSearch = !search ||
                item.description.toLowerCase().includes(search.toLowerCase()) ||
                item.payment_method?.toLowerCase().includes(search.toLowerCase()) ||
                (item.client_name && item.client_name.toLowerCase().includes(search.toLowerCase())) ||
                (item.vehicle && item.vehicle.toLowerCase().includes(search.toLowerCase())) ||
                (item.plate && item.plate.toLowerCase().includes(search.toLowerCase()));
            const matchesStatus = !statusFilter ||
                (statusFilter === 'pago' ? item.payment_status === 'pago' :
                    statusFilter === 'pendente' ? item.payment_status !== 'pago' : true);
            return matchesSearch && matchesStatus;
        });

        const filteredClients = stats.receivablesByClient.filter(c =>
            !search || c.clientName.toLowerCase().includes(search.toLowerCase())
        );

        // Calculate Totals for Header
        const totalPending = receivables.filter(r => r.payment_status === 'pendente').reduce((acc, r) => acc + r.amount, 0);
        const totalOverdue = stats.receivablesAging.overdue30 + stats.receivablesAging.overdue60 + stats.receivablesAging.overdue90;

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

                {/* --- KPI & AGING HEADER --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* KPI Cards */}
                    <div className="lg:col-span-1 grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-xs font-bold text-slate-400 uppercase">A Receber (Total)</p>
                            <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(totalPending)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm relative overflow-hidden">
                            <div className="absolute right-0 top-0 p-2 opacity-10"><span className="material-icons-round text-rose-500 text-4xl">warning</span></div>
                            <p className="text-xs font-bold text-rose-500 uppercase">Em Atraso</p>
                            <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalOverdue)}</p>
                        </div>
                    </div>

                    {/* Aging Bar */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                            <span className="material-icons-round text-sm">timelapse</span> Envelhecimento da Dívida
                        </h4>
                        <div className="w-full h-8 rounded-lg flex overflow-hidden text-[10px] font-bold text-white uppercase leading-8 text-center shadow-inner">
                            <div style={{ flex: stats.receivablesAging.current || 1 }} className="bg-emerald-400 transition-all hover:bg-emerald-500" title={`Em dia: ${formatCurrency(stats.receivablesAging.current)}`}>
                                {stats.receivablesAging.current > 0 && 'Em dia'}
                            </div>
                            <div style={{ flex: stats.receivablesAging.overdue30 || 0 }} className="bg-orange-400 transition-all hover:bg-orange-500" title={`30 dias: ${formatCurrency(stats.receivablesAging.overdue30)}`}>
                                {stats.receivablesAging.overdue30 > 0 && '<30d'}
                            </div>
                            <div style={{ flex: stats.receivablesAging.overdue60 || 0 }} className="bg-amber-500 transition-all hover:bg-amber-600" title={`60 dias: ${formatCurrency(stats.receivablesAging.overdue60)}`}>
                                {stats.receivablesAging.overdue60 > 0 && '<60d'}
                            </div>
                            <div style={{ flex: stats.receivablesAging.overdue90 || 0 }} className="bg-rose-500 transition-all hover:bg-rose-600" title={`90+ dias: ${formatCurrency(stats.receivablesAging.overdue90)}`}>
                                {stats.receivablesAging.overdue90 > 0 && '90+d'}
                            </div>
                            {totalOverdue === 0 && stats.receivablesAging.current === 0 && (
                                <div className="w-full bg-slate-100 text-slate-400 flex items-center justify-center">Sem dados</div>
                            )}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-slate-400 font-medium">
                            <span>Hoje</span>
                            <span>30 dias</span>
                            <span>60 dias</span>
                            <span>90+ dias</span>
                        </div>
                    </div>
                </div>

                {/* --- CONTROLS --- */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between gap-4 items-center">

                        {/* View Switcher */}
                        <div className="flex bg-slate-200/50 p-1 rounded-lg">
                            <button
                                onClick={() => setReceivableViewMode('list')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${receivableViewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <span className="material-icons-round text-sm">list</span> Transações
                            </button>
                            <button
                                onClick={() => setReceivableViewMode('client')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${receivableViewMode === 'client' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <span className="material-icons-round text-sm">groups</span> Por Cliente
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                            <div className="relative">
                                <span className="material-icons-round absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar cliente..."
                                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/20 w-full md:w-64"
                                />
                            </div>

                            {receivableViewMode === 'list' && (
                                <>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                                    >
                                        <option value="">Status: Todos</option>
                                        <option value="pendente">Pendentes</option>
                                        <option value="pago">Recebidos</option>
                                    </select>
                                </>

                            )}
                        </div>
                    </div>

                    {/* --- TABLE CONTENT --- */}
                    <div className="overflow-x-auto min-h-[300px]">
                        {receivableViewMode === 'list' ? (
                            <table className="w-full text-xs md:text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3">Data</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">Carro/Placa</th>
                                        <th className="px-4 py-3">Origem</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredReceivables.length === 0 ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>
                                    ) : filteredReceivables.map(item => (
                                        <tr
                                            key={item.id}
                                            onClick={() => setViewingReceivable(item)}
                                            className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-4 py-3 text-slate-500">
                                                <div>{formatDate(item.date)}</div>
                                                {item.due_date && item.payment_status !== 'pago' && (
                                                    <div className={`text-[10px] ${new Date(item.due_date) < new Date() ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                                                        Vence: {formatDate(item.due_date)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-700">
                                                {item.client_name || 'Cliente Balcão'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {item.vehicle ? (
                                                    <div>
                                                        <span className="font-semibold">{item.vehicle}</span>
                                                        <span className="block text-[10px] text-slate-400 uppercase">{item.plate}</span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${item.type === 'os' ? 'bg-indigo-50 text-indigo-700' : 'bg-cyan-50 text-cyan-700'}`}>
                                                    {item.type === 'os' ? 'OS' : 'Venda'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.payment_status === 'pago' ? (
                                                    <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                                                        <span className="material-icons-round text-sm">check</span> PAGO
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold border flex items-center gap-1 w-fit ${getStatusColor('pendente', item.due_date)}`}>
                                                            {new Date(item.due_date || '') < new Date() ? 'VENCIDO' : 'PENDENTE'}
                                                        </span>
                                                        <span className="material-icons-round text-slate-300 group-hover:text-blue-500 text-sm transition-colors">visibility</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-700">
                                                {formatCurrency(item.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3 text-center">Ordens/Vendas</th>
                                        <th className="px-4 py-3">Vencim. Mais Antigo</th>
                                        <th className="px-4 py-3 text-right">Devendo (Atrasado)</th>
                                        <th className="px-4 py-3 text-right">Total Devendo</th>
                                        <th className="px-4 py-3 text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredClients.length === 0 ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum cliente com débito.</td></tr>
                                    ) : filteredClients.map((client, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 font-bold text-slate-700">{client.clientName}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{client.count}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(client.oldestDueDate)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-rose-600">
                                                {client.overdueAmount > 0 ? formatCurrency(client.overdueAmount) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                                                {formatCurrency(client.totalDebt)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => { setSearch(client.clientName); setReceivableViewMode('list'); }}
                                                    className="text-blue-600 hover:text-blue-800 text-xs font-bold underline"
                                                >
                                                    Ver Detalhes
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* --- RECEIVABLE DETAILS MODAL --- */}
                {
                    viewingReceivable && (
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                        <span className="material-icons-round text-blue-600">receipt</span>
                                        Detalhes do Recebimento
                                    </h3>
                                    <button onClick={() => setViewingReceivable(null)} className="hover:bg-slate-200 rounded p-1"><span className="material-icons-round">close</span></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase">Cliente</p>
                                            <p className="text-lg font-bold text-slate-800">{viewingReceivable.client_name || 'Não informado'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-400 uppercase">Valor</p>
                                            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(viewingReceivable.amount)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                        {viewingReceivable.vehicle && (
                                            <>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Veículo</p>
                                                    <p className="text-sm font-semibold text-slate-700">{viewingReceivable.vehicle}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Placa</p>
                                                    <p className="text-sm font-semibold text-slate-700 uppercase">{viewingReceivable.plate || '-'}</p>
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Origem</p>
                                            <p className="text-sm font-semibold text-slate-700">{viewingReceivable.type === 'os' ? 'Ordem de Serviço' : 'Venda de Balcão'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Status Pagto</p>
                                            <p className={`text-sm font-bold uppercase ${viewingReceivable.payment_status === 'pago' ? 'text-emerald-600' : 'text-orange-600'}`}>
                                                {viewingReceivable.payment_status}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Data Emissão</p>
                                            <p className="text-sm font-medium text-slate-600">{formatDate(viewingReceivable.date)}</p>
                                        </div>
                                        {viewingReceivable.due_date && (
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Vencimento</p>
                                                <p className={`text-sm font-bold ${new Date(viewingReceivable.due_date) < new Date() && viewingReceivable.payment_status !== 'pago' ? 'text-rose-600' : 'text-slate-600'}`}>
                                                    {formatDate(viewingReceivable.due_date)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Descrição / Itens</p>
                                        <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 border border-slate-100">
                                            {viewingReceivable.description}
                                        </div>
                                    </div>

                                    {viewingReceivable.payment_status !== 'pago' && (
                                        <button
                                            onClick={() => {
                                                handleReceive(viewingReceivable.id);
                                                setViewingReceivable(null);
                                            }}
                                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 mt-4"
                                        >
                                            <span className="material-icons-round">payments</span>
                                            Confirmar Recebimento
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        );
    };

    const renderReports = () => (
        <div className="space-y-6 animate-in fade-in">
            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                <button onClick={() => setReportTab('dre')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${reportTab === 'dre' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    Visão Geral (DRE)
                </button>
                <button onClick={() => setReportTab('parts')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${reportTab === 'parts' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    Peças (Loja)
                </button>
                <button onClick={() => setReportTab('services')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${reportTab === 'services' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    Serviços
                </button>
                <button onClick={() => setReportTab('suppliers')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${reportTab === 'suppliers' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    Fornecedores
                </button>
            </div>

            {reportTab === 'dre' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold mb-4">DRE Simplificado</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded text-emerald-900">
                                <span>(+) Receita Operacional Bruta</span>
                                <span className="font-bold">{formatCurrency(stats.totalRevenue)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-rose-50 rounded text-rose-900">
                                <span>(-) Despesas Pagas</span>
                                <span className="font-bold">{formatCurrency(stats.totalExpenses)}</span>
                            </div>
                            <div className="my-2 border-t border-slate-200"></div>
                            <div className="flex justify-between items-center p-4 bg-slate-800 text-white rounded-lg shadow">
                                <span className="font-bold">(=) Resultado Líquido</span>
                                <span className="font-bold text-xl">{formatCurrency(stats.netProfit)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {reportTab === 'parts' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Parts KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <span className="material-icons-round">category</span>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Itens</p>
                                <p className="text-xl font-bold text-slate-800">{stats.partsReport.totalItems}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <span className="material-icons-round">attach_money</span>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Receita</p>
                                <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.partsReport.totalRevenue)}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                                <span className="material-icons-round">money_off</span>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Custo (Fornecedor)</p>
                                <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.partsReport.totalCost)}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <span className="material-icons-round">trending_up</span>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Lucro Bruto</p>
                                <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.partsReport.totalRevenue - stats.partsReport.totalCost)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Products Chart */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Top 5 Peças (Receita)</h3>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart data={stats.partsReport.topProducts} layout="vertical" margin={{ left: 40, right: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                                    <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} name="Receita" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Inventory Table */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden h-80 flex flex-col">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Detalhamento</h3>
                            <div className="flex-1 overflow-y-auto pr-2">
                                <table className="w-full text-sm text-left">
                                    <thead className="sticky top-0 bg-white border-b border-slate-100 text-slate-400 text-xs uppercase">
                                        <tr>
                                            <th className="py-2">Peça</th>
                                            <th className="py-2 text-center">Qtd</th>
                                            <th className="py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {stats.partsReport.allProducts.map((p, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="py-2 font-medium text-slate-700 truncate max-w-[150px]" title={p.name}>{p.name}</td>
                                                <td className="py-2 text-center text-slate-500">{p.quantity}</td>
                                                <td className="py-2 text-right font-bold text-slate-700">{formatCurrency(p.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {reportTab === 'services' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Services KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <span className="material-icons-round">handyman</span>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-bold uppercase">Serviços Realizados</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.servicesReport.totalJobs}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <span className="material-icons-round">attach_money</span>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-bold uppercase">Receita de Serviços</p>
                                <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.servicesReport.totalRevenue)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Services Chart */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Top 5 Serviços (Receita)</h3>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart data={stats.servicesReport.topServices} layout="vertical" margin={{ left: 40, right: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                                    <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="Receita" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Services Table */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden h-80 flex flex-col">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Detalhamento</h3>
                            <div className="flex-1 overflow-y-auto pr-2">
                                <table className="w-full text-sm text-left">
                                    <thead className="sticky top-0 bg-white border-b border-slate-100 text-slate-400 text-xs uppercase">
                                        <tr>
                                            <th className="py-2">Serviço</th>
                                            <th className="py-2 text-center">Qtd</th>
                                            <th className="py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {stats.servicesReport.allServices.map((p, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="py-2 font-medium text-slate-700 truncate max-w-[150px]" title={p.name}>{p.name}</td>
                                                <td className="py-2 text-center text-slate-500">{p.count}</td>
                                                <td className="py-2 text-right font-bold text-slate-700">{formatCurrency(p.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {reportTab === 'suppliers' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Suppliers KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                <span className="material-icons-round">local_shipping</span>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-bold uppercase">Compras Realizadas</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.suppliersReport.totalSuppliers} <span className="text-sm text-slate-400 font-medium">fornecedores</span></p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                                <span className="material-icons-round">money_off</span>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-bold uppercase">Total Comprado</p>
                                <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.suppliersReport.totalPurchases)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Suppliers Chart */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Top 5 Fornecedores (Valor)</h3>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart data={stats.suppliersReport.topSuppliers} layout="vertical" margin={{ left: 40, right: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                                    <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Bar dataKey="total" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} name="Total Comprado" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Suppliers Table */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden h-80 flex flex-col">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Detalhamento</h3>
                            <div className="flex-1 overflow-y-auto pr-2">
                                <table className="w-full text-sm text-left">
                                    <thead className="sticky top-0 bg-white border-b border-slate-100 text-slate-400 text-xs uppercase">
                                        <tr>
                                            <th className="py-2">Fornecedor</th>
                                            <th className="py-2 text-center">Compras</th>
                                            <th className="py-2 text-right text-emerald-600">Pago</th>
                                            <th className="py-2 text-right text-orange-600">Pendente</th>
                                            <th className="py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {stats.suppliersReport.allSuppliers.map((s, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="py-2 font-medium text-slate-700 truncate max-w-[150px]" title={s.name}>{s.name}</td>
                                                <td className="py-2 text-center text-slate-500">{s.count}</td>
                                                <td className="py-2 text-right text-emerald-600 font-medium">{formatCurrency(s.paid)}</td>
                                                <td className="py-2 text-right text-orange-600 font-medium">{formatCurrency(s.pending)}</td>
                                                <td className="py-2 text-right font-bold text-slate-700">{formatCurrency(s.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 pb-20">
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-icons-round text-blue-600">query_stats</span>
                        Gestão Financeira
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Controle de caixa, contas e resultados.</p>
                </div>

                <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex items-center">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as DateRange)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-transparent outline-none cursor-pointer hover:text-slate-800"
                    >
                        <option value="month">Este Mês</option>
                        <option value="last-month">Mês Passado</option>
                        <option value="quarter">Trimestre</option>
                        <option value="year">Este Ano</option>
                        <option value="all">Tudo</option>
                    </select>
                </div>
            </div>

            {/* --- TABS --- */}
            <div className="flex items-center gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
                <TabButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="dashboard" label="Visão Geral" />
                <TabButton active={view === 'payable'} onClick={() => setView('payable')} icon="receipt_long" label="Contas a Pagar"
                    badge={stats.payables.pendingCount > 0 ? stats.payables.pendingCount : undefined} />
                <TabButton active={view === 'receivable'} onClick={() => setView('receivable')} icon="attach_money" label="Contas a Receber" />
                <TabButton active={view === 'reports'} onClick={() => setView('reports')} icon="bar_chart" label="Relatórios" />
            </div>

            {/* --- CONTENT --- */}
            {loading ? (
                <div className="h-64 flex items-center justify-center text-slate-400 gap-2">
                    <span className="material-icons-round animate-spin">refresh</span> Carregando...
                </div>
            ) : (
                <>
                    {view === 'dashboard' && renderDashboard()}
                    {view === 'payable' && renderPayables()}
                    {view === 'receivable' && renderReceivables()}
                    {view === 'reports' && renderReports()}
                </>
            )}

            {/* --- MODAL --- */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold">{editingAccount ? 'Editar Conta' : 'Nova Conta a Pagar'}</h3>
                            <button onClick={() => setShowModal(false)} className="hover:bg-white/20 rounded p-1"><span className="material-icons-round">close</span></button>
                        </div>
                        <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                                <input required type="text" value={accountForm.description} onChange={e => setAccountForm({ ...accountForm, description: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500" placeholder="Ex. peças" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor (R$)</label>
                                    <input required type="number" step="0.01" value={accountForm.amount} onChange={e => setAccountForm({ ...accountForm, amount: parseFloat(e.target.value) })}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vencimento</label>
                                    <input type="date" value={accountForm.due_date} onChange={e => setAccountForm({ ...accountForm, due_date: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor (Opcional)</label>
                                <input type="text" value={accountForm.supplier_name} onChange={e => setAccountForm({ ...accountForm, supplier_name: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500" placeholder="Nome do fornecedor" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                                    <select value={accountForm.payment_type} onChange={e => setAccountForm({ ...accountForm, payment_type: e.target.value as any })}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500">
                                        <option value="a_vista">À Vista</option>
                                        <option value="faturado">Faturado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                    <select value={accountForm.status} onChange={e => setAccountForm({ ...accountForm, status: e.target.value as any })}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500">
                                        <option value="pendente">Pendente</option>
                                        <option value="pago">Pago</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-600/20 transition-all">
                                Salvar Conta
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// Stats Card Component
const KpiCard = ({ icon, label, value, color, sub, isAlert }: any) => (
    <div className={`p-5 rounded-xl border border-slate-200 shadow-sm bg-white relative overflow-hidden ${isAlert ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}>
        <div className={`absolute top-0 right-0 p-3 opacity-10 text-${color}-600`}>
            <span className="material-icons-round text-6xl">{icon}</span>
        </div>
        <div className={`w-10 h-10 rounded-lg bg-${color}-50 text-${color}-600 flex items-center justify-center mb-3`}>
            <span className="material-icons-round">{icon}</span>
        </div>
        <p className="text-slate-500 text-xs uppercase font-bold tracking-wider">{label}</p>
        <p className={`text-2xl font-bold text-slate-800 mt-1`}>{formatCurrency(value)}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
);

// Tab Button Component
const TabButton = ({ active, onClick, icon, label, badge }: any) => (
    <button onClick={onClick} className={`
        flex items-center gap-2 px-6 py-3 border-b-2 transition-all whitespace-nowrap
        ${active ? 'border-blue-600 text-blue-600 font-bold bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
    `}>
        <span className="material-icons-round text-lg">{icon}</span>
        {label}
        {badge > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                {badge}
            </span>
        )}
    </button>
);
