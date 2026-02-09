import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ServiceOrder {
    id: string;
    order_number: number;
    client_id: string | null;
    client_name?: string;
    client_phone?: string;
    plate: string;
    vehicle: string;
    km?: string;
    complaint?: string;
    diagnosis?: string;
    service: string;
    status: 'Pendente' | 'Em Andamento' | 'Aguardando Peças' | 'Concluído';
    value: number;
    notes?: string;
    delivery_date?: string;
    items?: any[] | string; // JSON array ou string
    vehicle_photo?: string; // URL da foto do veículo
    created_at: string;
    payment_method?: string;
    payment_status?: 'pendente' | 'pago';
    payment_due_date?: string;
    payment_date?: string;
    entry_amount?: number;
    entry_method?: string;
    installment_count?: number;
    installments_paid?: number;
}

export function useServiceOrders() {
    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrders = async () => {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
            .from('service_orders')
            .select(`
        *,
        clients (name, phone)
      `)
            .order('created_at', { ascending: false });

        if (fetchError) {
            setError('Erro ao carregar ordens de serviço');
            console.error('Erro ao buscar OS:', fetchError);
        } else {
            const ordersWithClientName = (data || []).map(order => ({
                ...order,
                client_name: order.clients?.name || 'Cliente não informado',
                client_phone: order.clients?.phone || ''
            }));
            setOrders(ordersWithClientName);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const addOrder = async (orderData: Partial<ServiceOrder>): Promise<ServiceOrder | null> => {
        // Campos base que existem na tabela
        const baseFields: Record<string, any> = {
            client_id: orderData.client_id || null,
            plate: orderData.plate,
            vehicle: orderData.vehicle,
            service: orderData.service,
            status: orderData.status || 'Pendente',
            value: orderData.value || 0,
            notes: orderData.notes || null,
            payment_method: orderData.payment_method || null,
            payment_status: orderData.payment_status || 'pendente', // Adicionado
            entry_amount: orderData.entry_amount || 0,
            entry_method: orderData.entry_method || null,
            installment_count: orderData.installment_count || 1,
            installments_paid: 0,
        };

        // Campos opcionais
        if (orderData.km) baseFields.km = orderData.km;
        if (orderData.complaint) baseFields.complaint = orderData.complaint;
        if (orderData.diagnosis) baseFields.diagnosis = orderData.diagnosis;
        if (orderData.delivery_date) baseFields.delivery_date = orderData.delivery_date;
        if (orderData.items) baseFields.items = orderData.items;
        if (orderData.vehicle_photo) baseFields.vehicle_photo = orderData.vehicle_photo;
        if (orderData.payment_due_date) baseFields.payment_due_date = orderData.payment_due_date;
        if (orderData.payment_date) baseFields.payment_date = orderData.payment_date;

        const { data, error: insertError } = await supabase
            .from('service_orders')
            .insert(baseFields)
            .select()
            .single();

        if (insertError) {
            console.error('Erro ao criar OS:', insertError);
            return null;
        }

        await fetchOrders(); // Recarregar para obter o nome do cliente
        return data;
    };

    const updateOrder = async (id: string, orderData: Partial<ServiceOrder>): Promise<boolean> => {
        const { error: updateError } = await supabase
            .from('service_orders')
            .update({
                ...orderData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (updateError) {
            console.error('Erro ao atualizar OS:', updateError);
            return false;
        }

        setOrders(prev => prev.map(o => o.id === id ? { ...o, ...orderData } : o));
        return true;
    };

    const deleteOrder = async (id: string): Promise<boolean> => {
        const { error: deleteError } = await supabase
            .from('service_orders')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Erro ao deletar OS:', deleteError);
            return false;
        }

        setOrders(prev => prev.filter(o => o.id !== id));
        return true;
    };

    // Estatísticas
    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'Pendente').length,
        inProgress: orders.filter(o => o.status === 'Em Andamento').length,
        completed: orders.filter(o => o.status === 'Concluído').length,
        totalValue: orders.reduce((sum, o) => sum + (o.value || 0), 0),
    };

    return {
        orders,
        loading,
        error,
        stats,
        fetchOrders,
        addOrder,
        updateOrder,
        deleteOrder,
    };
}
