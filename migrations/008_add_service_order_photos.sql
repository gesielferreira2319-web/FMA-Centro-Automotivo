-- Adiciona colunas para suportar múltiplas fotos de veículos e peças nas ordens de serviço
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS additional_vehicle_photos text[] DEFAULT '{}';
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS part_photos text[] DEFAULT '{}';
