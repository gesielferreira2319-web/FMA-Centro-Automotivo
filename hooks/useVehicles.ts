import { useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Vehicle {
    id: string;
    client_id: string;
    plate: string;
    model: string;
    color?: string;
    year?: string;
    notes?: string;
    created_at?: string;
}

export function useVehicles() {
    const [loading, setLoading] = useState(false);

    const getClientVehicles = async (clientId: string): Promise<Vehicle[]> => {
        setLoading(true);
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        setLoading(false);
        if (error) {
            console.error('Erro ao buscar veículos:', error);
            return [];
        }
        return data || [];
    };

    const addVehicle = async (vehicleData: Partial<Vehicle>, photoFile?: File | null): Promise<Vehicle | null> => {
        setLoading(true);

        let photoUrl = null;

        // Upload photo if provided
        if (photoFile) {
            const fileExt = photoFile.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('vehicles') // Assuming a 'vehicles' bucket exists or we use 'service-orders' and organize by folder
                .upload(filePath, photoFile);

            if (uploadError) {
                console.error('Erro ao fazer upload da foto:', uploadError);
                // Continue without photo? Or stop? For now continue.
            } else {
                const { data: { publicUrl } } = supabase.storage
                    .from('vehicles')
                    .getPublicUrl(filePath);
                photoUrl = publicUrl;
            }
        }

        // Ensure plate is uppercase
        const payload = {
            ...vehicleData,
            plate: vehicleData.plate?.toUpperCase(),
            photo_url: photoUrl
        };

        const { data, error } = await supabase
            .from('vehicles')
            .insert(payload)
            .select()
            .single();

        setLoading(false);

        if (error) {
            console.error('Erro ao adicionar veículo:', error);
            if (error.code === '23505') { // Unique constraint violation
                alert('Já existe um veículo cadastrado com esta placa.');
            } else {
                alert('Erro ao cadastrar veículo. Verifique os dados.');
            }
            return null;
        }

        return data;
    };

    const deleteVehicle = async (id: string): Promise<boolean> => {
        setLoading(true);
        const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('id', id);

        setLoading(false);

        if (error) {
            console.error('Erro ao excluir veículo:', error);
            alert('Erro ao excluir veículo.');
            return false;
        }
        return true;
    };

    return {
        getClientVehicles,
        addVehicle,
        deleteVehicle,
        loading
    };
}
