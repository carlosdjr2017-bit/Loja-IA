-- ============================================================================
-- VITRINE PREMIUM (CHINELOS & ROUPAS) - SUPABASE SCHEMA + RLS + LGPD
-- ============================================================================
-- Como usar:
-- 1. Acesse seu projeto no Supabase (https://supabase.com/dashboard)
-- 2. Abra o menu "SQL Editor" -> "New query"
-- 3. Cole este script inteiro e clique em "Run"
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela de Configurações Personalizáveis da Loja
CREATE TABLE IF NOT EXISTS public.store_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  store_name TEXT NOT NULL DEFAULT 'Vitrine Premium',
  store_subtitle TEXT NOT NULL DEFAULT 'Chinelos & Roupas Exclusivas',
  logo_url TEXT DEFAULT '',
  hero_badge TEXT DEFAULT 'Coleção Exclusiva • Atendimento Rápido',
  hero_title TEXT DEFAULT 'Estilo e conforto no seu passo.',
  hero_description TEXT DEFAULT 'Escolha suas peças favoritas na vitrine, selecione sua numeração ou tamanho e confirme tudo direto pelo WhatsApp.',
  whatsapp_number TEXT NOT NULL DEFAULT '',
  whatsapp_greeting TEXT DEFAULT 'Olá! Vi a vitrine online e gostaria de confirmar meu pedido:',
  instagram_url TEXT DEFAULT '',
  store_hours TEXT DEFAULT 'Seg a Sáb • 09h às 19h',
  store_city TEXT DEFAULT 'Enviamos para toda a região',
  accent_color TEXT NOT NULL DEFAULT '#007AFF',
  show_prices BOOLEAN NOT NULL DEFAULT true,
  allow_multiple_items BOOLEAN NOT NULL DEFAULT true,
  dpo_contact TEXT NOT NULL DEFAULT 'privacidade@vitrine.com.br',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.store_settings (id, store_name, store_subtitle, whatsapp_number, accent_color, show_prices, allow_multiple_items)
VALUES ('default', 'Vitrine Premium', 'Chinelos & Roupas Exclusivas', '', '#007AFF', true, true)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de Produtos (Catálogo da Vitrine)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('chinelos', 'roupas')),
  description TEXT DEFAULT '',
  price NUMERIC(10, 2) DEFAULT NULL,
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Logs de Consentimento LGPD (Anonimizada por SHA-256)
CREATE TABLE IF NOT EXISTS public.lgpd_consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'pre_checkin_whatsapp',
  policy_version TEXT NOT NULL DEFAULT '1.0.0',
  encryption_cipher TEXT NOT NULL DEFAULT 'AES-256-GCM + SHA-256',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ============================================================================

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_consent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica de configuracoes" ON public.store_settings;
CREATE POLICY "Leitura publica de configuracoes"
  ON public.store_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Atualizacao de configuracoes pelo painel" ON public.store_settings;
CREATE POLICY "Atualizacao de configuracoes pelo painel"
  ON public.store_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Leitura publica de produtos" ON public.products;
CREATE POLICY "Leitura publica de produtos"
  ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gerenciamento de produtos pelo painel" ON public.products;
CREATE POLICY "Gerenciamento de produtos pelo painel"
  ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Insercao de comprovante LGPD" ON public.lgpd_consent_logs;
CREATE POLICY "Insercao de comprovante LGPD"
  ON public.lgpd_consent_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Leitura de comprovantes LGPD" ON public.lgpd_consent_logs;
CREATE POLICY "Leitura de comprovantes LGPD"
  ON public.lgpd_consent_logs FOR SELECT USING (true);
