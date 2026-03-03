// ==========================================
// FINANÇAS FAMILIAR - APP.JS (VERSÃO CORRIGIDA)
// ==========================================

// ==========================================
// CONFIGURAÇÃO E ESTADO GLOBAL
// ==========================================

const STORAGE_KEYS = {
  USERS: "financas_users",
  CURRENT_USER: "financas_current_user",
  PASSWORD_RESET: "financas_password_reset",
  FINANCES: "financas_finances",
};

let currentUser = null;
let currentMonth = new Date().toISOString().slice(0, 7);
let formSubmitLock = false;

// ==========================================
// INICIALIZAÇÃO PRINCIPAL
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("=== DOM CARREGADO ===");

  const path = window.location.pathname;
  const page = path.split("/").pop() || "index.html";
  console.log("Página:", page);

  // Verificar token de redefinição de senha
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get("reset");

  if (resetToken && (page === "index.html" || page === "")) {
    showPasswordResetForm(resetToken);
    return;
  }

  if (page === "index.html" || page === "" || page === "login.html") {
    initLoginPage();
  } else if (page === "financas.html" || page === "dashboard.html") {
    initAppPage();
  }
});

// ==========================================
// PÁGINA DE LOGIN (index.html)
// ==========================================

function initLoginPage() {
  console.log("Inicializando login...");

  // Verificar se já está logado
  const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (savedUser) {
    window.location.href = "financas.html";
    return;
  }

  // Configurar tabs
  const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
  const registerTab = document.querySelector('.auth-tab[data-tab="register"]');

  if (loginTab) {
    loginTab.addEventListener("click", () => switchAuthTab("login"));
  }
  if (registerTab) {
    registerTab.addEventListener("click", () => switchAuthTab("register"));
  }

  // Configurar formulários
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister);
  }

  // Link esqueci senha
  const forgotLink = document.getElementById("forgotPasswordLink");
  if (forgotLink) {
    forgotLink.addEventListener("click", function (e) {
      e.preventDefault();
      showForgotPasswordForm();
    });
  }
}

function switchAuthTab(tab) {
  console.log("Switch tab:", tab);

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
  const registerTab = document.querySelector('.auth-tab[data-tab="register"]');

  // Esconder todos
  if (loginForm) loginForm.classList.remove("active");
  if (registerForm) registerForm.classList.remove("active");
  if (loginTab) loginTab.classList.remove("active");
  if (registerTab) registerTab.classList.remove("active");

  // Mostrar o correto
  if (tab === "login") {
    if (loginForm) loginForm.classList.add("active");
    if (loginTab) loginTab.classList.add("active");
  } else {
    if (registerForm) registerForm.classList.add("active");
    if (registerTab) registerTab.classList.add("active");
  }
}

function handleLogin(e) {
  e.preventDefault();
  console.log("Fazendo login...");

  const email = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;

  if (!email || !password) {
    showNotification("Preencha todos os campos!", "error");
    return;
  }

  const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
  const user = users.find((u) => u.email === email && u.password === password);

  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    showNotification("Login realizado!", "success");
    setTimeout(() => {
      window.location.href = "financas.html";
    }, 500);
  } else {
    showNotification("Email ou senha incorretos!", "error");
  }
}

function handleRegister(e) {
  e.preventDefault();
  console.log("Registrando...");

  if (formSubmitLock) return;
  formSubmitLock = true;

  const name = document.getElementById("registerName")?.value.trim();
  const email = document.getElementById("registerEmail")?.value.trim();
  const password = document.getElementById("registerPassword")?.value;
  const confirmPassword = document.getElementById(
    "registerConfirmPassword",
  )?.value;

  if (!name || !email || !password || !confirmPassword) {
    showNotification("Preencha todos os campos!", "error");
    formSubmitLock = false;
    return;
  }

  if (password.length < 6) {
    showNotification("Senha mínimo 6 caracteres!", "error");
    formSubmitLock = false;
    return;
  }

  if (password !== confirmPassword) {
    showNotification("Senhas não coincidem!", "error");
    formSubmitLock = false;
    return;
  }

  const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");

  if (users.find((u) => u.email === email)) {
    showNotification("Email já cadastrado!", "error");
    formSubmitLock = false;
    return;
  }

  const newUser = {
    id: Date.now().toString(),
    name,
    email,
    password,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));

  // Inicializar dados
  initializeUserData(newUser.id);

  showNotification("Conta criada!", "success");
  setTimeout(() => {
    window.location.href = "financas.html";
  }, 1000);
}

function initializeUserData(userId) {
  const userData = {
    familyMembers: [],
    finances: {},
    debts: [],
  };
  localStorage.setItem(
    `${STORAGE_KEYS.FINANCES}_${userId}`,
    JSON.stringify(userData),
  );
}

// ==========================================
// RECUPERAÇÃO DE SENHA
// ==========================================

function showForgotPasswordForm() {
  const container = document.querySelector(".auth-card");
  if (!container) return;

  // Esconder formulários existentes
  const existingForms = container.querySelectorAll(".auth-form");
  existingForms.forEach((f) => (f.style.display = "none"));

  // Criar formulário de recuperação
  const forgotForm = document.createElement("form");
  forgotForm.id = "forgotForm";
  forgotForm.className = "auth-form active";
  forgotForm.innerHTML = `
    <h2>Recuperar Senha</h2>
    <p style="color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.9rem;">
      Digite seu email cadastrado.
    </p>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="forgotEmail" placeholder="seu@email.com" required />
    </div>
    <button type="submit" class="btn btn-primary btn-full">Enviar Link</button>
    <p class="auth-switch">
      <a href="#" onclick="backToLogin(event)">← Voltar ao login</a>
    </p>
  `;

  container.appendChild(forgotForm);
  forgotForm.addEventListener("submit", handleForgotPassword);
}

function backToLogin(e) {
  if (e) e.preventDefault();
  location.reload();
}

function handleForgotPassword(e) {
  e.preventDefault();

  const email = document.getElementById("forgotEmail")?.value.trim();
  if (!email) {
    showNotification("Digite seu email!", "error");
    return;
  }

  const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
  const user = users.find((u) => u.email === email);

  if (!user) {
    showNotification(
      "Se este email existir, você receberá instruções.",
      "info",
    );
    setTimeout(backToLogin, 3000);
    return;
  }

  // Gerar token
  const token =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  const resetData = {
    token,
    userId: user.id,
    email: user.email,
    expires: Date.now() + 24 * 60 * 60 * 1000,
    used: false,
  };

  const resets = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.PASSWORD_RESET) || "[]",
  );
  resets.push(resetData);
  localStorage.setItem(STORAGE_KEYS.PASSWORD_RESET, JSON.stringify(resets));

  // Mostrar link (simulação)
  const forgotForm = document.getElementById("forgotForm");
  if (forgotForm) {
    const linkDiv = document.createElement("div");
    linkDiv.style.cssText =
      "margin-top: 1rem; padding: 1rem; background: var(--bg-card); border-radius: 8px; word-break: break-all;";
    linkDiv.innerHTML = `
      <p style="color: var(--accent-gold); font-size: 0.85rem; margin-bottom: 0.5rem;">
        Link de recuperação (modo teste):
      </p>
      <a href="?reset=${token}" style="color: var(--accent-blue); font-size: 0.8rem;">
        ${window.location.origin}${window.location.pathname}?reset=${token}
      </a>
    `;
    forgotForm.appendChild(linkDiv);
  }

  showNotification("Link gerado! Verifique acima.", "success");
}

