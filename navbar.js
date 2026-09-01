/**
 * Componente Mestre de Navegação, Temas Globais e Modal de Vendas
 */

window.formatarNomeCurto = function (nome) {
  if (!nome || typeof nome !== "string") return "NÃO INFORMADO";
  const limpo = nome.trim().replace(/\s+/g, " ");

  if (
    limpo.startsWith("VENDA EXTERNA") ||
    limpo.includes("SITE") ||
    limpo === "NÃO INFORMADO" ||
    limpo === "S/N" ||
    limpo === "Geral da Equipe" ||
    limpo === "Visão Geral da Equipe"
  ) {
    return limpo;
  }

  const partes = limpo.split(" ");
  if (partes.length <= 2) return limpo;

  const conectores = ["DE", "DA", "DO", "DOS", "DAS", "E"];
  if (conectores.includes(partes[1].toUpperCase()) && partes[2]) {
    return `${partes[0]} ${partes[1]} ${partes[2]}`;
  }

  return `${partes[0]} ${partes[1]}`;
};

window.aplicarTema = function (tema) {
  document.body.className = `theme-${tema}`;
  localStorage.setItem("ranking_theme_selected", tema);
  const select = document.getElementById("seletorTemaGlobal");
  if (select && select.value !== tema) {
    select.value = tema;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const temaSalvo = localStorage.getItem("ranking_theme_selected") || "dracula";
  window.aplicarTema(temaSalvo);

  renderizarNavbarGlobal();
  configurarModalGlobal();
});

