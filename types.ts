export interface ServiceOrder {
  id: string;
  plate: string;
  client: string;
  service: string;
  status: 'Em Andamento' | 'Concluído' | 'Aguardando Peças' | 'Pendente';
  value: number;
  date: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unitPrice: number;
  status: 'Estável' | 'Estoque Baixo' | 'Esgotado' | 'Em Estoque';
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  lastVisit: string;
  totalSpent: number;
}

export interface Transaction {
  id: string;
  description: string;
  type: 'income' | 'expense';
  category: string;
  value: number;
  date: string;
}