function showPasswordResetForm(token) {
  const resets = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.PASSWORD_RESET) || "[]",
  );
  const resetData = resets.find(
    (r) => r.token === token && !r.used && r.expires > Date.now(),
  );

  if (!resetData) {
    showNotification("Link inválido ou expirado!", "error");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
    return;
  }

  const container = document.querySelector(".auth-container");
  if (container) {
    container.innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">
          <div class="logo-icon-large">🔐</div>
          <h1>Nova Senha</h1>
        </div>
        <form id="resetForm" class="auth-form active">
          <div class="form-group">
            <label>Nova Senha</label>
            <input type="password" id="newPassword" placeholder="Mínimo 6 caracteres" minlength="6" required />
          </div>
          <div class="form-group">
            <label>Confirmar Nova Senha</label>
            <input type="password" id="confirmNewPassword" placeholder="••••••••" required />
          </div>
          <button type="submit" class="btn btn-primary btn-full">Redefinir Senha</button>
        </form>
      </div>
    `;

    document
      .getElementById("resetForm")
      .addEventListener("submit", function (e) {
        e.preventDefault();

        const newPass = document.getElementById("newPassword").value;
        const confirmPass = document.getElementById("confirmNewPassword").value;

        if (newPass !== confirmPass) {
          showNotification("As senhas não coincidem!", "error");
          return;
        }

        const users = JSON.parse(
          localStorage.getItem(STORAGE_KEYS.USERS) || "[]",
        );
        const userIndex = users.findIndex((u) => u.id === resetData.userId);

        if (userIndex >= 0) {
          users[userIndex].password = newPass;
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

          resetData.used = true;
          localStorage.setItem(
            STORAGE_KEYS.PASSWORD_RESET,
            JSON.stringify(resets),
          );

          showNotification("Senha alterada!", "success");
          setTimeout(() => {
            window.location.href = "index.html";
          }, 1500);
        }
      });
  }
}

// ==========================================
// PÁGINA DO APP (financas.html)
// ==========================================

function initAppPage() {
  console.log("=== INICIANDO APP ===");

  // Verificar login
  const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (!savedUser) {
    console.log("Sem usuário, redirecionando...");
    window.location.href = "index.html";
    return;
  }

  currentUser = JSON.parse(savedUser);
  console.log("Usuário:", currentUser);

  // Atualizar info do usuário na sidebar
  const userNameEl = document.getElementById("userName");
  const userEmailEl = document.getElementById("userEmail");
  if (userNameEl) userNameEl.textContent = currentUser.name;
  if (userEmailEl) userEmailEl.textContent = currentUser.email;

  // Configurar mês
  const monthInput = document.getElementById("currentMonth");
  if (monthInput) {
    monthInput.value = currentMonth;
    monthInput.addEventListener("change", changeMonth);
  }

  // Configurar navegação mobile
  window.toggleMobileMenu = function () {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.querySelector(".sidebar-overlay");
    sidebar?.classList.toggle("active");
    overlay?.classList.toggle("active");
  };

  // Configurar formulários
  setupForms();

  // Carregar dados
  loadAllData();

  // Mostrar dashboard por padrão
  showSection("dashboard");

  console.log("=== APP PRONTO ===");
}

function setupForms() {
  console.log("Configurando formulários...");

  const forms = [
    { id: "memberForm", handler: addFamilyMember },
    { id: "debtForm", handler: addDebt },
    { id: "incomeForm", handler: addIncome },
    { id: "billForm", handler: addBill },
  ];

  forms.forEach(({ id, handler }) => {
    const form = document.getElementById(id);
    if (form) {
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);
      newForm.addEventListener("submit", handler);
      console.log(`✓ Formulário ${id} configurado`);
    } else {
      console.warn(`✗ Formulário ${id} não encontrado`);
    }
  });
}

function loadAllData() {
  console.log("Carregando dados...");
  loadFamilyMembers();
  loadDebts();
  loadIncomes();
  loadBills();
  updateDashboard();
  updateReports();
}

// ==========================================
// NAVEGAÇÃO
// ==========================================

function showSection(sectionId) {
  console.log("Mostrando seção:", sectionId);

  // Atualizar navegação
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
    const onclickAttr = item.getAttribute("onclick") || "";
    if (onclickAttr.includes(sectionId)) {
      item.classList.add("active");
    }
  });

  // Mostrar seção
  document.querySelectorAll(".content-section").forEach((section) => {
    section.classList.remove("active");
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add("active");
  }

  // Atualizar título
  const titles = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Visão geral da sua saúde financeira",
    },
    rendas: {
      title: "Rendas Familiares",
      subtitle: "Gerencie os membros da família",
    },
    dividas: { title: "Dívidas", subtitle: "Controle suas dívidas" },
    recebimentos: { title: "Recebimentos", subtitle: "Rendas extras" },
    contas: { title: "Contas a Pagar", subtitle: "Gerencie suas contas" },
    relatorios: { title: "Relatórios", subtitle: "Análises detalhadas" },
    historico: { title: "Histórico", subtitle: "Evolução financeira" },
    configuracoes: { title: "Configurações", subtitle: "Gerencie seus dados" },
  };

  const titleEl = document.getElementById("pageTitle");
  const subtitleEl = document.getElementById("pageSubtitle");
  if (titles[sectionId]) {
    if (titleEl) titleEl.textContent = titles[sectionId].title;
    if (subtitleEl) subtitleEl.textContent = titles[sectionId].subtitle;
  }

  // Fechar menu mobile
  const sidebar = document.getElementById("sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  if (sidebar) sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");

  // Recarregar dados específicos
  if (sectionId === "dashboard") updateDashboard();
  if (sectionId === "relatorios") updateReports();
  if (sectionId === "historico") loadFinancialEvolution();
}

function logout() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  currentUser = null;
  window.location.href = "index.html";
}

function changeMonth() {
  const newMonth = document.getElementById("currentMonth")?.value;
  if (newMonth) {
    currentMonth = newMonth;
    loadAllData();
    showNotification(`Mês: ${formatMonth(currentMonth)}`, "info");
  }
}

// ==========================================
// GERENCIAMENTO DE DADOS
// ==========================================

function getUserData() {
  if (!currentUser) {
    console.error("Sem usuário logado!");
    return { familyMembers: [], finances: {}, debts: [] };
  }

  const key = `${STORAGE_KEYS.FINANCES}_${currentUser.id}`;
  const data = localStorage.getItem(key);

  if (!data) {
    return { familyMembers: [], finances: {}, debts: [] };
  }

  try {
    const parsed = JSON.parse(data);
    // Garantir que debts sempre exista
    if (!parsed.debts) parsed.debts = [];
    return parsed;
  } catch (e) {
    console.error("Erro ao parsear dados:", e);
    return { familyMembers: [], finances: {}, debts: [] };
  }
}

function saveUserData(data) {
  if (!currentUser) {
    console.error("Sem usuário logado!");
    return;
  }

  const key = `${STORAGE_KEYS.FINANCES}_${currentUser.id}`;
  localStorage.setItem(key, JSON.stringify(data));
  console.log("Dados salvos!");
}

function getMonthData(month = currentMonth) {
  const userData = getUserData();
  if (!userData.finances) userData.finances = {};
  if (!userData.finances[month]) {
    userData.finances[month] = { incomes: [], bills: [] };
  }
  return userData.finances[month];
}

function saveMonthData(month, data) {
  const userData = getUserData();
  userData.finances[month] = data;
  saveUserData(userData);
}

// ==========================================
// MEMBROS DA FAMÍLIA
// ==========================================

function loadFamilyMembers() {
  console.log("=== CARREGANDO MEMBROS ===");

  const userData = getUserData();
  const members = userData.familyMembers || [];
  console.log("Membros:", members.length, members);

  const countEl = document.getElementById("memberCount");
  if (countEl) {
    countEl.textContent = `${members.length} membro${members.length !== 1 ? "s" : ""}`;
  }

  const tbody = document.getElementById("membersTableBody");
  if (!tbody) {
    console.error("Tabela membersTableBody não encontrada!");
    return;
  }

  if (members.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">
          <div class="empty-state small">
            <div class="empty-state-icon">👤</div>
            <h4>Nenhum membro cadastrado</h4>
            <p>Adicione os membros da sua família acima</p>
          </div>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = members
      .map(
        (m) => `
      <tr data-id="${m.id}">
        <td><strong>${escapeHtml(m.name)}</strong></td>
        <td>${escapeHtml(getIncomeTypeLabel(m.type))}</td>
        <td style="color: var(--accent-gold); font-weight: 600;">${formatCurrency(m.defaultSalary || 0)}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon btn-edit" onclick="editFamilyMember('${m.id}')" title="Editar">✏️</button>
            <button class="btn-icon btn-delete" onclick="deleteFamilyMember('${m.id}')" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>
    `,
      )
      .join("");
  }

  updateFamilyTotal(members);
}

function getIncomeTypeLabel(type) {
  const labels = {
    salario: "Salário Fixo",
    freelance: "Freelance/Autônomo",
    aposentadoria: "Aposentadoria",
    aluguel: "Aluguel",
    outro: "Outro",
  };
  return labels[type] || "Salário Fixo";
}

function updateFamilyTotal(members) {
  const total = members.reduce(
    (sum, m) => sum + (parseFloat(m.defaultSalary) || 0),
    0,
  );
  const totalEl = document.getElementById("familyTotalIncome");
  if (totalEl) {
    totalEl.textContent = formatCurrency(total);
  }
}

function addFamilyMember(e) {
  e.preventDefault();
  console.log("=== ADICIONANDO MEMBRO ===");

  if (formSubmitLock) {
    console.log("Bloqueado");
    return;
  }
  formSubmitLock = true;

  const nameInput = document.getElementById("memberName");
  const salaryInput = document.getElementById("memberSalary");
  const typeInput = document.getElementById("memberType");

  console.log("Inputs:", { nameInput, salaryInput, typeInput });

  if (!nameInput || !salaryInput) {
    showNotification("Erro: campos não encontrados!", "error");
    formSubmitLock = false;
    return;
  }

  const name = nameInput.value.trim();
  const salary = parseFloat(salaryInput.value) || 0;
  const type = typeInput ? typeInput.value : "salario";

  console.log("Dados:", { name, salary, type });

  if (!name) {
    showNotification("Digite o nome!", "error");
    formSubmitLock = false;
    return;
  }

  const userData = getUserData();
  if (!userData.familyMembers) userData.familyMembers = [];

  const exists = userData.familyMembers.find(
    (m) => m.name.toLowerCase() === name.toLowerCase(),
  );
  if (exists) {
    showNotification("Já existe membro com este nome!", "error");
    formSubmitLock = false;
    return;
  }

  const member = {
    id: Date.now().toString(),
    name,
    defaultSalary: salary,
    type,
    createdAt: new Date().toISOString(),
  };

  userData.familyMembers.push(member);
  saveUserData(userData);

  console.log("Membro salvo:", member);

  e.target.reset();
  loadFamilyMembers();
  updateDashboard();
  showNotification("Membro adicionado com sucesso!", "success");

  setTimeout(() => {
    formSubmitLock = false;
  }, 1000);
}

function editFamilyMember(id) {
  const userData = getUserData();
  const member = userData.familyMembers.find((m) => m.id === id);
  if (!member) return;

  const newName = prompt("Nome:", member.name);
  if (newName === null) return;

  const newSalary = prompt("Salário (R$):", member.defaultSalary || 0);
  if (newSalary === null) return;

  member.name = newName.trim() || member.name;
  member.defaultSalary = parseFloat(newSalary) || member.defaultSalary;

  saveUserData(userData);
  loadFamilyMembers();
  updateDashboard();
  showNotification("Membro atualizado!", "success");
}

function deleteFamilyMember(id) {
  if (!confirm("Excluir este membro?")) return;

  const userData = getUserData();
  userData.familyMembers = userData.familyMembers.filter((m) => m.id !== id);
  saveUserData(userData);

  loadFamilyMembers();
  updateDashboard();
  showNotification("Membro excluído!", "success");
}

// ==========================================
// DÍVIDAS
// ==========================================

function addDebt(e) {
  e.preventDefault();

  if (formSubmitLock) return;
  formSubmitLock = true;

  const description = document.getElementById("debtDescription")?.value.trim();
  const creditor = document.getElementById("debtCreditor")?.value.trim();
  const total = parseFloat(document.getElementById("debtTotal")?.value) || 0;
  const installment =
    parseFloat(document.getElementById("debtInstallment")?.value) || 0;
  const installments =
    parseInt(document.getElementById("debtInstallments")?.value) || 1;
  const paid = parseInt(document.getElementById("debtPaid")?.value) || 0;
  const dueDay = parseInt(document.getElementById("debtDueDay")?.value) || 1;

  if (!description || !creditor) {
    showNotification("Preencha todos os campos obrigatórios!", "error");
    formSubmitLock = false;
    return;
  }

  const userData = getUserData();
  if (!userData.debts) userData.debts = [];

  userData.debts.push({
    id: Date.now().toString(),
    description,
    creditor,
    total,
    installment,
    installments,
    paid,
    dueDay,
    createdAt: new Date().toISOString(),
  });

  saveUserData(userData);

  e.target.reset();
  const paidInput = document.getElementById("debtPaid");
  if (paidInput) paidInput.value = "0";

  loadDebts();
  updateDashboard();
  showNotification("Dívida adicionada!", "success");

  setTimeout(() => {
    formSubmitLock = false;
  }, 1000);
}

function loadDebts() {
  const userData = getUserData();
  const debts = userData.debts || [];

  const tbody = document.getElementById("debtTableBody");
  const count = document.getElementById("debtCount");

  if (count) count.textContent = `${debts.length} registro(s)`;

  if (tbody) {
    if (debts.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="8">
            <div class="empty-state small">
              <div class="empty-state-icon">💳</div>
              <h4>Nenhuma dívida cadastrada</h4>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = debts
        .map((d) => {
          const paidAmount = d.installment * d.paid;
          const remaining = Math.max(d.total - paidAmount, 0);
          const progress =
            d.installments > 0 ? (d.paid / d.installments) * 100 : 0;

          return `
            <tr>
              <td><strong>${escapeHtml(d.description)}</strong></td>
              <td>${escapeHtml(d.creditor)}</td>
              <td>${formatCurrency(d.total)}</td>
              <td>${formatCurrency(d.installment)}</td>
              <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <div style="flex: 1; height: 6px; background: var(--bg-card); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${Math.min(progress, 100)}%; height: 100%; background: var(--gradient-gold);"></div>
                  </div>
                  <span style="font-size: 0.85rem;">${d.paid}/${d.installments}</span>
                </div>
              </td>
              <td>Dia ${d.dueDay}</td>
              <td style="color: var(--accent-rose); font-weight: 600;">${formatCurrency(remaining)}</td>
              <td>
                <div class="action-btns">
                  <button class="btn-icon btn-edit" onclick="editDebt('${d.id}')" title="Editar">✏️</button>
                  <button class="btn-icon btn-delete" onclick="deleteDebt('${d.id}')" title="Excluir">🗑️</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");
    }
  }
}

