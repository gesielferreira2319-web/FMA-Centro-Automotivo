import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
    pix_qrcode?: string;
}

interface UserProfile {
    id: string;
    email: string;
    role: string;
    full_name?: string; // Optional if not ensuring it exists
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
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [passwordLoading, setPasswordLoading] = useState(false);

    // User Management State
    const { role: currentUserRole, session } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        fetchSettings();
        if (activeTab === 'Usuários') {
            fetchUsers();
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('email');

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
        setLoadingUsers(false);
    };

    const confirmDeleteUser = (user: UserProfile) => {
        setUserToDelete(user);
        setDeletePassword('');
        setShowDeleteModal(true);
    };

    const handleDeleteUser = async () => {
        if (!deletePassword || !userToDelete || !session?.user?.email) return;

        setDeleteLoading(true);
        try {
            console.log('Attempting re-auth for deletion:', session.user.email);

            // 1. Verify Owner Password
            const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
                email: session.user.email,
                password: deletePassword
            });

            if (signInError) {
                console.error('Re-auth failed:', signInError);
                alert(`Falha na verificação de senha: ${signInError.message}`);
                setDeleteLoading(false);
                return;
            }

            console.log('Re-auth success, proceeding to delete profile...');

            // 2. Delete User from Auth System (Hard Delete) via RPC
            // This requires the 'delete_user_by_owner' function to be created in Supabase
            const { error: deleteError } = await supabase.rpc('delete_user_by_owner', {
                target_user_id: userToDelete.id
            });

            if (deleteError) throw deleteError;

            alert('Usuário excluído permanentemente do sistema.');

