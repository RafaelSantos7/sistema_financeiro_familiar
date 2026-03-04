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
let currentEditingId = null;
let currentEditingType = null;

// ==========================================
// INICIALIZAÇÃO PRINCIPAL
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("=== DOM CARREGADO ===");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = {
        id: user.uid,
        email: user.email,
        name: user.displayName || user.email.split("@")[0],
      };

      await loadUserDataFromCloud();

      const path = window.location.pathname;
      const page = path.split("/").pop() || "index.html";

      if (page === "index.html" || page === "" || page === "login.html") {
        window.location.href = "financas.html";
      } else if (page === "financas.html" || page === "dashboard.html") {
        initAppPage();
      }
    } else {
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

  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get("reset");
  if (resetToken) {
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

  const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
  const registerTab = document.querySelector('.auth-tab[data-tab="register"]');

  if (loginTab)
    loginTab.addEventListener("click", () => switchAuthTab("login"));
  if (registerTab)
    registerTab.addEventListener("click", () => switchAuthTab("register"));

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  if (registerForm) registerForm.addEventListener("submit", handleRegister);

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
  } catch (error) {
    console.error("Erro login:", error);
    let msg = "Email ou senha incorretos!";
    if (error.code === "auth/user-not-found") msg = "Usuário não encontrado!";
    if (error.code === "auth/wrong-password") msg = "Senha incorreta!";
    if (error.code === "auth/invalid-email") msg = "Email inválido!";
    showNotification(msg, "error");
  }
}

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
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const user = userCredential.user;

    await updateProfile(user, {
      displayName: name,
    });

    const userData = {
      name: name,
      email: email,
      createdAt: new Date().toISOString(),
      familyMembers: [],
      finances: {},
      debts: [],
      recurringBillTemplates: [],
      debtPaymentHistory: [],
    };

    await setDoc(doc(db, "users", user.uid), userData);

    showNotification("Conta criada!", "success");
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

async function loadUserDataFromCloud() {
  if (!currentUser) return;

  try {
    const docRef = doc(db, "users", currentUser.id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      currentUserData = docSnap.data();
      if (!currentUserData.familyMembers) currentUserData.familyMembers = [];
      if (!currentUserData.finances) currentUserData.finances = {};
      if (!currentUserData.debts) currentUserData.debts = [];
      if (!currentUserData.recurringBillTemplates)
        currentUserData.recurringBillTemplates = [];
      if (!currentUserData.debtPaymentHistory)
        currentUserData.debtPaymentHistory = [];
    } else {
      currentUserData = {
        familyMembers: [],
        finances: {},
        debts: [],
        recurringBillTemplates: [],
        debtPaymentHistory: [],
      };
    }
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    showNotification("Erro ao carregar dados da nuvem!", "error");
  }
}

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
// PÁGINA DO APP
// ==========================================

function initAppPage() {
  console.log("=== INICIANDO APP ===");

  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  const userNameEl = document.getElementById("userName");
  const userEmailEl = document.getElementById("userEmail");
  if (userNameEl)
    userNameEl.textContent = currentUserData?.name || currentUser.name;
  if (userEmailEl) userEmailEl.textContent = currentUser.email;

  const monthInput = document.getElementById("currentMonth");
  if (monthInput) {
    monthInput.value = currentMonth;
    monthInput.addEventListener("change", changeMonth);
  }

  window.toggleMobileMenu = function () {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.querySelector(".sidebar-overlay");
    sidebar?.classList.toggle("active");
    overlay?.classList.toggle("active");
  };

  setupForms();

  // GARANTIR que só o dashboard está visível ANTES de carregar dados
  document.querySelectorAll(".content-section").forEach((section) => {
    section.classList.remove("active");
  });
  const dashboard = document.getElementById("dashboard");
  if (dashboard) dashboard.classList.add("active");

  // Atualizar navegação
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
    if (item.getAttribute("onclick")?.includes("dashboard")) {
      item.classList.add("active");
    }
  });

  loadAllData();

  console.log("=== APP PRONTO ===");
}