function editDebt(id) {
  const userData = getUserData();
  const debt = userData.debts.find((d) => d.id === id);
  if (!debt) return;

  const newPaid = prompt("Parcelas pagas:", debt.paid);
  if (newPaid === null) return;

  debt.paid = parseInt(newPaid) || debt.paid;
  saveUserData(userData);
  loadDebts();
  updateDashboard();
  showNotification("Dívida atualizada!", "success");
}

function deleteDebt(id) {
  if (!confirm("Excluir esta dívida?")) return;

  const userData = getUserData();
  userData.debts = userData.debts.filter((d) => d.id !== id);
  saveUserData(userData);

  loadDebts();
  updateDashboard();
  showNotification("Dívida excluída!", "success");
}

// ==========================================
// RECEBIMENTOS (RENDA EXTRA)
// ==========================================

function addIncome(e) {
  e.preventDefault();

  if (formSubmitLock) return;
  formSubmitLock = true;

  const description = document
    .getElementById("incomeDescription")
    ?.value.trim();
  const category = document.getElementById("incomeCategory")?.value;
  const amount =
    parseFloat(document.getElementById("incomeAmount")?.value) || 0;
  const date = document.getElementById("incomeDate")?.value;
  const recurring =
    document.getElementById("incomeRecurring")?.value === "true";

  if (!description || !category || !amount) {
    showNotification("Preencha todos os campos!", "error");
    formSubmitLock = false;
    return;
  }

  const monthData = getMonthData();
  if (!monthData.incomes) monthData.incomes = [];

  monthData.incomes.push({
    id: Date.now().toString(),
    description,
    category,
    amount,
    date,
    recurring,
    createdAt: new Date().toISOString(),
  });

  saveMonthData(currentMonth, monthData);

  e.target.reset();
  const dateInput = document.getElementById("incomeDate");
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

  loadIncomes();
  updateDashboard();
  showNotification("Recebimento adicionado!", "success");

  setTimeout(() => {
    formSubmitLock = false;
  }, 1000);
}

