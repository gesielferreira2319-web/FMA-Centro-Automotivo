-- Migração para adicionar imagens ao estoque e configurar o bucket no Supabase Storage

-- 1. Adicionar a coluna images (array de text) na tabela inventory
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- 2. Inserir o bucket 'inventory_images' se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'inventory_images',
    'inventory_images',
    true, -- Torna o bucket público para facilitar a visualização sem assinar URLs
    5242880, -- 5MB limit por arquivo
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Configurar políticas de acesso ao Storage (Security Rules)
-- Permite leitura pública de qualquer arquivo no bucket
CREATE POLICY "Imagens do estoque são publicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'inventory_images');

-- Permite upload de arquivos autenticados
CREATE POLICY "Upload permitido para usuários autenticados"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'inventory_images' 
    AND auth.role() = 'authenticated'
);

-- Permite deleção/atualização de arquivos autenticados
CREATE POLICY "Update permitido para usuários autenticados"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'inventory_images' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Delete permitido para usuários autenticados"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'inventory_images' 
    AND auth.role() = 'authenticated'
);
