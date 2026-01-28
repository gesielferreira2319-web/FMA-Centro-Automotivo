import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useServiceOrders, ServiceOrder } from '../hooks/useServiceOrders';
import { printOrder, downloadOrder, sendOrderToWhatsApp, printBoleto, downloadBoleto, sendBoletoToWhatsApp } from '../utils/orderPrint';
import { DropdownButton } from '../components/DropdownButton';
import { useSettings } from '../hooks/useSettings';

export default function ServiceOrders() {
  const { orders, loading, updateOrder, deleteOrder } = useServiceOrders();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewingOrder, setViewingOrder] = useState<ServiceOrder | null>(null);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !search ||
      order.plate?.toLowerCase().includes(search.toLowerCase()) ||
      order.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      `#OS-${order.order_number}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (order: ServiceOrder, newStatus: ServiceOrder['status']) => {
    await updateOrder(order.id, { status: newStatus });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta OS?')) {
      await deleteOrder(id);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';

    // Se for apenas uma data YYYY-MM-DD (sem hora), faz o split para evitar problemas de fuso
    if (dateStr.length === 10 && dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }

    // Para timestamps completos (created_at), usa a data local
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const handlePrintOrder = (order: ServiceOrder) => {
    printOrder(order);
  };

  const handleDownloadOrder = (order: ServiceOrder) => {
    downloadOrder(order);
  };

  const handleWhatsAppOrder = (order: ServiceOrder) => {
    sendOrderToWhatsApp(order);
  };

  if (loading) {
    return (
      <div className="animate-in fade-in duration-500 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Carregando ordens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-primary dark:text-white">Ordens de Serviço</h2>
          <p className="text-slate-500 dark:text-slate-400">Gerencie todos os atendimentos da oficina.</p>
        </div>
        <Link
          to="/service-orders/new"
          className="flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-lg font-semibold shadow-xl shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 w-fit"
        >
          <span className="material-icons-round">add</span>
          Nova OS
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por OS, cliente ou placa..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dark:text-white"
          >
            <option value="">Todos Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Em Andamento">Em Andamento</option>
            <option value="Aguardando Peças">Aguardando Peças</option>
            <option value="Concluído">Concluído</option>
          </select>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-icons-round text-6xl text-slate-300 dark:text-slate-600 mb-4">assignment</span>
            <p className="text-slate-500 dark:text-slate-400">{search ? 'Nenhuma OS encontrada' : 'Nenhuma ordem de serviço cadastrada'}</p>
            {!search && (
              <Link to="/service-orders/new" className="mt-4 text-secondary font-bold hover:underline inline-block">
                Criar primeira OS
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-sm uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">OS / Data</th>
                  <th className="px-6 py-4 font-semibold">Veículo</th>
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold">Serviço</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Valor</th>
                  <th className="px-6 py-4 font-semibold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700 dark:text-slate-300">#OS-{order.order_number}</div>
                      <div className="text-xs text-slate-500">{formatDate(order.created_at)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-semibold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded w-fit text-slate-700 dark:text-slate-300">{order.plate}</div>
                      {order.vehicle && <div className="text-xs text-slate-500 mt-1">{order.vehicle}</div>}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{order.client_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">{order.service}</td>
                    <td className="px-6 py-4">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order, e.target.value as ServiceOrder['status'])}
                        className={`px - 3 py - 1 text - [11px] font - bold rounded - full border cursor - pointer ${order.status === 'Em Andamento' ? 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' :
                          order.status === 'Concluído' ? 'bg-green-100 text-green-600 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' :
                            order.status === 'Aguardando Peças' ? 'bg-orange-100 text-secondary border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800' :
                              'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                          } `}
                      >
                        <option value="Pendente">PENDENTE</option>
                        <option value="Em Andamento">EM ANDAMENTO</option>
                        <option value="Aguardando Peças">AGUARDANDO PEÇAS</option>
                        <option value="Concluído">CONCLUÍDO</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300 text-right">R$ {(order.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => setViewingOrder(order)}
                          className="text-primary hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2"
                          title="Visualizar OS"
                        >
                          <span className="material-icons-round">visibility</span>
                        </button>
                        <button
                          onClick={() => navigate('/service-orders/new', { state: { editingOrder: order } })}
                          className="text-amber-500 hover:text-amber-600 p-2"
                          title="Editar OS"
                        >
                          <span className="material-icons-round">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="text-slate-400 hover:text-red-500 p-2"
                          title="Excluir OS"
                        >
                          <span className="material-icons-round">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Visualização */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Ordem de Serviço #OS-{viewingOrder.order_number}</h3>
                <p className="text-sm text-slate-500">{formatDate(viewingOrder.created_at)}</p>
              </div>
              <button onClick={() => setViewingOrder(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Cliente */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Cliente</h4>
                <p className="font-semibold text-slate-800 dark:text-white">{viewingOrder.client_name || 'Não informado'}</p>
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
                  // items pode vir como string JSON ou como objeto (JSONB do Supabase)
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
                                  <span className={`text - xs px - 2 py - 0.5 rounded - full font - bold ${item.type === 'service' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'} `}>
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
                              <td className="py-2 text-right text-green-600">R$ {(partsTotal + servicesTotal).toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  }
                  return null;
                } catch { return null; }
              })()}

              {/* Status, Valor e Data */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Status da OS</h4>
                  <span className={`inline-block px-3 py-1 text-sm font-bold rounded-full ${viewingOrder.status === 'Concluído' ? 'bg-green-100 text-green-600' :
                    viewingOrder.status === 'Em Andamento' ? 'bg-blue-100 text-blue-600' :
                      viewingOrder.status === 'Aguardando Peças' ? 'bg-orange-100 text-orange-600' :
                        'bg-slate-100 text-slate-600'
                    }`}>
                    {viewingOrder.status || 'Pendente'}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Financeiro</h4>
                  <p className="text-2xl font-bold text-green-600">
                    R$ {(viewingOrder.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {(viewingOrder as any).payment_method && (
                    <div className="mt-1">
                      <p className="text-xs text-slate-500 uppercase font-bold">
                        {(viewingOrder as any).payment_method}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${(viewingOrder as any).payment_status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {(viewingOrder as any).payment_status === 'pago' ? 'PAGO' : 'PENDENTE'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Datas</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Entrega:</span>
                      <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                        {viewingOrder.delivery_date ? formatDate(viewingOrder.delivery_date) : 'A combinar'}
                      </p>
                    </div>
                    {(viewingOrder as any).created_at && (
                      <div>
                        <span className="text-[10px] text-slate-400 block">Abertura:</span>
                        <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                          {formatDate((viewingOrder as any).created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {((viewingOrder as any).payment_due_date || (viewingOrder as any).payment_date) && (
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Vencimento / Pagamento</h4>
                    <div className="space-y-2">
                      {(viewingOrder as any).payment_due_date && (
                        <div>
                          <span className="text-[10px] text-slate-400 block">Vencimento:</span>
                          <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm text-amber-600">
                            {formatDate((viewingOrder as any).payment_due_date)}
                          </p>
                        </div>
                      )}
                      {(viewingOrder as any).payment_date && (
                        <div>
                          <span className="text-[10px] text-slate-400 block">Pago em:</span>
                          <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm text-green-600">
                            {formatDate((viewingOrder as any).payment_date)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Observações */}
              {viewingOrder.notes && (
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Observações</h4>
                  <p className="text-slate-700 dark:text-slate-300">{viewingOrder.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setViewingOrder(null)}
                className="mr-auto px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Fechar
              </button>

              {/* Botão Imprimir */}
              {(viewingOrder as any).payment_method === 'Boleto' ? (
                <DropdownButton
                  label="Imprimir"
                  icon="print"
                  colorClass="bg-secondary hover:bg-orange-600 text-white"
                  placement="top"
                  options={[
                    { label: 'Imprimir OS', icon: 'description', onClick: () => handlePrintOrder(viewingOrder) },
                    {
                      label: 'Imprimir Boleto',
                      icon: 'qr_code',
                      onClick: () => printBoleto({
                        company_name: settings.company_name,
                        cnpj: settings.cnpj,
                        address: settings.address,
                        pix_key: settings.pix_key || 'Chave não configurada',
                        pix_key_type: settings.pix_key_type || 'CPF',
                        amount: viewingOrder.value || 0,
                        due_date: (viewingOrder as any).payment_due_date,
                        client_name: viewingOrder.client_name || 'Cliente',
                        client_doc: 'Não informado',
                        description: `Pagamento OS #${viewingOrder.order_number}`,
                        created_at: viewingOrder.created_at,
                        pix_qrcode: settings.pix_qrcode,
                        id: viewingOrder.id
                      })
                    }
                  ]}
                />
              ) : (
                <button
                  onClick={() => handlePrintOrder(viewingOrder)}
                  className="px-5 py-2.5 bg-secondary text-white rounded-lg font-bold hover:bg-orange-600 transition-all flex items-center gap-2"
                  title="Imprimir"
                >
                  <span className="material-icons-round text-lg">print</span>
                  Imprimir
                </button>
              )}

              {/* Botão Baixar */}
              {(viewingOrder as any).payment_method === 'Boleto' ? (
                <DropdownButton
                  label="Baixar"
                  icon="download"
                  colorClass="bg-slate-600 hover:bg-slate-700 text-white"
                  placement="top"
                  options={[
                    { label: 'Baixar PDF da OS', icon: 'description', onClick: () => handleDownloadOrder(viewingOrder) },
                    {
                      label: 'Baixar Boleto PDF',
                      icon: 'qr_code',
                      onClick: () => downloadBoleto({
                        company_name: settings.company_name,
                        cnpj: settings.cnpj,
                        address: settings.address,
                        pix_key: settings.pix_key || 'Chave não configurada',
                        pix_key_type: settings.pix_key_type || 'CPF',
                        amount: viewingOrder.value || 0,
                        due_date: (viewingOrder as any).payment_due_date,
                        client_name: viewingOrder.client_name || 'Cliente',
                        client_doc: 'Não informado',
                        description: `Pagamento OS #${viewingOrder.order_number}`,
                        created_at: viewingOrder.created_at,
                        pix_qrcode: settings.pix_qrcode,
                        id: viewingOrder.id
                      })
                    }
                  ]}
                />
              ) : (
                <button
                  onClick={() => handleDownloadOrder(viewingOrder)}
                  className="px-5 py-2.5 bg-slate-600 text-white rounded-lg font-bold hover:bg-slate-700 transition-all flex items-center gap-2"
                  title="Baixar PDF"
                >
                  <span className="material-icons-round text-lg">download</span>
                  Baixar
                </button>
              )}

              {/* Botão WhatsApp */}
              {(viewingOrder as any).payment_method === 'Boleto' ? (
                <DropdownButton
                  label="WhatsApp"
                  icon="send"
                  colorClass="bg-green-500 hover:bg-green-600 text-white"
                  placement="top"
                  options={[
                    { label: 'Enviar Resumo da OS', icon: 'description', onClick: () => handleWhatsAppOrder(viewingOrder) },
                    {
                      label: 'Enviar Boleto Pix',
                      icon: 'qr_code',
                      onClick: () => sendBoletoToWhatsApp({
                        company_name: settings.company_name,
                        cnpj: settings.cnpj,
                        address: settings.address,
                        pix_key: settings.pix_key || 'Chave não configurada',
                        pix_key_type: settings.pix_key_type || 'CPF',
                        amount: viewingOrder.value || 0,
                        due_date: (viewingOrder as any).payment_due_date,
                        client_name: viewingOrder.client_name || 'Cliente',
                        client_doc: 'Não informado',
                        description: `Pagamento OS #${viewingOrder.order_number}`,
                        created_at: viewingOrder.created_at,
                        id: viewingOrder.id,
                        pix_qrcode: settings.pix_qrcode,
                        client_phone: viewingOrder.client_phone
                      }, viewingOrder.client_phone)
                    }
                  ]}
                />
              ) : (
                <button
                  onClick={() => handleWhatsAppOrder(viewingOrder)}
                  className="px-5 py-2.5 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-all flex items-center gap-2"
                  title="Enviar via WhatsApp"
                >
                  <span className="material-icons-round text-lg">send</span>
                  WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