            setShowDeleteModal(false);
            fetchUsers();
        } catch (error: any) {
            console.error('Error deleting user:', error);
            alert(`Erro ao excluir usuário: ${error.message || JSON.stringify(error)}`);
        }
        setDeleteLoading(false);
    };

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

    const handleUpdatePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('As senhas novas não coincidem.');
            return;
        }

        if (newPassword.length < 6) {
            alert('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setPasswordLoading(true);
        try {
            // 1. Verify current password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: settings.email,
                password: currentPassword
            });

            if (signInError) {
                alert('Senha atual incorreta.');
                setPasswordLoading(false);
                return;
            }

            // 2. Update password
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            alert('Senha atualizada com sucesso!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error('Error updating password:', error);
            alert('Erro ao atualizar senha: ' + (error.message || 'Erro desconhecido'));
        }
        setPasswordLoading(false);
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
                    </div>
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

                            <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    QR Code do PIX (Opcional)
                                </label>
                                <div className="flex items-start gap-4">
                                    {settings.pix_qrcode ? (
                                        <div className="relative group">
                                            <img
                                                src={settings.pix_qrcode}
                                                alt="QR Code PIX"
                                                className="w-32 h-32 object-contain border border-slate-200 rounded-lg bg-white"
                                            />
                                            <button
                                                onClick={() => handleChange('pix_qrcode', '')}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                            >
                                                <span className="material-icons-round text-xs">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full">
                                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 dark:hover:bg-bray-800 dark:bg-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-600 transition-all">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <span className="material-icons-round text-slate-400 mb-2 text-3xl">qr_code_scanner</span>
                                                    <p className="mb-2 text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold">Clique para enviar</span> ou arraste</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG ou JPEG</p>
                                                </div>
                                                <input
                                                    id="dropzone-file"
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                handleChange('pix_qrcode', reader.result);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    Este QR Code será exibido nos boletos para facilitar o pagamento por seus clientes.
                                </p>
                            </div>
                        </div>
                    </div>
                );
            case 'Segurança':
                return (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-right-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Segurança da Conta</h3>

                        <div className="space-y-6 max-w-lg">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl">
                                <div className="flex gap-3">
                                    <span className="material-icons-round text-blue-600 dark:text-blue-400">lock</span>
                                    <div>
                                        <p className="font-bold text-blue-800 dark:text-blue-300 text-sm">Redefinir Senha</p>
                                        <p className="text-xs text-blue-700 dark:text-blue-400/80 mt-1">
                                            Digite sua nova senha abaixo. Você será desconectado de outros dispositivos.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha Atual</label>
                                    <div className="relative">
                                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">lock</span>
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white transition-all"
                                            placeholder="Digite sua senha atual"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nova Senha</label>
                                    <div className="relative">
                                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">lock_outline</span>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white transition-all"
                                            placeholder="Mínimo 6 caracteres"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirmar Nova Senha</label>
                                    <div className="relative">
                                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">lock</span>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white transition-all"
                                            placeholder="Repita a nova senha"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleUpdatePassword}
                                        disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                                        className="w-full px-4 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold shadow-lg shadow-slate-900/10 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                    >
                                        {passwordLoading ? (
                                            <>
                                                <span className="material-icons-round animate-spin text-sm">refresh</span>
                                                Atualizando...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-icons-round">check_circle</span>
                                                Atualizar Senha
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Usuários':
                return (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-right-4">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Gerenciar Usuários</h3>
                                <p className="text-sm text-slate-500">Lista de usuários com acesso ao sistema</p>
                            </div>
                            <button
                                onClick={fetchUsers}
                                className="p-2 text-slate-400 hover:text-primary transition-colors"
                                title="Atualizar Lista"
                            >
                                <span className="material-icons-round">refresh</span>
                            </button>
                        </div>

                        {loadingUsers ? (
                            <div className="flex justify-center py-8">
                                <span className="material-icons-round animate-spin text-primary text-3xl">refresh</span>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-6 py-3 font-semibold">Nome</th>
                                            <th className="px-6 py-3 font-semibold">Email</th>
                                            <th className="px-6 py-3 font-semibold">Função (Role)</th>
                                            <th className="px-6 py-3 font-semibold text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {users.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                                    Nenhum usuário encontrado.
                                                </td>
                                            </tr>
                                        ) : (
                                            users.map((user) => (
                                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-white">
                                                        {user.full_name || 'Sem nome'}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                        {user.email || 'Email não disponível'}
                                                        {user.id === session?.user?.id && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Você</span>}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.role === 'owner' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                            {user.role === 'owner' ? 'Proprietário' : 'Funcionário'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {currentUserRole === 'owner' && user.id !== session?.user?.id && (
                                                            <button
                                                                onClick={() => confirmDeleteUser(user)}
                                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                                title="Excluir Usuário"
                                                            >
                                                                <span className="material-icons-round">delete_outline</span>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Delete Confirmation Modal */}
                        {showDeleteModal && userToDelete && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 transform transition-all scale-100">
                                    <div className="text-center mb-6">
                                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <span className="material-icons-round text-red-600 dark:text-red-400 text-2xl">warning</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Excluir Usuário?</h3>
                                        <p className="text-slate-500 dark:text-slate-400">
                                            Você está prestes a remover o acesso de <strong>{userToDelete.email}</strong>.
                                            Para confirmar, digite sua senha de login.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sua Senha (Proprietário)</label>
                                            <input
                                                type="password"
                                                value={deletePassword}
                                                onChange={(e) => setDeletePassword(e.target.value)}
                                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-red-500 dark:text-white"
                                                placeholder="Confirme com sua senha"
                                            />
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => setShowDeleteModal(false)}
                                                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleDeleteUser}
                                                disabled={deleteLoading || !deletePassword}
                                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                            >
                                                {deleteLoading ? (
                                                    <>
                                                        <span className="material-icons-round animate-spin text-sm">refresh</span>
                                                        Excluindo...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-icons-round">delete_forever</span>
                                                        Confirmar Exclusão
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
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
                    {['Geral', 'Financeiro', 'Segurança', 'Usuários'].map((item) => (
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
