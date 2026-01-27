-- =====================================================
-- MIGRAÇÃO: Adicionar campos de custo e fornecedor
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- 1. Adicionar campos de custo e fornecedor na tabela inventory
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier_name TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS due_date DATE;

-- 2. Criar tabela de pagamentos a fornecedores
CREATE TABLE IF NOT EXISTS supplier_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
    supplier_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pendente',
    payment_type TEXT NOT NULL DEFAULT 'a_vista',
    due_date DATE,
    paid_date DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar índices para otimização
CREATE INDEX IF NOT EXISTS idx_supplier_payments_status ON supplier_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_due_date ON supplier_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_inventory_payment_status ON inventory(payment_status);

-- 4. Habilitar RLS na nova tabela
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- 5. Política de acesso para usuários autenticados
DROP POLICY IF EXISTS "Allow all for authenticated users" ON supplier_payments;
CREATE POLICY "Allow all for authenticated users" ON supplier_payments
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Política pública (caso necessário para desenvolvimento)
DROP POLICY IF EXISTS "Allow public access" ON supplier_payments;
CREATE POLICY "Allow public access" ON supplier_payments
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);
