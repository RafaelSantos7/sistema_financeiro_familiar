// ==========================================
// CONFIGURAÇÃO FIREBASE
// ==========================================
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  updateProfile,
} from "./firebase-config.js";

// Estado global
let currentUser = null;
let currentUserData = null;
let currentMonth = new Date().toISOString().slice(0, 7);
let formSubmitLock = false;

// ==========================================
// INICIALIZAÇÃO PRINCIPAL
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("=== DOM CARREGADO ===");

  // Verificar estado de autenticação em TODOS os navegadores
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Usuário logado no Firebase!
      currentUser = {
        id: user.uid,
        email: user.email,
        name: user.displayName || user.email.split("@")[0],
      };

      // Carregar dados do Firestore
      await loadUserDataFromCloud();

      const path = window.location.pathname;
      const page = path.split("/").pop() || "index.html";

      if (page === "index.html" || page === "" || page === "login.html") {
        window.location.href = "financas.html";
      } else if (page === "financas.html" || page === "dashboard.html") {
        initAppPage();
      }
    } else {
      // Não logado
      currentUser = null;
      const path = window.location.pathname;
      const page = path.split("/").pop() || "index.html";

      if (page === "financas.html" || page === "dashboard.html") {
        window.location.href = "index.html";
      } else if (
        page === "index.html" ||
        page === "" ||
        page === "login.html"
      ) {
        initLoginPage();
      }
    }
  });

  // Verificar token de redefinição de senha
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get("reset");
  if (resetToken) {
    // Firebase lida com reset de senha via email, não precisa disso
    showNotification(
      "Use o link enviado por email para redefinir senha.",
      "info",
    );
  }
});

// ==========================================
// PÁGINA DE LOGIN
// ==========================================

