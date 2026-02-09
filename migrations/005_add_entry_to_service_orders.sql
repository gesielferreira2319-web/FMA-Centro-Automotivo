-- Migration: Add Entry and Installment fields to service_orders
-- Author: Antigravity
-- Date: 2026-02-09

ALTER TABLE service_orders 
ADD COLUMN IF NOT EXISTS entry_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS entry_method text,
ADD COLUMN IF NOT EXISTS installment_count integer DEFAULT 1;

-- Add comment to explain columns
COMMENT ON COLUMN service_orders.entry_amount IS 'Valor da entrada paga pelo cliente';
COMMENT ON COLUMN service_orders.entry_method IS 'Método de pagamento da entrada (Pix, Dinheiro, etc)';
COMMENT ON COLUMN service_orders.installment_count IS 'Número de parcelas do valor restante';
