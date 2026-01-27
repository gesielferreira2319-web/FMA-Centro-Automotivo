/**
 * Utilitário para geração padronizada de Ordem de Serviço
 * Usado para impressão, download e envio via WhatsApp
 */

export interface OrderData {
    order_number: number | string;
    created_at: string;
    status?: string;
    client_name?: string;
    client_phone?: string;
    client_cpf?: string;
    plate?: string;
    vehicle?: string;
    km?: string | number;
    complaint?: string;
    diagnosis?: string;
    service?: string;
    items?: any[] | string;
    value?: number;
    delivery_date?: string;
    notes?: string;
    vehicle_photo?: string;
}

const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
};

const formatDateTime = (): string => {
    return new Date().toLocaleString('pt-BR');
};

/**
 * Gera o HTML padronizado para Ordem de Serviço
 */
export const generateOrderHTML = (order: OrderData): string => {
    // Processar itens
    let itemsHtml = '';
    let totalValue = order.value || 0;

    if (order.items) {
        try {
            const parsedItems = typeof order.items === 'string'
                ? JSON.parse(order.items)
                : order.items;

            if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                const partsItems = parsedItems.filter((i: any) => i.type === 'part');
                const serviceItems = parsedItems.filter((i: any) => i.type === 'service');
                const partsTotal = partsItems.reduce((sum: number, i: any) => sum + ((i.unitPrice || 0) * (i.qty || 1)), 0);
                const servicesTotal = serviceItems.reduce((sum: number, i: any) => sum + ((i.unitPrice || 0) * (i.qty || 1)), 0);
                totalValue = partsTotal + servicesTotal;

                itemsHtml = `
                    <div class="section">
                        <div class="section-title">PEÇAS E SERVIÇOS</div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 40%">Item</th>
                                    <th style="width: 15%">Tipo</th>
                                    <th style="width: 10%">Qtd</th>
                                    <th style="width: 15%; text-align: right">Unit. (R$)</th>
                                    <th style="width: 20%; text-align: right">Total (R$)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${parsedItems.map((item: any) => `
                                    <tr>
                                        <td>${item.name || '-'}</td>
                                        <td>${item.type === 'service' ? 'Serviço' : 'Peça'}</td>
                                        <td>${item.qty || 1}</td>
                                        <td style="text-align: right">${(item.unitPrice || 0).toFixed(2)}</td>
                                        <td style="text-align: right">${((item.unitPrice || 0) * (item.qty || 1)).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr class="total-row">
                                    <td colspan="4" style="text-align: right; font-weight: bold">TOTAL:</td>
                                    <td style="text-align: right; font-weight: bold">R$ ${totalValue.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                `;
            }
        } catch (e) {
            console.error('Erro ao parsear items:', e);
        }
    }

    // Separar reclamação e diagnóstico
    const complaint = order.complaint || order.service?.split('\n\nDiagnóstico:')[0] || '-';
    const diagnosis = order.diagnosis || order.service?.split('Diagnóstico: ')[1] || '-';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Ordem de Serviço #OS-${order.order_number}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: Arial, Helvetica, sans-serif;
                    padding: 40px; 
                    color: #000; 
                    max-width: 800px; 
                    margin: 0 auto;
                    background: #fff;
                    font-size: 12px;
                    line-height: 1.4;
                }
                
                /* Header */
                .header { 
                    text-align: center; 
                    margin-bottom: 30px;
                }
                .header h1 { 
                    font-size: 18px; 
                    font-weight: bold;
                    margin-bottom: 5px;
                    text-transform: uppercase;
                }
                .header .subtitle {
                    font-size: 10px;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .header .meta {
                    font-size: 10px;
                    margin-bottom: 15px;
                }
                .header-line {
                    border-bottom: 2px solid #000;
                    margin-top: 10px;
                }
                
                /* Sections */
                .section { margin-bottom: 20px; }
                .section-title { 
                    font-weight: bold; 
                    font-size: 12px; 
                    margin-bottom: 10px;
                    text-transform: uppercase;
                }
                
                /* Data Rows */
                .data-row {
                    display: flex;
                    margin-bottom: 5px;
                }
                .data-label {
                    width: 120px;
                    font-weight: bold;
                }
                .data-value {
                    flex: 1;
                }
                
                /* Table */
                table { 
                    width: 100%; 
                    border-collapse: collapse;
                    margin-top: 5px;
                    border: 1px solid #ccc;
                }
                th, td { 
                    padding: 6px 8px;
                    border: 1px solid #ccc;
                    text-align: left;
                    font-size: 11px;
                }
                th { 
                    font-weight: bold;
                    background-color: #f9f9f9;
                }
                .total-row td {
                    border-top: 2px solid #ccc;
                    font-size: 12px;
                }
                
                /* Signature Area */
                .signature-area {
                    margin-top: 60px;
                    display: flex;
                    justify-content: space-between;
                }
                .signature-box {
                    width: 40%;
                    text-align: center;
                }
                .signature-line {
                    border-top: 1px solid #000;
                    padding-top: 5px;
                    font-size: 10px;
                }
                
                /* Footer */
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    font-size: 9px;
                    color: #666;
                }

                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>FMA CENTRO AUTOMOTIVO</h1>
                <div class="subtitle">ORDEM DE SERVIÇO</div>
                <div class="meta">Data: ${formatDate(order.created_at)} - Hora: ${new Date(order.created_at).toLocaleTimeString('pt-BR')}</div>
                <div class="header-line"></div>
            </div>
            
            <div class="section">
                <div class="section-title">DADOS DO CLIENTE</div>
                <div class="data-row">
                    <div class="data-label">Nome:</div>
                    <div class="data-value">${order.client_name || 'Não informado'}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Telefone:</div>
                    <div class="data-value">${order.client_phone || 'Não informado'}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">CPF/CNPJ:</div>
                    <div class="data-value">${order.client_cpf || 'Não informado'}</div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">DADOS DO VEÍCULO</div>
                <div class="data-row">
                    <div class="data-label">Placa:</div>
                    <div class="data-value">${order.plate || '-'}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Marca/Modelo:</div>
                    <div class="data-value">${order.vehicle || '-'}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">KM:</div>
                    <div class="data-value">${order.km || '-'}</div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">DIAGNÓSTICO</div>
                <div class="data-row">
                    <div class="data-label">Reclamação:</div>
                    <div class="data-value">${complaint}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Diagnóstico:</div>
                    <div class="data-value">${diagnosis}</div>
                </div>
            </div>
            
            ${itemsHtml}
            
            <div class="section" style="margin-top: 20px">
                <div class="data-row">
                    <div class="data-label">Forma Pagto:</div>
                    <div class="data-value" style="text-transform: uppercase;">${(order as any).payment_method || '-'}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Previsão Entrega:</div>
                    <div class="data-value">${order.delivery_date ? formatDate(order.delivery_date) : 'A combinar'}</div>
                </div>
            </div>

            ${order.notes ? `
            <div class="section" style="margin-top: 10px; font-size: 10px; color: #666;">
                <strong>Observações:</strong> ${order.notes}
            </div>
            ` : ''}
            
            <div class="signature-area">
                <div class="signature-box">
                    <div class="signature-line">Assinatura do Cliente</div>
                </div>
                <div class="signature-box">
                    <div class="signature-line">Responsável Técnico</div>
                </div>
            </div>
            
            <div class="footer">
                Este documento é válido como orçamento. Sujeito a alterações após diagnóstico detalhado.
            </div>
        </body>
        </html>
    `;
};

/**
 * Imprime a Ordem de Serviço
 */
export const printOrder = (order: OrderData): void => {
    const html = generateOrderHTML(order);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
    }
};

/**
 * Faz o download da OS como arquivo PDF
 * Usa html2pdf.js para converter HTML em PDF
 */
export const downloadOrder = async (order: OrderData): Promise<void> => {
    const html = generateOrderHTML(order);

    // Importar html2pdf dinamicamente
    const html2pdf = (await import('html2pdf.js')).default;

    // Criar container temporário para renderizar o HTML
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.width = '210mm'; // A4 width
    container.style.padding = '0';
    container.style.margin = '0';
    container.style.background = 'white';
    document.body.appendChild(container);

    // Configurações do PDF
    const options = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `OS-${order.order_number}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            letterRendering: true,
            windowWidth: 794 // A4 width in pixels at 96dpi
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
        // Gerar e baixar o PDF
        await html2pdf().set(options).from(container).save();
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
        // Limpar container temporário
        document.body.removeChild(container);
    }
};

/**
 * Gera texto resumido da OS para WhatsApp
 */
const generateWhatsAppMessage = (order: OrderData): string => {
    // Calcular total
    let total = order.value || 0;
    if (order.items) {
        try {
            const parsedItems = typeof order.items === 'string'
                ? JSON.parse(order.items)
                : order.items;
            if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                total = parsedItems.reduce((sum: number, i: any) =>
                    sum + ((i.unitPrice || 0) * (i.qty || 1)), 0);
            }
        } catch { }
    }

    // Listar itens
    let itemsList = '';
    if (order.items) {
        try {
            const parsedItems = typeof order.items === 'string'
                ? JSON.parse(order.items)
                : order.items;
            if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                itemsList = '\n\n📦 *Serviços/Peças:*\n' +
                    parsedItems.map((item: any) =>
                        `• ${item.name} (${item.qty}x) - R$ ${((item.unitPrice || 0) * (item.qty || 1)).toFixed(2)}`
                    ).join('\n');
            }
        } catch { }
    }

    const complaint = order.complaint || order.service?.split('\n\nDiagnóstico:')[0] || '';
    const diagnosis = order.diagnosis || order.service?.split('Diagnóstico: ')[1] || '';

    return `🔧 *FMA CENTRO AUTOMOTIVO*
━━━━━━━━━━━━━━━━━━━━━

📋 *ORDEM DE SERVIÇO #OS-${order.order_number}*
📅 Data: ${formatDate(order.created_at)}
📊 Status: ${order.status || 'Pendente'}

🚗 *VEÍCULO*
• Placa: ${order.plate || '-'}
• Modelo: ${order.vehicle || '-'}
${order.km ? `• KM: ${order.km}` : ''}
${complaint ? `\n📝 *Reclamação:*\n${complaint}` : ''}
${diagnosis ? `\n🔍 *Diagnóstico:*\n${diagnosis}` : ''}
${itemsList}

💰 *VALOR TOTAL: R$ ${total.toFixed(2)}*
${(order as any).payment_method ? `💳 Pagamento: ${(order as any).payment_method}` : ''}
${order.delivery_date ? `🗓️ Previsão: ${formatDate(order.delivery_date)}` : ''}
${order.notes ? `\n📌 Obs: ${order.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━
_FMA Centro Automotivo_
_Obrigado pela preferência!_`;
};

/**
 * Envia a OS para o WhatsApp do cliente
 */
export const sendOrderToWhatsApp = (order: OrderData, phoneNumber?: string): void => {
    const phone = phoneNumber || order.client_phone;
    if (!phone) {
        alert('Cliente não possui telefone cadastrado!');
        return;
    }

    // Limpar número de telefone
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    // Gerar mensagem
    const message = generateWhatsAppMessage(order);

    // Codificar para URL
    const encodedMessage = encodeURIComponent(message);

    // Abrir WhatsApp Web
    window.open(`https://wa.me/${fullPhone}?text=${encodedMessage}`, '_blank');
};

/**
 * Componente de ações (para uso inline)
 */
export const OrderActions = {
    print: printOrder,
    download: downloadOrder,
    whatsapp: sendOrderToWhatsApp,
    generateHTML: generateOrderHTML
};

export default OrderActions;