function initLoginPage() {
  console.log("Inicializando login...");

  // Tabs
  const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
  const registerTab = document.querySelector('.auth-tab[data-tab="register"]');

  if (loginTab)
    loginTab.addEventListener("click", () => switchAuthTab("login"));
  if (registerTab)
    registerTab.addEventListener("click", () => switchAuthTab("register"));

  // Forms
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  if (registerForm) registerForm.addEventListener("submit", handleRegister);

  // Esqueci senha
  const forgotLink = document.getElementById("forgotPasswordLink");
  if (forgotLink) {
    forgotLink.addEventListener("click", function (e) {
      e.preventDefault();
      showForgotPasswordForm();
    });
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
  const registerTab = document.querySelector('.auth-tab[data-tab="register"]');

  if (loginForm) loginForm.classList.remove("active");
  if (registerForm) registerForm.classList.remove("active");
  if (loginTab) loginTab.classList.remove("active");
  if (registerTab) registerTab.classList.remove("active");

  if (tab === "login") {
    if (loginForm) loginForm.classList.add("active");
    if (loginTab) loginTab.classList.add("active");
  } else {
    if (registerForm) registerForm.classList.add("active");
    if (registerTab) registerTab.classList.add("active");
  }
}

// LOGIN COM FIREBASE
async function handleLogin(e) {
  e.preventDefault();
  console.log("Fazendo login no Firebase...");

  const email = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;

  if (!email || !password) {
    showNotification("Preencha todos os campos!", "error");
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    showNotification("Login realizado!", "success");
    // onAuthStateChanged vai redirecionar automaticamente
  } catch (error) {
    console.error("Erro login:", error);
    let msg = "Email ou senha incorretos!";
    if (error.code === "auth/user-not-found") msg = "Usuário não encontrado!";
    if (error.code === "auth/wrong-password") msg = "Senha incorreta!";
    if (error.code === "auth/invalid-email") msg = "Email inválido!";
    showNotification(msg, "error");
  }
}

// REGISTRO COM FIREBASE
async function handleRegister(e) {
  e.preventDefault();
  console.log("Registrando no Firebase...");

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

  try {
    // Criar usuário no Firebase Auth
    // Criar usuário no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const user = userCredential.user;

    // ✅ salvar nome no Firebase Auth
    await updateProfile(user, {
      displayName: name,
    });

    // Criar documento no Firestore com dados iniciais
    const userData = {
      name: name,
      email: email,
      createdAt: new Date().toISOString(),
      familyMembers: [],
      finances: {},
      debts: [],
    };

    await setDoc(doc(db, "users", user.uid), userData);

    showNotification("Conta criada!", "success");
    // onAuthStateChanged vai redirecionar
  } catch (error) {
    console.error("Erro registro:", error);
    let msg = "Erro ao criar conta!";
    if (error.code === "auth/email-already-in-use")
      msg = "Email já cadastrado!";
    if (error.code === "auth/invalid-email") msg = "Email inválido!";
    if (error.code === "auth/weak-password") msg = "Senha muito fraca!";
    showNotification(msg, "error");
    formSubmitLock = false;
  }
}

// CARREGAR DADOS DA NUVEM
async function loadUserDataFromCloud() {
  if (!currentUser) return;

  try {
    const docRef = doc(db, "users", currentUser.id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      currentUserData = docSnap.data();
      // Garantir estrutura mínima
      if (!currentUserData.familyMembers) currentUserData.familyMembers = [];
      if (!currentUserData.finances) currentUserData.finances = {};
      if (!currentUserData.debts) currentUserData.debts = [];
    } else {
      // Criar estrutura inicial se não existir
      currentUserData = {
        familyMembers: [],
        finances: {},
        debts: [],
      };
    }
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    showNotification("Erro ao carregar dados da nuvem!", "error");
  }
}

// SALVAR DADOS NA NUVEM
async function saveUserDataToCloud() {
  if (!currentUser || !currentUserData) return;

  try {
    await setDoc(doc(db, "users", currentUser.id), currentUserData, {
      merge: true,
    });

    console.log("Dados salvos na nuvem!");
  } catch (error) {
    console.error("Erro ao salvar:", error);
    showNotification("Erro ao salvar dados!", "error");
  }
}

// ==========================================
// RECUPERAÇÃO DE SENHA (FIREBASE)
// ==========================================

function showForgotPasswordForm() {
  const container = document.querySelector(".auth-card");
  if (!container) return;

  const existingForms = container.querySelectorAll(".auth-form");
  existingForms.forEach((f) => (f.style.display = "none"));

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

async function handleForgotPassword(e) {
  e.preventDefault();

  const email = document.getElementById("forgotEmail")?.value.trim();
  if (!email) {
    showNotification("Digite seu email!", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showNotification("Link de recuperação enviado para seu email!", "success");
    setTimeout(backToLogin, 3000);
  } catch (error) {
    console.error("Erro:", error);
    // Por segurança, não revelamos se email existe ou não
    showNotification(
      "Se este email existir, você receberá instruções.",
      "info",
    );
    setTimeout(backToLogin, 3000);
  }
}

function backToLogin(e) {
  if (e) e.preventDefault();
  location.reload();
}

// ==========================================
// PÁGINA DO APP (adaptada para Firebase)
// ==========================================

function initAppPage() {
  console.log("=== INICIANDO APP ===");

  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  // Atualizar info do usuário
  const userNameEl = document.getElementById("userName");
  const userEmailEl = document.getElementById("userEmail");
  if (userNameEl)
    userNameEl.textContent = currentUserData?.name || currentUser.name;
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

  // Carregar dados (já carregados do Firebase, só renderizar)
  loadAllData();

  // Mostrar dashboard
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

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
    const onclickAttr = item.getAttribute("onclick") || "";
    if (onclickAttr.includes(sectionId)) {
      item.classList.add("active");
    }
  });

  document.querySelectorAll(".content-section").forEach((section) => {
    section.classList.remove("active");
  });

  const target = document.getElementById(sectionId);
  if (target) target.classList.add("active");

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

  const sidebar = document.getElementById("sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  if (sidebar) sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");

  if (sectionId === "dashboard") updateDashboard();
  if (sectionId === "relatorios") updateReports();
  if (sectionId === "historico") loadFinancialEvolution();
}

async function logout() {
  try {
    await signOut(auth);
    currentUser = null;
    currentUserData = null;
    window.location.href = "index.html";
  } catch (error) {
    console.error("Erro logout:", error);
  }
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
// GERENCIAMENTO DE DADOS (Firestore)
// ==========================================

function getUserData() {
  if (!currentUserData) {
    return { familyMembers: [], finances: {}, debts: [] };
  }
  return currentUserData;
}

async function saveUserData(data) {
  currentUserData = data;
  await saveUserDataToCloud();
}

function getMonthData(month = currentMonth) {
  const userData = getUserData();
  if (!userData.finances) userData.finances = {};
  if (!userData.finances[month]) {
    userData.finances[month] = { incomes: [], bills: [] };
  }
  return userData.finances[month];
}

async function saveMonthData(month, data) {
  const userData = getUserData();
  userData.finances[month] = data;
  await saveUserData(userData);
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
  if (totalEl) totalEl.textContent = formatCurrency(total);
}

async function addFamilyMember(e) {
  e.preventDefault();
  console.log("=== ADICIONANDO MEMBRO ===");

  if (formSubmitLock) return;
  formSubmitLock = true;

  const nameInput = document.getElementById("memberName");
  const salaryInput = document.getElementById("memberSalary");
  const typeInput = document.getElementById("memberType");

  if (!nameInput || !salaryInput) {
    showNotification("Erro: campos não encontrados!", "error");
    formSubmitLock = false;
    return;
  }

  const name = nameInput.value.trim();
  const salary = parseFloat(salaryInput.value) || 0;
  const type = typeInput ? typeInput.value : "salario";

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
  await saveUserData(userData);

  e.target.reset();
  loadFamilyMembers();
  updateDashboard();
  showNotification("Membro adicionado com sucesso!", "success");

  setTimeout(() => {
    formSubmitLock = false;
  }, 1000);
}

async function editFamilyMember(id) {
  const userData = getUserData();
  const member = userData.familyMembers.find((m) => m.id === id);
  if (!member) return;

  const newName = prompt("Nome:", member.name);
  if (newName === null) return;

  const newSalary = prompt("Salário (R$):", member.defaultSalary || 0);
  if (newSalary === null) return;

  member.name = newName.trim() || member.name;
  member.defaultSalary = parseFloat(newSalary) || member.defaultSalary;

  await saveUserData(userData);
  loadFamilyMembers();
  updateDashboard();
  showNotification("Membro atualizado!", "success");
}

async function deleteFamilyMember(id) {
  if (!confirm("Excluir este membro?")) return;

  const userData = getUserData();
  userData.familyMembers = userData.familyMembers.filter((m) => m.id !== id);
  await saveUserData(userData);

  loadFamilyMembers();
  updateDashboard();
  showNotification("Membro excluído!", "success");
}

// ==========================================
// DÍVIDAS
// ==========================================

async function addDebt(e) {
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

  await saveUserData(userData);

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

async function editDebt(id) {
  const userData = getUserData();
  const debt = userData.debts.find((d) => d.id === id);
  if (!debt) return;

  const newPaid = prompt("Parcelas pagas:", debt.paid);
  if (newPaid === null) return;

  debt.paid = parseInt(newPaid) || debt.paid;
  await saveUserData(userData);
  loadDebts();
  updateDashboard();
  showNotification("Dívida atualizada!", "success");
}

async function deleteDebt(id) {
  if (!confirm("Excluir esta dívida?")) return;

  const userData = getUserData();
  userData.debts = userData.debts.filter((d) => d.id !== id);
  await saveUserData(userData);

  loadDebts();
  updateDashboard();
  showNotification("Dívida excluída!", "success");
}

// ==========================================
// RECEBIMENTOS (RENDA EXTRA)
// ==========================================

async function addIncome(e) {
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

  await saveMonthData(currentMonth, monthData);

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

async function editIncome(id) {
  const monthData = getMonthData();
  const income = monthData.incomes.find((i) => i.id === id);
  if (!income) return;

  const newAmount = prompt("Novo valor (R$):", income.amount);
  if (newAmount === null) return;

  income.amount = parseFloat(newAmount) || income.amount;
  await saveMonthData(currentMonth, monthData);
  loadIncomes();
  updateDashboard();
  showNotification("Recebimento atualizado!", "success");
}

async function deleteIncome(id) {
  if (!confirm("Excluir este recebimento?")) return;

  const monthData = getMonthData();
  monthData.incomes = monthData.incomes.filter((i) => i.id !== id);
  await saveMonthData(currentMonth, monthData);

  loadIncomes();
  updateDashboard();
  showNotification("Recebimento excluído!", "success");
}

// ==========================================
// CONTAS
// ==========================================

async function addBill(e) {
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

  await saveMonthData(currentMonth, monthData);

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

async function toggleBillStatus(id) {
  const monthData = getMonthData();
  const bill = monthData.bills.find((b) => b.id === id);
  if (!bill) return;

  bill.status = bill.status === "Pago" ? "Pendente" : "Pago";
  await saveMonthData(currentMonth, monthData);
  loadBills();
  updateDashboard();
  showNotification(`Conta ${bill.status.toLowerCase()}!`, "success");
}

async function editBill(id) {
  const monthData = getMonthData();
  const bill = monthData.bills.find((b) => b.id === id);
  if (!bill) return;

  const newAmount = prompt("Novo valor (R$):", bill.amount);
  if (newAmount === null) return;

  bill.amount = parseFloat(newAmount) || bill.amount;
  await saveMonthData(currentMonth, monthData);
  loadBills();
  updateDashboard();
  showNotification("Conta atualizada!", "success");
}

async function deleteBill(id) {
  if (!confirm("Excluir esta conta?")) return;

  const monthData = getMonthData();
  monthData.bills = monthData.bills.filter((b) => b.id !== id);
  await saveMonthData(currentMonth, monthData);

  loadBills();
  updateDashboard();
  showNotification("Conta excluída!", "success");
}

// ==========================================
// DASHBOARD
// ==========================================

function updateDashboard() {
  const monthData = getMonthData();
  const userData = getUserData();

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
    (sum, b) => sum + (b.status !== "Pago" ? b.amount : 0),
    0,
  );
  const totalDebts = (userData.debts || []).reduce(
    (sum, d) => sum + (d.installment || 0),
    0,
  );
  const balance = totalIncome - totalBills - totalDebts;

  const incomeEl = document.getElementById("totalIncome");
  const debtsEl = document.getElementById("totalDebts");
  const billsEl = document.getElementById("totalBills");
  const balanceEl = document.getElementById("availableBalance");

  if (incomeEl) incomeEl.textContent = formatCurrency(totalIncome);
  if (debtsEl) debtsEl.textContent = formatCurrency(totalDebts);
  if (billsEl) billsEl.textContent = formatCurrency(totalBills);
  if (balanceEl) balanceEl.textContent = formatCurrency(balance);

  updateAlerts(monthData.bills || [], userData.debts || []);
  updateMainChart(totalIncome, totalBills, totalDebts, balance);
}

function updateAlerts(bills, debts) {
  const container = document.getElementById("alertsContainer");
  if (!container) return;

  const alerts = [];
  const today = new Date();
  const hoje = today.getDate();

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

  if (window.mainChartInstance) window.mainChartInstance.destroy();

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

  const ctx1 = document.getElementById("reportChart1");
  if (ctx1) {
    if (window.reportChart1Instance) window.reportChart1Instance.destroy();

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
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: "#64748b",
              callback: (value) => formatCurrency(value),
            },
            grid: { color: "#334155" },
          },
          x: { ticks: { color: "#64748b" }, grid: { display: false } },
        },
      },
    });
  }

  const ctx2 = document.getElementById("reportChart2");
  if (ctx2) {
    const categories = {};
    (monthData.bills || []).forEach((b) => {
      if (!categories[b.category]) categories[b.category] = 0;
      categories[b.category] += b.amount;
    });

    const labels = Object.keys(categories);
    const data = Object.values(categories);

    if (window.reportChart2Instance) window.reportChart2Instance.destroy();

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
            legend: { position: "right", labels: { color: "#cbd5e1" } },
          },
        },
      });
    }
  }

  const healthContainer = document.getElementById("healthAnalysis");
  if (healthContainer) {
    const despesas = totalBills + totalDebts;
    const percentual = totalIncome > 0 ? (despesas / totalIncome) * 100 : 0;

    let status, mensagem, cor;

    if (percentual < 50) {
      status = "Excelente";
      mensagem = "Suas despesas estão bem controladas!";
      cor = "var(--accent-emerald)";
    } else if (percentual < 70) {
      status = "Bom";
      mensagem = "Suas finanças estão saudáveis.";
      cor = "var(--accent-gold)";
    } else if (percentual < 90) {
      status = "Atenção";
      mensagem = "Despesas consumindo maior parte da renda.";
      cor = "orange";
    } else {
      status = "Crítico";
      mensagem = "ALERTA! Despesas próximas ou ultrapassando renda.";
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
// HISTÓRICO E EVOLUÇÃO FINANCEIRA
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

  let historyHTML = `
    <div class="chart-container" style="height: 400px; margin-bottom: 2rem;">
      <canvas id="evolutionChart"></canvas>
    </div>
    <h3 style="margin: 2rem 0 1rem 0;">Resumo por Mês</h3>
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr><th>Mês</th><th>Renda Familiar</th><th>Renda Extra</th><th>Contas</th><th>Dívidas</th><th>Saldo</th></tr>
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
        <td style="color: ${balance >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)"}; font-weight: 600;">${formatCurrency(balance)}</td>
      </tr>
    `;
  });

  historyHTML += `</tbody></table></div>`;
  container.innerHTML = historyHTML;

  const ctx = document.getElementById("evolutionChart");
  if (ctx) {
    if (window.evolutionChartInstance) window.evolutionChartInstance.destroy();

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
          legend: { position: "bottom", labels: { color: "#cbd5e1" } },
          tooltip: {
            callbacks: {
              label: (context) =>
                context.dataset.label + ": " + formatCurrency(context.raw),
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: "#64748b",
              callback: (value) => formatCurrency(value),
            },
            grid: { color: "#334155" },
          },
          x: { ticks: { color: "#64748b" }, grid: { display: false } },
        },
      },
    });
  }
}

