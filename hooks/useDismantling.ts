import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface DismantlingVehicle {
    id: string;
    model: string;
    plate: string;
    year?: string;
    color?: string;
    purchase_price: number;
    cost_price: number;
    supplier?: string;
    payment_status: 'pendente' | 'pago';
    payment_method?: string;
    purchase_date: string;
    status: 'disponivel' | 'processando' | 'finalizado';
    notes?: string;
    created_at?: string;
}

export function useDismantling() {
    const [vehicles, setVehicles] = useState<DismantlingVehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVehicles = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('dismantling_vehicles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar veículos:', error);
            setError('Erro ao carregar veículos de desmanche');
        } else {
            // cast payment_status to literal type to satisfy TS if needed, or rely on inferrence
            setVehicles(data as DismantlingVehicle[]);
        }
        setLoading(false);
    };

    const addVehicle = async (vehicle: Omit<DismantlingVehicle, 'id' | 'created_at'>) => {
        const { data, error } = await supabase
            .from('dismantling_vehicles')
            .insert(vehicle)
            .select()
            .single();

        if (error) {
            console.error('Erro ao adicionar veículo:', error);
            throw error;
        }

        setVehicles(prev => [data, ...prev]);
        return data;
    };

    const updateVehicle = async (id: string, updates: Partial<DismantlingVehicle>) => {
        const { data, error } = await supabase
            .from('dismantling_vehicles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar veículo:', error);
            throw error;
        }

        setVehicles(prev => prev.map(v => v.id === id ? data : v));
        return data;
        setVehicles(prev => prev.map(v => v.id === id ? data : v));
        return data;
    };

    const deleteVehicle = async (id: string, originDescription?: string) => {
        // 1. Delete associated parts if origin is provided
        if (originDescription) {
            const { error: partError } = await supabase
                .from('inventory')
                .delete()
                .eq('origin_vehicle', originDescription);

            if (partError) {
                console.error('Erro ao deletar peças do veículo:', partError);
                // We typically continue to delete the vehicle, or throw? 
                // Let's continue but warn.
            }
        }

        // 2. Delete the vehicle itself
        const { error } = await supabase
            .from('dismantling_vehicles')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao deletar veículo:', error);
            throw error;
        }

        setVehicles(prev => prev.filter(v => v.id !== id));
        return true;
    };

    useEffect(() => {
        fetchVehicles();
    }, []);

    return {
        vehicles,
        loading,
        error,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        refresh: fetchVehicles
    };
}
