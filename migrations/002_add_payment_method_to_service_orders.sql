-- Migration: Add payment_method to service_orders
-- Description: Adds a column to store payment method (Credit, Debit, Cash, etc)

ALTER TABLE service_orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Update existing records if needed (optional)
-- UPDATE service_orders SET payment_method = 'Dinheiro' WHERE payment_method IS NULL;
