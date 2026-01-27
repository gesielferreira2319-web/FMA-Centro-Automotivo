-- Migration: Add payment_status to service_orders
-- Description: Adds a column to track if the payment has been received (pago) or is pending (pendente)

ALTER TABLE service_orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendente'; 
-- Values: 'pendente', 'pago'

-- Optional: Update existing 'Concluído' orders to 'pago' if payment_method is present and immediate
UPDATE service_orders 
SET payment_status = 'pago' 
WHERE status = 'Concluído' 
AND (payment_method IN ('Dinheiro', 'PIX', 'Cartão de Débito') OR payment_method IS NOT NULL);
