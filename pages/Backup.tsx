import React, { useState, useEffect } from 'react';
import {
    exportFullBackupExcel,
    exportSingleModuleExcel,
    exportFullBackupJson,
    fetchBackupStats,
    BackupStats,
    BackupProgress
} from '../utils/backupExcel';

interface BackupProps {
    isEmbedded?: boolean;
}

export default function Backup({ isEmbedded = false }: BackupProps) {
    const [stats, setStats] = useState<BackupStats>({
        clients: 0,
        vehicles: 0,
        serviceOrders: 0,
        inventory: 0,
        dismantling: 0,
        sales: 0,
        saleItems: 0,
        accountsPayable: 0,
        lastBackupDate: null
    });
    const [loadingStats, setLoadingStats] = useState(true);

    // Estados de download geral
    const [isExportingFull, setIsExportingFull] = useState(false);
    const [progress, setProgress] = useState<BackupProgress | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Estados de download individual
    const [exportingModule, setExportingModule] = useState<string | null>(null);

    // Estado do JSON
    const [isExportingJson, setIsExportingJson] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoadingStats(true);
        try {
            const data = await fetchBackupStats();
            setStats(data);
        } catch (err) {
            console.error('Erro ao carregar estatísticas do backup:', err);
        }
        setLoadingStats(false);
    };

    const handleFullBackup = async () => {
        setIsExportingFull(true);
        setProgress({ step: 'Iniciando backup...', percent: 0 });
        setSuccessMessage(null);
        setErrorMessage(null);

        try {
            const result = await exportFullBackupExcel((p) => {
                setProgress(p);
            });

            if (result.success) {
                setSuccessMessage(`Backup completo baixado com sucesso! Arquivo: ${result.filename}`);
                // Atualizar stats de data
                setStats(prev => ({ ...prev, lastBackupDate: new Date().toISOString() }));
            }
        } catch (error: any) {
            console.error('Falha no backup completo:', error);
            setErrorMessage(`Erro ao gerar backup: ${error.message || 'Falha de comunicação com o banco'}`);
        } finally {
            setIsExportingFull(false);
            setProgress(null);
        }
    };

    const handleSingleModule = async (
        module: 'clients' | 'vehicles' | 'service_orders' | 'inventory' | 'dismantling' | 'sales' | 'accounts_payable',
        label: string
    ) => {
        setExportingModule(module);
        setSuccessMessage(null);
        setErrorMessage(null);

        try {
            const result = await exportSingleModuleExcel(module);
            if (result.success) {
                setSuccessMessage(`Planilha de ${label} exportada com sucesso! Arquivo: ${result.filename}`);
            }
        } catch (error: any) {
            console.error(`Erro ao exportar ${module}:`, error);
            setErrorMessage(`Erro ao exportar ${label}: ${error.message || 'Erro inesperado'}`);
        } finally {
            setExportingModule(null);
        }
    };

    const handleJsonBackup = async () => {
        setIsExportingJson(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        try {
            const result = await exportFullBackupJson();
            if (result.success) {
                setSuccessMessage(`Backup em JSON baixado com sucesso! Arquivo: ${result.filename}`);
                setStats(prev => ({ ...prev, lastBackupDate: new Date().toISOString() }));
            }
        } catch (error: any) {
            console.error('Erro ao gerar JSON:', error);
            setErrorMessage(`Erro ao gerar arquivo JSON: ${error.message || 'Erro inesperado'}`);
        } finally {
            setIsExportingJson(false);
        }
    };

    const formatLastBackup = (dateStr: string | null) => {
        if (!dateStr) return 'Nenhum backup registrado neste navegador';
        try {
            const d = new Date(dateStr);
            return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
            return dateStr;
        }
    };

    const modules = [
        {
            id: 'clients' as const,
            title: 'Clientes',
            desc: 'Nomes, telefones, CPF/CNPJ, veículos vinculados e histórico.',
            count: stats.clients,
            unit: 'clientes',
            icon: 'people',
            color: 'from-blue-500 to-indigo-600',
            textColor: 'text-blue-500'
        },
        {
            id: 'vehicles' as const,
            title: 'Veículos dos Clientes',
            desc: 'Placas, modelos, cores, anos e proprietários cadastrados.',
            count: stats.vehicles,
            unit: 'veículos',
            icon: 'directions_car',
            color: 'from-cyan-500 to-blue-600',
            textColor: 'text-cyan-500'
        },
        {
            id: 'service_orders' as const,
            title: 'Ordens de Serviço (OS)',
            desc: 'Todas as OS, diagnósticos, valores, formas de pagamento e status.',
            count: stats.serviceOrders,
            unit: 'ordens de serviço',
            icon: 'assignment',
            color: 'from-amber-500 to-orange-600',
            textColor: 'text-amber-500'
        },
        {
            id: 'inventory' as const,
            title: 'Peças & Estoque',
            desc: 'Peças novas e usadas, SKUs, preços de custo, venda e quantidades.',
            count: stats.inventory,
            unit: 'itens em estoque',
            icon: 'inventory_2',
            color: 'from-emerald-500 to-teal-600',
            textColor: 'text-emerald-500'
        },
        {
            id: 'dismantling' as const,
            title: 'Desmanche / Veículos',
            desc: 'Carros adquiridos para desmanche, custos, placas e fornecedores.',
            count: stats.dismantling,
            unit: 'carros adquiridos',
            icon: 'recycling',
            color: 'from-violet-500 to-purple-600',
            textColor: 'text-violet-500'
        },
        {
            id: 'sales' as const,
            title: 'Vendas de Peças (Balcão)',
            desc: 'Vendas avulsas no balcão, clientes atendidos e totais faturados.',
            count: stats.sales,
            unit: 'vendas realizadas',
            icon: 'shopping_cart',
            color: 'from-rose-500 to-red-600',
            textColor: 'text-rose-500'
        },
        {
            id: 'accounts_payable' as const,
            title: 'Financeiro / Contas a Pagar',
            desc: 'Despesas com fornecedores, vencimentos, boletos e pagamentos.',
            count: stats.accountsPayable,
            unit: 'contas cadastradas',
            icon: 'payments',
            color: 'from-fuchsia-500 to-pink-600',
            textColor: 'text-fuchsia-500'
        }
    ];

    return (
        <div className={`space-y-6 ${isEmbedded ? '' : 'animate-in fade-in duration-500 max-w-6xl mx-auto pb-20'}`}>
            {/* Cabeçalho da página se for standalone */}
            {!isEmbedded && (
                <header className="mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-display font-bold text-primary dark:text-white flex items-center gap-3">
                                <span className="material-icons-round text-primary dark:text-blue-400 text-3xl">cloud_download</span>
                                Backup & Exportação de Dados
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">
                                Baixe e guarde com segurança cópias de todas as informações do sistema em planilhas Excel (.xlsx).
                            </p>
                        </div>

                        {/* Botão de atualizar contadores */}
                        <button
                            onClick={loadStats}
                            disabled={loadingStats}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold transition-all self-start sm:self-auto"
                            title="Atualizar contagem de registros"
                        >
                            <span className={`material-icons-round text-sm ${loadingStats ? 'animate-spin' : ''}`}>refresh</span>
                            Atualizar Dados
                        </button>
                    </div>
                </header>
            )}

            {/* Alertas de Sucesso / Erro */}
            {successMessage && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-start gap-3 animate-in fade-in shadow-sm">
                    <span className="material-icons-round text-emerald-600 dark:text-emerald-400 text-2xl mt-0.5">check_circle</span>
                    <div className="flex-1">
                        <p className="font-bold text-sm">Download Concluído!</p>
                        <p className="text-xs mt-0.5 opacity-90">{successMessage}</p>
                    </div>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200"
                    >
                        <span className="material-icons-round text-sm">close</span>
                    </button>
                </div>
            )}

            {errorMessage && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 flex items-start gap-3 animate-in fade-in shadow-sm">
                    <span className="material-icons-round text-red-600 dark:text-red-400 text-2xl mt-0.5">error</span>
                    <div className="flex-1">
                        <p className="font-bold text-sm">Ocorreu um Erro</p>
                        <p className="text-xs mt-0.5 opacity-90">{errorMessage}</p>
                    </div>
                    <button
                        onClick={() => setErrorMessage(null)}
                        className="text-red-500 hover:text-red-700 dark:hover:text-red-200"
                    >
                        <span className="material-icons-round text-sm">close</span>
                    </button>
                </div>
            )}

            {/* CARD PRINCIPAL: BACKUP COMPLETO EXCEL (.XLSX) */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-primary to-slate-900 text-white p-6 sm:p-8 shadow-2xl border border-blue-700/30">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="max-w-2xl space-y-3">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-200 text-xs font-semibold uppercase tracking-wider border border-white/10">
                                <span className="material-icons-round text-xs">verified</span>
                                Backup Completo e Seguro
                            </div>

                            <h3 className="text-2xl sm:text-3xl font-display font-black text-white leading-tight">
                                Baixar Backup Completo em Excel (.xlsx)
                            </h3>

                            <p className="text-blue-100/90 text-sm sm:text-base leading-relaxed">
                                Exporta todas as informações do sistema reunidas em uma única planilha organizada em abas:
                                <strong> Clientes</strong>, <strong>Veículos</strong>, <strong>Ordens de Serviço (OS)</strong>, 
                                <strong> Peças & Estoque</strong>, <strong>Desmanche</strong>, <strong>Vendas</strong>, 
                                <strong> Contas a Pagar</strong> e <strong>Configurações da Oficina</strong>.
                            </p>

                            <div className="flex items-center gap-2 text-xs text-blue-200/80 pt-1">
                                <span className="material-icons-round text-sm text-blue-300">schedule</span>
                                <span>Último backup: <strong>{formatLastBackup(stats.lastBackupDate)}</strong></span>
                            </div>
                        </div>

                        {/* Botão de Ação Principal */}
                        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[240px]">
                            <button
                                onClick={handleFullBackup}
                                disabled={isExportingFull}
                                className="px-6 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold shadow-xl shadow-emerald-950/40 hover:shadow-emerald-500/25 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed group text-base"
                            >
                                {isExportingFull ? (
                                    <>
                                        <span className="material-icons-round animate-spin">refresh</span>
                                        <span>Exportando Dados...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-2xl group-hover:scale-110 transition-transform">
                                            table_view
                                        </span>
                                        <span>Baixar Backup (.xlsx)</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleJsonBackup}
                                disabled={isExportingJson}
                                className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold backdrop-blur-md transition-all flex items-center justify-center gap-2 border border-white/15 disabled:opacity-50"
                                title="Exportar cópia técnica em JSON bruto"
                            >
                                <span className="material-icons-round text-sm">code</span>
                                {isExportingJson ? 'Gerando JSON...' : 'Exportar Cópia Técnica (JSON)'}
                            </button>
                        </div>
                    </div>

                    {/* Barra de Progresso quando estiver exportando */}
                    {isExportingFull && progress && (
                        <div className="mt-6 pt-6 border-t border-white/10 animate-in fade-in">
                            <div className="flex items-center justify-between text-xs text-blue-200 mb-2">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                    {progress.step}
                                </span>
                                <span className="font-bold">{progress.percent}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="bg-emerald-400 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Resumo rápido de contagem de registros */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6 pt-6 border-t border-white/10">
                        {modules.map((m) => (
                            <div key={m.id} className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
                                <div className="text-[11px] text-blue-200/80 truncate">{m.title}</div>
                                <div className="text-lg font-black text-white mt-0.5">
                                    {loadingStats ? (
                                        <span className="text-xs opacity-50">...</span>
                                    ) : (
                                        m.count
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* SEÇÃO: EXPORTAÇÃO INDIVIDUAL POR MÓDULO */}
            <div className="space-y-4 pt-2">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-icons-round text-primary dark:text-blue-400">tune</span>
                        Exportação Individual por Módulo
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Se preferir, baixe uma planilha Excel específica contendo somente os dados da área desejada.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {modules.map((m) => {
                        const isExportingThis = exportingModule === m.id;
                        return (
                            <div
                                key={m.id}
                                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} text-white flex items-center justify-center shadow-md`}>
                                            <span className="material-icons-round text-xl">{m.icon}</span>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                            {loadingStats ? '...' : `${m.count} ${m.unit}`}
                                        </span>
                                    </div>

                                    <h4 className="text-base font-bold text-slate-800 dark:text-white group-hover:text-primary dark:group-hover:text-blue-400 transition-colors">
                                        {m.title}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                        {m.desc}
                                    </p>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                                    <button
                                        onClick={() => handleSingleModule(m.id, m.title)}
                                        disabled={isExportingThis || isExportingFull}
                                        className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-primary hover:text-white dark:hover:bg-primary text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2 group/btn disabled:opacity-50"
                                    >
                                        {isExportingThis ? (
                                            <>
                                                <span className="material-icons-round animate-spin text-sm">refresh</span>
                                                <span>Gerando Planilha...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-icons-round text-sm group-hover/btn:scale-110 transition-transform">
                                                    file_download
                                                </span>
                                                <span>Baixar {m.title} (.xlsx)</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SEÇÃO: INFORMAÇÕES E BOAS PRÁTICAS */}
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <span className="material-icons-round text-xl">security</span>
                    </div>
                    <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">
                            Importância do Backup Regular
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
                            <li>Recomendamos fazer o download do backup completo semanalmente ou antes de grandes manutenções no estoque.</li>
                            <li>Os arquivos <strong>.xlsx</strong> podem ser abertos normalmente no <strong>Microsoft Excel</strong>, <strong>Google Planilhas</strong>, <strong>LibreOffice</strong> ou visualizadores em smartphones e tablets.</li>
                            <li>Todos os valores monetários estão formatados numericamente, permitindo somas e cálculos diretamente no Excel.</li>
                            <li>Para segurança extra, guarde uma cópia do arquivo gerado em seu e-mail, Google Drive, pen-drive ou nuvem segura.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