function setupForms() {
  console.log("Configurando formulários...");

  const forms = [
    { id: "memberForm", handler: addFamilyMember },
    { id: "debtForm", handler: addDebt },
    { id: "incomeForm", handler: addIncome },
    { id: "billForm", handler: addBill },
    { id: "templateForm", handler: createRecurringBillTemplate },
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
  checkMissingRecurringBills();
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
  // CORREÇÃO: Só carrega templates quando está na página de configurações
  if (sectionId === "configuracoes") loadRecurringTemplates();
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
// GERENCIAMENTO DE DADOS
// ==========================================

function getUserData() {
  if (!currentUserData) {
    return {
      familyMembers: [],
      finances: {},
      debts: [],
      recurringBillTemplates: [],
      debtPaymentHistory: [],
    };
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
// MODAL DE EDIÇÃO UNIVERSAL
// ==========================================

function openEditModal(type, id, data) {
  currentEditingId = id;
  currentEditingType = type;

  const modal = document.getElementById("editModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  let html = "";

  switch (type) {
    case "member":
      modalTitle.textContent = "Editar Membro da Família";
      html = `
        <div class="form-group">
          <label>Nome</label>
          <input type="text" id="editName" value="${escapeHtml(data.name)}" required>
        </div>
        <div class="form-group">
          <label>Salário/Renda (R$)</label>
          <input type="number" id="editSalary" step="0.01" value="${data.defaultSalary || 0}" required>
        </div>
        <div class="form-group">
          <label>Tipo de Renda</label>
          <select id="editType">
            <option value="salario" ${data.type === "salario" ? "selected" : ""}>Salário Fixo</option>
            <option value="freelance" ${data.type === "freelance" ? "selected" : ""}>Freelance/Autônomo</option>
            <option value="aposentadoria" ${data.type === "aposentadoria" ? "selected" : ""}>Aposentadoria</option>
            <option value="aluguel" ${data.type === "aluguel" ? "selected" : ""}>Aluguel</option>
            <option value="outro" ${data.type === "outro" ? "selected" : ""}>Outro</option>
          </select>
        </div>
      `;
      break;

    case "debt":
      modalTitle.textContent = "Editar Dívida";
      html = `
        <div class="form-group">
          <label>Descrição</label>
          <input type="text" id="editDescription" value="${escapeHtml(data.description)}" required>
        </div>
        <div class="form-group">
          <label>Credor</label>
          <input type="text" id="editCreditor" value="${escapeHtml(data.creditor)}" required>
        </div>
        <div class="form-group">
          <label>Valor Total (R$)</label>
          <input type="number" id="editTotal" step="0.01" value="${data.total}" required>
        </div>
        <div class="form-group">
          <label>Valor da Parcela (R$)</label>
          <input type="number" id="editInstallment" step="0.01" value="${data.installment}" required>
        </div>
        <div class="form-group">
          <label>Total de Parcelas</label>
          <input type="number" id="editInstallments" value="${data.installments}" required>
        </div>
        <div class="form-group">
          <label>Parcelas Pagas</label>
          <input type="number" id="editPaid" value="${data.paid}" required>
        </div>
        <div class="form-group">
          <label>Dia do Vencimento</label>
          <input type="number" id="editDueDay" min="1" max="31" value="${data.dueDay}" required>
        </div>
      `;
      break;

    case "income":
      modalTitle.textContent = "Editar Recebimento";
      html = `
        <div class="form-group">
          <label>Descrição</label>
          <input type="text" id="editDescription" value="${escapeHtml(data.description)}" required>
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <select id="editCategory">
            <option value="Extra" ${data.category === "Extra" ? "selected" : ""}>Renda Extra</option>
            <option value="Investimento" ${data.category === "Investimento" ? "selected" : ""}>Retorno Investimento</option>
            <option value="Presente" ${data.category === "Presente" ? "selected" : ""}>Presente/Herança</option>
            <option value="Reembolso" ${data.category === "Reembolso" ? "selected" : ""}>Reembolso</option>
            <option value="Outro" ${data.category === "Outro" ? "selected" : ""}>Outro</option>
          </select>
        </div>
        <div class="form-group">
          <label>Valor (R$)</label>
          <input type="number" id="editAmount" step="0.01" value="${data.amount}" required>
        </div>
        <div class="form-group">
          <label>Data</label>
          <input type="date" id="editDate" value="${data.date || ""}">
        </div>
        <div class="form-group">
          <label>Recorrente?</label>
          <select id="editRecurring">
            <option value="false" ${!data.recurring ? "selected" : ""}>Não</option>
            <option value="true" ${data.recurring ? "selected" : ""}>Sim</option>
          </select>
        </div>
      `;
      break;

    case "bill":
      modalTitle.textContent = "Editar Conta";
      html = `
        <div class="form-group">
          <label>Descrição</label>
          <input type="text" id="editDescription" value="${escapeHtml(data.description)}" required>
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <select id="editCategory">
            <option value="Moradia" ${data.category === "Moradia" ? "selected" : ""}>Moradia</option>
            <option value="Utilidades" ${data.category === "Utilidades" ? "selected" : ""}>Utilidades</option>
            <option value="Internet" ${data.category === "Internet" ? "selected" : ""}>Internet/TV</option>
            <option value="Alimentação" ${data.category === "Alimentação" ? "selected" : ""}>Alimentação</option>
            <option value="Transporte" ${data.category === "Transporte" ? "selected" : ""}>Transporte</option>
            <option value="Saúde" ${data.category === "Saúde" ? "selected" : ""}>Saúde</option>
            <option value="Educação" ${data.category === "Educação" ? "selected" : ""}>Educação</option>
            <option value="Lazer" ${data.category === "Lazer" ? "selected" : ""}>Lazer</option>
            <option value="Outros" ${data.category === "Outros" ? "selected" : ""}>Outros</option>
          </select>
        </div>
        <div class="form-group">
          <label>Valor (R$)</label>
          <input type="number" id="editAmount" step="0.01" value="${data.amount}" required>
        </div>
        <div class="form-group">
          <label>Data de Vencimento</label>
          <input type="date" id="editDueDate" value="${data.dueDate}" required>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="editStatus">
            <option value="Pendente" ${data.status === "Pendente" ? "selected" : ""}>Pendente</option>
            <option value="Pago" ${data.status === "Pago" ? "selected" : ""}>Pago</option>
          </select>
        </div>
      `;
      break;

    case "template":
      modalTitle.textContent = "Editar Template de Conta";
      html = `
        <div class="form-group">
          <label>Descrição</label>
          <input type="text" id="editDescription" value="${escapeHtml(data.description)}" required>
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <select id="editCategory">
            <option value="Moradia" ${data.category === "Moradia" ? "selected" : ""}>Moradia</option>
            <option value="Utilidades" ${data.category === "Utilidades" ? "selected" : ""}>Utilidades</option>
            <option value="Internet" ${data.category === "Internet" ? "selected" : ""}>Internet/TV</option>
            <option value="Telefone" ${data.category === "Telefone" ? "selected" : ""}>Telefone</option>
            <option value="Outro" ${data.category === "Outro" ? "selected" : ""}>Outro</option>
          </select>
        </div>
        <div class="form-group">
          <label>Valor Sugerido (R$)</label>
          <input type="number" id="editDefaultAmount" step="0.01" value="${data.defaultAmount || 0}">
        </div>
        <div class="form-group">
          <label>Dia de Vencimento</label>
          <input type="number" id="editDueDay" min="1" max="31" value="${data.dueDay}" required>
        </div>
        <div class="form-group">
          <label>Observações</label>
          <input type="text" id="editNotes" value="${escapeHtml(data.notes || "")}">
        </div>
      `;
      break;
  }

  modalBody.innerHTML = html;
  modal.classList.add("active");
}

async function saveEdit() {
  if (!currentEditingId || !currentEditingType) return;

  const userData = getUserData();

  try {
    switch (currentEditingType) {
      case "member":
        const member = userData.familyMembers.find(
          (m) => m.id === currentEditingId,
        );
        if (member) {
          member.name = document.getElementById("editName").value;
          member.defaultSalary =
            parseFloat(document.getElementById("editSalary").value) || 0;
          member.type = document.getElementById("editType").value;
          await saveUserData(userData);
          loadFamilyMembers();
          updateDashboard();
          showNotification("Membro atualizado!", "success");
        }
        break;

      case "debt":
        const debt = userData.debts.find((d) => d.id === currentEditingId);
        if (debt) {
          debt.description = document.getElementById("editDescription").value;
          debt.creditor = document.getElementById("editCreditor").value;
          debt.total =
            parseFloat(document.getElementById("editTotal").value) || 0;
          debt.installment =
            parseFloat(document.getElementById("editInstallment").value) || 0;
          debt.installments =
            parseInt(document.getElementById("editInstallments").value) || 1;
          debt.paid = parseInt(document.getElementById("editPaid").value) || 0;
          debt.dueDay =
            parseInt(document.getElementById("editDueDay").value) || 1;
          await saveUserData(userData);
          loadDebts();
          updateDashboard();
          showNotification("Dívida atualizada!", "success");
        }
        break;

      case "income":
        const monthDataIncome = getMonthData();
        const income = monthDataIncome.incomes.find(
          (i) => i.id === currentEditingId,
        );
        if (income) {
          income.description = document.getElementById("editDescription").value;
          income.category = document.getElementById("editCategory").value;
          income.amount =
            parseFloat(document.getElementById("editAmount").value) || 0;
          income.date = document.getElementById("editDate").value;
          income.recurring =
            document.getElementById("editRecurring").value === "true";
          await saveMonthData(currentMonth, monthDataIncome);
          loadIncomes();
          updateDashboard();
          showNotification("Recebimento atualizado!", "success");
        }
        break;

      case "bill":
        const monthDataBill = getMonthData();
        const bill = monthDataBill.bills.find((b) => b.id === currentEditingId);
        if (bill) {
          bill.description = document.getElementById("editDescription").value;
          bill.category = document.getElementById("editCategory").value;
          bill.amount =
            parseFloat(document.getElementById("editAmount").value) || 0;
          bill.dueDate = document.getElementById("editDueDate").value;
          bill.status = document.getElementById("editStatus").value;
          await saveMonthData(currentMonth, monthDataBill);
          loadBills();
          updateDashboard();
          showNotification("Conta atualizada!", "success");
        }
        break;

      case "template":
        const template = userData.recurringBillTemplates.find(
          (t) => t.id === currentEditingId,
        );
        if (template) {
          template.description =
            document.getElementById("editDescription").value;
          template.category = document.getElementById("editCategory").value;
          template.defaultAmount =
            parseFloat(document.getElementById("editDefaultAmount").value) || 0;
          template.dueDay =
            parseInt(document.getElementById("editDueDay").value) || 1;
          template.notes = document.getElementById("editNotes").value;
          await saveUserData(userData);
          loadRecurringTemplates();
          showNotification("Template atualizado!", "success");
        }
        break;
    }

    closeModal();
  } catch (error) {
    console.error("Erro ao salvar:", error);
    showNotification("Erro ao salvar alterações!", "error");
  }
}

function closeModal() {
  const modal = document.getElementById("editModal");
  if (modal) modal.classList.remove("active");
  currentEditingId = null;
  currentEditingType = null;
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

function editFamilyMember(id) {
  const userData = getUserData();
  const member = userData.familyMembers.find((m) => m.id === id);
  if (!member) return;

  openEditModal("member", id, member);
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
// DÍVIDAS COM HISTÓRICO GLOBAL
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

  const debtId = Date.now().toString();

  userData.debts.push({
    id: debtId,
    description,
    creditor,
    total,
    installment,
    installments,
    paid: 0,
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
  const history = userData.debtPaymentHistory || [];

  const activeDebts = debts;

  const tbody = document.getElementById("debtTableBody");
  const count = document.getElementById("debtCount");

  // Contar apenas dívidas ativas
  if (count) count.textContent = `${activeDebts.length} registro(s)`;

  if (!tbody) return;

  if (activeDebts.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="9">
          <div class="empty-state small">
            <div class="empty-state-icon">💳</div>
            <h4>Nenhuma dívida ativa</h4>
            <p>Todas as suas dívidas estão quitadas!</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = activeDebts
    .map((d) => {
      const paidAmount = d.installment * d.paid;
      const remaining = Math.max(d.total - paidAmount, 0);
      const progress = d.installments > 0 ? (d.paid / d.installments) * 100 : 0;

      const paidThisMonth = history.some(
        (h) => h.debtId === d.id && h.month === currentMonth,
      );
      const debtHistory = history
        .filter((h) => h.debtId === d.id)
        .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

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
          ${
            paidThisMonth
              ? '<span class="status-badge status-paid" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald);">✓ Pago</span>'
              : d.paid >= d.installments
                ? '<span class="status-badge" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald);">Quitado</span>'
                : `<button class="btn btn-primary btn-small" onclick="payDebtInstallment('${d.id}')" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;">
                  Pagar
                 </button>`
          }
        </td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" onclick="showDebtHistory('${d.id}')" title="Ver histórico">📊</button>
            <button class="btn-icon btn-edit" onclick="editDebt('${d.id}')" title="Editar">✏️</button>
            <button class="btn-icon btn-delete" onclick="deleteDebt('${d.id}')" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>
      ${
        debtHistory.length > 0
          ? `
      <tr class="history-row" style="background: rgba(0,0,0,0.2);">
        <td colspan="9" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
          <strong>Últimos pagamentos:</strong> 
          ${debtHistory
            .slice(0, 3)
            .map(
              (h) =>
                `${formatMonthShort(h.month)}: ${formatCurrency(h.amount)}`,
            )
            .join(" • ")}
          ${debtHistory.length > 3 ? ` <span style="color: var(--text-muted);">(+${debtHistory.length - 3} anteriores)</span>` : ""}
        </td>
      </tr>
      `
          : ""
      }
    `;
    })
    .join("");
}

async function payDebtInstallment(debtId) {
  const userData = getUserData();
  const debt = userData.debts.find((d) => d.id === debtId);
  if (!debt) return;

  if (debt.paid >= debt.installments) {
    showNotification("Esta dívida já está quitada!", "info");
    return;
  }

  // Abrir modal personalizado para pagamento
  const modal = document.getElementById("editModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  modalTitle.textContent = `Pagar Parcela - ${debt.description}`;
  modalBody.innerHTML = `
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-primary); border-radius: 8px;">
      <p><strong>Dívida:</strong> ${escapeHtml(debt.description)}</p>
      <p><strong>Parcela:</strong> ${debt.paid + 1} de ${debt.installments}</p>
      <p><strong>Valor sugerido:</strong> ${formatCurrency(debt.installment)}</p>
    </div>
    <div class="form-group">
      <label>Valor do Pagamento (R$)</label>
      <input type="number" id="paymentAmount" step="0.01" value="${debt.installment}" required>
    </div>
    <div class="form-group">
      <label>Mês de Referência</label>
      <input type="month" id="paymentMonth" value="${currentMonth}" required>
    </div>
  `;

  // Alterar o botão de salvar para processar pagamento
  const saveBtn = document.getElementById("modalSaveBtn");
  const originalOnclick = saveBtn.onclick;
  saveBtn.onclick = async function () {
    const amount = parseFloat(document.getElementById("paymentAmount").value);
    const month = document.getElementById("paymentMonth").value;

    if (isNaN(amount) || amount <= 0) {
      showNotification("Valor inválido!", "error");
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      showNotification("Formato de mês inválido!", "error");
      return;
    }

    await processDebtPayment(debtId, amount, month);
    closeModal();
    saveBtn.onclick = originalOnclick; // Restaurar função original
  };

  modal.classList.add("active");
  currentEditingId = debtId;
  currentEditingType = "payment";
}

async function processDebtPayment(debtId, amount, month) {
  const userData = getUserData();
  const debt = userData.debts.find((d) => d.id === debtId);
  if (!debt) return;

  if (!userData.debtPaymentHistory) userData.debtPaymentHistory = [];

  const alreadyPaidThisMonth = userData.debtPaymentHistory.some(
    (h) => h.debtId === debtId && h.month === month,
  );

  if (alreadyPaidThisMonth) {
    if (
      !confirm(
        `Já existe um pagamento registrado para "${debt.description}" em ${formatMonth(month)}. Deseja substituir?`,
      )
    ) {
      return;
    }
    userData.debtPaymentHistory = userData.debtPaymentHistory.filter(
      (h) => !(h.debtId === debtId && h.month === month),
    );
  }

  const payment = {
    id: Date.now().toString(),
    debtId: debtId,
    debtDescription: debt.description,
    amount: amount,
    month: month,
    paidAt: new Date().toISOString(),
    installmentNumber: debt.paid + 1,
  };

  userData.debtPaymentHistory.push(payment);
  debt.paid = (debt.paid || 0) + 1;
  debt.lastPaymentMonth = month;
  debt.lastPaymentDate = payment.paidAt;

  await saveUserData(userData);

  loadDebts();
  updateDashboard();
  showNotification(
    `Pagamento registrado: ${debt.description} - ${formatMonth(month)}`,
    "success",
  );
}

function showDebtHistory(debtId) {
  const userData = getUserData();
  const debt = userData.debts.find((d) => d.id === debtId);
  if (!debt) return;

  const history = (userData.debtPaymentHistory || [])
    .filter((h) => h.debtId === debtId)
    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

  const modal = document.createElement("div");
  modal.id = "debtHistoryModal";
  modal.className = "modal active";
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
      <div class="modal-header">
        <h3>📊 Histórico de Pagamentos</h3>
        <h4 style="color: var(--accent-gold); margin-top: 0.5rem;">${escapeHtml(debt.description)}</h4>
        <button class="modal-close" onclick="closeDebtHistoryModal()">×</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-primary); border-radius: 8px;">
          <p><strong>Total:</strong> ${formatCurrency(debt.total)}</p>
          <p><strong>Parcela:</strong> ${formatCurrency(debt.installment)}</p>
          <p><strong>Progresso:</strong> ${debt.paid} de ${debt.installments} parcelas (${((debt.paid / debt.installments) * 100).toFixed(1)}%)</p>
          <p><strong>Restante:</strong> ${formatCurrency(Math.max(debt.total - debt.installment * debt.paid, 0))}</p>
        </div>
        
        ${
          history.length === 0
            ? `
          <div class="empty-state small">
            <p>Nenhum pagamento registrado ainda.</p>
          </div>
        `
            : `
          <table class="data-table" style="font-size: 0.9rem;">
            <thead>
              <tr>
                <th>Parcela</th>
                <th>Mês Referência</th>
                <th>Valor</th>
                <th>Data Pagamento</th>
              </tr>
            </thead>
            <tbody>
              ${history
                .map(
                  (h, index) => `
                <tr>
                  <td>#${h.installmentNumber || history.length - index}</td>
                  <td>${formatMonth(h.month)}</td>
                  <td style="color: var(--accent-emerald); font-weight: 600;">${formatCurrency(h.amount)}</td>
                  <td>${formatDate(h.paidAt)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          
          <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border);">
            <h4 style="margin-bottom: 0.5rem;">Resumo por Ano</h4>
            ${getYearlySummary(history)}
          </div>
        `
        }
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeDebtHistoryModal() {
  const modal = document.getElementById("debtHistoryModal");
  if (modal) modal.remove();
}

function getYearlySummary(history) {
  const byYear = {};
  history.forEach((h) => {
    const year = h.month.split("-")[0];
    if (!byYear[year]) byYear[year] = { count: 0, total: 0 };
    byYear[year].count++;
    byYear[year].total += h.amount;
  });

  return Object.entries(byYear)
    .sort((a, b) => b[0] - a[0])
    .map(
      ([year, data]) => `
    <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: var(--bg-card); margin-bottom: 0.5rem; border-radius: 6px;">
      <span>${year}</span>
      <span>${data.count} pagamentos • ${formatCurrency(data.total)}</span>
    </div>
  `,
    )
    .join("");
}

function editDebt(id) {
  const userData = getUserData();
  const debt = userData.debts.find((d) => d.id === id);
  if (!debt) return;

  openEditModal("debt", id, debt);
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

function loadPaidOffDebts() {
  const userData = getUserData();
  const debts = userData.debts || [];
  const history = userData.debtPaymentHistory || [];

  // Filtrar apenas dívidas quitadas
  const paidOffDebts = debts.filter((d) => d.paid >= d.installments);

  const section = document.getElementById("paidDebtsSection");
  const countEl = document.getElementById("paidDebtsCount");
  const listEl = document.getElementById("paidDebtsList");

  if (!section || !countEl || !listEl) return;

  // Mostrar/esconder seção baseado em ter dívidas quitadas
  if (paidOffDebts.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  section.classList.add("has-debts");
  countEl.textContent = paidOffDebts.length;

  // Renderizar lista
  listEl.innerHTML = paidOffDebts
    .map((d) => {
      const lastPayment = history
        .filter((h) => h.debtId === d.id)
        .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0];

      return `
      <div class="paid-debt-card">
        <div class="paid-debt-info">
          <div class="paid-debt-main">
            <span class="paid-debt-name">${escapeHtml(d.description)}</span>
            <span class="paid-debt-badge">
              ✓ Quitado
            </span>
          </div>
          <div class="paid-debt-details">
            <span class="paid-debt-detail">
              💼 <strong>${escapeHtml(d.creditor)}</strong>
            </span>
            <span class="paid-debt-detail">
              📅 Vencimento dia <strong>${d.dueDay}</strong>
            </span>
            ${
              lastPayment
                ? `
              <span class="paid-debt-detail">
                🗓️ Quitado em <strong>${formatMonth(lastPayment.month)}</strong>
              </span>
            `
                : ""
            }
          </div>
        </div>
        <div class="paid-debt-amount">
          <div class="paid-debt-total">${formatCurrency(d.total)}</div>
          <div class="paid-debt-installments">${d.installments}x ${formatCurrency(d.installment)}</div>
        </div>
        <div class="paid-debt-actions">
          <button class="btn-icon" onclick="showDebtHistory('${d.id}')" title="Ver histórico completo">📊</button>
          <button class="btn-icon btn-delete" onclick="deletePaidDebt('${d.id}')" title="Remover do histórico">🗑️</button>
        </div>
      </div>
    `;
    })
    .join("");
}

function togglePaidDebts() {
  const content = document.getElementById("paidDebtsContent");
  const toggle = document.getElementById("paidDebtsToggle");

  if (!content || !toggle) return;

  content.classList.toggle("collapsed");
  toggle.classList.toggle("collapsed");
}

async function deletePaidDebt(id) {
  if (!confirm("Remover esta dívida quitada do histórico?")) return;

  const userData = getUserData();

  // Remover do array de dívidas
  userData.debts = userData.debts.filter((d) => d.id !== id);

  // Remover histórico de pagamentos relacionado
  userData.debtPaymentHistory = (userData.debtPaymentHistory || []).filter(
    (h) => h.debtId !== id,
  );

  await saveUserData(userData);

  loadPaidOffDebts();
  showNotification("Dívida removida do histórico!", "success");
}

// ==========================================
// RECEBIMENTOS
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

function editIncome(id) {
  const monthData = getMonthData();
  const income = monthData.incomes.find((i) => i.id === id);
  if (!income) return;

  openEditModal("income", id, income);
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

function editBill(id) {
  const monthData = getMonthData();
  const bill = monthData.bills.find((b) => b.id === id);
  if (!bill) return;

  openEditModal("bill", id, bill);
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
// CONTAS RECORRENTES
// ==========================================

async function createRecurringBillTemplate(e) {
  e.preventDefault();

  const description = document
    .getElementById("templateDescription")
    ?.value.trim();
  const category = document.getElementById("templateCategory")?.value;
  const defaultAmount =
    parseFloat(document.getElementById("templateDefaultAmount")?.value) || 0;
  const dueDay =
    parseInt(document.getElementById("templateDueDay")?.value) || 1;
  const notes = document.getElementById("templateNotes")?.value.trim();

  if (!description || !category) {
    showNotification("Preencha descrição e categoria!", "error");
    return;
  }

  const userData = getUserData();
  if (!userData.recurringBillTemplates) userData.recurringBillTemplates = [];

  const exists = userData.recurringBillTemplates.find(
    (t) => t.description.toLowerCase() === description.toLowerCase(),
  );
  if (exists) {
    showNotification("Já existe um template com este nome!", "error");
    return;
  }

  const template = {
    id: Date.now().toString(),
    description,
    category,
    defaultAmount,
    dueDay,
    notes,
    createdAt: new Date().toISOString(),
    lastUsedMonth: null,
    lastAmount: defaultAmount,
  };

  userData.recurringBillTemplates.push(template);
  await saveUserData(userData);

  loadRecurringTemplates();
  showNotification("Template de conta recorrente criado!", "success");
  e.target.reset();
}

function loadRecurringTemplates() {
  const userData = getUserData();
  const templates = userData.recurringBillTemplates || [];

  const container = document.getElementById("recurringTemplatesList");
  if (!container) return;

  if (templates.length === 0) {
    container.innerHTML = `
      <div class="empty-state small">
        <div class="empty-state-icon">📋</div>
        <h4>Nenhum template criado</h4>
        <p>Crie templates para contas que se repetem todo mês (luz, água, internet)</p>
      </div>
    `;
    return;
  }

  container.innerHTML = templates
    .map(
      (t) => `
    <div class="template-card" style="
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    ">
      <div>
        <h4 style="margin: 0 0 0.5rem 0; color: var(--accent-gold);">${escapeHtml(t.description)}</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          ${escapeHtml(t.category)} • Vence dia ${t.dueDay}
          ${t.defaultAmount > 0 ? `• Sugestão: ${formatCurrency(t.defaultAmount)}` : ""}
        </p>
        ${t.notes ? `<p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(t.notes)}</p>` : ""}
      </div>
      <div class="action-btns">
        <button class="btn-icon btn-edit" onclick="useTemplateForCurrentMonth('${t.id}')" title="Usar este mês">📅</button>
        <button class="btn-icon btn-edit" onclick="editTemplate('${t.id}')" title="Editar">✏️</button>
        <button class="btn-icon btn-delete" onclick="deleteTemplate('${t.id}')" title="Excluir">🗑️</button>
      </div>
    </div>
  `,
    )
    .join("");
}

async function useTemplateForCurrentMonth(templateId) {
  const userData = getUserData();
  const template = userData.recurringBillTemplates.find(
    (t) => t.id === templateId,
  );
  if (!template) return;

  const modal = document.getElementById("editModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  modalTitle.textContent = `Usar Template - ${template.description}`;
  modalBody.innerHTML = `
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-primary); border-radius: 8px;">
      <p><strong>Template:</strong> ${escapeHtml(template.description)}</p>
      <p><strong>Categoria:</strong> ${template.category}</p>
      <p><strong>Vencimento:</strong> Dia ${template.dueDay}</p>
      ${template.lastAmount ? `<p><strong>Último valor:</strong> ${formatCurrency(template.lastAmount)}</p>` : ""}
    </div>
    <div class="form-group">
      <label>Valor para ${formatMonth(currentMonth)} (R$)</label>
      <input type="number" id="templateUseAmount" step="0.01" value="${template.lastAmount || template.defaultAmount || ""}" required>
    </div>
  `;

  const saveBtn = document.getElementById("modalSaveBtn");
  const originalOnclick = saveBtn.onclick;
  saveBtn.onclick = async function () {
    const amount = parseFloat(
      document.getElementById("templateUseAmount").value,
    );

    if (isNaN(amount) || amount < 0) {
      showNotification("Valor inválido!", "error");
      return;
    }

    await processTemplateUse(templateId, amount);
    closeModal();
    saveBtn.onclick = originalOnclick;
  };

  modal.classList.add("active");
}

async function processTemplateUse(templateId, amount) {
  const userData = getUserData();
  const template = userData.recurringBillTemplates.find(
    (t) => t.id === templateId,
  );
  if (!template) return;

  const dueDate = `${currentMonth}-${String(template.dueDay).padStart(2, "0")}`;

  const monthData = getMonthData();
  const existing = monthData.bills.find(
    (b) =>
      b.templateId === templateId && b.description === template.description,
  );

  if (existing) {
    if (
      !confirm(
        `Já existe uma "${template.description}" neste mês. Deseja substituir?`,
      )
    ) {
      return;
    }
    monthData.bills = monthData.bills.filter((b) => b.id !== existing.id);
  }

  const newBill = {
    id: Date.now().toString(),
    description: template.description,
    category: template.category,
    amount: amount,
    dueDate: dueDate,
    status: "Pendente",
    recurring: true,
    templateId: templateId,
    createdAt: new Date().toISOString(),
  };

  monthData.bills.push(newBill);
  await saveMonthData(currentMonth, monthData);

  template.lastAmount = amount;
  template.lastUsedMonth = currentMonth;
  await saveUserData(userData);

  loadBills();
  updateDashboard();
  showNotification(
    `Conta "${template.description}" adicionada: ${formatCurrency(amount)}`,
    "success",
  );
}

function checkMissingRecurringBills() {
  const userData = getUserData();
  const templates = userData.recurringBillTemplates || [];
  if (templates.length === 0) return;

  const monthData = getMonthData();

  const missing = templates.filter((t) => {
    const exists = monthData.bills.some(
      (b) =>
        b.templateId === t.id ||
        b.description.toLowerCase() === t.description.toLowerCase(),
    );
    return !exists;
  });

  const container = document.getElementById("recurringSuggestions");
  if (!container) return;

  if (missing.length > 0) {
    container.innerHTML = `
      <div class="alert-item warning" style="margin-bottom: 1rem; background: rgba(245, 158, 11, 0.1); border-left: 4px solid var(--accent-gold); padding: 1rem; border-radius: 8px;">
        <div class="alert-icon">📋</div>
        <div class="alert-content">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--accent-gold);">Contas recorrentes pendentes</h4>
          <p style="margin: 0; color: var(--text-secondary);">Você ainda não adicionou: <strong>${missing.map((m) => m.description).join(", ")}</strong></p>
          <button onclick="showRecurringSuggestions()" class="btn btn-primary" style="margin-top: 0.5rem; padding: 0.5rem 1rem; font-size: 0.9rem;">
            Ver Sugestões
          </button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = "";
  }
}

function showRecurringSuggestions() {
  const userData = getUserData();
  const templates = userData.recurringBillTemplates || [];
  const monthData = getMonthData();

  const missing = templates.filter((t) => {
    const exists = monthData.bills.some(
      (b) =>
        b.templateId === t.id ||
        b.description.toLowerCase() === t.description.toLowerCase(),
    );
    return !exists;
  });

  if (missing.length === 0) {
    showNotification(
      "Todas as contas recorrentes já foram adicionadas!",
      "success",
    );
    return;
  }

  let html = `<h3 style="margin-bottom: 1rem;">Adicionar Contas do Mês</h3><div style="display: grid; gap: 1rem;">`;

  missing.forEach((t) => {
    html += `
      <div style="background: var(--bg-card); padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${escapeHtml(t.description)}</strong>
          <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${t.category} • Vence dia ${t.dueDay}</p>
        </div>
        <button onclick="useTemplateForCurrentMonth('${t.id}')" class="btn btn-primary" style="padding: 0.5rem 1rem;">
          Adicionar
        </button>
      </div>
    `;
  });

  html += `</div>`;

  showModal("Contas Recorrentes Pendentes", html);
}

function editTemplate(id) {
  const userData = getUserData();
  const template = userData.recurringBillTemplates.find((t) => t.id === id);
  if (!template) return;

  openEditModal("template", id, template);
}

async function deleteTemplate(id) {
  if (!confirm("Excluir este template?")) return;
  const userData = getUserData();
  userData.recurringBillTemplates = userData.recurringBillTemplates.filter(
    (t) => t.id !== id,
  );
  await saveUserData(userData);
  loadRecurringTemplates();
  showNotification("Template excluído!", "success");
}

// ==========================================
// DASHBOARD
// ==========================================
function updateDashboard() {
  const monthData = getMonthData();
  const userData = getUserData();

  // === MÊS ANTERIOR PARA COMPARAÇÃO ===
  const [year, month] = currentMonth.split("-").map(Number);
  let prevYear = year;
  let prevMonth = month - 1;

  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }

  const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  const prevMonthData = getMonthData(prevMonthStr);
  const prevUserData = getUserData();

  // === RENDA DA FAMÍLIA ===
  const familyIncome = (userData.familyMembers || []).reduce(
    (sum, m) => sum + (parseFloat(m.defaultSalary) || 0),
    0,
  );

  const prevFamilyIncome = (prevUserData.familyMembers || []).reduce(
    (sum, m) => sum + (parseFloat(m.defaultSalary) || 0),
    0,
  );

  // === RENDAS EXTRAS ===
  const extraIncome = (monthData.incomes || []).reduce(
    (sum, i) => sum + (parseFloat(i.amount) || 0),
    0,
  );

  const prevExtraIncome = (prevMonthData.incomes || []).reduce(
    (sum, i) => sum + (parseFloat(i.amount) || 0),
    0,
  );

  const totalIncome = familyIncome + extraIncome;
  const prevTotalIncome = prevFamilyIncome + prevExtraIncome;

  // === CONTAS DO MÊS ===
  const totalBills = (monthData.bills || []).reduce(
    (sum, b) => sum + (parseFloat(b.amount) || 0),
    0,
  );

  const prevTotalBills = (prevMonthData.bills || []).reduce(
    (sum, b) => sum + (parseFloat(b.amount) || 0),
    0,
  );

  // === HISTÓRICO DE PAGAMENTOS ===
  const history = userData.debtPaymentHistory || [];
  const debtsPaidThisMonth = history.filter((h) => h.month === currentMonth);

  // === PARCELAS DAS DÍVIDAS (CORRETO PARA TODOS OS MESES) ===
  const totalDebtInstallments = (userData.debts || []).reduce((sum, d) => {
    const totalInstallments = parseInt(d.installments) || 1;
    const paidInstallments = parseInt(d.paid) || 0;

    const remaining = totalInstallments - paidInstallments;

    if (remaining > 0) {
      return sum + (parseFloat(d.installment) || 0);
    }

    return sum;
  }, 0);

  const prevTotalDebtInstallments = totalDebtInstallments;

  // === DESPESAS TOTAIS ===
  const totalExpenses = totalBills + totalDebtInstallments;
  const prevTotalExpenses = prevTotalBills + prevTotalDebtInstallments;

  // === SALDO DISPONÍVEL ===
  const balance = totalIncome - totalExpenses;
  const prevBalance = prevTotalIncome - prevTotalExpenses;

  // === ELEMENTOS DO DASHBOARD ===
  const incomeEl = document.getElementById("totalIncome");
  const debtsEl = document.getElementById("totalDebts");
  const billsEl = document.getElementById("totalBills");
  const expensesEl = document.getElementById("totalExpenses");
  const balanceEl = document.getElementById("availableBalance");

  const incomeTrendEl = document.getElementById("incomeTrend");
  const debtTrendEl = document.getElementById("debtTrend");
  const expenseTrendEl = document.getElementById("expenseTrend");
  const balanceTrendEl = document.getElementById("balanceTrend");

  // === FUNÇÃO DE TENDÊNCIA ===
  function calcTrend(current, previous) {
    if (previous === 0) {
      if (current === 0) return { value: 0, text: "0%" };
      return { value: 100, text: "+100%" };
    }

    const diff = ((current - previous) / previous) * 100;
    const sign = diff >= 0 ? "+" : "";

    return {
      value: diff,
      text: `${sign}${diff.toFixed(1).replace(".0", "")}%`,
    };
  }

  // === RENDA ===
  if (incomeEl) {
    incomeEl.textContent = formatCurrency(totalIncome);
  }

  if (incomeTrendEl) {
    const trend = calcTrend(totalIncome, prevTotalIncome);
    incomeTrendEl.textContent = trend.text;
    incomeTrendEl.className = `metric-trend ${
      trend.value >= 0 ? "trend-up" : "trend-down"
    }`;
  }

  // === DÍVIDAS ===
  if (debtsEl) {
    debtsEl.textContent = formatCurrency(totalDebtInstallments);
    debtsEl.style.color = "var(--accent-purple)";
  }

  if (debtTrendEl) {
    const trend = calcTrend(totalDebtInstallments, prevTotalDebtInstallments);

    debtTrendEl.textContent = trend.text;

    debtTrendEl.className = `metric-trend ${
      trend.value > 0 ? "trend-down" : "trend-up"
    }`;

    debtTrendEl.style.color = "var(--accent-purple)";
    debtTrendEl.style.background = "rgba(139, 92, 246, 0.1)";
  }

  // === CONTAS ===
  if (billsEl) {
    billsEl.textContent = formatCurrency(totalBills);
  }

  if (expenseTrendEl) {
    const trend = calcTrend(totalBills, prevTotalBills);

    expenseTrendEl.textContent = trend.text;

    expenseTrendEl.className = `metric-trend ${
      trend.value >= 0 ? "trend-up" : "trend-down"
    }`;
  }

  // === DESPESAS ===
  if (expensesEl) {
    expensesEl.textContent = formatCurrency(totalExpenses);
    expensesEl.style.color = "var(--accent-rose)";
  }

  // === SALDO ===
  if (balanceEl) {
    balanceEl.textContent = formatCurrency(balance);

    if (balance < 0) {
      balanceEl.style.color = "var(--accent-rose)";
    } else {
      balanceEl.style.color = "var(--accent-emerald)";
    }
  }

  if (balanceTrendEl) {
    const trend = calcTrend(balance, prevBalance);

    balanceTrendEl.textContent = trend.text;

    balanceTrendEl.className = `metric-trend ${
      trend.value >= 0 ? "trend-up" : "trend-down"
    }`;
  }

  // === OUTRAS FUNÇÕES ===
  showDebtSummary(debtsPaidThisMonth);
  checkMissingRecurringBills();
  updateAlerts(monthData.bills || [], userData.debts || []);
  updateMainChart(totalIncome, totalBills, totalDebtInstallments, balance);
}

function showDebtSummary(payments) {
  const container = document.getElementById("debtSummary");
  if (!container) return;

  if (payments.length === 0) {
    container.innerHTML = "";
    return;
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  container.innerHTML = `
    <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid var(--accent-emerald); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
      <h4 style="margin: 0 0 0.5rem 0; color: var(--accent-emerald);">💳 Dívidas pagas este mês</h4>
      <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
        ${payments.length} pagamento(s) • Total: <strong>${formatCurrency(totalPaid)}</strong>
      </p>
      <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--text-muted);">
        ${payments.map((p) => p.debtDescription).join(", ")}
      </p>
    </div>
  `;
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
    recurringBillTemplates: [],
    debtPaymentHistory: [],
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
window.payDebtInstallment = payDebtInstallment;
window.showDebtHistory = showDebtHistory;
window.closeDebtHistoryModal = closeDebtHistoryModal;
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
window.createRecurringBillTemplate = createRecurringBillTemplate;
window.useTemplateForCurrentMonth = useTemplateForCurrentMonth;
window.editTemplate = editTemplate;
window.deleteTemplate = deleteTemplate;
window.showRecurringSuggestions = showRecurringSuggestions;
window.saveEdit = saveEdit;
window.closeModal = closeModal;
