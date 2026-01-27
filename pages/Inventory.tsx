import React, { useState } from 'react';
import { useInventory, InventoryItem, calculateProfitMargin } from '../hooks/useInventory';

export default function Inventory() {
  const { items, loading, stats, addItem, updateItem, deleteItem } = useInventory(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Motor',
    quantity: 0,
    unit_price: 0,
    cost_price: 0,
    supplier_name: '',
    payment_status: 'pendente' as 'a_vista' | 'faturado' | 'pendente',
    due_date: '',
  });
  const [saving, setSaving] = useState(false);

  const filteredItems = items.filter(item => {
    const matchesSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku?.toLowerCase().includes(search.toLowerCase()) ||
      item.supplier_name?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    const matchesStatus = !statusFilter || item.status === statusFilter;
    const matchesPayment = !paymentFilter || item.payment_status === paymentFilter;
    return matchesSearch && matchesCategory && matchesStatus && matchesPayment;
  });

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      sku: '',
      category: 'Motor',
      quantity: 0,
      unit_price: 0,
      cost_price: 0,
      supplier_name: '',
      payment_status: 'pendente',
      due_date: '',
    });
    setShowAddModal(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku || '',
      category: item.category,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_price: item.cost_price || 0,
      supplier_name: item.supplier_name || '',
      payment_status: item.payment_status || 'pendente',
      due_date: item.due_date || '',
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editingItem) {
      await updateItem(editingItem.id, formData);
    } else {
      await addItem({ ...formData, is_used: false });
    }

    setSaving(false);
    setShowAddModal(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta peça?')) {
      await deleteItem(id);
    }
  };

  const formatCurrency = (value: number) => {
    return value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="animate-in fade-in duration-500 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Carregando estoque...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-primary dark:text-white">Controle de Estoque</h2>
          <p className="text-slate-500 dark:text-slate-400">Gerencie peças, suprimentos e níveis de estoque em tempo real.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 w-fit"
        >
          <span className="material-icons-round">add</span>
          Nova Peça
        </button>
      </header>

      <section className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm mb-6 border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-secondary focus:border-secondary outline-none dark:text-white"
              placeholder="Buscar por nome ou SKU..."
              type="text"
            />
          </div>
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-4 pr-10 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 appearance-none focus:ring-secondary outline-none dark:text-white"
            >
              <option value="">Todas Categorias</option>
              <option value="Motor">Motor</option>
              <option value="Freios">Freios</option>
              <option value="Suspensão">Suspensão</option>
              <option value="Elétrica">Elétrica</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 pointer-events-none">expand_more</span>
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-4 pr-10 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 appearance-none focus:ring-secondary outline-none dark:text-white"
            >
              <option value="">Status do Estoque</option>
              <option value="Em Estoque">Em Estoque</option>
              <option value="Estoque Baixo">Estoque Baixo</option>
              <option value="Esgotado">Esgotado</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 pointer-events-none">filter_list</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="relative">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full pl-4 pr-10 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 appearance-none focus:ring-secondary outline-none dark:text-white"
            >
              <option value="">Status Pagamento</option>
              <option value="a_vista">À Vista</option>
              <option value="faturado">Faturado</option>
              <option value="pendente">Pendente</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 pointer-events-none">payments</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-bold mb-1 text-slate-500">Total de Itens</p>
          <p className="text-2xl font-display font-bold text-primary dark:text-blue-400">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-orange-500">
          <p className="text-xs uppercase tracking-wider font-bold mb-1 text-orange-600">Estoque Baixo</p>
          <p className="text-2xl font-display font-bold text-orange-600">{stats.lowStock}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-red-500">
          <p className="text-xs uppercase tracking-wider font-bold mb-1 text-red-600">Esgotados</p>
          <p className="text-2xl font-display font-bold text-red-600">{stats.outOfStock}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-xs uppercase tracking-wider font-bold mb-1 text-emerald-600">Valor Venda</p>
          <p className="text-2xl font-display font-bold text-emerald-600">{formatCurrency(stats.totalValue)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-purple-500">
          <p className="text-xs uppercase tracking-wider font-bold mb-1 text-purple-600">Custo Total</p>
          <p className="text-2xl font-display font-bold text-purple-600">{formatCurrency(stats.totalCost)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-blue-500">
          <p className="text-xs uppercase tracking-wider font-bold mb-1 text-blue-600">Lucro Potencial</p>
          <p className="text-2xl font-display font-bold text-blue-600">{formatCurrency(stats.potentialProfit)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-icons-round text-6xl text-slate-300 dark:text-slate-600 mb-4">inventory_2</span>
            <p className="text-slate-500 dark:text-slate-400">{search ? 'Nenhuma peça encontrada' : 'Nenhuma peça cadastrada'}</p>
            {!search && (
              <button onClick={openAddModal} className="mt-4 text-primary font-bold hover:underline">
                Cadastrar primeira peça
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-sm uppercase">
                <tr>
                  <th className="px-4 py-4 font-semibold">Peça</th>
                  <th className="px-4 py-4 font-semibold">Categoria</th>
                  <th className="px-4 py-4 font-semibold">Qtd</th>
                  <th className="px-4 py-4 font-semibold">Custo</th>
                  <th className="px-4 py-4 font-semibold">Venda</th>
                  <th className="px-4 py-4 font-semibold">Margem</th>
                  <th className="px-4 py-4 font-semibold">Fornecedor</th>
                  <th className="px-4 py-4 font-semibold">Pagamento</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredItems.map((item) => (
                  <tr key={item.id} className={`transition-colors ${item.status === 'Estoque Baixo' ? 'bg-orange-50/50 dark:bg-orange-900/10 border-l-4 border-l-orange-500' : item.status === 'Esgotado' ? 'bg-red-50/50 dark:bg-red-900/10 border-l-4 border-l-red-500' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-700">
                          <span className={`material-icons-round text-lg ${item.status === 'Estoque Baixo' ? 'text-orange-500' : item.status === 'Esgotado' ? 'text-red-500' : 'text-slate-400'}`}>
                            {item.category === 'Elétrica' ? 'bolt' : item.category === 'Suspensão' ? 'settings_input_component' : item.category === 'Freios' ? 'radio_button_checked' : 'directions_car'}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.name}</p>
                          {item.sku && <p className="text-xs text-slate-400 font-mono">{item.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${item.category === 'Freios' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                        item.category === 'Motor' ? 'bg-primary text-white' :
                          item.category === 'Elétrica' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                            'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className={`px-4 py-4 font-semibold text-sm ${item.status === 'Estoque Baixo' ? 'text-orange-600' : item.status === 'Esgotado' ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>{item.quantity}</td>
                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">R$ {(item.cost_price || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">R$ {item.unit_price.toFixed(2)}</td>
                    <td className="px-4 py-4">
                      {(() => {
                        const margin = calculateProfitMargin(item.unit_price, item.cost_price || 0);
                        const marginClass = margin >= 30 ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' :
                          margin >= 15 ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' :
                            margin > 0 ? 'text-red-600 bg-red-100 dark:bg-red-900/30' : 'text-slate-400 bg-slate-100 dark:bg-slate-700';
                        return (
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${marginClass}`}>
                            {margin > 0 ? `${margin.toFixed(0)}%` : '-'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-[120px] truncate" title={item.supplier_name || ''}>
                      {item.supplier_name || '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${item.payment_status === 'a_vista' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' :
                        item.payment_status === 'faturado' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' :
                          'bg-orange-100 dark:bg-orange-900/30 text-orange-700'
                        }`}>
                        {item.payment_status === 'a_vista' ? 'À Vista' : item.payment_status === 'faturado' ? 'Faturado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className={`flex items-center gap-1 ${item.status === 'Estoque Baixo' ? 'text-orange-500' : item.status === 'Esgotado' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {item.status === 'Estoque Baixo' || item.status === 'Esgotado' ? <span className="material-icons-round text-sm">warning</span> : <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                        <span className="text-xs font-medium">{item.status === 'Em Estoque' ? 'OK' : item.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => openEditModal(item)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-slate-400 hover:text-primary"><span className="material-icons-round text-sm">edit</span></button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-slate-400 hover:text-red-500"><span className="material-icons-round text-sm">delete</span></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-[zoomIn_0.2s_ease-out]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-primary text-white">
              <div className="flex items-center gap-3">
                <span className="material-icons-round bg-white/20 p-2 rounded-lg">inventory_2</span>
                <h3 className="text-xl font-display font-bold uppercase tracking-wide">{editingItem ? 'Editar Peça' : 'Adicionar Nova Peça'}</h3>
              </div>
              <button className="hover:bg-white/10 p-2 rounded-full transition-colors" onClick={() => setShowAddModal(false)}>
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <form className="p-6 max-h-[70vh] overflow-y-auto" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-tight">Nome da Peça *</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-secondary focus:border-secondary outline-none dark:text-white"
                    placeholder="Ex: Kit de Amortecedores"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-tight">SKU / Código</label>
                  <input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-secondary focus:border-secondary outline-none dark:text-white"
                    placeholder="FMA-XXX-0000"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-tight">Categoria *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-secondary focus:border-secondary outline-none dark:text-white"
                  >
                    <option value="Motor">Motor</option>
                    <option value="Freios">Freios</option>
                    <option value="Suspensão">Suspensão</option>
                    <option value="Elétrica">Elétrica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-tight">Qtd em Estoque</label>
                  <input
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-secondary focus:border-secondary outline-none dark:text-white"
                    type="number"
                    min="0"
                  />
                </div>

                {/* Seção de Valores e Margem */}
                <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                  <p className="text-sm font-bold text-primary dark:text-blue-400 mb-3 flex items-center gap-2">
                    <span className="material-icons-round text-lg">attach_money</span>
                    Valores e Margem de Lucro
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-tight">Valor de Custo (R$)</label>
                  <input
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-secondary focus:border-secondary outline-none dark:text-white"
                    placeholder="0,00"
                    type="number"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-tight">Preço de Venda (R$)</label>
                  <input
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-secondary focus:border-secondary outline-none dark:text-white"
                    placeholder="0,00"
                    type="number"
                    step="0.01"
                    min="0"
                  />
                </div>

                {/* Exibição da Margem Calculada */}
                <div className="md:col-span-2">
                  {(() => {
                    const margin = calculateProfitMargin(formData.unit_price, formData.cost_price);
                    const profit = formData.unit_price - formData.cost_price;
                    const marginClass = margin >= 30 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 border-emerald-300' :
                      margin >= 15 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 border-yellow-300' :
                        margin > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 border-red-300' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-300';
                    return (
                      <div className={`flex items-center justify-between p-4 rounded-lg border ${marginClass}`}>
                        <div className="flex items-center gap-2">
                          <span className="material-icons-round">trending_up</span>
                          <span className="font-semibold">Margem de Lucro:</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold">{margin > 0 ? `${margin.toFixed(1)}%` : '-'}</span>
                          {profit > 0 && <span className="text-sm ml-2">(R$ {profit.toFixed(2)} por unidade)</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Seção do Fornecedor */}
                <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                  <p className="text-sm font-bold text-primary dark:text-blue-400 mb-3 flex items-center gap-2">
                    <span className="material-icons-round text-lg">local_shipping</span>
                    Dados do Fornecedor
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-tight">Nome do Fornecedor</label>
                  <input
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-secondary focus:border-secondary outline-none dark:text-white"
                    placeholder="Ex: Auto Peças Central"
                    type="text"
                  />
                </div>


              </div>
              <div className="mt-10 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 px-6 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name}
                  className="flex-2 grow py-4 px-10 bg-secondary text-white rounded-lg font-bold shadow-lg shadow-secondary/30 hover:bg-secondary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Salvando...</>
                  ) : (
                    <>{editingItem ? 'Salvar Alterações' : 'Salvar no Estoque'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