function loadIncomes() {
  const monthData = getMonthData();
  const incomes = monthData.incomes || [];

  const tbody = document.getElementById("incomeTableBody");
  const count = document.getElementById("incomeCount");

  if (count) count.textContent = `${incomes.length} registro(s)`;

  if (tbody) {
    if (incomes.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">
            <div class="empty-state small">
              <div class="empty-state-icon">💰</div>
              <h4>Nenhum recebimento cadastrado</h4>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = incomes
        .map(
          (i) => `
        <tr>
          <td><strong>${escapeHtml(i.description)}</strong></td>
          <td><span class="status-badge" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue);">${i.category}</span></td>
          <td style="color: var(--accent-emerald); font-weight: 600;">${formatCurrency(i.amount)}</td>
          <td>${formatDate(i.date)}</td>
          <td>${i.recurring ? "♻️ Sim" : "Não"}</td>
          <td>
            <div class="action-btns">
              <button class="btn-icon btn-edit" onclick="editIncome('${i.id}')" title="Editar">✏️</button>
              <button class="btn-icon btn-delete" onclick="deleteIncome('${i.id}')" title="Excluir">🗑️</button>
            </div>
          </td>
        </tr>
      `,
        )
        .join("");
    }
  }
}

function editIncome(id) {
  const monthData = getMonthData();
  const income = monthData.incomes.find((i) => i.id === id);
  if (!income) return;

  const newAmount = prompt("Novo valor (R$):", income.amount);
  if (newAmount === null) return;

  income.amount = parseFloat(newAmount) || income.amount;
  saveMonthData(currentMonth, monthData);
  loadIncomes();
  updateDashboard();
  showNotification("Recebimento atualizado!", "success");
}

function deleteIncome(id) {
  if (!confirm("Excluir este recebimento?")) return;

  const monthData = getMonthData();
  monthData.incomes = monthData.incomes.filter((i) => i.id !== id);
  saveMonthData(currentMonth, monthData);

  loadIncomes();
  updateDashboard();
  showNotification("Recebimento excluído!", "success");
}

