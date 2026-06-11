import React, { useState } from 'react';
import { CustomerSelector } from '../components/CustomerSelector';
import { Client } from '../contexts/ClientContext';
import { useInventory, InventoryItem } from '../hooks/useInventory';
import { useSales, CartItem } from '../hooks/useSales';
import { useSettings } from '../hooks/useSettings';
import { printBoleto } from '../utils/orderPrint';

type PaymentMethod = 'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito' | 'PIX' | 'Boleto' | null;

export default function NewPartsSales() {
  const { items: products, loading, fetchItems } = useInventory(false); // Peças novas
  const { createSale, loading: savingSale } = useSales();
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<(CartItem & { name: string })[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [dueDate, setDueDate] = useState('');
  const [saleComplete, setSaleComplete] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: InventoryItem) => {
    if (product.quantity <= 0) return;

    const existing = cart.find(item => item.inventory_id === product.id);
    if (existing) {
      // Verificar se não excede o estoque
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
    if (!paymentMethod || !selectedClient) return;

    if (paymentMethod === 'Boleto' && !dueDate) {
      alert('Selecione a data de vencimento para o boleto.');
      return;
    }

    const sale = await createSale(
      selectedClient.id,
      paymentMethod,
      cart,
      'balcao',
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
          description: 'Venda Balcão (Peças Novas)',
          created_at: new Date().toISOString(),
          id: sale.id
        });
      }
      setSaleComplete(true);
      setTimeout(() => {
        setCart([]);
        setPaymentMethod(null);
        setDueDate('');
        setSelectedClient(null);
        setSaleComplete(false);
        setShowCheckout(false);
        fetchItems(); // Recarregar estoque
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="animate-in fade-in duration-500 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h2 className="text-3xl font-display font-bold text-primary dark:text-white">Venda de Balcão</h2>
        <p className="text-slate-500 dark:text-slate-400">Venda rápida de peças novas do estoque da oficina.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Catálogo */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative">
            <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              placeholder="Buscar peça no estoque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white"
            />
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-12 rounded-2xl text-center">
              <span className="material-icons-round text-6xl text-slate-300 dark:text-slate-600 mb-4">inventory_2</span>
              <p className="text-slate-500">{search ? 'Nenhuma peça encontrada' : 'Nenhuma peça nova cadastrada'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                  <div>
                    {product.images && product.images.length > 0 && (
                      <div className="w-full h-32 mb-4 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0">
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">{product.name}</h3>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${product.quantity === 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                        product.quantity <= 5 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' :
                          'bg-green-100 dark:bg-green-900/30 text-green-600'
                        }`}>
                        Estoque: {product.quantity}
                      </span>
                    </div>
                    {product.sku && <p className="text-xs text-slate-500 mb-2">{product.sku}</p>}
                    <p className="text-2xl font-display font-bold text-primary dark:text-blue-400">R$ {product.unit_price.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.quantity === 0}
                    className="mt-4 w-full py-3 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-icons-round text-lg">add_shopping_cart</span>
                    {product.quantity === 0 ? 'Esgotado' : 'Adicionar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Carrinho */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 h-fit sticky top-8">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-icons-round text-primary">shopping_cart</span>
            Carrinho ({cart.length})
          </h3>

          {/* Seletor de Cliente */}
          <div className="mb-4">
            <CustomerSelector
              selectedClient={selectedClient}
              onSelectClient={setSelectedClient}
            />
          </div>

          {cart.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <span className="material-icons-round text-4xl mb-2">remove_shopping_cart</span>
              <p className="text-sm">Carrinho vazio</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                {cart.map((item) => (
                  <div key={item.inventory_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-white text-sm truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">R$ {item.unit_price.toFixed(2)} cada</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.inventory_id, -1)} className="w-6 h-6 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-300">-</button>
                      <span className="w-6 text-center font-bold text-slate-800 dark:text-white text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.inventory_id, 1)} className="w-6 h-6 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-300">+</button>
                      <button onClick={() => removeFromCart(item.inventory_id)} className="ml-2 text-red-400 hover:text-red-600">
                        <span className="material-icons-round text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-500">Total</span>
                  <span className="text-2xl font-display font-bold text-primary dark:text-blue-400">R$ {total.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setShowCheckout(true)}
                  disabled={!selectedClient}
                  className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-icons-round">point_of_sale</span>
                  {selectedClient ? 'Finalizar Venda' : 'Selecione um Cliente'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Checkout */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {saleComplete ? (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                  <span className="material-icons-round text-green-600 text-4xl">check_circle</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Venda Concluída!</h3>
                <p className="text-slate-500">Registro salvo com sucesso.</p>
              </div>
            ) : (
              <>
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Pagamento</h3>
                    <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-slate-600">
                      <span className="material-icons-round">close</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto grow">
                  {selectedClient && (
                    <div className="mb-4 p-3 bg-primary/10 rounded-xl">
                      <p className="text-xs text-slate-500">Cliente</p>
                      <p className="font-bold text-slate-800 dark:text-white">{selectedClient.name}</p>
                    </div>
                  )}

                  <p className="text-sm font-bold text-slate-500 mb-3 uppercase">Forma de Pagamento</p>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {(['Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Boleto'] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === method
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/50'
                          }`}
                      >
                        <span className="material-icons-round">
                          {method === 'Dinheiro' ? 'payments' : method === 'PIX' ? 'qr_code' : method === 'Boleto' ? 'request_quote' : 'credit_card'}
                        </span>
                        <span className="text-xs font-bold">{method}</span>
                      </button>
                    ))}
                  </div>

                  {paymentMethod === 'Boleto' && (
                    <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Data de Vencimento</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none text-slate-800 dark:text-slate-200"
                        required
                      />
                      <p className="text-[10px] text-slate-400 mt-1">O boleto será gerado com a chave PIX configurada.</p>
                    </div>
                  )}

                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Total a Pagar</span>
                      <span className="text-3xl font-display font-bold text-primary">R$ {total.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleFinalizeSale}
                    disabled={!paymentMethod || savingSale}
                    className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingSale ? (
                      <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Processando...</>
                    ) : (
                      <><span className="material-icons-round">check</span>Confirmar Pagamento</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}