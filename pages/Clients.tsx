import React, { useState } from 'react';
import { useClients, Client } from '../contexts/ClientContext';
import { supabase } from '../lib/supabase';
import { printOrder as printOrderUtil, downloadOrder, sendOrderToWhatsApp } from '../utils/orderPrint';

interface ClientHistory {
    sales: any[];
    serviceOrders: any[];
}

export default function Clients() {
    const { clients, loading, addClient, updateClient, deleteClient } = useClients();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        cpf_cnpj: '',
        email: '',
        vehicle: '',
    });
    const [saving, setSaving] = useState(false);

    // Estados para histórico
    const [showHistory, setShowHistory] = useState(false);
    const [historyClient, setHistoryClient] = useState<Client | null>(null);
    const [history, setHistory] = useState<ClientHistory>({ sales: [], serviceOrders: [] });
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Estado para visualização de OS
    const [viewingOrder, setViewingOrder] = useState<any | null>(null);

    const filteredClients = clients.filter(client => {
        const matchesSearch = !search ||
            client.name.toLowerCase().includes(search.toLowerCase()) ||
            client.phone?.includes(search) ||
            client.cpf_cnpj?.includes(search);

        const matchesStatus = !statusFilter || client.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const openNewModal = () => {
        setEditingClient(null);
        setFormData({ name: '', phone: '', cpf_cnpj: '', email: '', vehicle: '' });
        setShowModal(true);
    };

    const openEditModal = (client: Client) => {
        setEditingClient(client);
        setFormData({
            name: client.name,
            phone: client.phone || '',
            cpf_cnpj: client.cpf_cnpj || '',
            email: client.email || '',
            vehicle: client.vehicle || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        if (editingClient) {
            await updateClient(editingClient.id, formData);
        } else {
            await addClient(formData);
        }

        setSaving(false);
        setShowModal(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este cliente?')) {
            await deleteClient(id);
        }
    };

    const toggleStatus = async (client: Client) => {
        const newStatus = client.status === 'Ativo' ? 'Inativo' : 'Ativo';
        await updateClient(client.id, { status: newStatus });
    };

    const loadClientHistory = async (client: Client) => {
        setHistoryClient(client);
        setShowHistory(true);
        setLoadingHistory(true);

        // Buscar vendas do cliente
        const { data: sales } = await supabase
            .from('sales')
            .select('*, sale_items(*, inventory(name))')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false });

        // Buscar ordens de serviço do cliente
        const { data: serviceOrders } = await supabase
            .from('service_orders')
            .select('*')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false });

        setHistory({
            sales: sales || [],
            serviceOrders: serviceOrders || []
        });
        setLoadingHistory(false);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    const openOrderModal = (order: any) => {
        setViewingOrder(order);
    };

    // Função de impressão do histórico do cliente
    const printHistory = () => {
        if (!historyClient) return;

        const totalOS = history.serviceOrders.reduce((sum: number, os: any) => sum + (os.value || 0), 0);
        const totalSales = history.sales.reduce((sum: number, sale: any) => sum + sale.total, 0);

        const printContent = `
            <html>
            <head>
                <title>Histórico - ${historyClient.name}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                    .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
                    .header h1 { color: #1e40af; font-size: 24px; }
                    .header p { color: #666; margin-top: 5px; }
                    .client-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .client-info h2 { font-size: 18px; color: #1e3a8a; margin-bottom: 10px; }
                    .section { margin-bottom: 25px; }
                    .section h3 { font-size: 16px; color: #1e40af; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                    th { background: #f1f5f9; font-weight: bold; color: #475569; }
                    .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
                    .status-concluido { background: #dcfce7; color: #166534; }
                    .status-andamento { background: #dbeafe; color: #1e40af; }
                    .status-pendente { background: #fef3c7; color: #92400e; }
                    .total-row { background: #f0f9ff; font-weight: bold; }
                    .total-value { color: #059669; font-size: 16px; }
                    .summary { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 20px; border-radius: 8px; margin-top: 20px; }
                    .summary h3 { color: #1e40af; margin-bottom: 15px; }
                    .summary-grid { display: flex; justify-content: space-around; }
                    .summary-item { text-align: center; }
                    .summary-label { color: #64748b; font-size: 14px; }
                    .summary-value { color: #1e3a8a; font-size: 24px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>FMA Centro Automotivo</h1>
                    <p>Histórico do Cliente</p>
                </div>
                
                <div class="client-info">
                    <h2>${historyClient.name}</h2>
                    <p>📞 ${historyClient.phone || 'Não informado'}</p>
                    ${historyClient.cpf_cnpj ? `<p>📄 ${historyClient.cpf_cnpj}</p>` : ''}
                    ${historyClient.email ? `<p>✉️ ${historyClient.email}</p>` : ''}
                </div>
                
                <div class="section">
                    <h3>🔧 Ordens de Serviço (${history.serviceOrders.length})</h3>
                    ${history.serviceOrders.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>OS</th>
                                    <th>Data</th>
                                    <th>Veículo</th>
                                    <th>Status Serv.</th>
                                    <th>Pagamento</th>
                                    <th style="text-align: right">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.serviceOrders.map((os: any) => `
                                    <tr>
                                        <td><strong>#${os.order_number}</strong></td>
                                        <td>${formatDate(os.created_at)}</td>
                                        <td>${os.plate} - ${os.vehicle || 'N/A'}</td>
                                        <td><span class="status ${os.status === 'Concluído' ? 'status-concluido' : os.status === 'Em Andamento' ? 'status-andamento' : 'status-pendente'}">${os.status}</span></td>
                                        <td>
                                            <span class="status ${os.payment_status === 'pago' ? 'status-concluido' : 'status-pendente'}">
                                                ${os.payment_status === 'pago' ? 'PAGO' : 'PENDENTE'}
                                            </span>
                                        </td>
                                        <td style="text-align: right">R$ ${(os.value || 0).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td colspan="5" style="text-align: right"><strong>Total:</strong></td>
                                    <td style="text-align: right" class="total-value">R$ ${totalOS.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    ` : '<p style="text-align: center; color: #94a3b8;">Nenhuma ordem de serviço encontrada</p>'}
                </div>
                
                <div class="section">
                    <h3>🛒 Vendas de Peças (${history.sales.length})</h3>
                    ${history.sales.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Tipo</th>
                                    <th>Pagamento</th>
                                    <th style="text-align: right">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.sales.map((sale: any) => `
                                    <tr>
                                        <td>${formatDate(sale.created_at)}</td>
                                        <td>${sale.sale_type === 'balcao' ? 'Balcão' : 'Desmanche'}</td>
                                        <td>${sale.payment_method}</td>
                                        <td style="text-align: right">R$ ${sale.total.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td colspan="3" style="text-align: right"><strong>Total:</strong></td>
                                    <td style="text-align: right" class="total-value">R$ ${totalSales.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    ` : '<p style="text-align: center; color: #94a3b8;">Nenhuma venda encontrada</p>'}
                </div>
                
                <div class="summary">
                    <h3>📊 Resumo Geral</h3>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <div class="summary-label">Total em OS</div>
                            <div class="summary-value">R$ ${totalOS.toFixed(2)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Total em Vendas</div>
                            <div class="summary-value">R$ ${totalSales.toFixed(2)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Total Geral</div>
                            <div class="summary-value" style="color: #059669;">R$ ${(totalOS + totalSales).toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Impresso em ${new Date().toLocaleString('pt-BR')} | FMA Centro Automotivo</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.print();
        }
    };

    // Função de impressão da ordem de serviço usando utilitário padrão
    const printOrder = () => {
        if (!viewingOrder) return;
        // Adiciona nome do cliente do histórico se não tiver na OS
        const orderWithClient = {
            ...viewingOrder,
            client_name: viewingOrder.client_name || historyClient?.name,
            client_phone: viewingOrder.client_phone || historyClient?.phone
        };
        printOrderUtil(orderWithClient);
    };

    const handleDownloadOrder = () => {
        if (!viewingOrder) return;
        const orderWithClient = {
            ...viewingOrder,
            client_name: viewingOrder.client_name || historyClient?.name,
            client_phone: viewingOrder.client_phone || historyClient?.phone
        };
        downloadOrder(orderWithClient);
    };

    const handleWhatsAppOrder = () => {
        if (!viewingOrder) return;
        const orderWithClient = {
            ...viewingOrder,
            client_name: viewingOrder.client_name || historyClient?.name,
            client_phone: viewingOrder.client_phone || historyClient?.phone
        };
        sendOrderToWhatsApp(orderWithClient, historyClient?.phone);
    };

    if (loading) {
        return (
            <div className="animate-in fade-in duration-500 flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500">Carregando clientes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-primary dark:text-white">Clientes</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gerenciamento da base de clientes e veículos.</p>
                </div>
                <button
                    onClick={openNewModal}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 w-fit"
                >
                    <span className="material-icons-round">person_add</span>
                    Novo Cliente
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative md:col-span-2">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nome, CPF ou telefone..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none dark:text-white"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dark:text-white"
                    >
                        <option value="">Todos os Clientes</option>
                        <option value="Ativo">Ativos</option>
                        <option value="Inativo">Inativos</option>
                    </select>
                </div>

                {filteredClients.length === 0 ? (
                    <div className="p-12 text-center">
                        <span className="material-icons-round text-6xl text-slate-300 dark:text-slate-600 mb-4">people_outline</span>
                        <p className="text-slate-500 dark:text-slate-400">{search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p>
                        {!search && (
                            <button
                                onClick={openNewModal}
                                className="mt-4 text-primary font-bold hover:underline"
                            >
                                Cadastrar primeiro cliente
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                        {filteredClients.map(client => (
                            <div key={client.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300 group flex flex-col relative overflow-hidden">
                                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openEditModal(client); }}
                                        className="p-1.5 bg-white dark:bg-slate-700 text-slate-400 hover:text-primary rounded-lg shadow-sm border border-slate-100 dark:border-slate-600 transition-colors"
                                        title="Editar"
                                    >
                                        <span className="material-icons-round text-sm">edit</span>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }}
                                        className="p-1.5 bg-white dark:bg-slate-700 text-slate-400 hover:text-red-500 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600 transition-colors"
                                        title="Excluir"
                                    >
                                        <span className="material-icons-round text-sm">delete</span>
                                    </button>
                                </div>

                                <div className="p-5 flex-1">
                                    <div className="flex items-start gap-4 mb-5">
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 dark:from-primary/20 dark:to-primary/30 flex items-center justify-center text-xl font-bold text-primary dark:text-blue-400 shrink-0">
                                            {client.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1">
                                            <h3 className="font-bold text-lg text-slate-800 dark:text-white truncate capitalize" title={client.name}>
                                                {client.name}
                                            </h3>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleStatus(client); }}
                                                className={`mt-1 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 w-fit transition-colors ${client.status === 'Ativo'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200'
                                                    }`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'Ativo' ? 'bg-green-600' : 'bg-red-600'}`}></span>
                                                {client.status}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {client.phone && (
                                            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 p-2.5 rounded-lg">
                                                <span className="material-icons-round text-slate-400 text-base">phone</span>
                                                <span className="font-medium">{client.phone}</span>
                                            </div>
                                        )}
                                        {client.vehicle && (
                                            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 px-2.5">
                                                <span className="material-icons-round text-slate-400 text-base">directions_car</span>
                                                <span className="truncate capitalize">{client.vehicle}</span>
                                            </div>
                                        )}
                                        {client.cpf_cnpj && (
                                            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 px-2.5">
                                                <span className="material-icons-round text-slate-400 text-base">badge</span>
                                                <span>{client.cpf_cnpj}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex gap-3">
                                    <button
                                        onClick={() => loadClientHistory(client)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold text-primary dark:text-blue-400 bg-primary/5 hover:bg-primary/10 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                    >
                                        <span className="material-icons-round text-lg">history</span>
                                        Histórico
                                    </button>

                                    {client.phone && (
                                        <a
                                            href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center p-2 text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                            title="Conversar no WhatsApp"
                                        >
                                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                            </svg>
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Novo/Editar Cliente */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                                    {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Nome *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    placeholder="Nome completo"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Telefone</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">CPF/CNPJ</label>
                                    <input
                                        type="text"
                                        value={formData.cpf_cnpj}
                                        onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    placeholder="email@exemplo.com"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Veículo</label>
                                <input
                                    type="text"
                                    value={formData.vehicle}
                                    onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                                    className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    placeholder="Marca Modelo Ano"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving || !formData.name}
                                className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons-round">check</span>
                                        {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Histórico */}
            {showHistory && historyClient && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-primary text-white">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold">Histórico de {historyClient.name}</h3>
                                    <p className="text-sm opacity-90">{historyClient.phone}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={printHistory}
                                        className="flex items-center gap-1 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                                    >
                                        <span className="material-icons-round text-sm">print</span>
                                        Imprimir
                                    </button>
                                    <button onClick={() => setShowHistory(false)} className="text-white/70 hover:text-white">
                                        <span className="material-icons-round">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                            {loadingHistory ? (
                                <div className="text-center py-12">
                                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-slate-500">Carregando histórico...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Ordens de Serviço */}
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                            <span className="material-icons-round text-primary">build</span>
                                            Ordens de Serviço ({history.serviceOrders.length})
                                        </h4>
                                        {history.serviceOrders.length === 0 ? (
                                            <p className="text-slate-500 text-sm text-center py-8">Nenhuma ordem de serviço encontrada</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {history.serviceOrders.map((os: any) => (
                                                    <div
                                                        key={os.id}
                                                        onClick={() => openOrderModal(os)}
                                                        className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all cursor-pointer hover:shadow-md"
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <p className="font-bold text-slate-800 dark:text-white">OS #{os.order_number}</p>
                                                                <p className="text-xs text-slate-500">{os.plate} • {os.vehicle || 'Sem veículo'}</p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1">
                                                                <span className={`text-xs px-2 py-1 rounded-lg font-bold ${os.status === 'Concluído' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                                    os.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                                    }`}>
                                                                    {os.status}
                                                                </span>
                                                                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${os.payment_status === 'pago'
                                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                                                    }`}>
                                                                    {os.payment_status === 'pago' ? 'PAGO' : 'PENDENTE'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-end">
                                                            <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(os.created_at)}</p>
                                                            <p className="font-bold text-primary dark:text-blue-400">R$ {(os.value || 0).toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Vendas */}
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                            <span className="material-icons-round text-primary">shopping_cart</span>
                                            Vendas de Peças ({history.sales.length})
                                        </h4>
                                        {history.sales.length === 0 ? (
                                            <p className="text-slate-500 text-sm text-center py-8">Nenhuma venda encontrada</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {history.sales.map((sale: any) => (
                                                    <div key={sale.id} className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex-1">
                                                                <p className="font-bold text-slate-800 dark:text-white">Venda - {sale.sale_type === 'balcao' ? 'Balcão' : 'Desmanche'}</p>

                                                                {/* Lista de Itens */}
                                                                {sale.sale_items && sale.sale_items.length > 0 && (
                                                                    <div className="mt-2 mb-2 space-y-1">
                                                                        {sale.sale_items.map((item: any, idx: number) => (
                                                                            <div key={idx} className="text-sm text-slate-600 dark:text-slate-300 flex justify-between">
                                                                                <span>{item.inventory?.name || `Item #${item.inventory_id?.substring(0, 8) || '???'}`} {(item.quantity > 1) ? `(${item.quantity}x)` : ''}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <span className="text-xs font-bold text-slate-500 uppercase bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded">
                                                                        {sale.payment_method}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-end border-t border-slate-200 dark:border-slate-600 pt-2 mt-2">
                                                            <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(sale.created_at)}</p>
                                                            <p className="font-bold text-green-600 dark:text-green-400">R$ {sale.total.toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Resumo Total */}
                                    <div className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                                        <h4 className="font-bold text-slate-800 dark:text-white mb-3">Resumo Total</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm text-slate-500">Total em OS</p>
                                                <p className="text-xl font-bold text-slate-800 dark:text-white">
                                                    R$ {history.serviceOrders.reduce((sum: number, os: any) => sum + (os.value || 0), 0).toFixed(2)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500">Total em Vendas</p>
                                                <p className="text-xl font-bold text-slate-800 dark:text-white">
                                                    R$ {history.sales.reduce((sum: number, sale: any) => sum + sale.total, 0).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Visualização de OS */}
            {viewingOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-primary text-white">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold">Ordem de Serviço #{viewingOrder.order_number}</h3>
                                    <p className="text-sm opacity-90">{formatDate(viewingOrder.created_at)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={printOrder}
                                        className="flex items-center gap-1 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                                        title="Imprimir"
                                    >
                                        <span className="material-icons-round text-sm">print</span>
                                        <span className="hidden sm:inline">Imprimir</span>
                                    </button>
                                    <button
                                        onClick={handleDownloadOrder}
                                        className="flex items-center gap-1 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                                        title="Baixar PDF"
                                    >
                                        <span className="material-icons-round text-sm">download</span>
                                        <span className="hidden sm:inline">Baixar</span>
                                    </button>
                                    <button
                                        onClick={handleWhatsAppOrder}
                                        className="flex items-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-white transition-colors"
                                        title="Enviar via WhatsApp"
                                    >
                                        <span className="material-icons-round text-sm">send</span>
                                        <span className="hidden sm:inline">WhatsApp</span>
                                    </button>
                                    <button onClick={() => setViewingOrder(null)} className="text-white/70 hover:text-white ml-2">
                                        <span className="material-icons-round">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-4">
                            {/* Status */}
                            <div className="flex gap-3">
                                <span className={`px-4 py-2 rounded-xl font-bold text-sm ${viewingOrder.status === 'Concluído' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    viewingOrder.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                    }`}>
                                    {viewingOrder.status}
                                </span>
                            </div>

                            {/* Cliente */}
                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Cliente</h4>
                                <p className="font-semibold text-slate-800 dark:text-white">{viewingOrder.client_name || historyClient?.name || 'Não informado'}</p>
                                {viewingOrder.client_phone && (
                                    <p className="text-sm text-slate-500 mt-1">📞 {viewingOrder.client_phone}</p>
                                )}
                            </div>

                            {/* Veículo */}
                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Veículo</h4>
                                <div className="flex flex-wrap items-center gap-4 mb-3">
                                    <span className="font-mono text-lg font-bold bg-primary/10 text-primary px-3 py-1 rounded">{viewingOrder.plate}</span>
                                    {viewingOrder.vehicle && <span className="text-slate-600 dark:text-slate-400">{viewingOrder.vehicle}</span>}
                                    {viewingOrder.km && <span className="text-sm text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">{viewingOrder.km} km</span>}
                                </div>
                                {viewingOrder.vehicle_photo && (
                                    <div className="mt-3">
                                        <img
                                            src={viewingOrder.vehicle_photo}
                                            alt="Foto do veículo"
                                            className="w-full max-h-48 object-cover rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(viewingOrder.vehicle_photo, '_blank')}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Reclamação e Diagnóstico */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Reclamação do Cliente</h4>
                                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{viewingOrder.complaint || viewingOrder.service?.split('\n\nDiagnóstico:')[0] || '-'}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Diagnóstico Técnico</h4>
                                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{viewingOrder.diagnosis || viewingOrder.service?.split('Diagnóstico: ')[1] || '-'}</p>
                                </div>
                            </div>

                            {/* Itens/Peças/Serviços */}
                            {viewingOrder.items && (() => {
                                try {
                                    const parsedItems = typeof viewingOrder.items === 'string'
                                        ? JSON.parse(viewingOrder.items)
                                        : viewingOrder.items;
                                    if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                                        const partsItems = parsedItems.filter((i: any) => i.type === 'part');
                                        const serviceItems = parsedItems.filter((i: any) => i.type === 'service');
                                        const partsTotal = partsItems.reduce((sum: number, i: any) => sum + (i.unitPrice * i.qty), 0);
                                        const servicesTotal = serviceItems.reduce((sum: number, i: any) => sum + (i.unitPrice * i.qty), 0);

                                        return (
                                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Peças e Serviços</h4>
                                                <table className="w-full text-sm">
                                                    <thead className="border-b border-slate-200 dark:border-slate-700">
                                                        <tr className="text-slate-500">
                                                            <th className="py-2 text-left">Item</th>
                                                            <th className="py-2 text-center">Tipo</th>
                                                            <th className="py-2 text-center">Qtd</th>
                                                            <th className="py-2 text-right">Unitário</th>
                                                            <th className="py-2 text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {parsedItems.map((item: any, idx: number) => (
                                                            <tr key={idx}>
                                                                <td className="py-2 text-slate-700 dark:text-slate-300 font-medium">{item.name}</td>
                                                                <td className="py-2 text-center">
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${item.type === 'service' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                                        {item.type === 'service' ? 'Serviço' : 'Peça'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 text-center text-slate-600 dark:text-slate-400">{item.qty}</td>
                                                                <td className="py-2 text-right text-slate-600 dark:text-slate-400">R$ {(item.unitPrice || 0).toFixed(2)}</td>
                                                                <td className="py-2 text-right font-semibold text-slate-800 dark:text-white">R$ {((item.unitPrice || 0) * (item.qty || 1)).toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="border-t-2 border-slate-200 dark:border-slate-600">
                                                        {partsItems.length > 0 && (
                                                            <tr className="text-slate-600 dark:text-slate-400">
                                                                <td colSpan={4} className="py-2 text-right text-sm">Subtotal Peças:</td>
                                                                <td className="py-2 text-right font-medium">R$ {partsTotal.toFixed(2)}</td>
                                                            </tr>
                                                        )}
                                                        {serviceItems.length > 0 && (
                                                            <tr className="text-slate-600 dark:text-slate-400">
                                                                <td colSpan={4} className="py-2 text-right text-sm">Subtotal Serviços:</td>
                                                                <td className="py-2 text-right font-medium">R$ {servicesTotal.toFixed(2)}</td>
                                                            </tr>
                                                        )}
                                                        <tr className="text-slate-800 dark:text-white font-bold">
                                                            <td colSpan={4} className="py-2 text-right">TOTAL:</td>
                                                            <td className="py-2 text-right text-green-600 text-lg">R$ {(partsTotal + servicesTotal).toFixed(2)}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        );
                                    }
                                    return null;
                                } catch { return null; }
                            })()}

                            {/* Observações */}
                            {viewingOrder.notes && (
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Observações</h4>
                                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{viewingOrder.notes}</p>
                                </div>
                            )}

                            {/* Valor Total (se não houver itens) */}
                            {(!viewingOrder.items || (typeof viewingOrder.items === 'string' && viewingOrder.items === '[]')) && viewingOrder.value && (
                                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 p-5 rounded-xl border border-green-200 dark:border-green-800">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-700 dark:text-slate-300 font-semibold">Valor Total da OS:</span>
                                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">R$ {(viewingOrder.value || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
