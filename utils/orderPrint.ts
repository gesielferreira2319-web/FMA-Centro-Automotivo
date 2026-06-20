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
    additional_vehicle_photos?: string[];
    part_photos?: string[];
    payment_method?: string;
    payment_due_date?: string;
}

export interface BoletoData {
    company_name: string;
    cnpj: string;
    address: string;
    pix_key: string;
    pix_key_type: string;
    pix_qrcode?: string;
    amount: number;
    due_date: string;
    client_name: string;
    client_doc: string;
    description: string;
    created_at: string;
    id: string | number;
    client_phone?: string;
}

const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    // Se for apenas uma data YYYY-MM-DD (sem hora), faz o split para evitar problemas de fuso
    if (dateStr.length === 10 && dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
};

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

/**
 * Gera o HTML do Boleto/Recibo PIX
 */
/**
 * Gera o HTML do Boleto/Recibo PIX
 */
export const generateBoletoHTML = (data: BoletoData, index?: number, total?: number): string => {
    return `
        <div class="boleto-container" style="${index !== undefined && index > 0 ? 'page-break-before: always;' : ''}">
            <div class="header">
                <div class="company-info">
                    <h1>${data.company_name}</h1>
                    <p>${data.cnpj}</p>
                    <p>${data.address}</p>
                </div>
                <div class="doc-title">
                    <h2>Recibo de Pagamento</h2>
                    <p>#${data.id} ${total && total > 1 ? `(${index! + 1}/${total})` : ''}</p>
                </div>
            </div>
            
            <div class="row">
                <div class="col" style="flex: 2">
                    <div class="label">Pagador (Cliente)</div>
                    <div class="value">${data.client_name}</div>
                </div>
                <div class="col">
                    <div class="label">Documento</div>
                    <div class="value">${data.client_doc || '-'}</div>
                </div>
            </div>
            
            <div class="row">
                <div class="col" style="flex: 3">
                    <div class="label">Descrição</div>
                    <div class="value">${data.description}</div>
                </div>
            </div>
            
            <div class="row">
                <div class="col">
                    <div class="label">Data de Emissão</div>
                    <div class="value">${formatDate(data.created_at)}</div>
                </div>
                <div class="col">
                    <div class="label">Vencimento</div>
                    <div class="value" style="color: #d00">${formatDate(data.due_date)}</div>
                </div>
            </div>
            
            <div class="total-box">
                <span class="total-label">Valor da Parcela</span>
                <span class="total-value">${formatCurrency(data.amount)}</span>
            </div>
            
            <div class="pix-box">
                <div class="pix-title">PAGAMENTO VIA PIX</div>
                <p class="pix-inst">Utilize a chave abaixo para realizar o pagamento:</p>
                
                ${data.pix_qrcode ? `
                <div class="pix-qr">
                    <img src="${data.pix_qrcode}" alt="QR Code PIX" />
                </div>
                ` : ''}

                <div class="pix-key">${data.pix_key}</div>
                <p class="pix-inst">Tipo de Chave: <strong>${data.pix_key_type}</strong></p>
                <p style="margin-top: 10px; font-size: 10px;">Após o pagamento, envie o comprovante para facilitar a baixa.</p>
            </div>
            
            <div class="footer">
                Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}.
                Não serve como nota fiscal.
            </div>
        </div>
    `;
}

const getBoletosStyles = () => `
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; }
        body { padding: 40px; max-width: 800px; margin: 0 auto; background: #fff; }
        .boleto-container { border: 2px solid #000; padding: 20px; margin-bottom: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
        .company-info h1 { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
        .company-info p { font-size: 12px; }
        .doc-title { text-align: right; }
        .doc-title h2 { font-size: 24px; font-weight: bold; text-transform: uppercase; }
        .doc-title p { font-size: 14px; font-weight: bold; margin-top: 5px; }
        
        .row { display: flex; margin-bottom: 15px; }
        .col { flex: 1; padding-right: 20px; }
        .label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 3px; }
        .value { font-size: 14px; font-weight: bold; border-bottom: 1px dotted #ccc; padding-bottom: 2px; width: 100%; display: block; }
        
        .pix-box { border: 2px dashed #000; padding: 20px; text-align: center; margin: 30px 0; background: #f9f9f9; }
        .pix-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
        .pix-key { font-size: 20px; font-weight: bold; padding: 10px; background: #fff; border: 1px solid #ddd; margin: 10px 0; word-break: break-all; }
        .pix-inst { font-size: 12px; }
        .pix-qr { margin: 15px auto; max-width: 150px; }
        .pix-qr img { width: 100%; height: auto; border: 1px solid #ddd; padding: 5px; background: #fff; }
        
        .total-box { background: #000; color: #fff; padding: 10px; text-align: right; margin-top: 20px; }
        .total-label { font-size: 12px; text-transform: uppercase; margin-right: 10px; }
        .total-value { font-size: 24px; font-weight: bold; }
        
        .footer { margin-top: 40px; font-size: 10px; text-align: center; border-top: 1px solid #ccc; padding-top: 10px; }
        
        @media print {
            body { padding: 0; }
            .boleto-container { border: 1px solid #000; margin-bottom: 0; height: 100vh; }
        }
    </style>
`;

/**
 * Imprime múltiplos Boletos/Recibos PIX
 */
export const printBoletos = (boletos: BoletoData[]): void => {
    const styles = getBoletosStyles();
    const content = boletos.map((b, i) => generateBoletoHTML(b, i, boletos.length)).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Carnê de Pagamento</title>
            ${styles}
        </head>
        <body>
            ${content}
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
    }
}