function renderizarNavbarGlobal() {
  const container = document.getElementById("navbar-container");
  if (!container) return;

  const caminhoAtual =
    window.location.pathname.split("/").pop() || "index.html";
  const temaAtual = localStorage.getItem("ranking_theme_selected") || "dracula";

  const rotas = [
    { href: "index.html", label: "Rankings", icon: "fa-trophy" },
    { href: "posvenda.html", label: "Pós-Venda (Lavínia)", icon: "fa-headset" },
    { href: "desempenho.html", label: "Desempenho", icon: "fa-chart-pie" },
    {
      href: "comparativo.html",
      label: "Comparativo",
      icon: "fa-users-viewfinder",
    },
    { href: "cancelamentos.html", label: "Vendas Canceladas", icon: "fa-ban" },
    { href: "importador.html", label: "Importador", icon: "fa-cloud-arrow-up" },
    { href: "admin.html", label: "Consultores", icon: "fa-user-gear" },
  ];

  const linksHtml = rotas
    .map((r) => {
      const isActive = caminhoAtual === r.href ? "active" : "";
      return `<a href="${r.href}" class="nav-link ${isActive}"><i class="fa-solid ${r.icon}"></i> ${r.label}</a>`;
    })
    .join("");

  container.innerHTML = `
    <header class="main-header">
      <div class="logo-area">
        <i class="fa-solid fa-chart-line header-icon"></i>
        <h1>Ranking<span>Vendas</span></h1>
      </div>
      
      <nav class="header-nav">
        <div class="nav-links-group">
          ${linksHtml}
        </div>

        <div class="header-actions-group">
          <!-- Seletor de Temas -->
          <div class="theme-selector-wrap">
            <i class="fa-solid fa-palette text-muted"></i>
            <select id="seletorTemaGlobal" onchange="aplicarTema(this.value)">
              <option value="dracula" ${temaAtual === "dracula" ? "selected" : ""}>Dracula Dark</option>
              <option value="midnight" ${temaAtual === "midnight" ? "selected" : ""}>Midnight Blue</option>
              <option value="cyberpunk" ${temaAtual === "cyberpunk" ? "selected" : ""}>Cyberpunk Neon</option>
              <option value="light" ${temaAtual === "light" ? "selected" : ""}>Light Clean</option>
            </select>
          </div>

          <button class="btn btn-primary" id="btnAbrirModalVendaGlobal">
            <i class="fa-solid fa-plus"></i> Nova Venda
          </button>

          <a href="login.html" class="btn btn-secondary-sm btn-logout" title="Sair / Trocar Usuário">
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
          </a>
        </div>
      </nav>
    </header>

    <!-- Modal Global de Lançamento de Venda -->
    <div class="modal-overlay" id="modalVendaOverlayGlobal">
      <div class="modal-card">
        <div class="modal-header">
          <h3><i class="fa-solid fa-cart-plus"></i> Registrar Nova Venda</h3>
          <button class="btn-close" id="btnFecharModalGlobal">&times;</button>
        </div>
        <form id="formNovaVendaGlobal">
          <div class="form-group">
            <label for="consultorSelectGlobal">Consultor Responsável *</label>
            <select id="consultorSelectGlobal" required>
              <option value="" disabled selected>Selecione o consultor...</option>
              <option value="ALEXANDRA GUERREIRO">ALEXANDRA GUERREIRO</option>
              <option value="ADRIELLE CRISTINA">ADRIELLE CRISTINA</option>
              <option value="CLAUDIO LUIZ">CLAUDIO LUIZ</option>
              <option value="KARINE MARCELA">KARINE MARCELA</option>
              <option value="MAYARA NUNES">MAYARA NUNES</option>
              <option value="NATALIA CRISTINA">NATALIA CRISTINA</option>
              <option value="PRISCILA LIMA">PRISCILA LIMA</option>
              <option value="SIMONE KNUPP">SIMONE KNUPP</option>
              <option value="THATIANE CHRISTINE">THATIANE CHRISTINE</option>
              <option value="OUTRO">OUTRO / DIGITAR NOME</option>
            </select>
          </div>

          <div class="form-group" id="grupoConsultorManualGlobal" style="display: none;">
            <label for="consultorManualInputGlobal">Nome do Novo Consultor *</label>
            <input type="text" id="consultorManualInputGlobal" placeholder="Digite o nome completo" />
          </div>

          <div class="form-row">
            <div class="form-group col">
              <label for="clienteInputGlobal">Nome do Cliente *</label>
              <input type="text" id="clienteInputGlobal" required placeholder="Nome completo" />
            </div>
            <div class="form-group col">
              <label for="matriculaInputGlobal">Matrícula *</label>
              <input type="text" id="matriculaInputGlobal" required placeholder="Ex: RJ411032445" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col">
              <label for="tipoVendaSelectGlobal">Tipo de Venda *</label>
              <select id="tipoVendaSelectGlobal" required>
                <option value="FILIAÇÃO">FILIAÇÃO</option>
                <option value="REFILIAÇÃO">REFILIAÇÃO</option>
              </select>
            </div>
            <div class="form-group col">
              <label for="formaPagamentoSelectGlobal">Forma de Pagamento *</label>
              <select id="formaPagamentoSelectGlobal" required>
                <option value="CRÉDITO">CRÉDITO</option>
                <option value="DÉBITO">DÉBITO</option>
                <option value="BOLETO">BOLETO</option>
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">DINHEIRO</option>
                <option value="NÃO INFORMADO">NÃO INFORMADO</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="valorInputGlobal">Valor Negociado (R$)</label>
            <input type="number" id="valorInputGlobal" step="0.01" placeholder="66.80" value="66.80" />
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary-sm" id="btnCancelarModalGlobal">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btnSalvarVendaGlobal">
              <i class="fa-solid fa-check"></i> Salvar e Enviar p/ Pós-Venda
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function configurarModalGlobal() {
  const modal = document.getElementById("modalVendaOverlayGlobal");
  const btnAbrir = document.getElementById("btnAbrirModalVendaGlobal");
  const btnFechar = document.getElementById("btnFecharModalGlobal");
  const btnCancelar = document.getElementById("btnCancelarModalGlobal");
  const form = document.getElementById("formNovaVendaGlobal");
  const selectConsultor = document.getElementById("consultorSelectGlobal");
  const grupoManual = document.getElementById("grupoConsultorManualGlobal");
  const inputManual = document.getElementById("consultorManualInputGlobal");

  if (!modal || !btnAbrir || !form) return;

  selectConsultor.onchange = () => {
    if (selectConsultor.value === "OUTRO") {
      grupoManual.style.display = "block";
      inputManual.required = true;
      inputManual.focus();
    } else {
      grupoManual.style.display = "none";
      inputManual.required = false;
    }
  };

  btnAbrir.onclick = () => {
    modal.style.display = "flex";
  };
  const fechar = () => {
    modal.style.display = "none";
    form.reset();
    grupoManual.style.display = "none";
    document.getElementById("valorInputGlobal").value = "66.80";
  };

  if (btnFechar) btnFechar.onclick = fechar;
  if (btnCancelar) btnCancelar.onclick = fechar;

  form.onsubmit = async (e) => {
    e.preventDefault();

    let consultorFinal = selectConsultor.value;
    if (consultorFinal === "OUTRO") {
      consultorFinal = inputManual.value.trim().toUpperCase();
    }

    const novaVenda = {
      consultor: consultorFinal,
      cliente: document
        .getElementById("clienteInputGlobal")
        .value.trim()
        .toUpperCase(),
      matricula: document
        .getElementById("matriculaInputGlobal")
        .value.trim()
        .toUpperCase(),
      tipoVenda: document.getElementById("tipoVendaSelectGlobal").value,
      formaPagamento: document.getElementById("formaPagamentoSelectGlobal")
        .value,
      valor:
        parseFloat(document.getElementById("valorInputGlobal").value) || 66.8,
      dataVenda: firebase.firestore.FieldValue.serverTimestamp(),
      status: "PENDENTE",
      observacao: "",
      etapasPosVenda: {
        ligacao: false,
        linkEnviado: false,
        docsRecebidos: false,
      },
    };

    try {
      const db = firebase.firestore();
      await db.collection("vendas").add(novaVenda);
      fechar();
    } catch (err) {
      alert("Erro ao registrar venda: " + err.message);
    }
  };
}
