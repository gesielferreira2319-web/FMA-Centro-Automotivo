import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SettingsData {
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
}

const DEFAULT_SETTINGS: SettingsData = {
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

export default function Settings() {
    const [activeTab, setActiveTab] = useState('Geral');
    const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            // Use maybeSingle to avoid 406 error if multiple rows or no rows (but we expect one)
            // Limit 1 just in case
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

    const handleSave = async () => {
        setSaving(true);
        try {
            // Ensure we use the existing ID if we have one
            let currentId = settings.id;

            // If we don't have an ID in state, check DB one last time
            if (!currentId) {
                const { data: existing } = await supabase
                    .from('settings')
                    .select('id')
                    .limit(1)
                    .maybeSingle();
                if (existing) {
                    currentId = existing.id;
                }
            }

            const { error: upsertError } = await supabase.from('settings').upsert({
                ...settings,
                id: currentId, // If undefined, Supabase creates a new one (but we try to prevent that)
                updated_at: new Date()
            }, { onConflict: 'id' });

            if (upsertError) throw upsertError;

            alert('Configurações salvas com sucesso!');
            fetchSettings(); // Refresh to get ID if it was a new insert
        } catch (error) {
            console.error('Error saving:', error);
            alert('Erro ao salvar configurações.');
        }
        setSaving(false);
    };

    const handleChange = (field: keyof SettingsData, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'Geral':
                return (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-right-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Informações da Oficina</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Fantasia</label>
                                    <input
                                        type="text"
                                        value={settings.company_name}
                                        onChange={e => handleChange('company_name', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CNPJ</label>
                                    <input
                                        type="text"
                                        value={settings.cnpj}
                                        onChange={e => handleChange('cnpj', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Endereço Completo</label>
                                <input
                                    type="text"
                                    value={settings.address}
                                    onChange={e => handleChange('address', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                                    <input
                                        type="text"
                                        value={settings.phone}
                                        onChange={e => handleChange('phone', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail de Contato</label>
                                    <input
                                        type="email"
                                        value={settings.email}
                                        onChange={e => handleChange('email', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>
                        );
                        case 'Preferências':
                        return (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Preferências do Sistema</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <div>
                                        <p className="font-medium text-slate-800 dark:text-white">Tema Escuro</p>
                                        <p className="text-xs text-slate-500">Alternar entre modo claro e escuro (Em breve)</p>
                                    </div>
                                    <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                        <input
                                            type="checkbox"
                                            checked={settings.theme === 'dark'}
                                            onChange={e => handleChange('theme', e.target.checked ? 'dark' : 'light')}
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                        />
                                        <label
                                            onClick={() => handleChange('theme', settings.theme === 'light' ? 'dark' : 'light')}
                                            className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.theme === 'dark' ? 'bg-primary' : 'bg-slate-300'}`}
                                        ></label>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <div>
                                        <p className="font-medium text-slate-800 dark:text-white">Notificações de Estoque</p>
                                        <p className="text-xs text-slate-500">Alertar quando itens atingirem nível crítico</p>
                                    </div>
                                    <div
                                        onClick={() => handleChange('stock_alerts', !settings.stock_alerts)}
                                        className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${settings.stock_alerts ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.stock_alerts ? 'right-1' : 'left-1'}`}></div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <div>
                                        <p className="font-medium text-slate-800 dark:text-white">Backup Automático</p>
                                        <p className="text-xs text-slate-500">Realizar backup diário dos dados</p>
                                    </div>
                                    <div
                                        onClick={() => handleChange('auto_backup', !settings.auto_backup)}
                                        className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${settings.auto_backup ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.auto_backup ? 'right-1' : 'left-1'}`}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div >
                );
            case 'Financeiro':
                return (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-right-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Configuração de Pagamento (PIX)</h3>
                        <div className="space-y-4">
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 p-4 rounded-xl mb-6">
                                <div className="flex gap-3">
                                    <span className="material-icons-round text-yellow-600 dark:text-yellow-500">info</span>
                                    <div>
                                        <p className="font-bold text-yellow-800 dark:text-yellow-400 text-sm">Chave PIX para Boletos</p>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-500/80 mt-1">Essa chave será exibida nos boletos/recibos gerados pelo sistema para seus clientes realizarem o pagamento.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Chave</label>
                                    <select
                                        value={settings.pix_key_type || 'CPF'}
                                        onChange={e => handleChange('pix_key_type', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    >
                                        <option value="CPF">CPF</option>
                                        <option value="CNPJ">CNPJ</option>
                                        <option value="Email">E-mail</option>
                                        <option value="Telefone">Telefone</option>
                                        <option value="Aleatoria">Chave Aleatória</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chave PIX</label>
                                    <input
                                        type="text"
                                        value={settings.pix_key || ''}
                                        onChange={e => handleChange('pix_key', e.target.value)}
                                        placeholder={settings.pix_key_type === 'Email' ? 'exemplo@email.com' : 'Digite sua chave aqui'}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white font-mono"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="bg-white dark:bg-slate-800 p-12 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center animate-in fade-in">
                        <span className="material-icons-round text-6xl text-slate-200 dark:text-slate-600 mb-4">construction</span>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Em Desenvolvimento</h3>
                        <p className="text-slate-500">A aba <strong>{activeTab}</strong> estará disponível em breve.</p>
                    </div>
                );
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <span className="material-icons-round animate-spin text-primary text-4xl">refresh</span>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
            <header className="mb-8">
                <h2 className="text-3xl font-display font-bold text-primary dark:text-white">Configurações</h2>
                <p className="text-slate-500 dark:text-slate-400">Preferências do sistema e perfil de usuário.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <div className="space-y-2 md:col-span-1">
                    {['Geral', 'Preferências', 'Financeiro', 'Segurança', 'Usuários', 'Integrações'].map((item) => (
                        <button
                            key={item}
                            onClick={() => setActiveTab(item)}
                            className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-between group ${activeTab === item
                                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'
                                }`}
                        >
                            {item}
                            {activeTab === item && <span className="material-icons-round text-sm">chevron_right</span>}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="md:col-span-3 space-y-6">
                    {renderContent()}

                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-xl shadow-primary/20 hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <span className="material-icons-round animate-spin text-sm">refresh</span>
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <span className="material-icons-round">save</span>
                                    Salvar Alterações
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
