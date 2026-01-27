import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface Client {
    id: string;
    name: string;
    phone: string;
    cpf_cnpj: string;
    email?: string;
    vehicle?: string;
    status: 'Ativo' | 'Inativo';
    created_at?: string;
}

interface ClientContextType {
    clients: Client[];
    loading: boolean;
    error: string | null;
    fetchClients: () => Promise<void>;
    addClient: (client: Omit<Client, 'id' | 'status' | 'created_at'>) => Promise<Client | null>;
    updateClient: (id: string, client: Partial<Client>) => Promise<boolean>;
    deleteClient: (id: string) => Promise<boolean>;
    searchClients: (query: string) => Client[];
    getClientById: (id: string) => Client | undefined;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchClients = async () => {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
            .from('clients')
            .select('*')
            .order('name');

        if (fetchError) {
            setError('Erro ao carregar clientes');
            console.error('Erro ao buscar clientes:', fetchError);
        } else {
            setClients(data || []);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const addClient = async (clientData: Omit<Client, 'id' | 'status' | 'created_at'>): Promise<Client | null> => {
        const { data, error: insertError } = await supabase
            .from('clients')
            .insert({
                name: clientData.name,
                phone: clientData.phone,
                cpf_cnpj: clientData.cpf_cnpj,
                email: clientData.email || null,
                vehicle: clientData.vehicle || null,
                status: 'Ativo',
            })
            .select()
            .single();

        if (insertError) {
            console.error('Erro ao adicionar cliente:', insertError);
            return null;
        }

        setClients(prev => [...prev, data]);
        return data;
    };

    const updateClient = async (id: string, clientData: Partial<Client>): Promise<boolean> => {
        const { error: updateError } = await supabase
            .from('clients')
            .update({
                ...clientData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (updateError) {
            console.error('Erro ao atualizar cliente:', updateError);
            return false;
        }

        setClients(prev => prev.map(c => c.id === id ? { ...c, ...clientData } : c));
        return true;
    };

    const deleteClient = async (id: string): Promise<boolean> => {
        const { error: deleteError } = await supabase
            .from('clients')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Erro ao deletar cliente:', deleteError);
            return false;
        }

        setClients(prev => prev.filter(c => c.id !== id));
        return true;
    };

    const searchClients = (query: string): Client[] => {
        if (!query.trim()) return [];
        const lowerQuery = query.toLowerCase();
        return clients.filter(
            c => c.name.toLowerCase().includes(lowerQuery) ||
                c.phone?.includes(query) ||
                c.cpf_cnpj?.includes(query)
        );
    };

    const getClientById = (id: string): Client | undefined => {
        return clients.find(c => c.id === id);
    };

    return (
        <ClientContext.Provider value={{
            clients,
            loading,
            error,
            fetchClients,
            addClient,
            updateClient,
            deleteClient,
            searchClients,
            getClientById
        }}>
            {children}
        </ClientContext.Provider>
    );
}

export function useClients() {
    const context = useContext(ClientContext);
    if (!context) {
        throw new Error('useClients must be used within a ClientProvider');
    }
    return context;
}
