-- =====================================================
-- MIGRAÇÃO: Criar tabela de Contas a Pagar
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- Criar tabela de contas a pagar
CREATE TABLE IF NOT EXISTS accounts_payable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    supplier_name TEXT,
    supplier_phone TEXT,
    payment_type TEXT NOT NULL DEFAULT 'a_vista',
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pendente',
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para otimização
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON accounts_payable(status);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_due_date ON accounts_payable(due_date);

-- Habilitar RLS
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;

-- Política de acesso para usuários autenticados
DROP POLICY IF EXISTS "Allow all for authenticated users" ON accounts_payable;
CREATE POLICY "Allow all for authenticated users" ON accounts_payable
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Política pública (para desenvolvimento)
DROP POLICY IF EXISTS "Allow public access" ON accounts_payable;
CREATE POLICY "Allow public access" ON accounts_payable
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);
