const db = firebase.firestore();
let vendasTotalCache = [];
let canceladosFiltrados = [];
let limiteExibicao = 10;

let chartConsultorInstancia = null;
let chartPagamentoInstancia = null;

function formatarNomeCurto(nome) {
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
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("filtroMesCancelamentos")
    .addEventListener("change", aplicarFiltros);
  document
    .getElementById("filtroConsultorCancelamentos")
    .addEventListener("change", aplicarFiltros);
  document
    .getElementById("buscaCancelamentosInput")
    .addEventListener("input", filtrarTexto);

  document.getElementById("btnMostrarMais10").addEventListener("click", () => {
    limiteExibicao += 10;
    renderizarTabela();
  });

  document.getElementById("btnMostrarTodos").addEventListener("click", () => {
    limiteExibicao = canceladosFiltrados.length;
    renderizarTabela();
  });

  document.getElementById("btnRecolher10").addEventListener("click", () => {
    limiteExibicao = 10;
    renderizarTabela();
  });

  iniciarOuvinteVendasCanceladas();
});

function parseDataFlexivel(valorData) {
  if (!valorData) return new Date();
  if (valorData.toDate && typeof valorData.toDate === "function")
    return valorData.toDate();
  if (valorData instanceof Date) return valorData;
  if (typeof valorData === "string") {
    const limpo = valorData.trim();
    if (limpo.includes("/")) {
      const partes = limpo.split(" ")[0].split("/");
      if (partes.length === 3) {
        return new Date(
          parseInt(partes[2], 10),
          parseInt(partes[1], 10) - 1,
          parseInt(partes[0], 10),
        );
      }
    }
    const parsed = new Date(valorData);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function extrairConsultor(obj) {
  const prioridades = [
    "consultor",
    "NOME CONSULTOR",
    "NOME_CONSULTOR",
    "Nome Consultor",
    "nomeConsultor",
    "vendedor",
  ];
  let candidato = "";
  for (const p of prioridades) {
    if (obj[p] && String(obj[p]).trim() !== "") {
      candidato = String(obj[p]).trim();
      break;
    }
  }
  if (!candidato) {
    const chaves = Object.keys(obj);
    for (const k of chaves) {
      const kNorm = k.toLowerCase().replace(/[^a-z]/g, "");
      if (kNorm.includes("consultor") || kNorm === "nome") {
        const val = obj[k];
        if (val && typeof val === "string" && val.trim() !== "") {
          candidato = val.trim();
          break;
        }
      }
    }
  }
  candidato = candidato.toUpperCase();
  const ehHash = /^[A-Z0-9]{15,}$/.test(candidato) && !candidato.includes(" ");
  if (ehHash || !candidato) return "VENDA EXTERNA / SITE";
  return candidato;
}

function extrairStatus(obj) {
  if (!obj || typeof obj !== "object") return "PENDENTE";
  const chaves = [
    "status",
    "STATUS_VENDA",
    "STATUS VENDA",
    "STATUS",
    "statusVenda",
  ];
  for (const c of chaves) {
    if (obj[c]) return String(obj[c]).toUpperCase().trim();
  }
  return "CONCLUÍDO";
}

function extrairValor(obj) {
  if (!obj || typeof obj !== "object") return 66.8;
  const chaves = ["valor", "VALOR", "valorVenda", "VALOR VENDA", "total"];
  for (const c of chaves) {
    if (obj[c] !== undefined && obj[c] !== null && obj[c] !== "") {
      const val = obj[c];
      return typeof val === "number"
        ? val
        : parseFloat(String(val).replace(",", ".")) || 66.8;
    }
  }
  return 66.8;
}

function iniciarOuvinteVendasCanceladas() {
  db.collection("vendas").onSnapshot(
    (snapshot) => {
      vendasTotalCache = [];
      const consultoresSet = new Set();

      snapshot.forEach((doc) => {
        const v = { id: doc.id, ...doc.data() };
        vendasTotalCache.push(v);
        consultoresSet.add(extrairConsultor(v));
      });

      vendasTotalCache.sort((a, b) => {
        const dataA = parseDataFlexivel(
          a.dataVenda || a.DATA_VENDA || a.data,
        ).getTime();
        const dataB = parseDataFlexivel(
          b.dataVenda || b.DATA_VENDA || b.data,
        ).getTime();
        return dataB - dataA;
      });

      preencherSelectConsultores(Array.from(consultoresSet).sort());
      aplicarFiltros();
    },
    (err) => {
      console.error("Erro ao ler cancelamentos:", err);
    },
  );
}

function preencherSelectConsultores(consultores) {
  const select = document.getElementById("filtroConsultorCancelamentos");
  const valorAtual = select.value;

  select.innerHTML = '<option value="TODOS">Todos os Consultores</option>';
  consultores.forEach((c) => {
    select.innerHTML += `<option value="${c}">${formatarNomeCurto(c)}</option>`;
  });

  if (consultores.includes(valorAtual)) {
    select.value = valorAtual;
  }
}

function aplicarFiltros() {
  const mesFiltro = document.getElementById("filtroMesCancelamentos").value;
  const consultorFiltro = document.getElementById(
    "filtroConsultorCancelamentos",
  ).value;

  const vendasNoPeriodo = vendasTotalCache.filter((v) => {
    const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
    const consultor = extrairConsultor(v);

    const matchMes =
      mesFiltro === "TODOS" || dataObj.getMonth().toString() === mesFiltro;
    const matchConsultor =
      consultorFiltro === "TODOS" || consultor === consultorFiltro;

    return matchMes && matchConsultor;
  });

  canceladosFiltrados = vendasNoPeriodo.filter((v) => {
    const st = extrairStatus(v);
    return (
      st.includes("NÃO") ||
      st.includes("NAO") ||
      st.includes("RECUS") ||
      st.includes("CANCEL")
    );
  });

  limiteExibicao = 10;
  atualizarMetricasEDashboards(vendasNoPeriodo);
  renderizarTabela();
}

function atualizarMetricasEDashboards(vendasNoPeriodo) {
  const totalPeriodo = vendasNoPeriodo.length;
  const totalCanceladas = canceladosFiltrados.length;

  let receitaPerdida = 0;
  const perdasPorConsultor = {};
  const perdasPorPagamento = {
    Crédito: 0,
    Débito: 0,
    Pix: 0,
    "Boleto/Outros": 0,
  };
  let filiacaoCancelada = 0;
  let refiliacaoCancelada = 0;

  canceladosFiltrados.forEach((v) => {
    const valor = extrairValor(v);
    const consultor = extrairConsultor(v);
    const pag = (
      v.formaPagamento ||
      v["FORMA DE PAGAMENTO"] ||
      ""
    ).toUpperCase();
    const tipo = (
      v.tipoVenda ||
      v["TIPO DE VENDA"] ||
      "FILIAÇÃO"
    ).toUpperCase();

    receitaPerdida += valor;
    perdasPorConsultor[consultor] = (perdasPorConsultor[consultor] || 0) + 1;

    if (pag.includes("CRÉD") || pag.includes("CRED"))
      perdasPorPagamento["Crédito"]++;
    else if (pag.includes("DÉB") || pag.includes("DEB"))
      perdasPorPagamento["Débito"]++;
    else if (pag.includes("PIX")) perdasPorPagamento["Pix"]++;
    else perdasPorPagamento["Boleto/Outros"]++;

    if (tipo.includes("REFIL")) refiliacaoCancelada++;
    else filiacaoCancelada++;
  });

  const taxaCancelamento =
    totalPeriodo > 0 ? Math.round((totalCanceladas / totalPeriodo) * 100) : 0;

  let modCritica = "FILIAÇÃO";
  let modCriticaQtd = filiacaoCancelada;
  if (refiliacaoCancelada > filiacaoCancelada) {
    modCritica = "REFILIAÇÃO";
    modCriticaQtd = refiliacaoCancelada;
  }

  document.getElementById("cardTotalCanceladas").textContent = totalCanceladas;
  document.getElementById("cardReceitaPerdida").textContent =
    `R$ ${receitaPerdida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  document.getElementById("cardTaxaCancelamento").textContent =
    `${taxaCancelamento}%`;
  document.getElementById("cardModalidadeCritica").textContent =
    totalCanceladas > 0 ? modCritica : "--";
  document.getElementById("cardModalidadeCriticaQtd").textContent =
    `${modCriticaQtd} cancelamentos`;
  document.getElementById("txtQtdTotalBtn").textContent = totalCanceladas;

  renderizarGraficos(perdasPorConsultor, perdasPorPagamento);
}

function renderizarGraficos(consultoresMap, pagamentosMap) {
  const consultoresOrdenados = Object.entries(consultoresMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const labelsConsultores = consultoresOrdenados.map((item) =>
    formatarNomeCurto(item[0]),
  );
  const valoresConsultores = consultoresOrdenados.map((item) => item[1]);

  const ctxConsultor = document
    .getElementById("graficoCanceladosConsultor")
    .getContext("2d");
  if (chartConsultorInstancia) chartConsultorInstancia.destroy();

  chartConsultorInstancia = new Chart(ctxConsultor, {
    type: "bar",
    data: {
      labels:
        labelsConsultores.length > 0
          ? labelsConsultores
          : ["Nenhum cancelamento"],
      datasets: [
        {
          label: "Vendas Canceladas",
          data: valoresConsultores.length > 0 ? valoresConsultores : [0],
          backgroundColor: "#ff5555",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: "#6272a4", font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#6272a4", precision: 0 },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });

  const ctxPag = document
    .getElementById("graficoCanceladosPagamento")
    .getContext("2d");
  if (chartPagamentoInstancia) chartPagamentoInstancia.destroy();

  chartPagamentoInstancia = new Chart(ctxPag, {
    type: "doughnut",
    data: {
      labels: Object.keys(pagamentosMap),
      datasets: [
        {
          data: Object.values(pagamentosMap),
          backgroundColor: ["#bd93f9", "#50fa7b", "#ff79c6", "#ffb86c"],
          borderWidth: 2,
          borderColor: "#282a36",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#f8f8f2", font: { size: 10 } },
        },
      },
      cutout: "65%",
    },
  });
}

function filtrarTexto() {
  const termo = document
    .getElementById("buscaCancelamentosInput")
    .value.toLowerCase()
    .trim();
  renderizarTabela(termo);
}

function obterClasseTipo(tipo) {
  if (tipo.includes("REFIL")) return "pill-tipo-refiliacao";
  return "pill-tipo-filiacao";
}

function obterClassePagamento(pag) {
  if (pag.includes("CRÉD") || pag.includes("CRED")) return "pill-pag-credito";
  if (pag.includes("DÉB") || pag.includes("DEB")) return "pill-pag-debito";
  if (pag.includes("PIX")) return "pill-pag-pix";
  if (pag.includes("BOL")) return "pill-pag-boleto";
  return "pill-pag-outro";
}

function renderizarTabela(filtroTexto = "") {
  const tbody = document.getElementById("corpoCancelamentos");
  const txtContagem = document.getElementById("txtContagemCancelados");
  const btnMais = document.getElementById("btnMostrarMais10");
  const btnTodos = document.getElementById("btnMostrarTodos");
  const btnRecolher = document.getElementById("btnRecolher10");

  if (!tbody) return;

  let listaParaExibir = canceladosFiltrados;
  if (filtroTexto) {
    listaParaExibir = listaParaExibir.filter((v) => {
      const cliente = (v.cliente || v.CLIENTE || "").toLowerCase();
      const matricula = (
        v.matricula ||
        v.MATRÍCULA ||
        v.MATRICULA ||
        ""
      ).toLowerCase();
      const consultor = extrairConsultor(v).toLowerCase();
      return (
        cliente.includes(filtroTexto) ||
        matricula.includes(filtroTexto) ||
        consultor.includes(filtroTexto)
      );
    });
  }

  const total = listaParaExibir.length;
  const listaFatiada = listaParaExibir.slice(0, limiteExibicao);

  txtContagem.textContent = `Exibindo ${listaFatiada.length} de ${total} contratos`;

  btnMais.style.display = limiteExibicao < total ? "inline-flex" : "none";
  btnTodos.style.display = limiteExibicao < total ? "inline-flex" : "none";
  btnRecolher.style.display = limiteExibicao > 10 ? "inline-flex" : "none";

  if (listaFatiada.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 28px;">Nenhuma venda cancelada encontrada no período.</td></tr>`;
    return;
  }

  tbody.innerHTML = listaFatiada
    .map((v) => {
      const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
      const matricula = v.matricula || v.MATRÍCULA || v.MATRICULA || "S/N";
      const clienteCompleto = v.cliente || v.CLIENTE || "NÃO INFORMADO";
      const consultorCompleto = extrairConsultor(v);

      const clienteExibicao = formatarNomeCurto(clienteCompleto);
      const consultorExibicao = formatarNomeCurto(consultorCompleto);

      const tipo = v.tipoVenda || v["TIPO DE VENDA"] || "FILIAÇÃO";
      const pagamento =
        v.formaPagamento || v["FORMA DE PAGAMENTO"] || "NÃO INFORMADO";
      const obs = v.observacao || "Sem observação";

      return `
      <tr>
        <td><span class="pill pill-matricula">${matricula}</span></td>
        <td><span class="pill pill-cliente" title="${clienteCompleto}">${clienteExibicao}</span></td>
        <td><span class="pill pill-data">${dataObj.toLocaleDateString("pt-BR")}</span></td>
        <td><span class="pill pill-consultor" title="${consultorCompleto}">${consultorExibicao}</span></td>
        <td><span class="pill ${obterClasseTipo(tipo)}">${tipo}</span></td>
        <td><span class="pill ${obterClassePagamento(pagamento)}">${pagamento}</span></td>
        <td><span class="pill pill-cliente" style="max-width: 200px;" title="${obs}">${obs}</span></td>
        <td><span class="pill pill-status-recusado">NÃO CONCLUÍDO</span></td>
        <td class="text-center">
          <button class="btn btn-primary" style="padding: 5px 12px; font-size: 0.78rem; border-radius: 20px;" title="Reabrir para Pós-Venda" onclick="reabrirVenda('${v.id}')">
            <i class="fa-solid fa-rotate-left"></i> Reabrir
          </button>
        </td>
      </tr>
    `;
    })
    .join("");
}

window.reabrirVenda = async function (id) {
  if (
    confirm(
      "Deseja mover este contrato de volta para o Pós-Venda (Lavínia) como PENDENTE?",
    )
  ) {
    await db
      .collection("vendas")
      .doc(id)
      .update({
        status: "PENDENTE",
        STATUS_VENDA: "PENDENTE",
        etapasPosVenda: {
          ligacao: false,
          linkEnviado: false,
          docsRecebidos: false,
        },
      });
  }
};
