# Vitrine Premium — Chinelos & Roupas (Apple HIG + Criptografia AES-256 + LGPD + Supabase)

Site no formato de **Mostruário Virtual (Vitrine)** para chinelos e roupas, compilado a partir do sistema de design **Apple Human Interface Guidelines (`Apple-Hig-Designer-main`)**, com **Criptografia de Ponta (Web Crypto API AES-256-GCM + PBKDF2 + SHA-256)**, **Conformidade com a LGPD (Lei nº 13.709/2018)** e integração em nuvem com **Supabase**.

---

## Como Abrir / Executar o Site

1. **Abertura Direta:** Basta dar dois cliques no arquivo `index.html` para abrir em qualquer navegador (celular ou computador).
2. **Servidor Local (Opcional):**
   ```powershell
   cd "C:\Users\carlos e kayke\.gemini\antigravity\scratch\vitrine-chinelos-roupas"
   python -m http.server 8080
   ```
   E acesse `http://localhost:8080`.

---

## Como Conectar ao Banco em Nuvem (Supabase)

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No menu lateral do Supabase, clique em **SQL Editor** → **New query**.
3. Copie todo o conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql) (ou copie direto pela aba **☁️ Banco Supabase** dentro do Painel do site) e clique em **Run**.
4. No Supabase, vá em **Project Settings** → **API** e copie a **Project URL** e a **anon public key**.
5. No site, clique no botão **⚙️ Painel** (canto superior direito) → aba **☁️ Banco Supabase**, cole a URL e a Key e clique em **Conectar e Sincronizar Nuvem**.
   - *Nota:* As credenciais são salvas criptografadas com **AES-256-GCM** e o site também funciona com Cofre Local Criptografado caso esteja sem internet.
