/**
 * ============================================================================
 * VITRINE PREMIUM - APPLE HIG + LIQUID GLASS + PAINEL ADMIN PROTEGIDO POR SENHA
 * ============================================================================
 * 1. Visão do Comprador Limpa: Apenas vitrine, seleção de tamanhos/itens,
 *    pré-check-in simples (Nome, Telefone, Endereço) e redirecionamento ao WhatsApp.
 * 2. Painel do Administrador Exclusivo com Senha Obrigatória (SHA-256 + AES-256-GCM):
 *    Somente o administrador com senha entra para cadastrar produtos, gerenciar o
 *    WhatsApp e personalizar cada detalhe da loja de forma 100% visual e intuitiva.
 * 3. Apple Liquid Glass (iOS/macOS 26 & 27):
 *    - Minimização inteligente da barra de navegação no scroll
 *    - Controles translúcidos com brilho especular na camada de navegação
 *    - Geometria concêntrica nos cards de produto (24px externo / 16px interno)
 */

const App = (() => {
  const ADMIN_PIN_HASH_KEY = 'hig_admin_pin_sha256';
  const LGPD_CONSENT_STATE_KEY = 'hig_lgpd_banner_accepted';
  const SAVED_CHECKIN_USER_KEY = 'hig_encrypted_checkin_profile';

  let state = {
    settings: {
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
    },
    products: [], // Começa sem produtos cadastrados conforme briefing
    activeCategory: 'todos',
    searchQuery: '',
    selectedSizes: {},
    activeImageIndex: {},
    bag: [],
    adminUnlocked: false,
    adminTab: 'produtos', // 'produtos' | 'whatsapp' | 'personalizar' | 'seguranca'
    editingProduct: null,
    formImages: [],
    formSizes: ['33/34', '35/36', '37/38', '39/40', '41/42', '43/44']
  };

  const SIZE_PRESETS = {
    chinelos: ['33/34', '35/36', '37/38', '39/40', '41/42', '43/44'],
    roupas: ['PP', 'P', 'M', 'G', 'GG', 'XG']
  };

  const COLOR_THEMES = [
    { name: 'Azul Apple', hex: '#007AFF', rgb: '0, 122, 255' },
    { name: 'Preto Luxo', hex: '#1C1C1E', rgb: '28, 28, 30' },
    { name: 'Verde Esmeralda', hex: '#34C759', rgb: '52, 199, 89' },
    { name: 'Índigo Real', hex: '#5856D6', rgb: '88, 86, 214' },
    { name: 'Rosa Boutique', hex: '#FF2D55', rgb: '255, 45, 85' },
    { name: 'Laranja Solar', hex: '#FF9500', rgb: '255, 149, 0' }
  ];

  /**
   * Inicializa a aplicação
   */
  async function init() {
    await window.SupabaseService.init();
    state.settings = await window.SupabaseService.getSettings();
    state.products = await window.SupabaseService.getProducts();

    applyThemeAndBranding();
    renderCatalog();
    renderBagBar();
    initLgpdBanner();
    bindGlobalEvents();
  }

  /**
   * Aplica cores, textos, logo e chips de informações da loja na vitrine do comprador
   */
  function applyThemeAndBranding() {
    const s = state.settings;
    const themeObj = COLOR_THEMES.find(c => c.hex.toLowerCase() === (s.accent_color || '').toLowerCase()) || COLOR_THEMES[0];

    document.documentElement.style.setProperty('--brand-accent', themeObj.hex);
    document.documentElement.style.setProperty('--brand-accent-rgb', themeObj.rgb);
    document.documentElement.style.setProperty('--brand-accent-soft', `rgba(${themeObj.rgb}, 0.12)`);

    document.title = `${s.store_name || 'Vitrine'} — Mostruário Oficial`;

    const nameEl = document.getElementById('store-name-display');
    const subEl = document.getElementById('store-subtitle-display');
    const logoBadge = document.getElementById('store-logo-badge');
    const heroBadge = document.getElementById('hero-badge-display');
    const heroTitle = document.getElementById('hero-store-title');
    const heroDesc = document.getElementById('hero-store-desc');
    const footerName = document.getElementById('footer-store-name');
    const infoPills = document.getElementById('store-info-pills');
    const navWhatsappBtn = document.getElementById('nav-whatsapp-direct');

    if (nameEl) nameEl.textContent = s.store_name || 'Vitrine Premium';
    if (subEl) subEl.textContent = s.store_subtitle || 'Chinelos & Roupas Exclusivas';
    if (footerName) footerName.textContent = s.store_name || 'Vitrine Premium';

    if (logoBadge) {
      if (s.logo_url && s.logo_url.trim()) {
        logoBadge.innerHTML = `<img src="${escapeHtml(s.logo_url)}" alt="${escapeHtml(s.store_name)}" />`;
      } else {
        logoBadge.textContent = (s.store_name || 'V').trim().charAt(0).toUpperCase();
      }
    }

    if (heroBadge) heroBadge.textContent = `✨ ${s.hero_badge || 'Coleção Exclusiva • Atendimento Rápido'}`;
    if (heroTitle) heroTitle.textContent = s.hero_title || s.store_name || 'Vitrine Premium';
    if (heroDesc) {
      heroDesc.textContent = s.hero_description || 'Escolha suas peças favoritas na vitrine, selecione sua numeração ou tamanho e confirme tudo direto pelo WhatsApp.';
    }

    // Pílulas de informações rápidas (Horário, Cidade/Entrega, Instagram)
    if (infoPills) {
      const pills = [];
      if (s.store_hours) {
        pills.push(`<span class="info-chip">🕒 ${escapeHtml(s.store_hours)}</span>`);
      }
      if (s.store_city) {
        pills.push(`<span class="info-chip">📍 ${escapeHtml(s.store_city)}</span>`);
      }
      if (s.instagram_url) {
        const igClean = s.instagram_url.startsWith('http')
          ? s.instagram_url
          : `https://instagram.com/${s.instagram_url.replace('@', '')}`;
        pills.push(`<a href="${escapeHtml(igClean)}" target="_blank" rel="noopener noreferrer" class="info-chip" style="color: var(--brand-accent);">📸 Instagram</a>`);
      }
      infoPills.innerHTML = pills.join('');
    }

    // Botão rápido de dúvida no WhatsApp na barra do comprador (se número estiver configurado)
    if (navWhatsappBtn) {
      const cleanPhone = (s.whatsapp_number || '').replace(/\D/g, '');
      if (cleanPhone) {
        navWhatsappBtn.classList.remove('hidden');
        navWhatsappBtn.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Olá! Estou visitando a vitrine da ${s.store_name} e gostaria de tirar uma dúvida.`)}`;
      } else {
        navWhatsappBtn.classList.add('hidden');
      }
    }
  }

  function formatCurrency(val) {
    if (val === null || val === undefined || val === '' || isNaN(Number(val))) return null;
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /**
   * ==========================================================================
   * VITRINE DO COMPRADOR (EXPERIÊNCIA LIMPA E DIRETA)
   * ==========================================================================
   */
  function renderCatalog() {
    const container = document.getElementById('catalog-container');
    if (!container) return;

    const activeProducts = state.products.filter(p => p.active !== false);

    // Estado inicial sem produtos (Visão limpa para o comprador)
    if (activeProducts.length === 0) {
      container.innerHTML = `
        <div class="empty-showcase animate-fade-in">
          <div class="empty-icon-circle" aria-hidden="true">🛍️</div>
          <h2 class="text-title2" style="margin-bottom: var(--space-2);">Novidades chegando em breve!</h2>
          <p class="text-subhead text-secondary" style="max-width: 420px; margin: 0 auto;">
            Nossa vitrine de chinelos e roupas está sendo preparada com peças exclusivas para você.
          </p>
        </div>
      `;
      return;
    }

    const filtered = activeProducts.filter(product => {
      const matchesCat = state.activeCategory === 'todos' || product.category === state.activeCategory;
      const query = state.searchQuery.trim().toLowerCase();
      const matchesSearch = !query ||
        product.name.toLowerCase().includes(query) ||
        (product.description && product.description.toLowerCase().includes(query));
      return matchesCat && matchesSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-showcase animate-fade-in">
          <div class="empty-icon-circle" aria-hidden="true">🔍</div>
          <h3 class="text-title3" style="margin-bottom: var(--space-2);">Nenhum item encontrado</h3>
          <p class="text-subhead text-secondary" style="margin-bottom: var(--space-4);">
            Tente ver todas as categorias ou buscar por outro termo.
          </p>
          <button type="button" class="hig-btn hig-btn-secondary hig-btn-sm" onclick="App.setCategory('todos')">
            Ver Todos os Produtos
          </button>
        </div>
      `;
      return;
    }

    const cardsHtml = filtered.map(product => {
      const images = Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : ['https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80'];
      const currentImgIdx = state.activeImageIndex[product.id] || 0;
      const currentImgUrl = images[currentImgIdx] || images[0];

      const sizes = Array.isArray(product.sizes) && product.sizes.length > 0
        ? product.sizes
        : (product.category === 'chinelos' ? ['37/38', '39/40', '41/42'] : ['P', 'M', 'G']);

      const selectedSize = state.selectedSizes[product.id] || sizes[0];
      state.selectedSizes[product.id] = selectedSize;

      const formattedPrice = state.settings.show_prices ? formatCurrency(product.price) : null;
      const categoryLabel = product.category === 'chinelos' ? '🩴 Chinelos' : '👕 Roupas';
      const sizePromptLabel = product.category === 'chinelos' ? '1. Escolha a numeração:' : '1. Escolha o tamanho:';

      return `
        <article class="product-card animate-fade-in" data-product-id="${product.id}">
          <div class="product-media">
            <img src="${escapeHtml(currentImgUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />
            <span class="product-category-pill">${categoryLabel}</span>
            ${images.length > 1 ? `
              <div class="gallery-dots" role="tablist" aria-label="Fotos do produto">
                ${images.map((_, idx) => `
                  <button
                    type="button"
                    class="gallery-dot ${idx === currentImgIdx ? 'active' : ''}"
                    onclick="App.changeProductImage('${product.id}', ${idx})"
                    aria-label="Foto ${idx + 1}"
                  ></button>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <div class="product-body">
            <h3 class="product-title">${escapeHtml(product.name)}</h3>
            ${product.description ? `<p class="product-desc">${escapeHtml(product.description)}</p>` : ''}
            ${formattedPrice ? `<div class="product-price-tag">${formattedPrice}</div>` : ''}

            <span class="sizes-label">${sizePromptLabel}</span>
            <div class="sizes-selector" role="radiogroup" aria-label="${sizePromptLabel}">
              ${sizes.map(size => `
                <button
                  type="button"
                  class="size-chip ${selectedSize === size ? 'selected' : ''}"
                  onclick="App.selectSize('${product.id}', '${escapeHtml(size)}')"
                  aria-pressed="${selectedSize === size}"
                >
                  ${escapeHtml(size)}
                </button>
              `).join('')}
            </div>

            <div class="product-actions">
              ${state.settings.allow_multiple_items ? `
                <button
                  type="button"
                  class="hig-btn hig-btn-secondary hig-btn-sm"
                  style="flex: 1;"
                  onclick="App.addToBag('${product.id}', false)"
                >
                  + Adicionar
                </button>
              ` : ''}
              <button
                type="button"
                class="hig-btn hig-btn-primary hig-btn-sm"
                style="flex: 1.35;"
                onclick="App.addToBag('${product.id}', true)"
              >
                Pedir no WhatsApp →
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    container.innerHTML = `<div class="products-grid">${cardsHtml}</div>`;
  }

  function selectSize(productId, size) {
    state.selectedSizes[productId] = size;
    renderCatalog();
  }

  function changeProductImage(productId, imageIndex) {
    state.activeImageIndex[productId] = imageIndex;
    renderCatalog();
  }

  function setCategory(category) {
    state.activeCategory = category;
    document.querySelectorAll('[data-category-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-category-btn') === category);
    });
    renderCatalog();
  }

  function addToBag(productId, openCheckinImmediately = false) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const chosenSize = state.selectedSizes[productId] || (product.sizes && product.sizes[0]) || 'Único';

    if (!state.settings.allow_multiple_items) {
      state.bag = [{ product, size: chosenSize, qty: 1 }];
    } else {
      const existingIndex = state.bag.findIndex(item => item.product.id === productId && item.size === chosenSize);
      if (existingIndex > -1) {
        state.bag[existingIndex].qty += 1;
      } else {
        state.bag.push({ product, size: chosenSize, qty: 1 });
      }
    }

    renderBagBar();

    if (openCheckinImmediately) {
      openPreCheckinModal();
    } else {
      showToast(`"${product.name}" (Tam: ${chosenSize}) adicionado! Selecione mais itens ou clique em Finalizar.`);
    }
  }

  function removeFromBag(index) {
    state.bag.splice(index, 1);
    renderBagBar();
    renderPreCheckinItems();
    if (state.bag.length === 0) {
      closeModal('pre-checkin-modal');
    }
  }

  /**
   * Barra Flutuante Liquid Glass para o Comprador finalizar os itens selecionados
   */
  function renderBagBar() {
    const bar = document.getElementById('floating-bag-bar');
    if (!bar) return;

    const totalItems = state.bag.reduce((acc, item) => acc + item.qty, 0);
    if (totalItems === 0) {
      bar.classList.add('hidden');
      return;
    }

    let totalValue = 0;
    let hasAllPrices = true;
    state.bag.forEach(item => {
      if (item.product.price !== null && item.product.price !== '') {
        totalValue += Number(item.product.price) * item.qty;
      } else {
        hasAllPrices = false;
      }
    });

    const priceText = (state.settings.show_prices && totalValue > 0)
      ? ` • ${formatCurrency(totalValue)}${!hasAllPrices ? '+' : ''}`
      : '';

    bar.classList.remove('hidden');
    bar.innerHTML = `
      <div>
        <div class="text-footnote font-semibold">🛍️ ${totalItems} ${totalItems === 1 ? 'item separado' : 'itens separados'}${priceText}</div>
        <div class="text-caption2 text-secondary">Confirme seus dados para enviar ao WhatsApp</div>
      </div>
      <div class="flex gap-2">
        <button type="button" class="hig-btn hig-btn-whatsapp hig-btn-sm" onclick="App.openPreCheckinModal()">
          Finalizar no WhatsApp →
        </button>
      </div>
    `;
  }

  /**
   * ==========================================================================
   * PRÉ-CHECK-IN DO COMPRADOR (APENAS NOME, TELEFONE E ENDEREÇO -> WHATSAPP)
   * ==========================================================================
   */
  async function openPreCheckinModal() {
    if (state.bag.length === 0) {
      showToast('Selecione pelo menos um produto na vitrine primeiro.');
      return;
    }

    renderPreCheckinItems();

    const savedProfile = await window.CryptoEngine.getSecureStorage(SAVED_CHECKIN_USER_KEY, null);
    if (savedProfile) {
      document.getElementById('checkin-name').value = savedProfile.name || '';
      document.getElementById('checkin-phone').value = savedProfile.phone || '';
      document.getElementById('checkin-address').value = savedProfile.address || '';
    }

    openModal('pre-checkin-modal');
  }

  function renderPreCheckinItems() {
    const listContainer = document.getElementById('checkin-selected-items');
    if (!listContainer) return;

    listContainer.innerHTML = state.bag.map((item, idx) => {
      const priceStr = (state.settings.show_prices && item.product.price)
        ? ` • ${formatCurrency(item.product.price * item.qty)}`
        : '';
      const sizeLabel = item.product.category === 'chinelos' ? 'Numeração' : 'Tamanho';

      return `
        <div class="flex items-center justify-between p-3 bg-secondary rounded-lg" style="margin-bottom: 8px;">
          <div>
            <div class="text-subhead font-semibold">${escapeHtml(item.product.name)} ${item.qty > 1 ? `(x${item.qty})` : ''}</div>
            <div class="text-caption1 text-secondary">${sizeLabel}: <strong>${escapeHtml(item.size)}</strong>${priceStr}</div>
          </div>
          <button type="button" class="hig-btn hig-btn-destructive hig-btn-sm" onclick="App.removeFromBag(${idx})" aria-label="Remover item">
            ✕
          </button>
        </div>
      `;
    }).join('');
  }

  async function handlePreCheckinSubmit(event) {
    event.preventDefault();

    const name = window.CryptoEngine.sanitizeInput(document.getElementById('checkin-name').value);
    const phone = window.CryptoEngine.sanitizeInput(document.getElementById('checkin-phone').value);
    const address = window.CryptoEngine.sanitizeInput(document.getElementById('checkin-address').value);
    const lgpdConsent = document.getElementById('checkin-lgpd-consent').checked;

    if (!name || !phone || !address) {
      showToast('Preencha seu Nome, Telefone e Endereço para continuar.');
      return;
    }

    if (!lgpdConsent) {
      showToast('Marque a confirmação de proteção de dados (LGPD) para enviar.');
      return;
    }

    const protocol = await window.CryptoEngine.generateOrderProtocol({
      itemsCount: state.bag.length,
      timestamp: Date.now()
    });

    await window.SupabaseService.recordLgpdConsent(protocol.fullHash, 'pre_checkin_whatsapp');
    await window.CryptoEngine.setSecureStorage(SAVED_CHECKIN_USER_KEY, { name, phone, address });

    const itemsLines = state.bag.map((item, i) => {
      const catType = item.product.category === 'chinelos' ? 'Numeração' : 'Tamanho';
      const pricePart = (state.settings.show_prices && item.product.price)
        ? ` | Valor: ${formatCurrency(item.product.price * item.qty)}`
        : '';
      return `${i + 1}. *${item.product.name}* (${item.qty}x)\n   • ${catType}: *${item.size}*${pricePart}`;
    }).join('\n\n');

    const greeting = state.settings.whatsapp_greeting || `Olá! Gostaria de confirmar meu pedido na *${state.settings.store_name}*:`;

    const messageLines = [
      greeting,
      ``,
      `🛍️ *ITENS ESCOLHIDOS:*`,
      itemsLines,
      ``,
      `📋 *MEUS DADOS DE PRÉ-CHECK-IN:*`,
      `• *Nome:* ${name}`,
      `• *Telefone:* ${phone}`,
      `• *Endereço:* ${address}`,
      ``,
      `🔒 _Protocolo Criptográfico LGPD: #${protocol.shortCode}_`
    ];

    const encodedMessage = encodeURIComponent(messageLines.join('\n'));
    const cleanTargetPhone = (state.settings.whatsapp_number || '').replace(/\D/g, '');

    const whatsappUrl = cleanTargetPhone
      ? `https://wa.me/${cleanTargetPhone}?text=${encodedMessage}`
      : `https://api.whatsapp.com/send?text=${encodedMessage}`;

    closeModal('pre-checkin-modal');
    state.bag = [];
    renderBagBar();

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * ==========================================================================
   * ÁREA DO ADMINISTRADOR COM SENHA OBRIGATÓRIA (SHA-256)
   * ==========================================================================
   * - Se ainda não existe senha cadastrada: pede ao dono para criar sua senha
   *   administrativa no primeiro acesso.
   * - Se já existe senha cadastrada: exige a senha antes de exibir qualquer
   *   opção de cadastro ou configuração.
   */
  function openAdminModal() {
    openModal('admin-modal');
    const savedPinHash = localStorage.getItem(ADMIN_PIN_HASH_KEY);

    if (!savedPinHash) {
      renderAdminFirstTimeSetup();
      return;
    }

    if (!state.adminUnlocked) {
      renderAdminLoginScreen();
      return;
    }

    renderAdminDashboard();
  }

  function renderAdminFirstTimeSetup() {
    const content = document.getElementById('admin-modal-body');
    if (!content) return;

    content.innerHTML = `
      <div style="max-width: 420px; margin: var(--space-4) auto; text-align: center;">
        <div class="empty-icon-circle" style="margin-bottom: var(--space-3);">🔐</div>
        <h3 class="text-title2" style="margin-bottom: var(--space-2);">Criar Senha do Administrador</h3>
        <p class="text-subhead text-secondary" style="margin-bottom: var(--space-5);">
          Para garantir que <strong>somente você (administrador)</strong> possa cadastrar produtos e alterar o WhatsApp da loja, defina sua senha de acesso agora.
        </p>
        <form onsubmit="App.handleCreateInitialPassword(event)" style="text-align: left;">
          <div class="form-group">
            <label class="form-label" for="init-admin-pass">Crie sua Senha de Administrador *</label>
            <input
              type="password"
              id="init-admin-pass"
              class="form-input"
              placeholder="Mínimo de 4 dígitos ou letras"
              required
              autofocus
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="init-admin-pass-confirm">Confirme a Senha *</label>
            <input
              type="password"
              id="init-admin-pass-confirm"
              class="form-input"
              placeholder="Repita a senha"
              required
            />
          </div>
          <button type="submit" class="hig-btn hig-btn-primary w-full">
            🔒 Salvar Senha e Entrar no Painel
          </button>
        </form>
      </div>
    `;
  }

  async function handleCreateInitialPassword(event) {
    event.preventDefault();
    const p1 = document.getElementById('init-admin-pass').value;
    const p2 = document.getElementById('init-admin-pass-confirm').value;

    if (!p1 || p1.length < 4) {
      showToast('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (p1 !== p2) {
      showToast('As senhas digitadas não conferem.');
      return;
    }

    const hash = await window.CryptoEngine.sha256(p1);
    localStorage.setItem(ADMIN_PIN_HASH_KEY, hash);
    state.adminUnlocked = true;
    showToast('Senha do Administrador criada com sucesso!');
    renderAdminDashboard();
  }

  function renderAdminLoginScreen() {
    const content = document.getElementById('admin-modal-body');
    if (!content) return;

    content.innerHTML = `
      <div style="max-width: 380px; margin: var(--space-6) auto; text-align: center;">
        <div class="empty-icon-circle" style="margin-bottom: var(--space-3);">🔒</div>
        <h3 class="text-title2" style="margin-bottom: var(--space-2);">Área Restrita do Administrador</h3>
        <p class="text-subhead text-secondary" style="margin-bottom: var(--space-5);">
          Digite sua senha de administrador para gerenciar produtos, WhatsApp e personalização da vitrine.
        </p>
        <form onsubmit="App.verifyAdminPin(event)">
          <div class="form-group">
            <input
              type="password"
              id="admin-pin-input"
              class="form-input text-center"
              placeholder="Digite sua senha de administrador"
              required
              autofocus
            />
          </div>
          <button type="submit" class="hig-btn hig-btn-primary w-full">
            Entrar no Painel
          </button>
        </form>
      </div>
    `;
  }

  async function verifyAdminPin(event) {
    event.preventDefault();
    const input = document.getElementById('admin-pin-input').value;
    const savedHash = localStorage.getItem(ADMIN_PIN_HASH_KEY);
    const inputHash = await window.CryptoEngine.sha256(input);

    if (inputHash === savedHash) {
      state.adminUnlocked = true;
      showToast('Bem-vindo ao Painel do Administrador!');
      renderAdminDashboard();
    } else {
      showToast('Senha incorreta. Acesso permitido apenas ao administrador.');
    }
  }

  function lockAdminSession() {
    state.adminUnlocked = false;
    closeModal('admin-modal');
    showToast('Sessão de administrador bloqueada com segurança.');
  }

  function switchAdminTab(tab) {
    state.adminTab = tab;
    renderAdminDashboard();
  }

  /**
   * Renderiza o Painel do Administrador (Intuitivo, Visual e Sem Complicações)
   */
  function renderAdminDashboard() {
    const content = document.getElementById('admin-modal-body');
    if (!content) return;

    const supCreds = window.SupabaseService.getCredentials();

    content.innerHTML = `
      <div class="flex items-center justify-between flex-wrap gap-3" style="margin-bottom: var(--space-5);">
        <div class="segmented-control">
          <button type="button" class="segment-btn ${state.adminTab === 'produtos' ? 'active' : ''}" onclick="App.switchAdminTab('produtos')">
            📦 1. Cadastrar Produtos (${state.products.length})
          </button>
          <button type="button" class="segment-btn ${state.adminTab === 'whatsapp' ? 'active' : ''}" onclick="App.switchAdminTab('whatsapp')">
            💬 2. WhatsApp & Contato
          </button>
          <button type="button" class="segment-btn ${state.adminTab === 'personalizar' ? 'active' : ''}" onclick="App.switchAdminTab('personalizar')">
            🎨 3. Personalizar Site
          </button>
          <button type="button" class="segment-btn ${state.adminTab === 'seguranca' ? 'active' : ''}" onclick="App.switchAdminTab('seguranca')">
            🔐 4. Senha & Nuvem
          </button>
        </div>

        <button type="button" class="hig-btn hig-btn-destructive hig-btn-sm" onclick="App.lockAdminSession()">
          🔒 Sair / Bloquear Painel
        </button>
      </div>

      ${state.adminTab === 'produtos' ? renderAdminProductsTab() : ''}
      ${state.adminTab === 'whatsapp' ? renderAdminWhatsappTab() : ''}
      ${state.adminTab === 'personalizar' ? renderAdminPersonalizeTab() : ''}
      ${state.adminTab === 'seguranca' ? renderAdminSecurityAndCloudTab(supCreds) : ''}
    `;
  }

  /**
   * ABA 1: Cadastro Super Simples e Intuitivo de Produtos (Chinelos e Roupas)
   */
  function renderAdminProductsTab() {
    const editing = state.editingProduct || {
      id: '',
      name: '',
      category: 'chinelos',
      description: '',
      price: ''
    };

    const currentCategory = editing.category || 'chinelos';
    const presets = SIZE_PRESETS[currentCategory] || SIZE_PRESETS.chinelos;

    return `
      <div class="admin-grid">
        <!-- Passo a Passo Simples para Adicionar ou Editar Produto -->
        <div class="admin-card">
          <h4 class="text-title3" style="margin-bottom: 4px;">
            ${editing.id ? '✏️ Editando Produto' : '➕ Adicionar Novo Produto'}
          </h4>
          <p class="text-caption1 text-secondary" style="margin-bottom: var(--space-4);">
            Preencha os campos abaixo. É simples como postar uma foto no celular!
          </p>

          <form onsubmit="App.handleSaveProduct(event)">
            <input type="hidden" id="prod-id" value="${escapeHtml(editing.id)}" />

            <!-- Passo 1: Tipo de Produto -->
            <div class="form-group">
              <label class="form-label">1. Qual é o tipo de produto? *</label>
              <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 10px;">
                <button
                  type="button"
                  class="hig-btn ${currentCategory === 'chinelos' ? 'hig-btn-primary' : 'hig-btn-ghost'}"
                  onclick="App.handleCategoryChangeInForm('chinelos')"
                >
                  🩴 Chinelo / Calçado
                </button>
                <button
                  type="button"
                  class="hig-btn ${currentCategory === 'roupas' ? 'hig-btn-primary' : 'hig-btn-ghost'}"
                  onclick="App.handleCategoryChangeInForm('roupas')"
                >
                  👕 Roupa / Vestuário
                </button>
              </div>
              <input type="hidden" id="prod-category" value="${currentCategory}" />
            </div>

            <!-- Passo 2: Nome e Preço -->
            <div class="grid" style="grid-template-columns: 1.4fr 1fr; gap: var(--space-3);">
              <div class="form-group">
                <label class="form-label" for="prod-name">2. Nome da Peça *</label>
                <input
                  type="text"
                  id="prod-name"
                  class="form-input"
                  placeholder="Ex: Chinelo Nuvem Confort"
                  value="${escapeHtml(editing.name)}"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="prod-price">Preço R$ (Opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  id="prod-price"
                  class="form-input"
                  placeholder="Ex: 69.90"
                  value="${editing.price !== null && editing.price !== undefined ? editing.price : ''}"
                />
              </div>
            </div>

            <!-- Passo 3: Fotos do Produto (Visual com Miniaturas) -->
            <div class="form-group">
              <label class="form-label">3. Fotos do Produto *</label>
              <label class="photo-upload-dropzone" style="display: block;">
                <div style="font-size: 26px; margin-bottom: 4px;">📸</div>
                <div class="text-subhead font-semibold" style="color: var(--brand-accent);">
                  Clique aqui para escolher fotos do celular ou computador
                </div>
                <div class="text-caption1 text-secondary">
                  Você pode selecionar 1 ou várias fotos de uma só vez
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style="display: none;"
                  onchange="App.handleImageUpload(event)"
                />
              </label>

              <!-- Miniaturas das fotos adicionadas -->
              <div class="uploaded-photos-strip" id="admin-photos-preview">
                ${state.formImages.map((imgSrc, idx) => `
                  <div class="uploaded-photo-item">
                    <img src="${escapeHtml(imgSrc)}" alt="Foto ${idx + 1}" />
                    <button type="button" class="uploaded-photo-remove" onclick="App.removeFormImage(${idx})" title="Remover foto">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Passo 4: Tamanhos / Numerações com 1 clique -->
            <div class="form-group">
              <label class="form-label">
                4. Toque nos tamanhos disponíveis para marcar/desmarcar *
              </label>
              <div class="flex flex-wrap gap-2" style="margin-bottom: 8px;" id="admin-size-chips">
                ${presets.map(sz => {
                  const isSelected = state.formSizes.includes(sz);
                  return `
                    <button
                      type="button"
                      class="size-chip ${isSelected ? 'selected' : ''}"
                      onclick="App.toggleAdminSize('${sz}')"
                    >
                      ${sz}
                    </button>
                  `;
                }).join('')}
              </div>
              <input
                type="text"
                id="prod-custom-sizes"
                class="form-input"
                placeholder="Tamanhos selecionados (ex: 35/36, 37/38, 39/40)"
                value="${escapeHtml(state.formSizes.join(', '))}"
                oninput="App.syncCustomSizesInput(this.value)"
              />
            </div>

            <!-- Passo 5: Descrição curta -->
            <div class="form-group">
              <label class="form-label" for="prod-desc">5. Descrição Curta (Opcional)</label>
              <textarea
                id="prod-desc"
                class="form-textarea"
                rows="2"
                placeholder="Ex: Macio, antiderrapante, disponível para pronta entrega..."
              >${escapeHtml(editing.description || '')}</textarea>
            </div>

            <div class="flex gap-2">
              <button type="submit" class="hig-btn hig-btn-primary" style="flex: 1;">
                ${editing.id ? '✅ Salvar Alterações' : '✨ Publicar Produto na Vitrine'}
              </button>
              ${editing.id ? `
                <button type="button" class="hig-btn hig-btn-ghost" onclick="App.cancelEditProduct()">
                  Cancelar
                </button>
              ` : ''}
            </div>
          </form>
        </div>

        <!-- Lista Visual de Produtos já cadastrados -->
        <div class="admin-card">
          <h4 class="text-title3" style="margin-bottom: 4px;">Vitrine Atual (${state.products.length})</h4>
          <p class="text-caption1 text-secondary" style="margin-bottom: var(--space-4);">
            Aqui estão os itens que seus clientes veem na loja.
          </p>

          ${state.products.length === 0 ? `
            <div class="text-center p-6 text-secondary" style="background: var(--bg-tertiary); border-radius: 16px;">
              <div style="font-size: 32px; margin-bottom: 8px;">🩴👕</div>
              <p class="text-subhead font-semibold" style="margin-bottom: 4px;">Sua vitrine ainda está vazia</p>
              <p class="text-caption1">Use o quadro ao lado para publicar seu primeiro chinelo ou roupa!</p>
            </div>
          ` : `
            <div style="max-height: 520px; overflow-y: auto;">
              ${state.products.map(prod => {
                const thumb = (prod.images && prod.images[0]) || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=200&q=60';
                const priceTxt = formatCurrency(prod.price) || 'Sem preço exibido';
                return `
                  <div class="admin-product-row">
                    <div class="flex items-center gap-3" style="min-width: 0;">
                      <img src="${escapeHtml(thumb)}" alt="" class="admin-product-thumb" />
                      <div style="min-width: 0;">
                        <div class="text-subhead font-semibold" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${escapeHtml(prod.name)}
                        </div>
                        <div class="text-caption1 text-secondary">
                          ${prod.category === 'chinelos' ? '🩴 Chinelo' : '👕 Roupa'} • ${priceTxt}
                        </div>
                        <div class="text-caption2 text-tertiary">
                          Tam: ${(prod.sizes || []).join(', ')}
                        </div>
                      </div>
                    </div>
                    <div class="flex gap-1">
                      <button type="button" class="hig-btn hig-btn-secondary hig-btn-sm" onclick="App.startEditProduct('${prod.id}')">
                        Editar
                      </button>
                      <button type="button" class="hig-btn hig-btn-destructive hig-btn-sm" onclick="App.handleDeleteProduct('${prod.id}')">
                        Apagar
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * ABA 2: Gerenciador Dedicado de WhatsApp e Informações de Contato (Requisito 2)
   */
  function renderAdminWhatsappTab() {
    const s = state.settings;
    return `
      <div class="admin-grid">
        <div class="admin-card">
          <h4 class="text-title3" style="margin-bottom: 4px;">💬 Configurar WhatsApp de Pedidos</h4>
          <p class="text-caption1 text-secondary" style="margin-bottom: var(--space-4);">
            Defina para qual número os pedidos dos clientes serão enviados automaticamente após o pré-check-in.
          </p>

          <form onsubmit="App.handleSaveWhatsappSettings(event)">
            <div class="form-group">
              <label class="form-label" for="wa-number">Número do WhatsApp com DDD *</label>
              <input
                type="tel"
                id="wa-number"
                class="form-input"
                placeholder="Ex: 5511999999999"
                value="${escapeHtml(s.whatsapp_number || '')}"
                required
              />
              <div class="form-helper">
                Digite apenas números com o código do Brasil (55) + DDD + Número. Exemplo: <strong>5511987654321</strong>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="wa-greeting">Frase Inicial da Mensagem no WhatsApp</label>
              <input
                type="text"
                id="wa-greeting"
                class="form-input"
                placeholder="Olá! Vi a vitrine online e gostaria de confirmar meu pedido:"
                value="${escapeHtml(s.whatsapp_greeting || 'Olá! Vi a vitrine online e gostaria de confirmar meu pedido:')}"
              />
              <div class="form-helper">
                Essa frase aparece no topo da mensagem que chega para você junto com os itens e endereço do cliente.
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="wa-hours">Horário de Atendimento (Opcional)</label>
              <input
                type="text"
                id="wa-hours"
                class="form-input"
                placeholder="Ex: Seg a Sáb • 09h às 19h"
                value="${escapeHtml(s.store_hours || '')}"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="wa-city">Informação de Entrega / Região (Opcional)</label>
              <input
                type="text"
                id="wa-city"
                class="form-input"
                placeholder="Ex: Entregamos em toda a região"
                value="${escapeHtml(s.store_city || '')}"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="wa-instagram">Instagram da Loja (Opcional)</label>
              <input
                type="text"
                id="wa-instagram"
                class="form-input"
                placeholder="Ex: @sualoja"
                value="${escapeHtml(s.instagram_url || '')}"
              />
            </div>

            <div class="flex gap-2 flex-wrap">
              <button type="submit" class="hig-btn hig-btn-primary" style="flex: 1;">
                💾 Salvar Contato & WhatsApp
              </button>
              <button type="button" class="hig-btn hig-btn-whatsapp" onclick="App.testWhatsappConnection()">
                📲 Testar Meu WhatsApp Agora
              </button>
            </div>
          </form>
        </div>

        <!-- Prévia em Tempo Real de como a mensagem chega no WhatsApp -->
        <div class="admin-card">
          <h4 class="text-title3" style="margin-bottom: 4px;">📱 Como o Pedido Chega no Seu Celular</h4>
          <p class="text-caption1 text-secondary" style="margin-bottom: var(--space-4);">
            Veja um exemplo de como você receberá a mensagem pronta do comprador:
          </p>

          <div style="background: #DCF8C6; color: #111; padding: 16px; border-radius: 16px; font-size: 14px; line-height: 1.5; box-shadow: var(--shadow-sm);">
            <strong>${escapeHtml(s.whatsapp_greeting || 'Olá! Vi a vitrine online e gostaria de confirmar meu pedido:')}</strong><br/><br/>
            🛍️ <strong>ITENS ESCOLHIDOS:</strong><br/>
            1. <strong>Chinelo Nuvem Slide</strong> (1x)<br/>
            &nbsp;&nbsp;&nbsp;• Numeração: <strong>39/40</strong> | Valor: R$ 69,90<br/><br/>
            📋 <strong>MEUS DADOS DE PRÉ-CHECK-IN:</strong><br/>
            • <strong>Nome:</strong> Maria Silva<br/>
            • <strong>Telefone:</strong> (11) 99999-0000<br/>
            • <strong>Endereço:</strong> Rua das Flores, 123 - Centro<br/><br/>
            <span style="font-size: 12px; color: #555;">🔒 <em>Protocolo Criptográfico LGPD: #A9F42C10</em></span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ABA 3: Personalização Visual da Loja Sem Complicações (Requisito 2 e 3)
   */
  function renderAdminPersonalizeTab() {
    const s = state.settings;
    return `
      <div class="admin-card" style="max-width: 680px; margin: 0 auto;">
        <h4 class="text-title3" style="margin-bottom: 4px;">🎨 Personalizar Aparência e Textos da Vitrine</h4>
        <p class="text-caption1 text-secondary" style="margin-bottom: var(--space-4);">
          Deixe o site com a cara da sua marca em poucos cliques, sem precisar entender de programação.
        </p>

        <form onsubmit="App.handleSavePersonalization(event)">
          <div class="grid" style="grid-template-columns: 1fr 1fr; gap: var(--space-3);">
            <div class="form-group">
              <label class="form-label" for="pers-store-name">Nome da Sua Loja *</label>
              <input type="text" id="pers-store-name" class="form-input" value="${escapeHtml(s.store_name)}" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="pers-store-sub">Slogan / Subtítulo Curto</label>
              <input type="text" id="pers-store-sub" class="form-input" value="${escapeHtml(s.store_subtitle)}" />
            </div>
          </div>

          <!-- Upload fácil de Logo -->
          <div class="form-group">
            <label class="form-label">Logo da Loja (Opcional)</label>
            <div class="flex items-center gap-3 flex-wrap">
              <label class="hig-btn hig-btn-secondary hig-btn-sm cursor-pointer">
                🖼️ Escolher Imagem da Logo no Aparelho
                <input type="file" accept="image/*" style="display: none;" onchange="App.handleLogoUpload(event)" />
              </label>
              ${s.logo_url ? `
                <button type="button" class="hig-btn hig-btn-destructive hig-btn-sm" onclick="App.clearLogo()">
                  Remover Logo (Usar Inicial)
                </button>
              ` : ''}
            </div>
            <input type="hidden" id="pers-logo-url" value="${escapeHtml(s.logo_url || '')}" />
          </div>

          <div class="form-group">
            <label class="form-label" for="pers-hero-badge">Selo de Destaque no Topo</label>
            <input type="text" id="pers-hero-badge" class="form-input" value="${escapeHtml(s.hero_badge || 'Coleção Exclusiva • Atendimento Rápido')}" />
          </div>

          <div class="form-group">
            <label class="form-label" for="pers-hero-title">Frase Principal de Boas-Vindas</label>
            <input type="text" id="pers-hero-title" class="form-input" value="${escapeHtml(s.hero_title || 'Estilo e conforto no seu passo.')}" />
          </div>

          <div class="form-group">
            <label class="form-label" for="pers-hero-desc">Texto Explicativo da Vitrine</label>
            <textarea id="pers-hero-desc" class="form-textarea" rows="2">${escapeHtml(s.hero_description || '')}</textarea>
          </div>

          <!-- Seleção de Cor com Botões Visuais -->
          <div class="form-group">
            <label class="form-label">Cor Principal do Site (Toque para escolher)</label>
            <div class="color-swatch-grid">
              ${COLOR_THEMES.map(c => `
                <button
                  type="button"
                  class="color-swatch-btn ${(s.accent_color || '#007AFF').toLowerCase() === c.hex.toLowerCase() ? 'active' : ''}"
                  onclick="App.selectColorSwatch('${c.hex}')"
                  data-swatch-hex="${c.hex}"
                >
                  <span class="swatch-dot" style="background: ${c.hex};"></span>
                  <span>${c.name}</span>
                </button>
              `).join('')}
            </div>
            <input type="hidden" id="pers-accent-color" value="${escapeHtml(s.accent_color || '#007AFF')}" />
          </div>

          <!-- Opções de Comportamento da Vitrine -->
          <div class="p-4 bg-tertiary rounded-xl" style="margin-bottom: var(--space-4); border: 1px solid var(--separator);">
            <div class="text-subhead font-semibold" style="margin-bottom: 10px;">Opções de Funcionamento da Vitrine</div>

            <label class="flex items-center gap-3 cursor-pointer" style="margin-bottom: 10px;">
              <input
                type="checkbox"
                id="pers-show-prices"
                ${s.show_prices ? 'checked' : ''}
                style="width: 22px; height: 22px; accent-color: var(--brand-accent); -webkit-appearance: checkbox; appearance: auto;"
              />
              <span class="text-subhead">Mostrar preços dos produtos na vitrine</span>
            </label>

            <label class="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                id="pers-multiple-items"
                ${s.allow_multiple_items ? 'checked' : ''}
                style="width: 22px; height: 22px; accent-color: var(--brand-accent); -webkit-appearance: checkbox; appearance: auto;"
              />
              <span class="text-subhead">Permitir que o comprador escolha mais de 1 produto no mesmo pedido</span>
            </label>
          </div>

          <button type="submit" class="hig-btn hig-btn-primary w-full">
            ✨ Salvar Personalização da Loja
          </button>
        </form>
      </div>
    `;
  }

  /**
   * ABA 4: Senha do Administrador, Backup, Firebase Firestore e Cloudflare
   */
  function renderAdminSecurityAndCloudTab(supCreds) {
    const fbCreds = window.SupabaseService.getFirebaseCredentials();
    return `
      <div class="admin-grid">
        <!-- Conexão Direta com Firebase Firestore -->
        <div class="admin-card">
          <h4 class="text-title3" style="margin-bottom: 4px;">
            🔥 1. Banco em Nuvem Firebase ${fbCreds.connected ? '✅ Conectado' : ''}
          </h4>
          <p class="text-caption1 text-secondary" style="margin-bottom: var(--space-4);">
            Conecte seu projeto do <strong>Google Firebase (Cloud Firestore)</strong> para sincronizar seus produtos e configurações em tempo real. Suas chaves ficam criptografadas com AES-256-GCM.
          </p>

          <form onsubmit="App.handleSaveFirebaseConfig(event)">
            <div class="form-group">
              <label class="form-label" for="fb-project-id">Firebase Project ID *</label>
              <input
                type="text"
                id="fb-project-id"
                class="form-input"
                placeholder="Ex: minha-vitrine-12345"
                value="${escapeHtml(fbCreds.projectId || '')}"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="fb-api-key">Firebase Web API Key *</label>
              <input
                type="password"
                id="fb-api-key"
                class="form-input"
                placeholder="AIzaSy..."
                value="${escapeHtml(fbCreds.apiKey || '')}"
                required
              />
            </div>

            <div class="flex gap-2" style="margin-bottom: var(--space-3);">
              <button type="submit" class="hig-btn hig-btn-primary" style="flex: 1;">
                🔥 Conectar e Sincronizar Firebase
              </button>
              ${fbCreds.connected ? `
                <button type="button" class="hig-btn hig-btn-destructive" onclick="App.disconnectFirebase()">
                  Desconectar
                </button>
              ` : ''}
            </div>
          </form>

          <details style="margin-top: var(--space-2);">
            <summary class="text-footnote font-semibold cursor-pointer" style="color: var(--brand-accent);">
              📜 Regras de Segurança do Firestore (firestore.rules)
            </summary>
            <div style="margin-top: 8px;">
              <pre class="code-block-sql" id="firestore-rules-preview">rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /store_settings/{docId} {
      allow read, write: if true;
    }
    match /products/{productId} {
      allow read, write: if true;
    }
    match /lgpd_consent_logs/{logId} {
      allow create, read: if true;
      allow update, delete: if false;
    }
  }
}</pre>
            </div>
          </details>
        </div>

        <!-- Alterar Senha do Administrador & Backup Criptografado -->
        <div class="admin-card">
          <h4 class="text-title3" style="margin-bottom: 4px;">🔑 2. Senha do Administrador & Backup</h4>
          <p class="text-caption1 text-secondary" style="margin-bottom: var(--space-4);">
            Altere quando quiser a senha que protege a entrada neste painel administrativo (protegida com hash SHA-256).
          </p>

          <form onsubmit="App.handleUpdateAdminPin(event)" style="margin-bottom: var(--space-5);">
            <div class="form-group">
              <label class="form-label" for="new-admin-pin">Nova Senha de Administrador</label>
              <input type="password" id="new-admin-pin" class="form-input" placeholder="Digite a nova senha" required />
            </div>
            <button type="submit" class="hig-btn hig-btn-primary w-full">
              Atualizar Senha do Administrador
            </button>
          </form>

          <hr style="border: none; border-top: 1px solid var(--separator); margin: var(--space-4) 0;" />

          <h4 class="text-headline" style="margin-bottom: 4px;">🛡️ Cópia de Segurança Criptografada (AES-256)</h4>
          <p class="text-caption1 text-secondary" style="margin-bottom: var(--space-3);">
            Baixe ou restaure todo o catálogo de produtos e configurações em arquivo blindado.
          </p>
          <div class="flex flex-col gap-2">
            <button type="button" class="hig-btn hig-btn-secondary w-full" onclick="App.exportEncryptedCatalog()">
              ⬇️ Baixar Cópia de Segurança (.enc.json)
            </button>
            <label class="hig-btn hig-btn-ghost w-full cursor-pointer" style="text-align: center;">
              ⬆️ Restaurar Cópia de Segurança
              <input type="file" accept=".json" style="display: none;" onchange="App.importEncryptedCatalog(event)" />
            </label>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ==========================================================================
   * AÇÕES INTUITIVAS DO PAINEL DE PRODUTOS E CONFIGURAÇÕES
   * ==========================================================================
   */
  function handleCategoryChangeInForm(newCat) {
    if (!state.editingProduct) {
      state.editingProduct = {
        id: '',
        name: document.getElementById('prod-name') ? document.getElementById('prod-name').value : '',
        category: newCat,
        description: document.getElementById('prod-desc') ? document.getElementById('prod-desc').value : '',
        price: document.getElementById('prod-price') ? document.getElementById('prod-price').value : ''
      };
    } else {
      state.editingProduct.category = newCat;
    }

    state.formSizes = [...(SIZE_PRESETS[newCat] || SIZE_PRESETS.chinelos)];
    renderAdminDashboard();
  }

  function toggleAdminSize(sizeVal) {
    if (state.formSizes.includes(sizeVal)) {
      state.formSizes = state.formSizes.filter(s => s !== sizeVal);
    } else {
      state.formSizes.push(sizeVal);
    }

    const customInput = document.getElementById('prod-custom-sizes');
    if (customInput) customInput.value = state.formSizes.join(', ');

    document.querySelectorAll('#admin-size-chips .size-chip').forEach(btn => {
      if (btn.textContent.trim() === sizeVal) {
        btn.classList.toggle('selected', state.formSizes.includes(sizeVal));
      }
    });
  }

  function syncCustomSizesInput(rawVal) {
    state.formSizes = rawVal.split(',').map(s => s.trim()).filter(Boolean);
  }

  async function handleImageUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const compressedDataUrl = await compressImageFile(file, 900, 0.82);
        state.formImages.push(compressedDataUrl);
      } catch (err) {
        console.error('Erro ao processar foto:', err);
      }
    }

    refreshPhotosPreviewStrip();
    showToast(`${files.length} foto(s) adicionada(s)!`);
  }

  function removeFormImage(idx) {
    state.formImages.splice(idx, 1);
    refreshPhotosPreviewStrip();
  }

  function refreshPhotosPreviewStrip() {
    const strip = document.getElementById('admin-photos-preview');
    if (!strip) return;
    strip.innerHTML = state.formImages.map((imgSrc, idx) => `
      <div class="uploaded-photo-item">
        <img src="${escapeHtml(imgSrc)}" alt="Foto ${idx + 1}" />
        <button type="button" class="uploaded-photo-remove" onclick="App.removeFormImage(${idx})" title="Remover foto">✕</button>
      </div>
    `).join('');
  }

  function compressImageFile(file, maxWidth = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSaveProduct(event) {
    event.preventDefault();

    const id = document.getElementById('prod-id').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const priceRaw = document.getElementById('prod-price').value.trim();
    const description = document.getElementById('prod-desc').value.trim();
    const sizesRaw = document.getElementById('prod-custom-sizes').value;

    const sizes = sizesRaw.split(',').map(s => s.trim()).filter(Boolean);

    if (!name) {
      showToast('Digite o nome do produto.');
      return;
    }

    if (sizes.length === 0) {
      showToast('Selecione pelo menos um tamanho ou numeração.');
      return;
    }

    try {
      await window.SupabaseService.saveProduct({
        id: id || undefined,
        name,
        category,
        description,
        price: priceRaw !== '' ? Number(priceRaw) : null,
        sizes,
        images: [...state.formImages]
      });

      state.editingProduct = null;
      state.formImages = [];
      state.formSizes = [...SIZE_PRESETS.chinelos];
      state.products = await window.SupabaseService.getProducts();
      renderCatalog();
      renderAdminDashboard();
      showToast(id ? 'Produto atualizado na vitrine!' : 'Produto publicado na vitrine com sucesso!');
    } catch (err) {
      showToast(err.message || 'Erro ao salvar produto.');
    }
  }

  function startEditProduct(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (!prod) return;
    state.editingProduct = JSON.parse(JSON.stringify(prod));
    state.formImages = Array.isArray(prod.images) ? [...prod.images] : [];
    state.formSizes = Array.isArray(prod.sizes) && prod.sizes.length > 0
      ? [...prod.sizes]
      : [...(SIZE_PRESETS[prod.category] || SIZE_PRESETS.chinelos)];
    renderAdminDashboard();
  }

  function cancelEditProduct() {
    state.editingProduct = null;
    state.formImages = [];
    state.formSizes = [...SIZE_PRESETS.chinelos];
    renderAdminDashboard();
  }

  async function handleDeleteProduct(productId) {
    if (!confirm('Deseja realmente apagar este produto da vitrine?')) return;
    try {
      await window.SupabaseService.deleteProduct(productId);
      state.products = await window.SupabaseService.getProducts();
      renderCatalog();
      renderAdminDashboard();
      showToast('Produto removido da vitrine.');
    } catch (err) {
      showToast(err.message || 'Erro ao remover produto.');
    }
  }

  /**
   * Salvar configurações de WhatsApp e Contato (Aba 2)
   */
  async function handleSaveWhatsappSettings(event) {
    event.preventDefault();
    const updated = {
      ...state.settings,
      whatsapp_number: document.getElementById('wa-number').value.trim(),
      whatsapp_greeting: document.getElementById('wa-greeting').value.trim(),
      store_hours: document.getElementById('wa-hours').value.trim(),
      store_city: document.getElementById('wa-city').value.trim(),
      instagram_url: document.getElementById('wa-instagram').value.trim()
    };

    try {
      state.settings = await window.SupabaseService.updateSettings(updated);
      applyThemeAndBranding();
      renderAdminDashboard();
      showToast('Número de WhatsApp e contatos salvos com sucesso!');
    } catch (err) {
      showToast(err.message || 'Erro ao salvar contato.');
    }
  }

  function testWhatsappConnection() {
    const rawNum = document.getElementById('wa-number')
      ? document.getElementById('wa-number').value.trim()
      : state.settings.whatsapp_number;
    const cleanPhone = (rawNum || '').replace(/\D/g, '');
    if (!cleanPhone) {
      showToast('Digite seu número de WhatsApp com DDD primeiro para testar.');
      return;
    }
    const testMsg = encodeURIComponent(`✅ Teste de conexão da vitrine *${state.settings.store_name}*: Seu WhatsApp está pronto para receber os pedidos dos clientes!`);
    window.open(`https://wa.me/${cleanPhone}?text=${testMsg}`, '_blank', 'noopener,noreferrer');
  }

  /**
   * Salvar Personalização da Loja (Aba 3)
   */
  function selectColorSwatch(hex) {
    const input = document.getElementById('pers-accent-color');
    if (input) input.value = hex;
    document.querySelectorAll('[data-swatch-hex]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-swatch-hex').toLowerCase() === hex.toLowerCase());
    });
  }

  async function handleLogoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 300, 0.85);
      state.settings.logo_url = dataUrl;
      const logoInput = document.getElementById('pers-logo-url');
      if (logoInput) logoInput.value = dataUrl;
      applyThemeAndBranding();
      showToast('Logo carregada! Clique em Salvar Personalização para confirmar.');
    } catch (err) {
      showToast('Erro ao carregar imagem da logo.');
    }
  }

  function clearLogo() {
    state.settings.logo_url = '';
    const logoInput = document.getElementById('pers-logo-url');
    if (logoInput) logoInput.value = '';
    applyThemeAndBranding();
    renderAdminDashboard();
  }

  async function handleSavePersonalization(event) {
    event.preventDefault();
    const updated = {
      ...state.settings,
      store_name: document.getElementById('pers-store-name').value.trim() || 'Vitrine Premium',
      store_subtitle: document.getElementById('pers-store-sub').value.trim(),
      logo_url: document.getElementById('pers-logo-url').value.trim(),
      hero_badge: document.getElementById('pers-hero-badge').value.trim(),
      hero_title: document.getElementById('pers-hero-title').value.trim(),
      hero_description: document.getElementById('pers-hero-desc').value.trim(),
      accent_color: document.getElementById('pers-accent-color').value.trim() || '#007AFF',
      show_prices: document.getElementById('pers-show-prices').checked,
      allow_multiple_items: document.getElementById('pers-multiple-items').checked
    };

    try {
      state.settings = await window.SupabaseService.updateSettings(updated);
      applyThemeAndBranding();
      renderCatalog();
      renderBagBar();
      showToast('Personalização do site salva e aplicada!');
    } catch (err) {
      showToast(err.message || 'Erro ao salvar personalização.');
    }
  }

  /**
   * Segurança e Nuvem (Aba 4)
   */
  async function handleUpdateAdminPin(event) {
    event.preventDefault();
    const pin = document.getElementById('new-admin-pin').value;
    if (!pin || pin.length < 4) {
      showToast('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    const hash = await window.CryptoEngine.sha256(pin);
    localStorage.setItem(ADMIN_PIN_HASH_KEY, hash);
    document.getElementById('new-admin-pin').value = '';
    showToast('Senha do Administrador atualizada com sucesso!');
  }

  async function handleSaveFirebaseConfig(event) {
    event.preventDefault();
    const projectId = document.getElementById('fb-project-id').value.trim();
    const apiKey = document.getElementById('fb-api-key').value.trim();

    const result = await window.SupabaseService.saveFirebaseCredentials(projectId, apiKey);
    if (result.ok) {
      state.settings = await window.SupabaseService.getSettings();
      state.products = await window.SupabaseService.getProducts();
      applyThemeAndBranding();
      renderCatalog();
      renderAdminDashboard();
      showToast('🔥 Conectado e sincronizado com o Firebase Firestore!');
    } else {
      showToast(result.message || 'Erro ao conectar ao Firebase.');
      renderAdminDashboard();
    }
  }

  async function disconnectFirebase() {
    await window.SupabaseService.saveFirebaseCredentials('', '');
    renderAdminDashboard();
    showToast('Desconectado do Firebase.');
  }

  async function handleSaveSupabaseConfig(event) {
    event.preventDefault();
    const url = document.getElementById('sup-url').value.trim();
    const key = document.getElementById('sup-key').value.trim();

    const result = await window.SupabaseService.saveCredentials(url, key);
    if (result.ok) {
      state.settings = await window.SupabaseService.getSettings();
      state.products = await window.SupabaseService.getProducts();
      applyThemeAndBranding();
      renderCatalog();
      renderAdminDashboard();
      showToast(result.mode === 'cloud' ? 'Conectado ao Supabase com sucesso!' : 'Operando no Cofre Local.');
    } else {
      showToast(result.message || 'Verifique as credenciais ou execute o Script SQL no Supabase.');
      renderAdminDashboard();
    }
  }

  async function disconnectSupabase() {
    await window.SupabaseService.saveCredentials('', '');
    renderAdminDashboard();
    showToast('Desconectado da nuvem.');
  }

  function copySqlSchema() {
    const sqlEl = document.getElementById('sql-schema-preview');
    if (!sqlEl) return;
    navigator.clipboard.writeText(sqlEl.textContent);
    showToast('Script SQL copiado!');
  }

  async function exportEncryptedCatalog() {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      products: state.products
    };
    const encrypted = await window.CryptoEngine.encryptData(payload, 'vitrine-backup-key-v1');
    const blob = new Blob([JSON.stringify({ cipher: 'AES-256-GCM', payload: encrypted }, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-vitrine-aes256.enc.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Cópia de segurança criptografada baixada!');
  }

  async function importEncryptedCatalog(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const decrypted = await window.CryptoEngine.decryptData(parsed.payload, 'vitrine-backup-key-v1');

      if (decrypted && Array.isArray(decrypted.products)) {
        if (decrypted.settings) {
          state.settings = await window.SupabaseService.updateSettings(decrypted.settings);
        }
        for (const prod of decrypted.products) {
          await window.SupabaseService.saveProduct(prod);
        }
        state.products = await window.SupabaseService.getProducts();
        applyThemeAndBranding();
        renderCatalog();
        renderAdminDashboard();
        showToast('Backup restaurado com sucesso!');
      }
    } catch (err) {
      showToast('Arquivo de backup inválido.');
    }
  }

  /**
   * ==========================================================================
   * CENTRAL DE PRIVACIDADE LGPD (DIREITOS DO TITULAR)
   * ==========================================================================
   */
  function initLgpdBanner() {
    const accepted = localStorage.getItem(LGPD_CONSENT_STATE_KEY);
    const banner = document.getElementById('lgpd-consent-banner');
    if (banner && !accepted) {
      banner.classList.remove('hidden');
    }
  }

  function acceptLgpdBanner() {
    localStorage.setItem(LGPD_CONSENT_STATE_KEY, new Date().toISOString());
    const banner = document.getElementById('lgpd-consent-banner');
    if (banner) banner.classList.add('hidden');
  }

  async function openLgpdModal() {
    const savedUser = await window.CryptoEngine.getSecureStorage(SAVED_CHECKIN_USER_KEY, null);
    const dpoEmail = document.getElementById('lgpd-dpo-display');
    if (dpoEmail) dpoEmail.textContent = state.settings.dpo_contact || 'privacidade@loja.com.br';

    const statusBox = document.getElementById('lgpd-user-data-status');
    if (statusBox) {
      if (savedUser) {
        statusBox.innerHTML = `
          <div class="p-3 bg-secondary rounded-lg text-footnote">
            <strong>Dados de Pré-Check-in salvos neste aparelho (Cifrados com AES-256-GCM):</strong><br/>
            • Nome: ${escapeHtml(savedUser.name)}<br/>
            • Telefone: ${escapeHtml(savedUser.phone)}<br/>
            • Endereço: ${escapeHtml(savedUser.address)}
          </div>
        `;
      } else {
        statusBox.innerHTML = `
          <div class="p-3 bg-secondary rounded-lg text-footnote text-secondary">
            Nenhum dado pessoal de pré-check-in está armazenado neste dispositivo.
          </div>
        `;
      }
    }

    openModal('lgpd-modal');
  }

  async function exportMyPersonalData() {
    const savedUser = await window.CryptoEngine.getSecureStorage(SAVED_CHECKIN_USER_KEY, null);
    const report = {
      lei_aplicavel: 'Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018)',
      data_exportacao: new Date().toISOString(),
      criptografia: 'AES-256-GCM + PBKDF2-HMAC-SHA256',
      dados_titular: savedUser || 'Nenhum dado armazenado.'
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meus-dados-lgpd.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Arquivo de portabilidade LGPD baixado.');
  }

  function deleteMyPersonalData() {
    localStorage.removeItem(SAVED_CHECKIN_USER_KEY);
    localStorage.removeItem(LGPD_CONSENT_STATE_KEY);
    ['checkin-name', 'checkin-phone', 'checkin-address'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    openLgpdModal();
    showToast('Seus dados foram apagados deste aparelho imediatamente.');
  }

  function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  function showToast(message) {
    const existing = document.getElementById('active-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'active-toast';
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3500);
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function bindGlobalEvents() {
    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        state.searchQuery = e.target.value;
        renderCatalog();
      });
    }

    // Apple Liquid Glass (iOS 27): toolbarMinimizationBehavior on scroll
    const navbar = document.querySelector('.hig-navbar');
    if (navbar) {
      window.addEventListener('scroll', () => {
        navbar.classList.toggle('is-minimized', window.scrollY > 36);
      }, { passive: true });
    }

    // Fechar modais com tecla Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        ['pre-checkin-modal', 'admin-modal', 'lgpd-modal'].forEach(closeModal);
      }
    });

    // Fechar modais ao clicar no fundo escuro (backdrop)
    ['pre-checkin-modal', 'admin-modal', 'lgpd-modal'].forEach(id => {
      const modalEl = document.getElementById(id);
      if (modalEl) {
        modalEl.addEventListener('click', e => {
          if (e.target === modalEl) {
            closeModal(id);
          }
        });
      }
    });
  }

  return {
    init,
    setCategory,
    selectSize,
    changeProductImage,
    addToBag,
    removeFromBag,
    openPreCheckinModal,
    handlePreCheckinSubmit,
    openAdminModal,
    handleCreateInitialPassword,
    verifyAdminPin,
    lockAdminSession,
    switchAdminTab,
    handleCategoryChangeInForm,
    toggleAdminSize,
    syncCustomSizesInput,
    handleImageUpload,
    removeFormImage,
    handleSaveProduct,
    startEditProduct,
    cancelEditProduct,
    handleDeleteProduct,
    handleSaveWhatsappSettings,
    testWhatsappConnection,
    selectColorSwatch,
    handleLogoUpload,
    clearLogo,
    handleSavePersonalization,
    handleUpdateAdminPin,
    handleSaveFirebaseConfig,
    disconnectFirebase,
    handleSaveSupabaseConfig,
    disconnectSupabase,
    copySqlSchema,
    exportEncryptedCatalog,
    importEncryptedCatalog,
    acceptLgpdBanner,
    openLgpdModal,
    exportMyPersonalData,
    deleteMyPersonalData,
    closeModal
  };
})();

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
