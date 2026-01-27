import React, { useState, useRef, useEffect } from 'react';
import { useClients, Client } from '../contexts/ClientContext';

interface CustomerSelectorProps {
    selectedClient: Client | null;
    onSelectClient: (client: Client | null) => void;
    accentColor?: 'primary' | 'secondary';
}

export function CustomerSelector({ selectedClient, onSelectClient, accentColor = 'primary' }: CustomerSelectorProps) {
    const { searchClients, addClient } = useClients();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Client[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', phone: '', cpf_cnpj: '' });
    const [saving, setSaving] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const colorClasses = {
        primary: {
            border: 'border-primary',
            bg: 'bg-primary',
            bgLight: 'bg-primary/10',
            text: 'text-primary',
            ring: 'focus:ring-primary',
        },
        secondary: {
            border: 'border-secondary',
            bg: 'bg-secondary',
            bgLight: 'bg-secondary/10',
            text: 'text-secondary',
            ring: 'focus:ring-secondary',
        },
    };

    const colors = colorClasses[accentColor];

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (value: string) => {
        setQuery(value);
        if (value.length >= 2) {
            setResults(searchClients(value));
            setShowDropdown(true);
        } else {
            setResults([]);
            setShowDropdown(false);
        }
    };

    const handleSelectClient = (client: Client) => {
        onSelectClient(client);
        setQuery('');
        setShowDropdown(false);
        setResults([]);
    };

    const handleRemoveClient = () => {
        onSelectClient(null);
    };

    const handleNewClientSubmit = async () => {
        if (newClient.name && newClient.phone) {
            setSaving(true);
            const created = await addClient(newClient);
            if (created) {
                onSelectClient(created);
            }
            setNewClient({ name: '', phone: '', cpf_cnpj: '' });
            setShowNewClientForm(false);
            setSaving(false);
        }
    };

    // Se já tem cliente selecionado, mostra o card do cliente
    if (selectedClient) {
        return (
            <div className={`p-4 rounded-xl border-2 ${colors.border} ${colors.bgLight}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${colors.bg} text-white flex items-center justify-center font-bold`}>
                            {selectedClient.name.charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-sm">{selectedClient.name}</p>
                            <p className="text-xs text-slate-500">{selectedClient.phone}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRemoveClient}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <span className="material-icons-round text-sm">close</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div ref={wrapperRef} className="space-y-3">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="material-icons-round text-sm">person</span>
                Cliente
            </label>

            {/* Campo de busca */}
            <div className="relative">
                <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => query.length >= 2 && setShowDropdown(true)}
                    placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${colors.ring} focus:ring-2 outline-none transition-all dark:text-white text-sm`}
                />

                {/* Dropdown de resultados */}
                {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                        {results.length > 0 ? (
                            results.map((client) => (
                                <button
                                    key={client.id}
                                    onClick={() => handleSelectClient(client)}
                                    className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-slate-100 dark:border-slate-700 last:border-0"
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-200">
                                        {client.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-800 dark:text-white text-sm truncate">{client.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{client.phone} • {client.cpf_cnpj}</p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="p-4 text-center text-slate-500 text-sm">
                                <p>Nenhum cliente encontrado</p>
                            </div>
                        )}

                        {/* Botão para cadastrar novo */}
                        <button
                            onClick={() => {
                                setShowDropdown(false);
                                setShowNewClientForm(true);
                            }}
                            className={`w-full p-3 flex items-center justify-center gap-2 ${colors.text} font-bold text-sm hover:${colors.bgLight} transition-colors border-t border-slate-100 dark:border-slate-700`}
                        >
                            <span className="material-icons-round text-lg">person_add</span>
                            Cadastrar Novo Cliente
                        </button>
                    </div>
                )}
            </div>

            {/* Botão alternativo para cadastrar */}
            {!showNewClientForm && !showDropdown && (
                <button
                    onClick={() => setShowNewClientForm(true)}
                    className={`w-full py-2 text-sm ${colors.text} font-medium hover:underline flex items-center justify-center gap-1`}
                >
                    <span className="material-icons-round text-sm">add</span>
                    Cadastrar novo cliente
                </button>
            )}

            {/* Formulário de novo cliente */}
            {showNewClientForm && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                            <span className="material-icons-round text-lg">person_add</span>
                            Novo Cliente
                        </h4>
                        <button
                            onClick={() => setShowNewClientForm(false)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <span className="material-icons-round text-sm">close</span>
                        </button>
                    </div>

                    <input
                        type="text"
                        value={newClient.name}
                        onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                        placeholder="Nome completo *"
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white text-sm"
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            value={newClient.phone}
                            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                            placeholder="Telefone *"
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white text-sm"
                        />
                        <input
                            type="text"
                            value={newClient.cpf_cnpj}
                            onChange={(e) => setNewClient({ ...newClient, cpf_cnpj: e.target.value })}
                            placeholder="CPF/CNPJ"
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white text-sm"
                        />
                    </div>

                    <button
                        onClick={handleNewClientSubmit}
                        disabled={!newClient.name || !newClient.phone || saving}
                        className={`w-full py-3 ${colors.bg} text-white rounded-xl font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2`}
                    >
                        {saving ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Salvando...</>
                        ) : (
                            <><span className="material-icons-round text-sm">check</span>Salvar e Selecionar</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