// ==========================================
// CONTAS
// ==========================================

function addBill(e) {
  e.preventDefault();

  if (formSubmitLock) return;
  formSubmitLock = true;

  const description = document.getElementById("billDescription")?.value.trim();
  const category = document.getElementById("billCategory")?.value;
  const amount = parseFloat(document.getElementById("billAmount")?.value) || 0;
  const dueDate = document.getElementById("billDueDate")?.value;
  const status = document.getElementById("billStatus")?.value || "Pendente";
  const recurring = document.getElementById("billRecurring")?.value === "true";

  if (!description || !category || !amount || !dueDate) {
    showNotification("Preencha todos os campos!", "error");
    formSubmitLock = false;
    return;
  }

  const monthData = getMonthData();
  if (!monthData.bills) monthData.bills = [];

  monthData.bills.push({
    id: Date.now().toString(),
    description,
    category,
    amount,
    dueDate,
    status,
    recurring,
    createdAt: new Date().toISOString(),
  });

  saveMonthData(currentMonth, monthData);

  e.target.reset();
  const dueInput = document.getElementById("billDueDate");
  if (dueInput) dueInput.value = new Date().toISOString().split("T")[0];

  loadBills();
  updateDashboard();
  showNotification("Conta adicionada!", "success");

  setTimeout(() => {
    formSubmitLock = false;
  }, 1000);
}

