import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

export interface BackupProgress {
    step: string;
    percent: number;
}

export interface BackupStats {
    clients: number;
    vehicles: number;
    serviceOrders: number;
    inventory: number;
    dismantling: number;
    sales: number;
    saleItems: number;
    accountsPayable: number;
    lastBackupDate: string | null;
}

/**
 * Busca todos os registros de uma tabela paginando de 1000 em 1000
 * para evitar limites da API do Supabase
 */
async function fetchAllRows(tableName: string, selectQuery = '*', orderCol?: string): Promise<any[]> {
    let allRows: any[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            let query = supabase.from(tableName).select(selectQuery).range(from, from + pageSize - 1);
            if (orderCol) {
                query = query.order(orderCol, { ascending: true });
            }
            const { data, error } = await query;
            if (error) {
                console.warn(`Aviso ao consultar ${tableName} (offset ${from}):`, error.message);
                break;
            }
            if (data && data.length > 0) {
                allRows = allRows.concat(data);
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    from += pageSize;
                }
            } else {
                hasMore = false;
            }
        } catch (err) {
            console.error(`Erro ao buscar dados de ${tableName}:`, err);
            break;
        }
    }
    return allRows;
}

/**
 * Formata datas no padrão brasileiro DD/MM/AAAA
 */
function formatDate(dateStr?: string | null): string {
    if (!dateStr) return '-';
    try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('pt-BR');
    } catch {
        return dateStr;
    }
}

/**
 * Formata data e hora no padrão brasileiro DD/MM/AAAA HH:mm
 */
function formatDateTime(dateStr?: string | null): string {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleString('pt-BR');
    } catch {
        return dateStr;
    }
}

/**
 * Converte valores monetários para número com 2 casas
 */
function formatNumber(val?: any): number {
    if (val === null || val === undefined || isNaN(Number(val))) return 0;
    return Math.round(Number(val) * 100) / 100;
}

/**
 * Ajusta automaticamente a largura das colunas
 */
function fitColumnWidths(data: any[], headers?: string[]): { wch: number }[] {
    if (!data || data.length === 0) {
        if (headers) {
            return headers.map(h => ({ wch: Math.max(String(h).length + 3, 12) }));
        }
        return [];
    }
    const keys = headers || Object.keys(data[0]);
    return keys.map(key => {
        let maxLen = String(key).length;
        const sampleSize = Math.min(data.length, 300);
        for (let i = 0; i < sampleSize; i++) {
            const val = data[i][key];
            if (val !== null && val !== undefined) {
                const len = String(val).length;
                if (len > maxLen) maxLen = len;
            }
        }
        return { wch: Math.min(Math.max(maxLen + 3, 12), 65) };
    });
}

/**
 * Salva a planilha disparando o download no navegador com fallback seguro
 */
