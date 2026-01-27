import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface InventoryItem {
    id: string;
    name: string;
    sku: string;
    category: string;
    quantity: number;
    unit_price: number;
    cost_price?: number;
    supplier_name?: string;
    payment_status?: 'a_vista' | 'faturado' | 'pendente';
    due_date?: string;
    status: string;
    is_used: boolean;
    origin_vehicle?: string;
    part_condition?: string;
    created_at?: string;
}

// Função auxiliar para calcular margem de lucro
export const calculateProfitMargin = (unitPrice: number, costPrice: number): number => {
    if (!costPrice || costPrice === 0) return 0;
    return ((unitPrice - costPrice) / costPrice) * 100;
};

export function useInventory(isUsed: boolean = false) {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchItems = async () => {
        setLoading(true);
        setError(null);

        let query = supabase.from('inventory').select('*');

        if (isUsed !== undefined) {
            query = query.eq('is_used', isUsed);
        }

        const { data, error: fetchError } = await query.order('name');

        if (fetchError) {
            setError('Erro ao carregar estoque');
            console.error('Erro ao buscar estoque:', fetchError);
        } else {
            // Atualizar status baseado na quantidade
            const itemsWithStatus = (data || []).map(item => ({
                ...item,
                status: item.quantity === 0 ? 'Esgotado' : item.quantity <= 5 ? 'Estoque Baixo' : 'Em Estoque'
            }));
            setItems(itemsWithStatus);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, [isUsed]);

    const addItem = async (itemData: Omit<InventoryItem, 'id' | 'status' | 'created_at'>): Promise<InventoryItem | null> => {
        const { data, error: insertError } = await supabase
            .from('inventory')
            .insert({
                name: itemData.name,
                sku: itemData.sku || null,
                category: itemData.category,
                quantity: itemData.quantity || 0,
                unit_price: itemData.unit_price || 0,
                cost_price: itemData.cost_price || 0,
                supplier_name: itemData.supplier_name || null,
                payment_status: itemData.payment_status || 'pendente',
                due_date: itemData.due_date || null,
                is_used: itemData.is_used || false,
                origin_vehicle: itemData.origin_vehicle || null,
                part_condition: itemData.part_condition || null,
            })
            .select()
            .single();

        if (insertError) {
            console.error('Erro ao adicionar item:', insertError);
            return null;
        }

        const newItem = {
            ...data,
            status: data.quantity === 0 ? 'Esgotado' : data.quantity <= 5 ? 'Estoque Baixo' : 'Em Estoque'
        };

        setItems(prev => [...prev, newItem]);
        return newItem;
    };

    const updateItem = async (id: string, itemData: Partial<InventoryItem>): Promise<boolean> => {
        const { error: updateError } = await supabase
            .from('inventory')
            .update({
                ...itemData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (updateError) {
            console.error('Erro ao atualizar item:', updateError);
            return false;
        }

        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, ...itemData };
                return {
                    ...updated,
                    status: updated.quantity === 0 ? 'Esgotado' : updated.quantity <= 5 ? 'Estoque Baixo' : 'Em Estoque'
                };
            }
            return item;
        }));
        return true;
    };

    const deleteItem = async (id: string): Promise<boolean> => {
        const { error: deleteError } = await supabase
            .from('inventory')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Erro ao deletar item:', deleteError);
            return false;
        }

        setItems(prev => prev.filter(item => item.id !== id));
        return true;
    };

    const decrementQuantity = async (id: string, amount: number = 1): Promise<boolean> => {
        const item = items.find(i => i.id === id);
        if (!item) return false;

        const newQuantity = Math.max(0, item.quantity - amount);
        return updateItem(id, { quantity: newQuantity });
    };

    // Estatísticas
    const stats = {
        total: items.length,
        lowStock: items.filter(i => i.status === 'Estoque Baixo').length,
        outOfStock: items.filter(i => i.status === 'Esgotado').length,
        totalValue: items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0),
        totalCost: items.reduce((sum, i) => sum + (i.quantity * (i.cost_price || 0)), 0),
        potentialProfit: items.reduce((sum, i) => sum + (i.quantity * (i.unit_price - (i.cost_price || 0))), 0),
        pendingPayments: items.filter(i => i.payment_status === 'pendente' || i.payment_status === 'faturado').length,
        averageMargin: items.length > 0
            ? items.reduce((sum, i) => sum + calculateProfitMargin(i.unit_price, i.cost_price || 0), 0) / items.length
            : 0,
    };

    return {
        items,
        loading,
        error,
        stats,
        fetchItems,
        addItem,
        updateItem,
        deleteItem,
        decrementQuantity,
    };
}
