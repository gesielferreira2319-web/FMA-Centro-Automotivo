import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SettingsData {
    id?: number;
    company_name: string;
    cnpj: string;
    address: string;
    phone: string;
    email: string;
    theme: 'light' | 'dark';
    stock_alerts: boolean;
    auto_backup: boolean;
    pix_key?: string;
    pix_key_type?: 'CPF' | 'CNPJ' | 'Email' | 'Telefone' | 'Aleatoria';
    pix_qrcode?: string;
}

export const DEFAULT_SETTINGS: SettingsData = {
    company_name: 'FMA Centro Automotivo',
    cnpj: '',
    address: '',
    phone: '',
    email: '',
    theme: 'light',
    stock_alerts: true,
    auto_backup: false,
    pix_key: '',
    pix_key_type: 'CPF'
};

export function useSettings() {
    const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (data) {
                setSettings(data);
            } else if (error && error.code !== 'PGRST116') {
                console.error('Error fetching settings:', error);
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    return { settings, loading, fetchSettings };
}