async function loadHistory() {
  const historyMonth = document.getElementById("historyMonth")?.value;
  if (!historyMonth) {
    showNotification("Selecione um mês!", "error");
    return;
  }

  const userData = getUserData();
  const monthData = getMonthData(historyMonth);

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
        <div class="metric-card expense"><div class="metric-header"><div class="metric-icon">📄</div></div><div class="metric-value">${formatCurrency(totalBills)}</div><div class="metric-label">Contas</div></div>
        <div class="metric-card expense"><div class="metric-header"><div class="metric-icon">💳</div></div><div class="metric-value">${formatCurrency(totalDebts)}</div><div class="metric-label">Dívidas</div></div>
        <div class="metric-card balance"><div class="metric-header"><div class="metric-icon">💎</div></div><div class="metric-value">${formatCurrency(balance)}</div><div class="metric-label">Saldo</div></div>
      </div>
      
      <h3 style="margin: 2rem 0 1rem 0;">Detalhes de ${formatMonth(historyMonth)}</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
        <div class="card">
          <h4>📄 Contas</h4>
          ${
            (monthData.bills || []).length === 0
              ? '<p style="color: var(--text-muted);">Nenhuma conta</p>'
              : `
            <ul style="list-style: none; padding: 0;">
              ${(monthData.bills || [])
                .map(
                  (b) => `
                <li style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                  <span>${escapeHtml(b.description)}</span>
                  <span style="color: ${b.status === "Pago" ? "var(--accent-emerald)" : "var(--accent-rose)"}">${formatCurrency(b.amount)}</span>
                </li>
              `,
                )
                .join("")}
            </ul>
          `
          }
        </div>
        
        <div class="card">
          <h4>💰 Recebimentos</h4>
          ${
            (monthData.incomes || []).length === 0
              ? '<p style="color: var(--text-muted);">Nenhum recebimento</p>'
              : `
            <ul style="list-style: none; padding: 0;">
              ${(monthData.incomes || [])
                .map(
                  (i) => `
                <li style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                  <span>${escapeHtml(i.description)}</span>
                  <span style="color: var(--accent-emerald)">${formatCurrency(i.amount)}</span>
                </li>
              `,
                )
                .join("")}
            </ul>
          `
          }
        </div>
      </div>
    `;
  }
}

// ==========================================
// CONFIGURAÇÕES
// ==========================================

async function clearCurrentMonth() {
  if (!confirm("Apagar todos os dados do mês atual?")) return;

  const userData = getUserData();
  delete userData.finances[currentMonth];
  await saveUserData(userData);

  loadAllData();
  showNotification("Dados do mês apagados!", "success");
}

async function clearSpecificPeriod() {
  const month = document.getElementById("deletePeriodMonth")?.value;
  if (!month) {
    showNotification("Selecione um período!", "error");
    return;
  }

  if (!confirm(`Apagar dados de ${formatMonth(month)}?`)) return;

  const userData = getUserData();
  delete userData.finances[month];
  await saveUserData(userData);

  showNotification("Período apagado!", "success");
}

async function clearAllData() {
  if (!confirm("⚠️ ATENÇÃO! Apagar TODOS os dados?")) return;
  if (!confirm("Confirme: TUDO será perdido permanentemente!")) return;

  currentUserData = {
    familyMembers: [],
    finances: {},
    debts: [],
  };

  await saveUserData(currentUserData);
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

async function importData(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = JSON.parse(e.target.result);
      await saveUserData(data);
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