function saveWorkbook(wb: XLSX.WorkBook, filename: string) {
    try {
        XLSX.writeFile(wb, filename);
    } catch (e) {
        console.warn('XLSX.writeFile falhou, usando Blob fallback:', e);
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

/**
 * Cria uma planilha a partir de dados com cabeçalhos garantidos
 */
function createWorksheet(headers: string[], rows: any[]): XLSX.WorkSheet {
    let ws: XLSX.WorkSheet;
    if (rows.length === 0) {
        ws = XLSX.utils.aoa_to_sheet([headers]);
    } else {
        ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    }
    ws['!cols'] = fitColumnWidths(rows, headers);
    return ws;
}

/**
 * Consulta a contagem rápida de registros de todas as tabelas
 */
export async function fetchBackupStats(): Promise<BackupStats> {
    const tables = [
        { key: 'clients', name: 'clients' },
        { key: 'vehicles', name: 'vehicles' },
        { key: 'serviceOrders', name: 'service_orders' },
        { key: 'inventory', name: 'inventory' },
        { key: 'dismantling', name: 'dismantling_vehicles' },
        { key: 'sales', name: 'sales' },
        { key: 'saleItems', name: 'sale_items' },
        { key: 'accountsPayable', name: 'accounts_payable' },
    ];

    const stats: any = {
        clients: 0,
        vehicles: 0,
        serviceOrders: 0,
        inventory: 0,
        dismantling: 0,
        sales: 0,
        saleItems: 0,
        accountsPayable: 0,
        lastBackupDate: localStorage.getItem('last_backup_date') || null
    };

    await Promise.all(
        tables.map(async (t) => {
            try {
                const { count } = await supabase.from(t.name).select('*', { count: 'exact', head: true });
                stats[t.key] = count || 0;
            } catch (err) {
                console.warn(`Erro ao contar ${t.name}:`, err);
            }
        })
    );

    return stats;
}

/**
 * EXPORTA O BACKUP COMPLETO DO SISTEMA EM EXCEL (.XLSX)
 * Contém todas as tabelas e dados organizados em abas independentes:
 * - 📊 Resumo Geral
 * - 👥 Clientes
 * - 🚗 Veículos
 * - 🔧 Ordens de Serviço (OS)
 * - 🛠️ Itens e Peças das OS
 * - 📦 Peças & Estoque
 * - 🚙 Desmanche
 * - 💰 Vendas
 * - 🛒 Itens Vendidos
 * - 💳 Contas a Pagar
 * - ⚙️ Dados da Oficina
 */
export async function exportFullBackupExcel(
    onProgress?: (progress: BackupProgress) => void
): Promise<{ success: boolean; filename: string; stats: Record<string, number> }> {
    const notify = (step: string, percent: number) => {
        if (onProgress) onProgress({ step, percent });
    };

    notify('Iniciando coleta de dados...', 5);

    // 1. Buscar todas as tabelas
    notify('Buscando Clientes e Veículos...', 15);
    const clientsRaw = await fetchAllRows('clients', '*', 'name');
    const vehiclesRaw = await fetchAllRows('vehicles', '*', 'created_at');

    notify('Buscando Ordens de Serviço...', 30);
    const serviceOrdersRaw = await fetchAllRows('service_orders', '*', 'created_at');

    notify('Buscando Estoque e Peças...', 45);
    const inventoryRaw = await fetchAllRows('inventory', '*', 'name');

    notify('Buscando Veículos de Desmanche...', 60);
    const dismantlingRaw = await fetchAllRows('dismantling_vehicles', '*', 'created_at');

    notify('Buscando Vendas e Contas a Pagar...', 75);
    const salesRaw = await fetchAllRows('sales', '*', 'created_at');
    const saleItemsRaw = await fetchAllRows('sale_items', '*');
    const accountsPayableRaw = await fetchAllRows('accounts_payable', '*', 'due_date');

    notify('Buscando Configurações do Sistema...', 85);
    const { data: settingsData } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    const { data: profilesData } = await supabase.from('profiles').select('id, full_name, email, role, created_at');

    notify('Processando e organizando planilhas...', 90);

    // Criar mapas de relacionamento para enriquecer as planilhas
    const clientMap = new Map<string, any>();
    clientsRaw.forEach(c => clientMap.set(c.id, c));

    const inventoryMap = new Map<string, any>();
    inventoryRaw.forEach(i => inventoryMap.set(i.id, i));

    const salesMap = new Map<string, any>();
    salesRaw.forEach(s => salesMap.set(s.id, s));

    // ==========================================
    // 1. ABA: CLIENTES
    // ==========================================
    const clientHeaders = [
        'ID Cliente',
        'Nome Completo',
        'Telefone',
        'CPF / CNPJ',
        'E-mail',
        'Veículo Cadastrado',
        'Status',
        'Data de Cadastro'
    ];
    const clientsSheetData = clientsRaw.map(c => ({
        'ID Cliente': c.id,
        'Nome Completo': c.name || '-',
        'Telefone': c.phone || '-',
        'CPF / CNPJ': c.cpf_cnpj || '-',
        'E-mail': c.email || '-',
        'Veículo Cadastrado': c.vehicle || '-',
        'Status': c.status || 'Ativo',
        'Data de Cadastro': formatDateTime(c.created_at)
    }));

    // ==========================================
    // 2. ABA: VEÍCULOS
    // ==========================================
    const vehicleHeaders = [
        'ID Veículo',
        'Placa',
        'Modelo / Veículo',
        'Cor',
        'Ano',
        'Nome do Proprietário',
        'Telefone do Proprietário',
        'Observações',
        'Data de Cadastro'
    ];
    const vehiclesSheetData = vehiclesRaw.map(v => {
        const owner = clientMap.get(v.client_id);
        return {
            'ID Veículo': v.id,
            'Placa': (v.plate || '').toUpperCase(),
            'Modelo / Veículo': v.model || '-',
            'Cor': v.color || '-',
            'Ano': v.year || '-',
            'Nome do Proprietário': owner?.name || 'Não vinculado',
            'Telefone do Proprietário': owner?.phone || '-',
            'Observações': v.notes || '-',
            'Data de Cadastro': formatDateTime(v.created_at)
        };
    });

    // ==========================================
    // 3. ABA: ORDENS DE SERVIÇO (OS)
    // ==========================================
    const osHeaders = [
        'Nº OS',
        'Cliente',
        'Telefone',
        'Placa',
        'Veículo',
        'Quilometragem (KM)',
        'Status da OS',
        'Valor Total (R$)',
        'Valor Entrada (R$)',
        'Forma de Entrada',
        'Nº Parcelas',
        'Parcelas Pagas',
        'Forma de Pagamento',
        'Status Pagamento',
        'Data Vencimento',
        'Data Entrega/Conclusão',
        'Reclamação do Cliente',
        'Diagnóstico Técnico',
        'Descrição Serviços',
        'Resumo de Peças / Itens',
        'Observações',
        'Data de Abertura'
    ];

    // Array auxiliar para a aba de Itens das OS
    const osItemsDetails: any[] = [];

    const osSheetData = serviceOrdersRaw.map(os => {
        const client = clientMap.get(os.client_id);
        const clientName = client?.name || os.client_name || 'Não informado';
        const clientPhone = client?.phone || os.client_phone || '-';

        // Parse items da OS
        let itemsList: any[] = [];
        if (Array.isArray(os.items)) {
            itemsList = os.items;
        } else if (typeof os.items === 'string') {
            try {
                itemsList = JSON.parse(os.items);
            } catch {
                itemsList = [];
            }
        }

        // Resumo legível para a célula da OS
        const itemsSummary = itemsList.length > 0
            ? itemsList.map((item: any) => `${item.qty || item.quantity || 1}x ${item.name || item.description || 'Item'} (R$ ${formatNumber(item.unitPrice || item.unit_price).toFixed(2)})`).join(' | ')
            : '-';

        // Alimenta a lista de detalhe de itens
        itemsList.forEach((item: any) => {
            const qty = Number(item.qty || item.quantity || 1);
            const unitPrice = formatNumber(item.unitPrice || item.unit_price);
            osItemsDetails.push({
                'Nº OS': os.order_number || os.id?.slice(0, 8),
                'Data da OS': formatDate(os.created_at),
                'Cliente': clientName,
                'Placa': (os.plate || '').toUpperCase(),
                'Veículo': os.vehicle || '-',
                'Tipo': item.type === 'labor' ? 'Mão de Obra' : 'Peça',
                'Código / SKU': item.code || item.sku || '-',
                'Descrição do Item': item.name || item.description || '-',
                'Quantidade': qty,
                'Preço Unitário (R$)': unitPrice,
                'Subtotal (R$)': Math.round(qty * unitPrice * 100) / 100
            });
        });

        return {
            'Nº OS': os.order_number || os.id?.slice(0, 8),
            'Cliente': clientName,
            'Telefone': clientPhone,
            'Placa': (os.plate || '').toUpperCase(),
            'Veículo': os.vehicle || '-',
            'Quilometragem (KM)': os.km || '-',
            'Status da OS': os.status || 'Pendente',
            'Valor Total (R$)': formatNumber(os.value),
            'Valor Entrada (R$)': formatNumber(os.entry_amount),
            'Forma de Entrada': os.entry_method || '-',
            'Nº Parcelas': os.installment_count || 1,
            'Parcelas Pagas': os.installments_paid || 0,
            'Forma de Pagamento': os.payment_method || '-',
            'Status Pagamento': os.payment_status === 'pago' ? 'Pago' : 'Pendente',
            'Data Vencimento': formatDate(os.payment_due_date),
            'Data Entrega/Conclusão': formatDate(os.delivery_date),
            'Reclamação do Cliente': os.complaint || '-',
            'Diagnóstico Técnico': os.diagnosis || '-',
            'Descrição Serviços': os.service || '-',
            'Resumo de Peças / Itens': itemsSummary,
            'Observações': os.notes || '-',
            'Data de Abertura': formatDateTime(os.created_at)
        };
    });

    // ==========================================
    // 4. ABA: DETALHE DE ITENS DAS OS
    // ==========================================
    const osItemsHeaders = [
        'Nº OS',
        'Data da OS',
        'Cliente',
        'Placa',
        'Veículo',
        'Tipo',
        'Código / SKU',
        'Descrição do Item',
        'Quantidade',
        'Preço Unitário (R$)',
        'Subtotal (R$)'
    ];

    // ==========================================
    // 5. ABA: PEÇAS & ESTOQUE
    // ==========================================
    const inventoryHeaders = [
        'Código SKU',
        'Nome da Peça',
        'Categoria',
        'Tipo de Peça',
        'Veículo de Origem',
        'Condição',
        'Qtd em Estoque',
        'Preço de Custo (R$)',
        'Preço de Venda (R$)',
        'Margem Estimada (%)',
        'Total em Estoque (R$)',
        'Fornecedor',
        'Status Pagamento Fornecedor',
        'Vencimento Fornecedor',
        'Status do Estoque',
        'Data de Cadastro'
    ];
    const inventorySheetData = inventoryRaw.map(item => {
        const qty = Number(item.quantity) || 0;
        const costPrice = formatNumber(item.cost_price);
        const unitPrice = formatNumber(item.unit_price);
        const totalStockVal = Math.round(qty * unitPrice * 100) / 100;
        const margin = unitPrice > costPrice && unitPrice > 0
            ? `${(((unitPrice - costPrice) / unitPrice) * 100).toFixed(1)}%`
            : '-';

        return {
            'Código SKU': item.sku || '-',
            'Nome da Peça': item.name || '-',
            'Categoria': item.category || 'Geral',
            'Tipo de Peça': item.is_used ? 'Usada (Desmanche)' : 'Nova',
            'Veículo de Origem': item.origin_vehicle || '-',
            'Condição': item.part_condition || (item.is_used ? 'Usado' : 'Novo'),
            'Qtd em Estoque': qty,
            'Preço de Custo (R$)': costPrice,
            'Preço de Venda (R$)': unitPrice,
            'Margem Estimada (%)': margin,
            'Total em Estoque (R$)': totalStockVal,
            'Fornecedor': item.supplier_name || '-',
            'Status Pagamento Fornecedor': item.payment_status || '-',
            'Vencimento Fornecedor': formatDate(item.due_date),
            'Status do Estoque': item.status || (qty > 0 ? 'Em Estoque' : 'Esgotado'),
            'Data de Cadastro': formatDateTime(item.created_at)
        };
    });

    // ==========================================
    // 6. ABA: DESMANCHE (VEÍCULOS ADQUIRIDOS)
    // ==========================================
    const dismantlingHeaders = [
        'ID',
        'Modelo do Veículo',
        'Placa',
        'Ano',
        'Cor',
        'Preço de Compra (R$)',
        'Custo Total / Gastos (R$)',
        'Fornecedor / Origem',
        'Forma de Pagamento',
        'Status do Pagamento',
        'Data da Compra',
        'Status do Desmanche',
        'Observações',
        'Data de Cadastro'
    ];
    const dismantlingSheetData = dismantlingRaw.map(d => ({
        'ID': d.id,
        'Modelo do Veículo': d.model || '-',
        'Placa': (d.plate || '').toUpperCase(),
        'Ano': d.year || '-',
        'Cor': d.color || '-',
        'Preço de Compra (R$)': formatNumber(d.purchase_price),
        'Custo Total / Gastos (R$)': formatNumber(d.cost_price || d.purchase_price),
        'Fornecedor / Origem': d.supplier || '-',
        'Forma de Pagamento': d.payment_method || '-',
        'Status do Pagamento': d.payment_status === 'pago' ? 'Pago' : 'Pendente',
        'Data da Compra': formatDate(d.purchase_date),
        'Status do Desmanche': d.status === 'disponivel' ? 'Disponível' : (d.status === 'processando' ? 'Em Desmanche' : 'Finalizado'),
        'Observações': d.notes || '-',
        'Data de Cadastro': formatDateTime(d.created_at)
    }));

    // ==========================================
    // 7. ABA: VENDAS (BALCÃO / PEÇAS)
    // ==========================================
    const salesHeaders = [
        'ID Venda',
        'Cliente',
        'Tipo de Venda',
        'Forma de Pagamento',
        'Valor Total (R$)',
        'Data da Venda'
    ];
    const salesSheetData = salesRaw.map(s => {
        const client = clientMap.get(s.client_id);
        return {
            'ID Venda': s.id,
            'Cliente': client?.name || 'Cliente Balcão / Não identificado',
            'Tipo de Venda': s.sale_type === 'desmanche' ? 'Desmanche' : 'Balcão (Peças)',
            'Forma de Pagamento': s.payment_method || '-',
            'Valor Total (R$)': formatNumber(s.total),
            'Data da Venda': formatDateTime(s.created_at)
        };
    });

    // ==========================================
    // 8. ABA: ITENS DAS VENDAS
    // ==========================================
    const saleItemsHeaders = [
        'ID Item',
        'ID Venda',
        'Data da Venda',
        'Cliente',
        'Nome da Peça',
        'Código SKU',
        'Quantidade',
        'Preço Unitário (R$)',
        'Subtotal (R$)'
    ];
    const saleItemsSheetData = saleItemsRaw.map(si => {
        const sale = salesMap.get(si.sale_id);
        const client = sale ? clientMap.get(sale.client_id) : null;
        const inv = inventoryMap.get(si.inventory_id);
        const qty = Number(si.quantity) || 1;
        const unitPrice = formatNumber(si.unit_price);

        return {
            'ID Item': si.id,
            'ID Venda': si.sale_id,
            'Data da Venda': sale ? formatDateTime(sale.created_at) : '-',
            'Cliente': client?.name || 'Balcão',
            'Nome da Peça': inv?.name || 'Peça não identificada',
            'Código SKU': inv?.sku || '-',
            'Quantidade': qty,
            'Preço Unitário (R$)': unitPrice,
            'Subtotal (R$)': Math.round(qty * unitPrice * 100) / 100
        };
    });

    // ==========================================
    // 9. ABA: CONTAS A PAGAR / FINANCEIRO
    // ==========================================
    const apHeaders = [
        'ID',
        'Descrição da Despesa',
        'Fornecedor / Favorecido',
        'Telefone do Fornecedor',
        'Tipo de Pagamento',
        'Valor da Conta (R$)',
        'Data de Vencimento',
        'Status do Pagamento',
        'Data do Pagamento',
        'Observações',
        'Data de Lançamento'
    ];
    const accountsPayableSheetData = accountsPayableRaw.map(ap => ({
        'ID': ap.id,
        'Descrição da Despesa': ap.description || '-',
        'Fornecedor / Favorecido': ap.supplier_name || '-',
        'Telefone do Fornecedor': ap.supplier_phone || '-',
        'Tipo de Pagamento': ap.payment_type === 'faturado' ? 'Faturado' : (ap.payment_type === 'a_vista' ? 'À Vista' : ap.payment_type || '-'),
        'Valor da Conta (R$)': formatNumber(ap.amount),
        'Data de Vencimento': formatDate(ap.due_date),
        'Status do Pagamento': ap.status === 'pago' ? 'Pago' : 'Pendente',
        'Data do Pagamento': formatDate(ap.paid_at),
        'Observações': ap.notes || '-',
        'Data de Lançamento': formatDateTime(ap.created_at)
    }));

    // ==========================================
    // 10. ABA: CONFIGURAÇÕES DA EMPRESA
    // ==========================================
    const settingsHeaders = ['Configuração / Campo', 'Valor Cadastrado'];
    const settingsSheetData = [
        { 'Configuração / Campo': 'Nome da Oficina / Razão Social', 'Valor Cadastrado': settingsData?.company_name || 'FMA Centro Automotivo' },
        { 'Configuração / Campo': 'CNPJ', 'Valor Cadastrado': settingsData?.cnpj || '-' },
        { 'Configuração / Campo': 'Endereço Completo', 'Valor Cadastrado': settingsData?.address || '-' },
        { 'Configuração / Campo': 'Telefone de Contato', 'Valor Cadastrado': settingsData?.phone || '-' },
        { 'Configuração / Campo': 'E-mail Comercial', 'Valor Cadastrado': settingsData?.email || '-' },
        { 'Configuração / Campo': 'Tipo de Chave PIX', 'Valor Cadastrado': settingsData?.pix_key_type || '-' },
        { 'Configuração / Campo': 'Chave PIX', 'Valor Cadastrado': settingsData?.pix_key || '-' },
        { 'Configuração / Campo': 'Usuários do Sistema', 'Valor Cadastrado': (profilesData || []).map(p => `${p.full_name || p.email} (${p.role})`).join('; ') }
    ];

    // ==========================================
    // 11. ABA: RESUMO GERAL DO BACKUP (DASHBOARD)
    // ==========================================
    const totalOsValue = serviceOrdersRaw.reduce((acc, os) => acc + (Number(os.value) || 0), 0);
    const totalOsCompletedValue = serviceOrdersRaw.filter(os => os.status === 'Concluído').reduce((acc, os) => acc + (Number(os.value) || 0), 0);
    const totalInventoryItems = inventoryRaw.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
    const totalInventoryValue = inventoryRaw.reduce((acc, i) => acc + ((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)), 0);
    const totalDismantlingInvested = dismantlingRaw.reduce((acc, d) => acc + (Number(d.purchase_price) || 0), 0);
    const totalSalesValue = salesRaw.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const totalApPending = accountsPayableRaw.filter(ap => ap.status === 'pendente').reduce((acc, ap) => acc + (Number(ap.amount) || 0), 0);

    const now = new Date();
    const formattedBackupDate = now.toLocaleString('pt-BR');

    const summaryHeaders = ['Indicador / Módulo', 'Quantidade de Registros', 'Valor Financeiro Total'];
    const summarySheetData = [
        { 'Indicador / Módulo': 'Data e Hora da Geração do Backup', 'Quantidade de Registros': formattedBackupDate, 'Valor Financeiro Total': 'FMA Centro Automotivo' },
        { 'Indicador / Módulo': '👥 Clientes Cadastrados', 'Quantidade de Registros': clientsRaw.length, 'Valor Financeiro Total': '-' },
        { 'Indicador / Módulo': '🚗 Veículos dos Clientes', 'Quantidade de Registros': vehiclesRaw.length, 'Valor Financeiro Total': '-' },
        { 'Indicador / Módulo': '🔧 Ordens de Serviço (OS)', 'Quantidade de Registros': serviceOrdersRaw.length, 'Valor Financeiro Total': `R$ ${totalOsValue.toFixed(2)} (Total Geral)` },
        { 'Indicador / Módulo': '   ↳ OS Concluídas', 'Quantidade de Registros': serviceOrdersRaw.filter(os => os.status === 'Concluído').length, 'Valor Financeiro Total': `R$ ${totalOsCompletedValue.toFixed(2)} (Faturado)` },
        { 'Indicador / Módulo': '   ↳ OS Pendentes / Em Andamento', 'Quantidade de Registros': serviceOrdersRaw.filter(os => os.status !== 'Concluído').length, 'Valor Financeiro Total': '-' },
        { 'Indicador / Módulo': '📦 Peças & Estoque (Itens Cadastrados)', 'Quantidade de Registros': `${inventoryRaw.length} tipos de peças (${totalInventoryItems} un)`, 'Valor Financeiro Total': `R$ ${totalInventoryValue.toFixed(2)} (Em Estoque)` },
        { 'Indicador / Módulo': '🚙 Veículos de Desmanche Adquiridos', 'Quantidade de Registros': dismantlingRaw.length, 'Valor Financeiro Total': `R$ ${totalDismantlingInvested.toFixed(2)} (Investido)` },
        { 'Indicador / Módulo': '💰 Vendas de Peças (Balcão)', 'Quantidade de Registros': salesRaw.length, 'Valor Financeiro Total': `R$ ${totalSalesValue.toFixed(2)}` },
        { 'Indicador / Módulo': '🛒 Itens Vendidos (Total de Linhas)', 'Quantidade de Registros': saleItemsRaw.length, 'Valor Financeiro Total': '-' },
        { 'Indicador / Módulo': '💳 Contas a Pagar Cadastradas', 'Quantidade de Registros': accountsPayableRaw.length, 'Valor Financeiro Total': `R$ ${totalApPending.toFixed(2)} (Pendente)` },
        { 'Indicador / Módulo': '👤 Usuários com Acesso ao Sistema', 'Quantidade de Registros': profilesData?.length || 0, 'Valor Financeiro Total': '-' }
    ];

    // ==========================================
    // CRIAÇÃO DO WORKBOOK EXCEL
    // ==========================================
    notify('Compilando arquivo Excel...', 95);
    const wb = XLSX.utils.book_new();

    // 1. Resumo Geral
    XLSX.utils.book_append_sheet(wb, createWorksheet(summaryHeaders, summarySheetData), 'Resumo Geral');

    // 2. Clientes
    XLSX.utils.book_append_sheet(wb, createWorksheet(clientHeaders, clientsSheetData), 'Clientes');

    // 3. Veículos
    XLSX.utils.book_append_sheet(wb, createWorksheet(vehicleHeaders, vehiclesSheetData), 'Veículos');

    // 4. Ordens de Serviço
    XLSX.utils.book_append_sheet(wb, createWorksheet(osHeaders, osSheetData), 'Ordens de Serviço');

    // 5. Itens das OS
    XLSX.utils.book_append_sheet(wb, createWorksheet(osItemsHeaders, osItemsDetails), 'Itens das OS');

    // 6. Peças & Estoque
    XLSX.utils.book_append_sheet(wb, createWorksheet(inventoryHeaders, inventorySheetData), 'Peças e Estoque');

    // 7. Desmanche
    XLSX.utils.book_append_sheet(wb, createWorksheet(dismantlingHeaders, dismantlingSheetData), 'Desmanche');

    // 8. Vendas
    XLSX.utils.book_append_sheet(wb, createWorksheet(salesHeaders, salesSheetData), 'Vendas Balcão');

    // 9. Itens Vendidos
    XLSX.utils.book_append_sheet(wb, createWorksheet(saleItemsHeaders, saleItemsSheetData), 'Itens das Vendas');

    // 10. Contas a Pagar
    XLSX.utils.book_append_sheet(wb, createWorksheet(apHeaders, accountsPayableSheetData), 'Contas a Pagar');

    // 11. Dados da Oficina
    XLSX.utils.book_append_sheet(wb, createWorksheet(settingsHeaders, settingsSheetData), 'Dados da Oficina');

    // Gerar nome do arquivo com timestamp: Backup_FMA_Centro_Automotivo_AAAA-MM-DD_HHmm.xlsx
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `Backup_Completo_FMA_${dateStr}_${timeStr}.xlsx`;

    // Download do arquivo
    saveWorkbook(wb, filename);

    // Salvar data do último backup
    localStorage.setItem('last_backup_date', now.toISOString());

    notify('Backup concluído com sucesso!', 100);

    return {
        success: true,
        filename,
        stats: {
            clients: clientsRaw.length,
            vehicles: vehiclesRaw.length,
            serviceOrders: serviceOrdersRaw.length,
            inventory: inventoryRaw.length,
            dismantling: dismantlingRaw.length,
            sales: salesRaw.length,
            saleItems: saleItemsRaw.length,
            accountsPayable: accountsPayableRaw.length,
        }
    };
}

/**
 * EXPORTA UM MÓDULO INDIVIDUAL EM EXCEL (.XLSX)
 */
export async function exportSingleModuleExcel(
    module: 'clients' | 'vehicles' | 'service_orders' | 'inventory' | 'dismantling' | 'sales' | 'accounts_payable'
): Promise<{ success: boolean; filename: string }> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const wb = XLSX.utils.book_new();
    let filename = '';

    switch (module) {
        case 'clients': {
            const raw = await fetchAllRows('clients', '*', 'name');
            const headers = ['ID', 'Nome', 'Telefone', 'CPF / CNPJ', 'E-mail', 'Veículo', 'Status', 'Data Cadastro'];
            const data = raw.map(c => ({
                'ID': c.id,
                'Nome': c.name || '-',
                'Telefone': c.phone || '-',
                'CPF / CNPJ': c.cpf_cnpj || '-',
                'E-mail': c.email || '-',
                'Veículo': c.vehicle || '-',
                'Status': c.status || 'Ativo',
                'Data Cadastro': formatDateTime(c.created_at)
            }));
            XLSX.utils.book_append_sheet(wb, createWorksheet(headers, data), 'Clientes');
            filename = `Clientes_FMA_${dateStr}.xlsx`;
            break;
        }

        case 'vehicles': {
            const raw = await fetchAllRows('vehicles', '*', 'model');
            const clients = await fetchAllRows('clients', 'id, name, phone');
            const clientMap = new Map(clients.map(c => [c.id, c]));
            const headers = ['Placa', 'Modelo', 'Cor', 'Ano', 'Proprietário', 'Telefone', 'Observações', 'Data Cadastro'];
            const data = raw.map(v => {
                const owner = clientMap.get(v.client_id);
                return {
                    'Placa': (v.plate || '').toUpperCase(),
                    'Modelo': v.model || '-',
                    'Cor': v.color || '-',
                    'Ano': v.year || '-',
                    'Proprietário': owner?.name || '-',
                    'Telefone': owner?.phone || '-',
                    'Observações': v.notes || '-',
                    'Data Cadastro': formatDateTime(v.created_at)
                };
            });
            XLSX.utils.book_append_sheet(wb, createWorksheet(headers, data), 'Veículos');
            filename = `Veiculos_FMA_${dateStr}.xlsx`;
            break;
        }

        case 'service_orders': {
            const raw = await fetchAllRows('service_orders', '*', 'created_at');
            const clients = await fetchAllRows('clients', 'id, name, phone');
            const clientMap = new Map(clients.map(c => [c.id, c]));
            const headers = [
                'Nº OS', 'Cliente', 'Telefone', 'Placa', 'Veículo', 'KM', 'Status', 'Valor (R$)',
                'Entrada (R$)', 'Forma Entrada', 'Parcelas', 'Forma Pagamento', 'Status Pagamento',
                'Vencimento', 'Serviço Realizado', 'Data Abertura'
            ];
            const data = raw.map(os => {
                const client = clientMap.get(os.client_id);
                return {
                    'Nº OS': os.order_number || os.id?.slice(0, 8),
                    'Cliente': client?.name || os.client_name || '-',
                    'Telefone': client?.phone || os.client_phone || '-',
                    'Placa': (os.plate || '').toUpperCase(),
                    'Veículo': os.vehicle || '-',
                    'KM': os.km || '-',
                    'Status': os.status || 'Pendente',
                    'Valor (R$)': formatNumber(os.value),
                    'Entrada (R$)': formatNumber(os.entry_amount),
                    'Forma Entrada': os.entry_method || '-',
                    'Parcelas': os.installment_count || 1,
                    'Forma Pagamento': os.payment_method || '-',
                    'Status Pagamento': os.payment_status === 'pago' ? 'Pago' : 'Pendente',
                    'Vencimento': formatDate(os.payment_due_date),
                    'Serviço Realizado': os.service || '-',
                    'Data Abertura': formatDateTime(os.created_at)
                };
            });
            XLSX.utils.book_append_sheet(wb, createWorksheet(headers, data), 'Ordens de Serviço');
            filename = `Ordens_de_Servico_FMA_${dateStr}.xlsx`;
            break;
        }

        case 'inventory': {
            const raw = await fetchAllRows('inventory', '*', 'name');
            const headers = [
                'SKU', 'Nome da Peça', 'Categoria', 'Tipo', 'Origem Desmanche',
                'Qtd em Estoque', 'Preço Custo (R$)', 'Preço Venda (R$)', 'Total Estoque (R$)',
                'Fornecedor', 'Status Estoque', 'Data Cadastro'
            ];
            const data = raw.map(i => {
                const qty = Number(i.quantity) || 0;
                const unitPrice = formatNumber(i.unit_price);
                return {
                    'SKU': i.sku || '-',
                    'Nome da Peça': i.name || '-',
                    'Categoria': i.category || 'Geral',
                    'Tipo': i.is_used ? 'Usada (Desmanche)' : 'Nova',
                    'Origem Desmanche': i.origin_vehicle || '-',
                    'Qtd em Estoque': qty,
                    'Preço Custo (R$)': formatNumber(i.cost_price),
                    'Preço Venda (R$)': unitPrice,
                    'Total Estoque (R$)': Math.round(qty * unitPrice * 100) / 100,
                    'Fornecedor': i.supplier_name || '-',
                    'Status Estoque': i.status || (qty > 0 ? 'Em Estoque' : 'Esgotado'),
                    'Data Cadastro': formatDateTime(i.created_at)
                };
            });
            XLSX.utils.book_append_sheet(wb, createWorksheet(headers, data), 'Peças e Estoque');
            filename = `Estoque_Pecas_FMA_${dateStr}.xlsx`;
            break;
        }

        case 'dismantling': {
            const raw = await fetchAllRows('dismantling_vehicles', '*', 'created_at');
            const headers = [
                'Modelo', 'Placa', 'Ano', 'Cor', 'Preço Compra (R$)', 'Custo Total (R$)',
                'Fornecedor', 'Forma Pagamento', 'Status Pagamento', 'Data Compra', 'Status', 'Observações'
            ];
            const data = raw.map(d => ({
                'Modelo': d.model || '-',
                'Placa': (d.plate || '').toUpperCase(),
                'Ano': d.year || '-',
                'Cor': d.color || '-',
                'Preço Compra (R$)': formatNumber(d.purchase_price),
                'Custo Total (R$)': formatNumber(d.cost_price || d.purchase_price),
                'Fornecedor': d.supplier || '-',
                'Forma Pagamento': d.payment_method || '-',
                'Status Pagamento': d.payment_status === 'pago' ? 'Pago' : 'Pendente',
                'Data Compra': formatDate(d.purchase_date),
                'Status': d.status === 'disponivel' ? 'Disponível' : (d.status === 'processando' ? 'Em Desmanche' : 'Finalizado'),
                'Observações': d.notes || '-'
            }));
            XLSX.utils.book_append_sheet(wb, createWorksheet(headers, data), 'Desmanche');
            filename = `Desmanche_Veiculos_FMA_${dateStr}.xlsx`;
            break;
        }

        case 'sales': {
            const raw = await fetchAllRows('sales', '*', 'created_at');
            const clients = await fetchAllRows('clients', 'id, name');
            const clientMap = new Map(clients.map(c => [c.id, c.name]));
            const headers = ['ID Venda', 'Cliente', 'Tipo Venda', 'Forma Pagamento', 'Valor Total (R$)', 'Data Venda'];
            const data = raw.map(s => ({
                'ID Venda': s.id,
                'Cliente': clientMap.get(s.client_id) || 'Balcão',
                'Tipo Venda': s.sale_type === 'desmanche' ? 'Desmanche' : 'Balcão',
                'Forma Pagamento': s.payment_method || '-',
                'Valor Total (R$)': formatNumber(s.total),
                'Data Venda': formatDateTime(s.created_at)
            }));
            XLSX.utils.book_append_sheet(wb, createWorksheet(headers, data), 'Vendas');
            filename = `Vendas_Pecas_FMA_${dateStr}.xlsx`;
            break;
        }

        case 'accounts_payable': {
            const raw = await fetchAllRows('accounts_payable', '*', 'due_date');
            const headers = ['Descrição', 'Fornecedor', 'Telefone', 'Tipo Pagamento', 'Valor (R$)', 'Vencimento', 'Status', 'Pago Em', 'Observações'];
            const data = raw.map(ap => ({
                'Descrição': ap.description || '-',
                'Fornecedor': ap.supplier_name || '-',
                'Telefone': ap.supplier_phone || '-',
                'Tipo Pagamento': ap.payment_type || '-',
                'Valor (R$)': formatNumber(ap.amount),
                'Vencimento': formatDate(ap.due_date),
                'Status': ap.status === 'pago' ? 'Pago' : 'Pendente',
                'Pago Em': formatDate(ap.paid_at),
                'Observações': ap.notes || '-'
            }));
            XLSX.utils.book_append_sheet(wb, createWorksheet(headers, data), 'Contas a Pagar');
            filename = `Contas_a_Pagar_FMA_${dateStr}.xlsx`;
            break;
        }
    }

    saveWorkbook(wb, filename);
    return { success: true, filename };
}

/**
 * EXPORTA O BACKUP COMPLETO EM FORMATO RAW JSON (.JSON)
 * Ideal para restauração técnica ou arquivamento de banco de dados
 */
export async function exportFullBackupJson(): Promise<{ success: boolean; filename: string }> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `Backup_Raw_FMA_${dateStr}_${timeStr}.json`;

    const [
        clients,
        vehicles,
        serviceOrders,
        inventory,
        dismantling,
        sales,
        saleItems,
        accountsPayable,
        settings,
        profiles
    ] = await Promise.all([
        fetchAllRows('clients'),
        fetchAllRows('vehicles'),
        fetchAllRows('service_orders'),
        fetchAllRows('inventory'),
        fetchAllRows('dismantling_vehicles'),
        fetchAllRows('sales'),
        fetchAllRows('sale_items'),
        fetchAllRows('accounts_payable'),
        fetchAllRows('settings'),
        fetchAllRows('profiles')
    ]);

    const backupPayload = {
        metadata: {
            system: 'FMA Centro Automotivo',
            exportedAt: now.toISOString(),
            version: '1.0.0'
        },
        data: {
            clients,
            vehicles,
            serviceOrders,
            inventory,
            dismantling,
            sales,
            saleItems,
            accountsPayable,
            settings,
            profiles
        }
    };

    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem('last_backup_date', now.toISOString());
    return { success: true, filename };
}
