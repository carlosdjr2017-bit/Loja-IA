/**
 * ============================================================================
 * CAMADA DE INTEGRAÇÃO EM NUVEM: FIREBASE FIRESTORE + SUPABASE + COFRE LOCAL
 * ============================================================================
 * Suporta:
 * 1. Firebase Cloud Firestore (via REST API oficial v1 — zero configuração complexa,
 *    basta informar o Project ID e Web API Key no Painel do Administrador).
 * 2. Supabase Cloud (PostgreSQL + RLS).
 * 3. Cofre Local Criptografado (AES-256-GCM) — funciona mesmo offline e sincroniza
 *    automaticamente com o Firebase ou Supabase assim que conectado.
 */

const SupabaseService = (() => {
  const SUPABASE_CONFIG_KEY = 'hig_supabase_credentials_enc';
  const FIREBASE_CONFIG_KEY = 'hig_firebase_credentials_enc';
  const LOCAL_PRODUCTS_KEY = 'hig_catalog_products_enc';
  const LOCAL_SETTINGS_KEY = 'hig_store_settings_enc';
  const LOCAL_LGPD_LOGS_KEY = 'hig_lgpd_audit_logs_enc';

  let supabaseClient = null;
  let currentConfig = { url: '', anonKey: '' };
  let firebaseConfig = {
    projectId: 'vitrine-loja-fb269',
    apiKey: 'AIzaSyCrFteCZ4kNTqiDVZq52KF72GG08P-drOo'
  };

  const DEFAULT_SETTINGS = {
    id: 'default',
    store_name: 'Vitrine Premium',
    store_subtitle: 'Chinelos & Roupas Exclusivas',
    logo_url: '',
    hero_badge: 'Coleção Exclusiva • Atendimento Rápido',
    hero_title: 'Estilo e conforto no seu passo.',
    hero_description: 'Escolha suas peças favoritas na vitrine, selecione sua numeração ou tamanho e confirme tudo direto pelo WhatsApp.',
    whatsapp_number: '',
    whatsapp_greeting: 'Olá! Vi a vitrine online e gostaria de confirmar meu pedido:',
    instagram_url: '',
    store_hours: 'Seg a Sáb • 09h às 19h',
    store_city: 'Atendimento e entrega rápida',
    accent_color: '#007AFF',
    show_prices: true,
    allow_multiple_items: true,
    dpo_contact: 'privacidade@loja.com.br'
  };

  /**
   * Inicializa conexões salvas (Firebase ou Supabase) descriptografando com AES-256-GCM
   */
  async function init() {
    const savedFb = await window.CryptoEngine.getSecureStorage(FIREBASE_CONFIG_KEY, null);
    if (savedFb && savedFb.projectId && savedFb.apiKey) {
      firebaseConfig = savedFb;
    }

    const savedSup = await window.CryptoEngine.getSecureStorage(SUPABASE_CONFIG_KEY, null);
    if (savedSup && savedSup.url && savedSup.anonKey) {
      currentConfig = savedSup;
      connectClient(savedSup.url, savedSup.anonKey);
    }

    return isConnected() || isFirebaseConnected();
  }

  // ==========================================================================
  // HELPERS FIREBASE FIRESTORE REST API (CONVERSÃO JSON <-> FIRESTORE FIELDS)
  // ==========================================================================

  function isFirebaseConnected() {
    return Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
  }

  function getFirebaseCredentials() {
    return { ...firebaseConfig, connected: isFirebaseConnected() };
  }

  function getFirestoreBaseUrl() {
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId.trim())}/databases/(default)/documents`;
  }

  function toFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') return { doubleValue: val };
    if (Array.isArray(val)) {
      return { arrayValue: { values: val.map(toFirestoreValue) } };
    }
    if (typeof val === 'object') {
      const fields = {};
      Object.keys(val).forEach(k => { fields[k] = toFirestoreValue(val[k]); });
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  }

  function fromFirestoreValue(fieldObj) {
    if (!fieldObj) return null;
    if ('stringValue' in fieldObj) return fieldObj.stringValue;
    if ('booleanValue' in fieldObj) return Boolean(fieldObj.booleanValue);
    if ('integerValue' in fieldObj) return Number(fieldObj.integerValue);
    if ('doubleValue' in fieldObj) return Number(fieldObj.doubleValue);
    if ('nullValue' in fieldObj) return null;
    if ('arrayValue' in fieldObj) {
      return (fieldObj.arrayValue.values || []).map(fromFirestoreValue);
    }
    if ('mapValue' in fieldObj) {
      return fromFirestoreDoc({ fields: fieldObj.mapValue.fields || {} });
    }
    return null;
  }

  function toFirestoreDoc(obj) {
    const fields = {};
    Object.keys(obj).forEach(k => {
      fields[k] = toFirestoreValue(obj[k]);
    });
    return { fields };
  }

  function fromFirestoreDoc(doc) {
    if (!doc || !doc.fields) return null;
    const obj = {};
    Object.keys(doc.fields).forEach(k => {
      obj[k] = fromFirestoreValue(doc.fields[k]);
    });
    return obj;
  }

  async function saveFirebaseCredentials(projectId, apiKey) {
    if (!projectId || !apiKey) {
      firebaseConfig = { projectId: '', apiKey: '' };
      localStorage.removeItem(FIREBASE_CONFIG_KEY);
      return { ok: true, mode: 'local' };
    }

    firebaseConfig = {
      projectId: projectId.trim(),
      apiKey: apiKey.trim()
    };
    await window.CryptoEngine.setSecureStorage(FIREBASE_CONFIG_KEY, firebaseConfig);

    try {
      const testUrl = `${getFirestoreBaseUrl()}/store_settings/default?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
      const res = await fetch(testUrl);
      if (res.status === 403 || res.status === 400) {
        const errData = await res.json().catch(() => ({}));
        return {
          ok: false,
          message: `Verifique se o Firestore Database está ativado e com as Regras publicadas (${errData.error?.message || res.status}).`
        };
      }
      await syncLocalToFirebase();
      return { ok: true, mode: 'firebase' };
    } catch (err) {
      return {
        ok: false,
        message: `Erro ao conectar ao Firebase: ${err.message}`
      };
    }
  }

  async function syncLocalToFirebase() {
    if (!isFirebaseConnected()) return;
    try {
      const localSettings = await window.CryptoEngine.getSecureStorage(LOCAL_SETTINGS_KEY, DEFAULT_SETTINGS);
      await fetch(`${getFirestoreBaseUrl()}/store_settings/default?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toFirestoreDoc(localSettings))
      });

      const localProducts = await window.CryptoEngine.getSecureStorage(LOCAL_PRODUCTS_KEY, []);
      for (const prod of localProducts) {
        await fetch(`${getFirestoreBaseUrl()}/products/${encodeURIComponent(prod.id)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toFirestoreDoc(prod))
        });
      }
    } catch (err) {
      console.warn('[FirebaseSync] Aviso na sincronização inicial:', err);
    }
  }

  // ==========================================================================
  // CONEXÃO SUPABASE
  // ==========================================================================

  function connectClient(url, anonKey) {
    try {
      const cleanUrl = url.trim().replace(/\/$/, '');
      const cleanKey = anonKey.trim();
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(cleanUrl, cleanKey, {
          auth: { persistSession: true }
        });
      }
      currentConfig = { url: cleanUrl, anonKey: cleanKey };
      return true;
    } catch (err) {
      supabaseClient = null;
      return false;
    }
  }

  function isConnected() {
    return Boolean(supabaseClient && currentConfig.url && currentConfig.anonKey);
  }

  function getCredentials() {
    return { ...currentConfig, connected: isConnected() };
  }

  async function saveCredentials(url, anonKey) {
    if (!url || !anonKey) {
      supabaseClient = null;
      currentConfig = { url: '', anonKey: '' };
      localStorage.removeItem(SUPABASE_CONFIG_KEY);
      return { ok: true, mode: 'local' };
    }

    connectClient(url, anonKey);
    await window.CryptoEngine.setSecureStorage(SUPABASE_CONFIG_KEY, currentConfig);

    try {
      const { error } = await supabaseClient.from('store_settings').select('id').limit(1);
      if (error) {
        return {
          ok: false,
          connected: true,
          needsSchema: true,
          message: `Conectado ao Supabase, mas falta rodar o Script SQL (${error.message}).`
        };
      }
      await syncLocalToCloud();
      return { ok: true, mode: 'cloud' };
    } catch (err) {
      return {
        ok: false,
        connected: false,
        message: `Não foi possível alcançar o Supabase: ${err.message}`
      };
    }
  }

  async function syncLocalToCloud() {
    if (!isConnected()) return;
    try {
      const localSettings = await window.CryptoEngine.getSecureStorage(LOCAL_SETTINGS_KEY, null);
      if (localSettings) {
        await supabaseClient.from('store_settings').upsert({
          ...DEFAULT_SETTINGS,
          ...localSettings,
          id: 'default',
          updated_at: new Date().toISOString()
        });
      }

      const localProducts = await window.CryptoEngine.getSecureStorage(LOCAL_PRODUCTS_KEY, []);
      if (Array.isArray(localProducts) && localProducts.length > 0) {
        for (const prod of localProducts) {
          await supabaseClient.from('products').upsert({
            ...prod,
            updated_at: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.warn('[SupabaseService] Aviso na sincronização:', err);
    }
  }

  // ==========================================================================
  // OPERAÇÕES DE DADOS UNIFICADAS (FIREBASE -> SUPABASE -> COFRE LOCAL AES-256)
  // ==========================================================================

  async function getSettings() {
    // 1. Tenta Firebase Firestore se conectado
    if (isFirebaseConnected()) {
      try {
        const res = await fetch(`${getFirestoreBaseUrl()}/store_settings/default?key=${encodeURIComponent(firebaseConfig.apiKey)}`);
        if (res.ok) {
          const doc = await res.json();
          const parsed = fromFirestoreDoc(doc);
          if (parsed) {
            const merged = { ...DEFAULT_SETTINGS, ...parsed };
            await window.CryptoEngine.setSecureStorage(LOCAL_SETTINGS_KEY, merged);
            return merged;
          }
        }
      } catch (err) {
        console.warn('[Firebase] Usando cache local criptografado:', err);
      }
    }

    // 2. Tenta Supabase se conectado
    if (isConnected()) {
      try {
        const { data, error } = await supabaseClient
          .from('store_settings')
          .select('*')
          .eq('id', 'default')
          .maybeSingle();

        if (!error && data) {
          const merged = { ...DEFAULT_SETTINGS, ...data };
          await window.CryptoEngine.setSecureStorage(LOCAL_SETTINGS_KEY, merged);
          return merged;
        }
      } catch (err) {
        console.warn('[Supabase] Usando cache local criptografado:', err);
      }
    }

    const local = await window.CryptoEngine.getSecureStorage(LOCAL_SETTINGS_KEY, DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...local };
  }

  async function updateSettings(newSettings) {
    const merged = {
      ...DEFAULT_SETTINGS,
      ...newSettings,
      id: 'default',
      updated_at: new Date().toISOString()
    };

    await window.CryptoEngine.setSecureStorage(LOCAL_SETTINGS_KEY, merged);

    if (isFirebaseConnected()) {
      await fetch(`${getFirestoreBaseUrl()}/store_settings/default?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toFirestoreDoc(merged))
      });
    }

    if (isConnected()) {
      const { error } = await supabaseClient.from('store_settings').upsert(merged);
      if (error) throw new Error(`Erro ao salvar no Supabase: ${error.message}`);
    }

    return merged;
  }

  async function getProducts() {
    // 1. Tenta Firebase Firestore se conectado
    if (isFirebaseConnected()) {
      try {
        const res = await fetch(`${getFirestoreBaseUrl()}/products?key=${encodeURIComponent(firebaseConfig.apiKey)}`);
        if (res.ok) {
          const data = await res.json();
          const docs = (data.documents || []).map(fromFirestoreDoc).filter(Boolean);
          docs.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
          await window.CryptoEngine.setSecureStorage(LOCAL_PRODUCTS_KEY, docs);
          return docs;
        }
      } catch (err) {
        console.warn('[Firebase] Usando produtos locais criptografados:', err);
      }
    }

    // 2. Tenta Supabase se conectado
    if (isConnected()) {
      try {
        const { data, error } = await supabaseClient
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          await window.CryptoEngine.setSecureStorage(LOCAL_PRODUCTS_KEY, data);
          return data;
        }
      } catch (err) {
        console.warn('[Supabase] Usando produtos locais criptografados:', err);
      }
    }

    const localProducts = await window.CryptoEngine.getSecureStorage(LOCAL_PRODUCTS_KEY, []);
    return Array.isArray(localProducts) ? localProducts : [];
  }

  async function saveProduct(productData) {
    const products = await getProducts();
    const isEdit = Boolean(productData.id);
    const now = new Date().toISOString();

    const normalizedProduct = {
      id: productData.id || crypto.randomUUID(),
      name: window.CryptoEngine.sanitizeInput(productData.name),
      category: productData.category === 'roupas' ? 'roupas' : 'chinelos',
      description: window.CryptoEngine.sanitizeInput(productData.description || ''),
      price: productData.price !== null && productData.price !== '' && !isNaN(Number(productData.price))
        ? Number(productData.price)
        : null,
      sizes: Array.isArray(productData.sizes) ? productData.sizes : [],
      images: Array.isArray(productData.images) && productData.images.length > 0 ? productData.images : [],
      active: productData.active !== false,
      created_at: productData.created_at || now,
      updated_at: now
    };

    const updatedList = isEdit
      ? products.map(p => (p.id === normalizedProduct.id ? normalizedProduct : p))
      : [normalizedProduct, ...products];

    await window.CryptoEngine.setSecureStorage(LOCAL_PRODUCTS_KEY, updatedList);

    if (isFirebaseConnected()) {
      await fetch(`${getFirestoreBaseUrl()}/products/${encodeURIComponent(normalizedProduct.id)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toFirestoreDoc(normalizedProduct))
      });
    }

    if (isConnected()) {
      const { error } = await supabaseClient.from('products').upsert(normalizedProduct);
      if (error) throw new Error(`Erro ao salvar produto no Supabase: ${error.message}`);
    }

    return normalizedProduct;
  }

  async function deleteProduct(productId) {
    const products = await getProducts();
    const filtered = products.filter(p => p.id !== productId);
    await window.CryptoEngine.setSecureStorage(LOCAL_PRODUCTS_KEY, filtered);

    if (isFirebaseConnected()) {
      await fetch(`${getFirestoreBaseUrl()}/products/${encodeURIComponent(productId)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
        method: 'DELETE'
      });
    }

    if (isConnected()) {
      const { error } = await supabaseClient.from('products').delete().eq('id', productId);
      if (error) throw new Error(`Erro ao excluir no Supabase: ${error.message}`);
    }

    return true;
  }

  async function recordLgpdConsent(consentHash, purpose = 'pre_checkin_whatsapp') {
    const entry = {
      id: crypto.randomUUID(),
      consent_hash: consentHash,
      purpose,
      policy_version: '1.0.0',
      encryption_cipher: 'AES-256-GCM + SHA-256',
      created_at: new Date().toISOString()
    };

    const logs = await window.CryptoEngine.getSecureStorage(LOCAL_LGPD_LOGS_KEY, []);
    logs.unshift(entry);
    await window.CryptoEngine.setSecureStorage(LOCAL_LGPD_LOGS_KEY, logs.slice(0, 100));

    if (isFirebaseConnected()) {
      try {
        await fetch(`${getFirestoreBaseUrl()}/lgpd_consent_logs/${encodeURIComponent(entry.id)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toFirestoreDoc(entry))
        });
      } catch (err) {
        console.warn('[Firebase] Log LGPD mantido localmente:', err);
      }
    }

    if (isConnected()) {
      try {
        await supabaseClient.from('lgpd_consent_logs').insert(entry);
      } catch (err) {
        console.warn('[Supabase] Log LGPD mantido localmente:', err);
      }
    }

    return entry;
  }

  return {
    init,
    isConnected,
    getCredentials,
    saveCredentials,
    isFirebaseConnected,
    getFirebaseCredentials,
    saveFirebaseCredentials,
    syncLocalToCloud,
    getSettings,
    updateSettings,
    getProducts,
    saveProduct,
    deleteProduct,
    recordLgpdConsent
  };
})();

window.SupabaseService = SupabaseService;
