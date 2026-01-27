import { useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Sale {
    id: string;
    client_id: string | null;
    payment_method: string;
    total: number;
    sale_type: 'balcao' | 'desmanche';
    created_at: string;
}

export interface SaleItem {
    id: string;
    sale_id: string;
    inventory_id: string;
    quantity: number;
    unit_price: number;
}

export interface CartItem {
    inventory_id: string;
    name: string;
    quantity: number;
    unit_price: number;
}

export function useSales() {
    const [loading, setLoading] = useState(false);

    const createSale = async (
        clientId: string | null,
        paymentMethod: string,
        items: CartItem[],
        saleType: 'balcao' | 'desmanche' = 'balcao',
        paymentStatus: 'pago' | 'pendente' = 'pago',
        paymentDueDate: string | null = null
    ): Promise<Sale | null> => {
        setLoading(true);

        const total = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

        // Criar a venda
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert({
                client_id: clientId,
                payment_method: paymentMethod,
                total,
                sale_type: saleType,
                payment_status: paymentStatus,
                payment_due_date: paymentDueDate
            })
            .select()
            .single();

        if (saleError) {
            console.error('Erro ao criar venda:', saleError);
            setLoading(false);
            return null;
        }

        // Criar os itens da venda
        const saleItems = items.map(item => ({
            sale_id: sale.id,
            inventory_id: item.inventory_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
        }));

        const { error: itemsError } = await supabase
            .from('sale_items')
            .insert(saleItems);

        if (itemsError) {
            console.error('Erro ao criar itens da venda:', itemsError);
            // Não vamos reverter a venda, mas logamos o erro
        }

        // Atualizar estoque (decrementar quantidade)
        for (const item of items) {
            // Buscar quantidade atual
            const { data: currentItem } = await supabase
                .from('inventory')
                .select('quantity')
                .eq('id', item.inventory_id)
                .single();

            if (currentItem) {
                const newQuantity = currentItem.quantity - item.quantity;
                await supabase
                    .from('inventory')
                    .update({ quantity: newQuantity })
                    .eq('id', item.inventory_id);
            }
        }

        setLoading(false);
        return sale;
    };

    const fetchDismantlingSales = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('sales')
            .select(`
                id,
                total,
                payment_method,
                created_at,
                sale_items (
                    id,
                    quantity,
                    unit_price,
                    inventory (
                        id,
                        origin_vehicle,
                        name
                    )
                )
            `)
            .eq('sale_type', 'desmanche')
            .order('created_at', { ascending: false });

        setLoading(false);
        if (error) {
            console.error('Erro ao buscar vendas de desmanche:', error);
            return [];
        }
        return data as any[]; // Returning typed data would be better but keeping it simple for now
    };

    return {
        loading,
        createSale,
        fetchDismantlingSales
    };
}
