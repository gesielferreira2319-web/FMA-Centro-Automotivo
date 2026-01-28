import React, { useState } from 'react';
import { CustomerSelector } from './CustomerSelector'; // Assuming it's in components folder
import { Client } from '../contexts/ClientContext';
import { useInventory, InventoryItem } from '../hooks/useInventory';
import { useSales, CartItem } from '../hooks/useSales';
import { useSettings } from '../hooks/useSettings';
import { printBoleto } from '../utils/orderPrint';

type PaymentMethod = 'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito' | 'PIX' | 'Boleto' | null;

interface UsedPartsSalesProps {
    onClose: () => void;
    onSaleComplete?: () => void;
    isStandalone?: boolean;
}

export const UsedPartsSales: React.FC<UsedPartsSalesProps> = ({ onClose, onSaleComplete, isStandalone = false }) => {
    const { items: products, loading, fetchItems } = useInventory(true); // Peças usadas (Desmanche)
    const { createSale, loading: savingSale } = useSales();
    const { settings } = useSettings();
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<(CartItem & { name: string })[]>([]);
    // removed showCheckout state
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
    const [dueDate, setDueDate] = useState('');
    const [saleComplete, setSaleComplete] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.origin_vehicle?.toLowerCase().includes(search.toLowerCase())
    );

    const addToCart = (product: InventoryItem) => {
        if (product.quantity <= 0) return;

        const existing = cart.find(item => item.inventory_id === product.id);
        if (existing) {
            if (existing.quantity >= product.quantity) return;
            setCart(cart.map(item =>
                item.inventory_id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                inventory_id: product.id,
                name: product.name,
                unit_price: product.unit_price,
                quantity: 1
            }]);
        }
    };

    const updateQuantity = (inventoryId: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.inventory_id === inventoryId) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const removeFromCart = (inventoryId: string) => {
        setCart(cart.filter(item => item.inventory_id !== inventoryId));
    };

    const total = cart.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);

    const handleFinalizeSale = async () => {
        if (!paymentMethod || !selectedClient) {
            alert('Selecione um cliente e uma forma de pagamento.');
            return;
        }

        if (paymentMethod === 'Boleto' && !dueDate) {
            alert('Selecione a data de vencimento para o boleto.');
            return;
        }

        const sale = await createSale(
            selectedClient.id,
            paymentMethod,
            cart,
            'desmanche',
            paymentMethod === 'Boleto' ? 'pendente' : 'pago',
            paymentMethod === 'Boleto' ? dueDate : null
        );

        if (sale) {
            if (paymentMethod === 'Boleto') {
                printBoleto({
                    company_name: settings.company_name,
                    cnpj: settings.cnpj,
                    address: settings.address,
                    pix_key: settings.pix_key || 'Chave não configurada',
                    pix_key_type: settings.pix_key_type || 'CPF',
                    amount: total,
                    due_date: dueDate,
                    client_name: selectedClient.name,
                    client_doc: selectedClient.cpf_cnpj || 'Não informado',
                    description: 'Venda Balcão (Peças Usadas)',
                    created_at: new Date().toISOString(),
                    id: sale.id,
                    pix_qrcode: settings.pix_qrcode
                });
            }

            setSaleComplete(true);
            setTimeout(() => {
                setCart([]);
                setPaymentMethod(null);
                setDueDate('');
                setSelectedClient(null);
                setSaleComplete(false);
                fetchItems();
                if (onSaleComplete) onSaleComplete();
                onClose(); // Optional: Close modal after sale
            }, 2000);
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando estoque de desmanche...</div>;

    const paymentOptions: { method: PaymentMethod, icon: string, label: string }[] = [
        { method: 'Dinheiro', icon: 'payments', label: 'Dinheiro' },
        { method: 'PIX', icon: 'qr_code_2', label: 'PIX' },
        { method: 'Cartão de Crédito', icon: 'credit_card', label: 'Crédito' },
        { method: 'Cartão de Débito', icon: 'credit_card', label: 'Débito' },
        { method: 'Boleto', icon: 'request_quote', label: 'Boleto' },
    ];

    return (
        <div className={`bg-white dark:bg-slate-800 w-full flex flex-col overflow-hidden transition-all ${isStandalone
            ? 'h-[calc(100vh-10rem)] shadow-none rounded-none'
            : 'max-w-6xl h-[90vh] rounded-2xl shadow-2xl animate-in zoom-in-95'
            }`}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-icons-round text-primary">recycling</span>
                        Venda de Peças Usadas (Desmanche)
                    </h2>
                    <p className="text-slate-500 text-sm">Selecione peças do estoque de desmanche para vender.</p>
                </div>
                {!isStandalone && (
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition">
                        <span className="material-icons-round text-slate-500">close</span>
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">
                {/* Left: Catalog */}
                <div className="lg:col-span-2 p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="relative mb-6">
                        <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar peça, SKU ou veículo de origem..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary outline-none dark:text-white"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredProducts.map(product => (
                            <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                disabled={product.quantity === 0}
                                className="text-left bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition group relative overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{product.name}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${product.quantity === 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                        }`}>
                                        Qtd: {product.quantity}
                                    </span>
                                </div>
                                {product.origin_vehicle && (
                                    <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                                        <span className="material-icons-round text-[12px]">directions_car</span>
                                        {product.origin_vehicle}
                                    </div>
                                )}
                                <div className="font-bold text-primary dark:text-blue-400 text-lg">
                                    R$ {product.unit_price.toFixed(2)}
                                </div>
                                {product.quantity > 0 && <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Cart & Checkout (Unified) */}
                <div className="bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col h-full min-h-0">
                    {/* Cart Header */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
                        <h3 className="font-bold text-lg flex items-center gap-2 dark:text-white">
                            <span className="material-icons-round">shopping_cart</span>
                            Carrinho
                        </h3>
                    </div>

                    {/* Scrollable Cart Items */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0 bg-slate-50/30 dark:bg-slate-900/10">
                        {cart.length === 0 ? (
                            <div className="text-center text-slate-400 py-10 flex flex-col items-center">
                                <span className="material-icons-round text-4xl mb-2 text-slate-300">remove_shopping_cart</span>
                                Carrinho vazio
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.inventory_id} className="flex justify-between items-center p-2 bg-white dark:bg-slate-700/50 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
                                    <div className="truncate flex-1 mr-2">
                                        <div className="text-sm font-medium dark:text-slate-200">{item.name}</div>
                                        <div className="text-xs text-slate-500">R$ {item.unit_price.toFixed(2)}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => updateQuantity(item.inventory_id, -1)} className="w-5 h-5 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 rounded flex items-center justify-center text-xs transition">-</button>
                                        <span className="text-xs font-bold w-4 text-center dark:text-white">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.inventory_id, 1)} className="w-5 h-5 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 rounded flex items-center justify-center text-xs transition">+</button>
                                        <button onClick={() => removeFromCart(item.inventory_id)} className="text-slate-400 hover:text-red-500 ml-1 transition">
                                            <span className="material-icons-round text-xs">close</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Fixed Checkout Footer */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10 shrink-0">

                        {/* Total */}
                        <div className="flex justify-between items-end mb-3">
                            <span className="text-slate-500 text-sm">Total a pagar</span>
                            <span className="text-2xl font-bold text-slate-800 dark:text-white">R$ {total.toFixed(2)}</span>
                        </div>

                        {/* Customer & Payment */}
                        <div className="space-y-3 mb-3">
                            <div className="text-sm">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cliente</label>
                                <CustomerSelector selectedClient={selectedClient} onSelectClient={setSelectedClient} />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Forma de Pagamento</label>
                                <div className="grid grid-cols-5 gap-1">
                                    {paymentOptions.map((opt) => (
                                        <button
                                            key={opt.method}
                                            onClick={() => setPaymentMethod(opt.method)}
                                            title={opt.label}
                                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all h-full ${paymentMethod === opt.method
                                                ? 'bg-primary text-white border-primary shadow-sm transform scale-[1.02]'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            <span className="material-icons-round text-lg mb-0.5">{opt.icon}</span>
                                            <span className="text-[9px] font-bold leading-none text-center">{opt.label.split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>

                                {paymentMethod === 'Boleto' && (
                                    <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data de Vencimento</label>
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                            required
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">O boleto será gerado com a chave PIX configurada.</p>
                                    </div>
                                )}

                            </div>
                        </div>

                        <button
                            onClick={handleFinalizeSale}
                            disabled={cart.length === 0 || !selectedClient || !paymentMethod || savingSale}
                            className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 text-sm"
                        >
                            {savingSale ? (
                                <>
                                    <span className="material-icons-round animate-spin text-sm">refresh</span>
                                    Processando...
                                </>
                            ) : (
                                <>
                                    <span className="material-icons-round text-sm">check_circle</span>
                                    Finalizar Venda
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