/**
 * Mantém compatibilidade com chamada única (depreciado, usar printBoletos)
 */
export const printBoleto = (data: BoletoData): void => {
    printBoletos([data]);
}

/**
 * Faz o download de múltiplos Boletos/Recibos PIX como PDF
 */
export const downloadBoletos = async (boletos: BoletoData[]): Promise<void> => {
    const styles = getBoletosStyles();
    const content = boletos.map((b, i) => generateBoletoHTML(b, i, boletos.length)).join('');

    const html = `
        <div style="width: 210mm;">
            ${styles}
            ${content}
        </div>
    `;

    const html2pdf = (await import('html2pdf.js')).default;

    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.background = 'white';
    document.body.appendChild(container);

    const options = {
        margin: [0, 0, 0, 0] as [number, number, number, number],
        filename: `Boletos_${boletos[0].id}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    try {
        await html2pdf().set(options).from(container).save();
    } catch (error) {
        console.error('Erro ao baixar boletos:', error);
        alert('Erro ao baixar boletos PDF.');
    } finally {
        document.body.removeChild(container);
    }
}

/**
 * Mantém compatibilidade com chamada única
 */
export const downloadBoleto = async (data: BoletoData): Promise<void> => {
    await downloadBoletos([data]);
}

/**
 * Envia dados do Boleto/Pix via WhatsApp
 */
export const sendBoletoToWhatsApp = (data: BoletoData, phoneNumber?: string): void => {
    // Tenta usar o telefone do cliente do objeto data se não passado
    // Como BoletoData não tem client_phone explícito na interface acima, vamos assumir que o caller passa ou que não temos.
    // Update interface above to include client_phone if needed, or pass separately.
    // For now, let's just ask for it or use a fallback if user passes it in data (need to update interface).
    // Let's update interface first in a separate check or just accept it as arg.

    if (!phoneNumber) {
        // Try to find a phone number in client data if we had it, but BoletoData defines strict fields.
        // We will rely on the caller passing it.
        alert('Telefone do cliente necessário para envio.');
        return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const message = `💲 *FMA CENTRO AUTOMOTIVO - COBRANÇA*
━━━━━━━━━━━━━━━━━━━━━
Olá *${data.client_name}*, segue os dados para pagamento:

📄 *Referência:* ${data.description}
💰 *Valor:* ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.amount)}
📅 *Vencimento:* ${new Date(data.due_date).toLocaleDateString('pt-BR')}

🔑 *CHAVE PIX:*
${data.pix_key}
(${data.pix_key_type})

_Copie e cole a chave acima no seu aplicativo de banco._
━━━━━━━━━━━━━━━━━━━━━`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${fullPhone}?text=${encodedMessage}`, '_blank');
}

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

    // Renderizar fotos do veículo e peças
    let attachmentsHtml = '';
    const allPhotos: { title: string, url: string }[] = [];
    if (order.vehicle_photo) {
        allPhotos.push({ title: 'Veículo (Principal)', url: order.vehicle_photo });
    }
    if (order.additional_vehicle_photos && order.additional_vehicle_photos.length > 0) {
        order.additional_vehicle_photos.forEach((url, i) => {
            allPhotos.push({ title: `Veículo (${i + 1})`, url });
        });
    }
    if (order.part_photos && order.part_photos.length > 0) {
        order.part_photos.forEach((url, i) => {
            allPhotos.push({ title: `Peça (${i + 1})`, url });
        });
    }

    if (allPhotos.length > 0) {
        attachmentsHtml = `
            <div class="section" style="page-break-inside: avoid;">
                <div class="section-title">FOTOS EM ANEXO</div>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    ${allPhotos.map(photo => `
                        <div style="width: 48%; margin-bottom: 10px; text-align: center;">
                            <img src="${photo.url}" style="width: 100%; height: 200px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px;" />
                            <div style="font-size: 10px; color: #666; margin-top: 5px;">${photo.title}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

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
                ${order.payment_due_date ? `
                <div class="data-row">
                    <div class="data-label">Vencimento:</div>
                    <div class="data-value" style="color: #d00; font-weight: bold;">${formatDate(order.payment_due_date)}</div>
                </div>
                ` : ''}
            </div>

            ${order.notes ? `
            <div class="section" style="margin-top: 10px; font-size: 10px; color: #666;">
                <strong>Observações:</strong> ${order.notes}
            </div>
            ` : ''}
            
            ${attachmentsHtml}

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

    let photosList = '';
    const allPhotos: { title: string, url: string }[] = [];
    if (order.vehicle_photo) allPhotos.push({ title: 'Veículo (Principal)', url: order.vehicle_photo });
    if (order.additional_vehicle_photos) order.additional_vehicle_photos.forEach((url, i) => allPhotos.push({ title: `Veículo ${i+1}`, url }));
    if (order.part_photos) order.part_photos.forEach((url, i) => allPhotos.push({ title: `Peça ${i+1}`, url }));

    if (allPhotos.length > 0) {
        photosList = '\n\n📸 *FOTOS EM ANEXO:*\n' + allPhotos.map(p => `• ${p.title}: ${p.url}`).join('\n');
    }

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
${photosList}

💰 *VALOR TOTAL: R$ ${total.toFixed(2)}*
${(order as any).payment_method ? `💳 Pagamento: ${(order as any).payment_method}` : ''}
${order.payment_due_date ? `📅 Vencimento: ${formatDate(order.payment_due_date)}` : ''}
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