function loadBills() {
  const monthData = getMonthData();
  const bills = monthData.bills || [];

  const tbody = document.getElementById("billTableBody");
  const count = document.getElementById("billCount");

  if (count) count.textContent = `${bills.length} registro(s)`;

  if (tbody) {
    if (bills.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7">
            <div class="empty-state small">
              <div class="empty-state-icon">📄</div>
              <h4>Nenhuma conta cadastrada</h4>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = bills
        .map((b) => {
          const daysUntil = Math.ceil(
            (new Date(b.dueDate) - new Date()) / (1000 * 60 * 60 * 24),
          );
          let daysText, daysColor;

          if (b.status === "Pago") {
            daysText = "✅ Pago";
            daysColor = "var(--accent-emerald)";
          } else if (daysUntil < 0) {
            daysText = `⚠️ ${Math.abs(daysUntil)} dias atrás`;
            daysColor = "var(--accent-rose)";
          } else if (daysUntil === 0) {
            daysText = "🔴 Vence hoje";
            daysColor = "var(--accent-rose)";
          } else if (daysUntil <= 3) {
            daysText = `⚡ ${daysUntil} dias`;
            daysColor = "var(--accent-gold)";
          } else {
            daysText = `${daysUntil} dias`;
            daysColor = "var(--text-secondary)";
          }

          return `
            <tr>
              <td><strong>${escapeHtml(b.description)}</strong></td>
              <td><span class="status-badge" style="background: rgba(245, 158, 11, 0.1); color: var(--accent-gold);">${b.category}</span></td>
              <td style="font-weight: 600;">${formatCurrency(b.amount)}</td>
              <td>${formatDate(b.dueDate)}</td>
              <td><span class="status-badge ${b.status === "Pago" ? "status-paid" : "status-pending"}">${b.status}</span></td>
              <td style="color: ${daysColor};">${daysText}</td>
              <td>
                <div class="action-btns">
                  <button class="btn-icon btn-edit" onclick="toggleBillStatus('${b.id}')" title="${b.status === "Pago" ? "Marcar pendente" : "Marcar pago"}">${b.status === "Pago" ? "↩️" : "✓"}</button>
                  <button class="btn-icon btn-edit" onclick="editBill('${b.id}')" title="Editar">✏️</button>
                  <button class="btn-icon btn-delete" onclick="deleteBill('${b.id}')" title="Excluir">🗑️</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");
    }
  }
}

function toggleBillStatus(id) {
  const monthData = getMonthData();
  const bill = monthData.bills.find((b) => b.id === id);
  if (!bill) return;

  bill.status = bill.status === "Pago" ? "Pendente" : "Pago";
  saveMonthData(currentMonth, monthData);
  loadBills();
  updateDashboard();
  showNotification(`Conta ${bill.status.toLowerCase()}!`, "success");
}

function editBill(id) {
  const monthData = getMonthData();
  const bill = monthData.bills.find((b) => b.id === id);
  if (!bill) return;

  const newAmount = prompt("Novo valor (R$):", bill.amount);
  if (newAmount === null) return;

  bill.amount = parseFloat(newAmount) || bill.amount;
  saveMonthData(currentMonth, monthData);
  loadBills();
  updateDashboard();
  showNotification("Conta atualizada!", "success");
}

function deleteBill(id) {
  if (!confirm("Excluir esta conta?")) return;

  const monthData = getMonthData();
  monthData.bills = monthData.bills.filter((b) => b.id !== id);
  saveMonthData(currentMonth, monthData);

  loadBills();
  updateDashboard();
  showNotification("Conta excluída!", "success");
}

// ==========================================
// DASHBOARD (CORRIGIDO)
// ==========================================

function updateDashboard() {
  const monthData = getMonthData();
  const userData = getUserData();

  // CORREÇÃO: Somar renda dos membros da família (defaultSalary)
  const familyIncome = (userData.familyMembers || []).reduce(
    (sum, m) => sum + (parseFloat(m.defaultSalary) || 0),
    0,
  );

  // Renda extra do mês (recebimentos)
  const extraIncome = (monthData.incomes || []).reduce(
    (sum, i) => sum + i.amount,
    0,
  );

  // Total de renda (FAMÍLIA + EXTRA)
  const totalIncome = familyIncome + extraIncome;

  // Contas a pagar (apenas pendentes)
  const totalBills = (monthData.bills || []).reduce(
    (sum, b) => sum + (b.status !== "Pago" ? b.amount : 0),
    0,
  );

  // Dívidas (parcelas mensais)
  const totalDebts = (userData.debts || []).reduce(
    (sum, d) => sum + (d.installment || 0),
    0,
  );

  // Saldo disponível
  const balance = totalIncome - totalBills - totalDebts;

  // Atualizar cards
  const incomeEl = document.getElementById("totalIncome");
  const debtsEl = document.getElementById("totalDebts");
  const billsEl = document.getElementById("totalBills");
  const balanceEl = document.getElementById("availableBalance");

  if (incomeEl) incomeEl.textContent = formatCurrency(totalIncome);
  if (debtsEl) debtsEl.textContent = formatCurrency(totalDebts);
  if (billsEl) billsEl.textContent = formatCurrency(totalBills);
  if (balanceEl) balanceEl.textContent = formatCurrency(balance);

  // Atualizar alertas e gráficos
  updateAlerts(monthData.bills || [], userData.debts || []);
  updateMainChart(totalIncome, totalBills, totalDebts, balance);
}

function updateAlerts(bills, debts) {
  const container = document.getElementById("alertsContainer");
  if (!container) return;

  const alerts = [];
  const today = new Date();
  const hoje = today.getDate();

  // Verificar contas pendentes
  (bills || [])
    .filter((b) => b.status !== "Pago")
    .forEach((b) => {
      const dueDate = new Date(b.dueDate);
      const diffTime = dueDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        alerts.push({
          type: "danger",
          icon: "⚠️",
          title: `Conta VENCIDA: ${b.description}`,
          text: `Venceu há ${Math.abs(diffDays)} dias - ${formatCurrency(b.amount)}`,
          urgencia: 1,
        });
      } else if (diffDays === 0) {
        alerts.push({
          type: "danger",
          icon: "🔴",
          title: `Conta VENCE HOJE: ${b.description}`,
          text: `${formatCurrency(b.amount)} - Pague agora!`,
          urgencia: 2,
        });
      } else if (diffDays <= 3) {
        alerts.push({
          type: "warning",
          icon: "⏰",
          title: `Conta próxima do vencimento: ${b.description}`,
          text: `Vence em ${diffDays} dias (${formatDate(b.dueDate)}) - ${formatCurrency(b.amount)}`,
          urgencia: 3,
        });
      } else if (diffDays <= 7) {
        alerts.push({
          type: "info",
          icon: "📅",
          title: `Conta em breve: ${b.description}`,
          text: `Vence em ${diffDays} dias - ${formatCurrency(b.amount)}`,
          urgencia: 4,
        });
      }
    });

  // Verificar dívidas (parcelas mensais)
  (debts || []).forEach((d) => {
    const diaVencimento = d.dueDay || 1;
    const diasAteVencimento = diaVencimento - hoje;

    if (
      diasAteVencimento >= -5 &&
      diasAteVencimento <= 0 &&
      d.paid < d.installments
    ) {
      alerts.push({
        type: "danger",
        icon: "💳",
        title: `Parcela de dívida VENCIDA/HOJE: ${d.description}`,
        text: `Vence dia ${diaVencimento} - Parcela: ${formatCurrency(d.installment)} (${d.paid}/${d.installments})`,
        urgencia: 2,
      });
    } else if (
      diasAteVencimento > 0 &&
      diasAteVencimento <= 5 &&
      d.paid < d.installments
    ) {
      alerts.push({
        type: "warning",
        icon: "💳",
        title: `Parcela de dívida próxima: ${d.description}`,
        text: `Vence dia ${diaVencimento} (em ${diasAteVencimento} dias) - ${formatCurrency(d.installment)}`,
        urgencia: 3,
      });
    }
  });

  // Ordenar por urgência
  alerts.sort((a, b) => a.urgencia - b.urgencia);

  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <h3>Tudo em ordem!</h3>
        <p>Nenhum alerta no momento</p>
      </div>
    `;
  } else {
    container.innerHTML = alerts
      .map(
        (a) => `
      <div class="alert-item ${a.type}">
        <div class="alert-icon">${a.icon}</div>
        <div class="alert-content">
          <h4>${escapeHtml(a.title)}</h4>
          <p>${escapeHtml(a.text)}</p>
        </div>
      </div>
    `,
      )
      .join("");
  }
}

function updateMainChart(income, bills, debts, balance) {
  const ctx = document.getElementById("mainChart");
  if (!ctx) return;

  if (window.mainChartInstance) {
    window.mainChartInstance.destroy();
  }

  window.mainChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Renda", "Contas", "Dívidas", "Saldo"],
      datasets: [
        {
          data: [income, bills, debts, Math.max(balance, 0)],
          backgroundColor: ["#f59e0b", "#3b82f6", "#f43f5e", "#10b981"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#cbd5e1", padding: 20 },
        },
      },
    },
  });
}

// ==========================================
// RELATÓRIOS
// ==========================================

function updateReports() {
  const monthData = getMonthData();
  const userData = getUserData();

  // Dados para relatórios
  const familyIncome = (userData.familyMembers || []).reduce(
    (sum, m) => sum + (parseFloat(m.defaultSalary) || 0),
    0,
  );
  const extraIncome = (monthData.incomes || []).reduce(
    (sum, i) => sum + i.amount,
    0,
  );
  const totalIncome = familyIncome + extraIncome;

  const totalBills = (monthData.bills || []).reduce(
    (sum, b) => sum + b.amount,
    0,
  );
  const totalDebts = (userData.debts || []).reduce(
    (sum, d) => sum + (d.installment || 0),
    0,
  );

  // Gráfico 1: Receitas vs Despesas
  const ctx1 = document.getElementById("reportChart1");
  if (ctx1) {
    if (window.reportChart1Instance) {
      window.reportChart1Instance.destroy();
    }

    window.reportChart1Instance = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: ["Renda Familiar", "Renda Extra", "Contas", "Dívidas"],
        datasets: [
          {
            label: "Valores (R$)",
            data: [familyIncome, extraIncome, totalBills, totalDebts],
            backgroundColor: ["#f59e0b", "#10b981", "#3b82f6", "#f43f5e"],
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: "#64748b",
              callback: function (value) {
                return formatCurrency(value);
              },
            },
            grid: { color: "#334155" },
          },
          x: {
            ticks: { color: "#64748b" },
            grid: { display: false },
          },
        },
      },
    });
  }

  // Gráfico 2: Distribuição por Categoria (Contas)
  const ctx2 = document.getElementById("reportChart2");
  if (ctx2) {
    const categories = {};
    (monthData.bills || []).forEach((b) => {
      if (!categories[b.category]) categories[b.category] = 0;
      categories[b.category] += b.amount;
    });

    const labels = Object.keys(categories);
    const data = Object.values(categories);

    if (window.reportChart2Instance) {
      window.reportChart2Instance.destroy();
    }

    if (labels.length === 0) {
      ctx2.style.display = "none";
    } else {
      ctx2.style.display = "block";
      window.reportChart2Instance = new Chart(ctx2, {
        type: "pie",
        data: {
          labels: labels,
          datasets: [
            {
              data: data,
              backgroundColor: [
                "#f59e0b",
                "#3b82f6",
                "#10b981",
                "#f43f5e",
                "#8b5cf6",
                "#ec4899",
                "#06b6d4",
                "#84cc16",
              ],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: { color: "#cbd5e1" },
            },
          },
        },
      });
    }
  }

  // Diagnóstico de Saúde Financeira
  const healthContainer = document.getElementById("healthAnalysis");
  if (healthContainer) {
    const despesas = totalBills + totalDebts;
    const percentual = totalIncome > 0 ? (despesas / totalIncome) * 100 : 0;

    let status, mensagem, cor;

    if (percentual < 50) {
      status = "Excelente";
      mensagem =
        "Suas despesas estão bem controladas! Você está economizando mais da metade da sua renda.";
      cor = "var(--accent-emerald)";
    } else if (percentual < 70) {
      status = "Bom";
      mensagem =
        "Suas finanças estão saudáveis, mas há espaço para economizar mais.";
      cor = "var(--accent-gold)";
    } else if (percentual < 90) {
      status = "Atenção";
      mensagem =
        "Suas despesas estão consumindo a maior parte da sua renda. Tente reduzir gastos.";
      cor = "orange";
    } else {
      status = "Crítico";
      mensagem =
        "ALERTA! Suas despesas estão próximas ou ultrapassando sua renda. Reveja urgentemente seu orçamento.";
      cor = "var(--accent-rose)";
    }

    healthContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">${percentual < 70 ? "😊" : percentual < 90 ? "😰" : "🚨"}</div>
        <h3 style="color: ${cor}; font-size: 1.5rem; margin-bottom: 0.5rem;">Status: ${status}</h3>
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">${mensagem}</p>
        <div style="background: var(--bg-card); padding: 1rem; border-radius: 12px; margin-top: 1rem;">
          <p style="margin: 0.25rem 0;"><strong>Renda Total:</strong> ${formatCurrency(totalIncome)}</p>
          <p style="margin: 0.25rem 0;"><strong>Despesas:</strong> ${formatCurrency(despesas)} (${percentual.toFixed(1)}%)</p>
          <p style="margin: 0.25rem 0;"><strong>Saldo:</strong> ${formatCurrency(totalIncome - despesas)}</p>
        </div>
      </div>
    `;
  }
}

// ==========================================
// HISTÓRICO E EVOLUÇÃO FINANCEIRA (CORRIGIDO)
// ==========================================

function loadFinancialEvolution() {
  const userData = getUserData();
  const finances = userData.finances || {};
  const months = Object.keys(finances).sort();

  const container = document.getElementById("historyContent");
  if (!container) return;

  if (months.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <h3>Sem dados históricos</h3>
        <p>Cadastre dados em diferentes meses para ver a evolução</p>
      </div>
    `;
    return;
  }

  // Preparar dados para o gráfico de evolução
  const labels = [];
  const familyIncomeData = [];
  const extraIncomeData = [];
  const billsData = [];
  const debtsData = [];
  const balanceData = [];

  months.forEach((month) => {
    const monthData = finances[month];
    const familyIncome = (userData.familyMembers || []).reduce(
      (sum, m) => sum + (parseFloat(m.defaultSalary) || 0),
      0,
    );
    const extraIncome = (monthData.incomes || []).reduce(
      (sum, i) => sum + i.amount,
      0,
    );
    const totalIncome = familyIncome + extraIncome;
    const totalBills = (monthData.bills || []).reduce(
      (sum, b) => sum + b.amount,
      0,
    );
    const totalDebts = (userData.debts || []).reduce(
      (sum, d) => sum + (d.installment || 0),
      0,
    );
    const balance = totalIncome - totalBills - totalDebts;

    labels.push(formatMonthShort(month));
    familyIncomeData.push(familyIncome);
    extraIncomeData.push(extraIncome);
    billsData.push(totalBills);
    debtsData.push(totalDebts);
    balanceData.push(balance);
  });

  // Criar HTML do histórico
  let historyHTML = `
    <div class="chart-container" style="height: 400px; margin-bottom: 2rem;">
      <canvas id="evolutionChart"></canvas>
    </div>
    <h3 style="margin: 2rem 0 1rem 0;">Resumo por Mês</h3>
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Mês</th>
            <th>Renda Familiar</th>
            <th>Renda Extra</th>
            <th>Contas</th>
            <th>Dívidas</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>
  `;

  months.forEach((month) => {
    const monthData = finances[month];
    const familyIncome = (userData.familyMembers || []).reduce(
      (sum, m) => sum + (parseFloat(m.defaultSalary) || 0),
      0,
    );
    const extraIncome = (monthData.incomes || []).reduce(
      (sum, i) => sum + i.amount,
      0,
    );
    const totalBills = (monthData.bills || []).reduce(
      (sum, b) => sum + b.amount,
      0,
    );
    const totalDebts = (userData.debts || []).reduce(
      (sum, d) => sum + (d.installment || 0),
      0,
    );
    const balance = familyIncome + extraIncome - totalBills - totalDebts;

    historyHTML += `
      <tr>
        <td><strong>${formatMonth(month)}</strong></td>
        <td style="color: var(--accent-gold);">${formatCurrency(familyIncome)}</td>
        <td style="color: var(--accent-emerald);">${formatCurrency(extraIncome)}</td>
        <td style="color: var(--accent-blue);">${formatCurrency(totalBills)}</td>
        <td style="color: var(--accent-rose);">${formatCurrency(totalDebts)}</td>
        <td style="color: ${balance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; font-weight: 600;">${formatCurrency(balance)}</td>
      </tr>
    `;
  });

  historyHTML += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = historyHTML;

  // Criar gráfico de evolução
  const ctx = document.getElementById("evolutionChart");
  if (ctx) {
    if (window.evolutionChartInstance) {
      window.evolutionChartInstance.destroy();
    }

    window.evolutionChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Renda Familiar",
            data: familyIncomeData,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            fill: false,
            tension: 0.4,
          },
          {
            label: "Renda Extra",
            data: extraIncomeData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            fill: false,
            tension: 0.4,
          },
          {
            label: "Contas",
            data: billsData,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: false,
            tension: 0.4,
          },
          {
            label: "Dívidas",
            data: debtsData,
            borderColor: "#f43f5e",
            backgroundColor: "rgba(244, 63, 94, 0.1)",
            fill: false,
            tension: 0.4,
          },
          {
            label: "Saldo",
            data: balanceData,
            borderColor: "#8b5cf6",
            backgroundColor: "rgba(139, 92, 246, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#cbd5e1" },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.dataset.label + ": " + formatCurrency(context.raw);
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: "#64748b",
              callback: function (value) {
                return formatCurrency(value);
              },
            },
            grid: { color: "#334155" },
          },
          x: {
            ticks: { color: "#64748b" },
            grid: { display: false },
          },
        },
      },
    });
  }
}

