import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useServiceOrders, ServiceOrder } from '../hooks/useServiceOrders';
import { useClients, Client } from '../contexts/ClientContext';
import { useInventory } from '../hooks/useInventory';
import { CustomerSelector } from '../components/CustomerSelector';
import { printOrder as printOrderUtil, downloadOrder, sendOrderToWhatsApp } from '../utils/orderPrint';

interface ServiceItem {
  id: number;
  name: string;
  code: string;
  qty: number;
  unitPrice: number;
  type: 'part' | 'service';
}

export default function NewServiceOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addOrder, updateOrder } = useServiceOrders();
  const { items: inventoryItems } = useInventory(false);
  const [saving, setSaving] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [vehiclePhotoFile, setVehiclePhotoFile] = useState<File | null>(null);

  // Estado para detectar se está editando
  const editingOrder = (location.state as { editingOrder?: ServiceOrder })?.editingOrder;
  const isEditing = !!editingOrder;

  const [formData, setFormData] = useState({
    plate: '',
    vehicle: '',
    km: '',
    complaint: '',
    diagnosis: '',
    service: '',
    notes: '',
    value: 0,
    deliveryDate: '',
    paymentMethod: '',
    installments: '1x',
    boletoExpiration: '',
    status: 'Pendente' as 'Pendente' | 'Em Andamento' | 'Aguardando Peças' | 'Concluído'
  });

  // Itens de peças e mão de obra
  const [items, setItems] = useState<ServiceItem[]>([]);

  // Modal para adicionar item
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState<ServiceItem>({
    id: 0,
    name: '',
    code: '',
    qty: 1,
    unitPrice: 0,
    type: 'part',
  });

  // Carregar dados da OS se estiver editando
  useEffect(() => {
    const loadEditingData = async () => {
      if (editingOrder) {
        setFormData({
          plate: editingOrder.plate || '',
          vehicle: editingOrder.vehicle || '',
          km: editingOrder.km || '',
          complaint: editingOrder.complaint || editingOrder.service?.split('\n\nDiagnóstico:')[0] || '',
          diagnosis: editingOrder.diagnosis || editingOrder.service?.split('Diagnóstico: ')[1] || '',
          service: editingOrder.service || '',
          notes: editingOrder.notes || '',
          value: editingOrder.value || 0,
          deliveryDate: editingOrder.delivery_date || '',
          paymentMethod: (editingOrder as any).payment_method || '',
          boletoExpiration: (editingOrder as any).payment_due_date || '',
          installments: '1x', // Tentar extrair de notes se necessário, mas '1x' é safe default
          status: editingOrder.status
        });

        // Carregar foto do veículo se existir
        if (editingOrder.vehicle_photo) {
          setVehiclePhoto(editingOrder.vehicle_photo);
        }

        // Carregar itens se existirem
        if (editingOrder.items) {
          try {
            const parsedItems = typeof editingOrder.items === 'string'
              ? JSON.parse(editingOrder.items)
              : editingOrder.items;
            if (Array.isArray(parsedItems)) {
              setItems(parsedItems);
            }
          } catch (e) {
            console.error('Erro ao carregar itens:', e);
          }
        }

        // Carregar cliente se existir client_id
        if (editingOrder.client_id) {
          try {
            const { supabase } = await import('../lib/supabase');
            const { data: clientData } = await supabase
              .from('clients')
              .select('*')
              .eq('id', editingOrder.client_id)
              .single();

            if (clientData) {
              setSelectedClient(clientData);
            }
          } catch (e) {
            console.error('Erro ao carregar cliente:', e);
          }
        }
      }
    };

    loadEditingData();
  }, [editingOrder]);


  const partsTotal = items.filter(i => i.type === 'part').reduce((sum, i) => sum + (i.unitPrice * i.qty), 0);
  const servicesTotal = items.filter(i => i.type === 'service').reduce((sum, i) => sum + (i.unitPrice * i.qty), 0);
  const total = partsTotal + servicesTotal;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVehiclePhotoFile(file); // Salvar arquivo para upload
      const reader = new FileReader();
      reader.onload = (event) => {
        setVehiclePhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddItem = () => {
    if (!newItem.name || newItem.unitPrice <= 0) {
      alert('Preencha o nome e o preço do item');
      return;
    }

    const itemToAdd = {
      ...newItem,
      id: Date.now(),
    };
    setItems([...items, itemToAdd]);
    setNewItem({ id: 0, name: '', code: '', qty: 1, unitPrice: 0, type: 'part' });
    setShowAddItemModal(false);
  };

  const handleSelectFromInventory = (item: any) => {
    const itemToAdd: ServiceItem = {
      id: Date.now(),
      name: item.name,
      code: item.sku || '',
      qty: 1,
      unitPrice: item.unit_price,
      type: 'part',
    };
    setItems([...items, itemToAdd]);
    setShowAddItemModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate) {
      alert('Preencha a placa do veículo');
      return;
    }

    setSaving(true);

    // Upload da foto do veículo se existir (apenas se for uma nova foto)
    let photoUrl: string | null = vehiclePhoto;
    if (vehiclePhotoFile) {
      try {
        const { supabase } = await import('../lib/supabase');
        const fileName = `vehicle_${Date.now()}_${formData.plate.toUpperCase()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('vehicle-photos')
          .upload(fileName, vehiclePhotoFile, { contentType: vehiclePhotoFile.type });

        if (uploadError) {
          console.error('Erro ao fazer upload da foto:', uploadError);
        } else if (uploadData) {
          const { data: publicUrl } = supabase.storage
            .from('vehicle-photos')
            .getPublicUrl(uploadData.path);
          photoUrl = publicUrl.publicUrl;
        }
      } catch (err) {
        console.error('Erro no upload:', err);
      }
    }

    // Combinar reclamação e diagnóstico no campo service
    const serviceDescription = formData.complaint + (formData.diagnosis ? '\n\nDiagnóstico: ' + formData.diagnosis : '');

    // Tratamento de método de pagamento com detalhe de parcelas
    let finalPaymentMethod = formData.paymentMethod;
    if (formData.paymentMethod === 'Cartão de Crédito' && formData.installments !== '1x') {
      finalPaymentMethod = `Cartão de Crédito (${formData.installments})`;
    }

    // Tratamento de parcelas nas anotações (backup)
    let finalNotes = formData.notes;
    if (formData.paymentMethod === 'Cartão de Crédito' && formData.installments !== '1x') {
      const installmentsNote = `\n[Pagamento Parcelado: ${formData.installments}]`;
      if (!finalNotes.includes(installmentsNote)) {
        finalNotes += installmentsNote;
      }
    }

    // Determine Payment Status
    const isImmediatePayment = ['Dinheiro', 'PIX', 'Cartão de Débito'].includes(formData.paymentMethod);
    const paymentStatus: 'pendente' | 'pago' = isImmediatePayment ? 'pago' : 'pendente';

    const orderData = {
      client_id: selectedClient?.id || null,
      plate: formData.plate.toUpperCase(),
      vehicle: formData.vehicle,
      km: formData.km || null,
      complaint: formData.complaint || null,
      diagnosis: formData.diagnosis || null,
      service: serviceDescription,
      status: formData.status || 'Pendente',
      value: total || formData.value,
      notes: finalNotes,
      vehicle_photo: photoUrl,
      items: items.length > 0 ? JSON.stringify(items) : null,
      delivery_date: formData.deliveryDate || null,
      payment_method: finalPaymentMethod || null,
      payment_due_date: formData.paymentMethod === 'Boleto' ? formData.boletoExpiration : null,
      payment_status: paymentStatus,
    };

    if (isEditing && editingOrder) {
      // Atualizar OS existente
      const success = await updateOrder(editingOrder.id, orderData);
      setSaving(false);

      if (success) {
        navigate('/service-orders');
      } else {
        alert('Erro ao atualizar ordem de serviço. Tente novamente.');
      }
    } else {
      // Criar nova OS
      const order = await addOrder(orderData);
      setSaving(false);

      if (order) {
        navigate('/service-orders');
      } else {
        alert('Erro ao salvar ordem de serviço. Tente novamente.');
      }
    }
  };

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItemQty = (id: number, delta: number) => {
    setItems(items.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  };

  // Monta objeto de OS para impressão/compartilhamento
  const buildOrderForPrint = () => {
    return {
      order_number: editingOrder?.order_number || 0,
      created_at: editingOrder?.created_at || new Date().toISOString(),
      status: formData.status || 'Pendente',
      client_name: selectedClient?.name,
      client_phone: selectedClient?.phone,
      client_cpf: selectedClient?.cpf_cnpj,
      plate: formData.plate,
      vehicle: formData.vehicle,
      km: formData.km,
      complaint: formData.complaint,
      diagnosis: formData.diagnosis,
      items: items,
      value: total,
      delivery_date: formData.deliveryDate,
      notes: formData.notes
    };
  };

  const handlePrint = () => {
    printOrderUtil(buildOrderForPrint());
  };

  const handleDownload = () => {
    downloadOrder(buildOrderForPrint());
  };

  const handleWhatsApp = () => {
    sendOrderToWhatsApp(buildOrderForPrint(), selectedClient?.phone);
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
            {isEditing ? `Editar OS #OS-${editingOrder?.order_number}` : 'Nova Ordem de Serviço'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {isEditing ? 'Edição de ordem de serviço existente.' : 'Abertura de nova ordem técnica e diagnóstica.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/service-orders')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <span className="material-icons-round text-lg">arrow_back</span>
            Voltar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
            title="Imprimir"
          >
            <span className="material-icons-round text-lg">print</span>
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 transition-all shadow-lg"
            title="Baixar PDF"
          >
            <span className="material-icons-round text-lg">download</span>
            <span className="hidden sm:inline">Baixar</span>
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-500/20"
            title="Enviar via WhatsApp"
          >
            <span className="material-icons-round text-lg">send</span>
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Seção 1: Cliente */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-lg">
                  <span className="material-icons-round text-primary dark:text-blue-400">person</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">1. Identificação do Cliente</h3>
              </div>
              <CustomerSelector
                selectedClient={selectedClient}
                onSelectClient={setSelectedClient}
              />
            </section>

            {/* Seção 2: Diagnóstico */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-lg">
                  <span className="material-icons-round text-primary dark:text-blue-400">content_paste_search</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">2. Diagnóstico Técnico</h3>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Reclamação do Cliente (Sintomas)</label>
                    <textarea
                      value={formData.complaint}
                      onChange={(e) => setFormData({ ...formData, complaint: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-slate-200"
                      placeholder="Descreva os ruídos, comportamentos ou falhas relatadas pelo cliente..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Previsão de Entrega</label>
                    <input
                      type="date"
                      value={formData.deliveryDate}
                      onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-slate-200"
                    />
                    <p className="text-xs text-slate-400">Data estimada para conclusão do serviço.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Parecer Técnico & Diagnóstico</label>
                  <textarea
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-slate-200"
                    placeholder="Resultado da análise técnica detalhada..."
                    rows={3}
                  />
                </div>
              </div>
            </section>

            {/* Seção 3: Peças e Mão de Obra */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-lg">
                    <span className="material-icons-round text-primary dark:text-blue-400">build_circle</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">3. Peças e Mão de Obra</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(true)}
                  className="text-primary dark:text-blue-400 font-bold flex items-center gap-1 hover:underline bg-primary/10 px-4 py-2 rounded-lg"
                >
                  <span className="material-icons-round text-sm">add</span> Adicionar Item
                </button>
              </div>

              {items.length === 0 ? (
                <div className="py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="material-icons-round text-4xl mb-2">shopping_basket</span>
                  <p>Nenhum item adicionado</p>
                  <button
                    type="button"
                    onClick={() => setShowAddItemModal(true)}
                    className="mt-2 text-primary font-bold hover:underline"
                  >
                    Adicionar primeiro item
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-400">
                        <th className="pb-3 font-semibold">Cód/Item</th>
                        <th className="pb-3 font-semibold text-center">Qtd</th>
                        <th className="pb-3 font-semibold text-right">Unitário (R$)</th>
                        <th className="pb-3 font-semibold text-right">Total (R$)</th>
                        <th className="pb-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                      {items.map((item) => (
                        <tr key={item.id} className="group">
                          <td className="py-4">
                            <p className="font-bold">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.code ? `Cod: ${item.code}` : item.type === 'service' ? 'Serviço' : 'Peça'}</p>
                          </td>
                          <td className="py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button type="button" onClick={() => updateItemQty(item.id, -1)} className="w-6 h-6 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-200">-</button>
                              <span className="w-8 text-center">{item.qty}</span>
                              <button type="button" onClick={() => updateItemQty(item.id, 1)} className="w-6 h-6 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-200">+</button>
                            </div>
                          </td>
                          <td className="py-4 text-right">{item.unitPrice.toFixed(2)}</td>
                          <td className="py-4 text-right font-bold">{(item.unitPrice * item.qty).toFixed(2)}</td>
                          <td className="py-4 text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <span className="material-icons-round text-sm">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Coluna Lateral */}
          <div className="space-y-8">
            {/* Dados do Veículo */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-lg">
                  <span className="material-icons-round text-primary dark:text-blue-400">directions_car</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Dados do Veículo</h3>
              </div>
              <div className="space-y-4">
                {/* Upload de Foto */}
                <div className="relative group">
                  {vehiclePhoto ? (
                    <div className="relative aspect-video bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden">
                      <img src={vehiclePhoto} alt="Veículo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setVehiclePhoto(null); setVehiclePhotoFile(null); }}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                      >
                        <span className="material-icons-round text-sm">close</span>
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                        <p className="text-white text-xs font-medium">Check-in visual do veículo</p>
                      </div>
                    </div>
                  ) : (
                    <label className="aspect-video bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center p-4 transition-all group-hover:border-primary/50 group-hover:bg-primary/5 cursor-pointer">
                      <span className="material-icons-round text-4xl text-slate-300 dark:text-slate-600 mb-2">add_a_photo</span>
                      <p className="text-xs font-semibold text-slate-500">Clique para adicionar foto</p>
                      <p className="text-[10px] text-slate-400 mt-1">Check-in de entrada visual</p>
                      <input
                        className="hidden"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Placa *</label>
                    <input
                      value={formData.plate}
                      onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-mono uppercase text-slate-800 dark:text-slate-200"
                      placeholder="ABC-1234"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">KM Atual</label>
                    <input
                      value={formData.km}
                      onChange={(e) => setFormData({ ...formData, km: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none text-slate-800 dark:text-slate-200"
                      placeholder="45.000"
                      type="number"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Marca / Modelo</label>
                    <input
                      value={formData.vehicle}
                      onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none text-slate-800 dark:text-slate-200"
                      placeholder="Ex: Toyota Corolla"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Seção 4: Pagamento */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg">
                  <span className="material-icons-round text-emerald-600 dark:text-emerald-400">attach_money</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">4. Pagamento</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Forma de Pagamento</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => {
                      const method = e.target.value;
                      setFormData({
                        ...formData,
                        paymentMethod: method,
                        status: (method === 'Dinheiro' || method === 'PIX' || method === 'Cartão de Débito' || method === 'Cartão de Crédito') ? 'Concluído' : formData.status
                      });
                    }}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="">Selecione...</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Boleto">Boleto / A Prazo</option>
                  </select>
                </div>

                {formData.paymentMethod === 'Cartão de Crédito' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Parcelas</label>
                    <select
                      value={formData.installments}
                      onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                      className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none text-slate-800 dark:text-slate-200"
                    >
                      {[1, 2, 3, 4, 5, 6, 10, 12].map(num => (
                        <option key={num} value={`${num}x`}>{num}x</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.paymentMethod === 'Boleto' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Data de Vencimento</label>
                    <input
                      type="date"
                      value={formData.boletoExpiration}
                      onChange={(e) => setFormData({ ...formData, boletoExpiration: e.target.value })}
                      className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none text-slate-800 dark:text-slate-200"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Status da OS</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className={`w-full mt-1 border rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-bold ${formData.status === 'Concluído'
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                  >
                    <option value="Pendente">Pendente / Em Aberto</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Aguardando Peças">Aguardando Peças</option>
                    <option value="Concluído">Concluído / Entregue</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Botão Salvar */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-secondary text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Salvando...</>
              ) : (
                <><span className="material-icons-round">save</span>Salvar Ordem de Serviço</>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Modal Adicionar Item */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Adicionar Item</h3>
                <button onClick={() => setShowAddItemModal(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-icons-round">close</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setNewItem({ ...newItem, type: 'part' })}
                  className={`flex-1 py-3 rounded-lg font-bold transition-all ${newItem.type === 'part' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                >
                  <span className="material-icons-round mr-1 text-sm">inventory_2</span>
                  Peça
                </button>
                <button
                  type="button"
                  onClick={() => setNewItem({ ...newItem, type: 'service' })}
                  className={`flex-1 py-3 rounded-lg font-bold transition-all ${newItem.type === 'service' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                >
                  <span className="material-icons-round mr-1 text-sm">build</span>
                  Mão de Obra
                </button>
              </div>

              {/* Formulário Manual */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Nome do Item *</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:text-white"
                    placeholder={newItem.type === 'part' ? 'Ex: Pastilha de Freio' : 'Ex: Troca de Óleo'}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Código</label>
                    <input
                      type="text"
                      value={newItem.code}
                      onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                      className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:text-white"
                      placeholder="Opcional"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      value={newItem.qty}
                      onChange={(e) => setNewItem({ ...newItem, qty: parseInt(e.target.value) || 1 })}
                      className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Preço Unit. (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItem.unitPrice}
                      onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:text-white"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-icons-round text-sm">add</span>
                  Adicionar ao Orçamento
                </button>
              </div>

              {/* Lista do Estoque */}
              {newItem.type === 'part' && inventoryItems.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">Ou selecione do estoque:</p>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
                    {inventoryItems.slice(0, 10).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectFromInventory(item)}
                        className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium text-slate-800 dark:text-white">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.sku || 'Sem código'} • Estoque: {item.quantity}</p>
                        </div>
                        <span className="font-bold text-primary">R$ {item.unit_price.toFixed(2)}</span>
                      </button>
                    ))}
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
