-- Migration: Add installments_paid field to service_orders
-- Author: Antigravity
-- Date: 2026-02-09

ALTER TABLE service_orders 
ADD COLUMN IF NOT EXISTS installments_paid integer DEFAULT 0;

-- Add comment to explain column
COMMENT ON COLUMN service_orders.installments_paid IS 'Número de parcelas já pagas';