function loadHistory() {
  const historyMonth = document.getElementById("historyMonth")?.value;
  if (!historyMonth) {
    showNotification("Selecione um mês!", "error");
    return;
  }

  const userData = getUserData();
  const monthData = getMonthData(historyMonth);

  // CORREÇÃO: Calcular renda total corretamente (família + extra)
  const familyIncome = (userData.familyMembers || []).reduce(
    (sum, m) => sum + (parseFloat(m.defaultSalary) || 0),
    0,
  );
  const extraIncome = (monthData.incomes || []).reduce(
    (sum, i) => sum + i.amount,
    0,
  );
  const totalIncome = familyIncome + extraIncome;

  const totalBills = (monthData.bills || []).reduce(
    (sum, b) => sum + b.amount,
    0,
  );
  const totalDebts = (userData.debts || []).reduce(
    (sum, d) => sum + (d.installment || 0),
    0,
  );
  const balance = totalIncome - totalBills - totalDebts;

  const container = document.getElementById("historyContent");
  if (container) {
    container.innerHTML = `
      <div class="metrics-grid" style="margin-top: 1.5rem;">
        <div class="metric-card income">
          <div class="metric-header"><div class="metric-icon">💰</div></div>
          <div class="metric-value">${formatCurrency(totalIncome)}</div>
          <div class="metric-label">Renda Total</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">
            Família: ${formatCurrency(familyIncome)} | Extra: ${formatCurrency(extraIncome)}
          </div>
        </div>
        <div class="metric-card expense">
          <div class="metric-header"><div class="metric-icon">📄</div></div>
          <div class="metric-value">${formatCurrency(totalBills)}</div>
          <div class="metric-label">Contas</div>
        </div>
        <div class="metric-card expense">
          <div class="metric-header"><div class="metric-icon">💳</div></div>
          <div class="metric-value">${formatCurrency(totalDebts)}</div>
          <div class="metric-label">Dívidas</div>
        </div>
        <div class="metric-card balance">
          <div class="metric-header"><div class="metric-icon">💎</div></div>
          <div class="metric-value">${formatCurrency(balance)}</div>
          <div class="metric-label">Saldo</div>
        </div>
      </div>
      
      <h3 style="margin: 2rem 0 1rem 0;">Detalhes de ${formatMonth(historyMonth)}</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
        <div class="card">
          <h4>📄 Contas</h4>
          ${(monthData.bills || []).length === 0 ? '<p style="color: var(--text-muted);">Nenhuma conta</p>' : `
            <ul style="list-style: none; padding: 0;">
              ${(monthData.bills || []).map(b => `
                <li style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                  <span>${escapeHtml(b.description)}</span>
                  <span style="color: ${b.status === 'Pago' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}">${formatCurrency(b.amount)}</span>
                </li>
              `).join('')}
            </ul>
          `}
        </div>
        
        <div class="card">
          <h4>💰 Recebimentos</h4>
          ${(monthData.incomes || []).length === 0 ? '<p style="color: var(--text-muted);">Nenhum recebimento</p>' : `
            <ul style="list-style: none; padding: 0;">
              ${(monthData.incomes || []).map(i => `
                <li style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                  <span>${escapeHtml(i.description)}</span>
                  <span style="color: var(--accent-emerald)">${formatCurrency(i.amount)}</span>
                </li>
              `).join('')}
            </ul>
          `}
        </div>
      </div>
    `;
  }
}

// ==========================================
// CONFIGURAÇÕES
// ==========================================

function clearCurrentMonth() {
  if (!confirm("Apagar todos os dados do mês atual?")) return;

  const userData = getUserData();
  delete userData.finances[currentMonth];
  saveUserData(userData);

  loadAllData();
  showNotification("Dados do mês apagados!", "success");
}

function clearSpecificPeriod() {
  const month = document.getElementById("deletePeriodMonth")?.value;
  if (!month) {
    showNotification("Selecione um período!", "error");
    return;
  }

  if (!confirm(`Apagar dados de ${formatMonth(month)}?`)) return;

  const userData = getUserData();
  delete userData.finances[month];
  saveUserData(userData);

  showNotification("Período apagado!", "success");
}

function clearAllData() {
  if (!confirm("⚠️ ATENÇÃO! Apagar TODOS os dados?")) return;
  if (!confirm("Confirme: TUDO será perdido permanentemente!")) return;

  if (currentUser) {
    localStorage.removeItem(`${STORAGE_KEYS.FINANCES}_${currentUser.id}`);
    initializeUserData(currentUser.id);
  }

  loadAllData();
  showNotification("Todos os dados apagados!", "success");
}

function exportData() {
  const userData = getUserData();
  const dataStr = JSON.stringify(userData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `financas_backup_${currentMonth}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showNotification("Dados exportados!", "success");
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      saveUserData(data);
      loadAllData();
      showNotification("Dados importados!", "success");
    } catch (err) {
      showNotification("Erro ao importar arquivo!", "error");
    }
  };
  reader.readAsText(file);
}

function generateFullReport() {
  window.print();
}

// ==========================================
// UTILITÁRIOS
// ==========================================

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("pt-BR");
}

function formatMonth(monthStr) {
  const [year, month] = monthStr.split("-");
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatMonthShort(monthStr) {
  const [year, month] = monthStr.split("-");
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = "info") {
  document.querySelectorAll(".notification").forEach((n) => n.remove());

  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `<span>${escapeHtml(message)}</span>`;

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    color: white;
    font-weight: 500;
    z-index: 9999;
    animation: slideIn 0.3s ease;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    max-width: 350px;
    ${type === "success" ? "background: #10b981;" : ""}
    ${type === "error" ? "background: #f43f5e;" : ""}
    ${type === "warning" ? "background: #f59e0b;" : ""}
    ${type === "info" ? "background: #3b82f6;" : ""}
  `;

  if (!document.getElementById("notification-styles")) {
    const style = document.createElement("style");
    style.id = "notification-styles";
    style.textContent = `
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease forwards";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ==========================================
// FUNÇÕES GLOBAIS
// ==========================================

window.showSection = showSection;
window.changeMonth = changeMonth;
window.loadHistory = loadHistory;
window.loadFinancialEvolution = loadFinancialEvolution;
window.editFamilyMember = editFamilyMember;
window.deleteFamilyMember = deleteFamilyMember;
window.editDebt = editDebt;
window.deleteDebt = deleteDebt;
window.editIncome = editIncome;
window.deleteIncome = deleteIncome;
window.toggleBillStatus = toggleBillStatus;
window.editBill = editBill;
window.deleteBill = deleteBill;
window.logout = logout;
window.switchAuthTab = switchAuthTab;
window.backToLogin = backToLogin;
window.clearCurrentMonth = clearCurrentMonth;
window.clearSpecificPeriod = clearSpecificPeriod;
window.clearAllData = clearAllData;
window.exportData = exportData;
window.importData = importData;
window.generateFullReport = generateFullReport;
window.closeModal = function () {
  document.getElementById("editModal")?.classList.remove("active");
};
