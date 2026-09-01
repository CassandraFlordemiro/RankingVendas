const db = firebase.firestore();
let vendasCache = [];
let vendasFiltradasAtuais = [];
let metasCache = {};
let limiteExibicao = 10;

let chartDiarioInstancia = null;
let chartPagamentosInstancia = null;

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
    .getElementById("filtroMesDesempenho")
    .addEventListener("change", aplicarFiltros);
  document
    .getElementById("filtroConsultorDesempenho")
    .addEventListener("change", aplicarFiltros);
  document
    .getElementById("buscaHistoricoInput")
    .addEventListener("input", filtrarHistoricoTexto);

  document.getElementById("btnMostrarMais10").addEventListener("click", () => {
    limiteExibicao += 10;
    renderizarTabela();
  });

  document.getElementById("btnMostrarTodos").addEventListener("click", () => {
    limiteExibicao = vendasFiltradasAtuais.length;
    renderizarTabela();
  });

  document.getElementById("btnRecolher10").addEventListener("click", () => {
    limiteExibicao = 10;
    renderizarTabela();
  });

  iniciarOuvinteMetas();
  iniciarOuvinteVendas();
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
  for (const p of prioridades) {
    if (obj[p] && String(obj[p]).trim() !== "")
      return String(obj[p]).trim().toUpperCase();
  }
  return "NÃO INFORMADO";
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

function iniciarOuvinteMetas() {
  db.collection("metas").onSnapshot((snapshot) => {
    metasCache = {};
    snapshot.forEach((doc) => {
      const d = doc.data();
      const chave = `${d.ano}_${d.mes}_${d.consultor}`;
      metasCache[chave] = d;
    });
    aplicarFiltros();
  });
}

function iniciarOuvinteVendas() {
  db.collection("vendas").onSnapshot(
    (snapshot) => {
      vendasCache = [];
      const consultoresUnicos = new Set();

      snapshot.forEach((doc) => {
        const v = { id: doc.id, ...doc.data() };
        vendasCache.push(v);
        consultoresUnicos.add(extrairConsultor(v));
      });

      vendasCache.sort((a, b) => {
        const dataA = parseDataFlexivel(
          a.dataVenda || a.DATA_VENDA || a.data,
        ).getTime();
        const dataB = parseDataFlexivel(
          b.dataVenda || b.DATA_VENDA || b.data,
        ).getTime();
        return dataB - dataA;
      });

      preencherSelectConsultores(Array.from(consultoresUnicos).sort());
      aplicarFiltros();
    },
    (err) => {
      console.error("Erro ao ler vendas:", err);
    },
  );
}

function preencherSelectConsultores(consultores) {
  const select = document.getElementById("filtroConsultorDesempenho");
  const valorAtual = select.value;

  select.innerHTML = '<option value="TODOS">Visão Geral da Equipe</option>';
  consultores.forEach((c) => {
    const nomeExibicao = formatarNomeCurto(c);
    select.innerHTML += `<option value="${c}">${nomeExibicao}</option>`;
  });

  if (consultores.includes(valorAtual)) {
    select.value = valorAtual;
  }
}

// Renderiza Badge de Posição com SVG de Medalha
function renderizarBadgePosicao(consultorSelecionado, mesFiltro) {
  if (consultorSelecionado === "TODOS") {
    return `<span class="badge-pos-text">Geral da Equipe</span>`;
  }

  const mapa = {};
  vendasCache.forEach((v) => {
    const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
    if (mesFiltro !== "TODOS" && dataObj.getMonth().toString() !== mesFiltro)
      return;

    const status = extrairStatus(v);
    const ehRecusado =
      status.includes("NÃO") ||
      status.includes("NAO") ||
      status.includes("RECUS") ||
      status.includes("CANCEL");
    if ((status.includes("CONCLU") || status === "OK") && !ehRecusado) {
      const c = extrairConsultor(v);
      mapa[c] = (mapa[c] || 0) + 1;
    }
  });

  const ordenados = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  const index = ordenados.findIndex((item) => item[0] === consultorSelecionado);

  if (index === -1)
    return `<span class="badge-pos-text">Sem vendas no período</span>`;

  const pos = index + 1;
  if (pos === 1) {
    return `<img src="icones/Ouro.svg" class="badge-svg-medal" alt="Ouro" /> <span class="badge-pos-text text-yellow">1º Lugar Geral</span>`;
  }
  if (pos === 2) {
    return `<img src="icones/Prata.svg" class="badge-svg-medal" alt="Prata" /> <span class="badge-pos-text text-purple">2º Lugar Geral</span>`;
  }
  if (pos === 3) {
    return `<img src="icones/Bronze.svg" class="badge-svg-medal" alt="Bronze" /> <span class="badge-pos-text text-orange">3º Lugar Geral</span>`;
  }
  return `<span class="badge-pos-text">${pos}º Lugar Geral</span>`;
}

function aplicarFiltros() {
  const mesFiltro = document.getElementById("filtroMesDesempenho").value;
  const consultorFiltro = document.getElementById(
    "filtroConsultorDesempenho",
  ).value;

  const nomeEl = document.getElementById("nomeConsultorDestaque");
  const badgePos = document.getElementById("badgePosicaoRanking");
  const avatarEl = document.getElementById("avatarConsultorDisplay");

  nomeEl.textContent =
    consultorFiltro === "TODOS"
      ? "Visão Geral da Equipe"
      : formatarNomeCurto(consultorFiltro);
  badgePos.innerHTML = renderizarBadgePosicao(consultorFiltro, mesFiltro);

  if (consultorFiltro !== "TODOS") {
    const iniciais = consultorFiltro
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("");
    avatarEl.innerHTML = `<span style="font-weight: 700; font-size: 1.4rem;">${iniciais}</span>`;
  } else {
    avatarEl.innerHTML = `<i class="fa-solid fa-users"></i>`;
  }

  vendasFiltradasAtuais = vendasCache.filter((v) => {
    const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
    const consultor = extrairConsultor(v);

    const matchMes =
      mesFiltro === "TODOS" || dataObj.getMonth().toString() === mesFiltro;
    const matchConsultor =
      consultorFiltro === "TODOS" || consultor === consultorFiltro;

    return matchMes && matchConsultor;
  });

  limiteExibicao = 10;
  atualizarMetricasEDashboards();
  renderizarTabela();
}

function atualizarMetricasEDashboards() {
  const consultorFiltro = document.getElementById(
    "filtroConsultorDesempenho",
  ).value;
  const mesFiltro = document.getElementById("filtroMesDesempenho").value;
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  let totalLancadas = vendasFiltradasAtuais.length;
  let efetivadas = 0;
  let recusadas = 0;
  let qtdFiliacao = 0;
  let qtdRefiliacao = 0;
  let valorTotalEfetivado = 0;

  const vendasPorDia = {};
  const pagamentosContagem = { Crédito: 0, Débito: 0, Pix: 0, Outros: 0 };

  vendasFiltradasAtuais.forEach((v) => {
    const status = extrairStatus(v);
    const valor = extrairValor(v);
    const tipo = (
      v.tipoVenda ||
      v["TIPO DE VENDA"] ||
      "FILIAÇÃO"
    ).toUpperCase();
    const pag = (
      v.formaPagamento ||
      v["FORMA DE PAGAMENTO"] ||
      ""
    ).toUpperCase();
    const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
    const diaChave = `${String(dataObj.getDate()).padStart(2, "0")}/${String(dataObj.getMonth() + 1).padStart(2, "0")}`;

    if (tipo.includes("REFIL")) qtdRefiliacao++;
    else qtdFiliacao++;

    if (pag.includes("CRÉD") || pag.includes("CRED"))
      pagamentosContagem["Crédito"]++;
    else if (pag.includes("DÉB") || pag.includes("DEB"))
      pagamentosContagem["Débito"]++;
    else if (pag.includes("PIX")) pagamentosContagem["Pix"]++;
    else pagamentosContagem["Outros"]++;

    const ehRecusado =
      status.includes("NÃO") ||
      status.includes("NAO") ||
      status.includes("RECUS") ||
      status.includes("CANCEL");

    if (ehRecusado) {
      recusadas++;
    } else if (status.includes("CONCLU") || status === "OK") {
      efetivadas++;
      valorTotalEfetivado += valor;
      vendasPorDia[diaChave] = (vendasPorDia[diaChave] || 0) + 1;
    }
  });

  const diasComVenda = Object.keys(vendasPorDia).length;
  const mediaDia =
    diasComVenda > 0 ? (efetivadas / diasComVenda).toFixed(1) : "0.0";
  const receitaMediaDia =
    diasComVenda > 0 ? valorTotalEfetivado / diasComVenda : 0;

  let melhorDia = "--/--";
  let melhorQtd = 0;
  for (const [dia, qtd] of Object.entries(vendasPorDia)) {
    if (qtd > melhorQtd) {
      melhorQtd = qtd;
      melhorDia = dia;
    }
  }

  // =========================================================
  // PRESENÇA NO PÓDIO RESTRITA AO MÊS FILTRADO
  // =========================================================
  let diasNoPodio = 0;
  if (consultorFiltro !== "TODOS") {
    const vendasPorDiaNoCiclo = {};

    vendasCache.forEach((v) => {
      const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);

      // Filtra estritamente pelo mês selecionado
      if (mesFiltro !== "TODOS" && dataObj.getMonth().toString() !== mesFiltro)
        return;

      const status = extrairStatus(v);
      const ehRecusado =
        status.includes("NÃO") ||
        status.includes("NAO") ||
        status.includes("RECUS") ||
        status.includes("CANCEL");

      if ((status.includes("CONCLU") || status === "OK") && !ehRecusado) {
        const diaChave = `${String(dataObj.getDate()).padStart(2, "0")}/${String(dataObj.getMonth() + 1).padStart(2, "0")}/${dataObj.getFullYear()}`;
        const c = extrairConsultor(v);

        if (!vendasPorDiaNoCiclo[diaChave]) vendasPorDiaNoCiclo[diaChave] = {};
        vendasPorDiaNoCiclo[diaChave][c] =
          (vendasPorDiaNoCiclo[diaChave][c] || 0) + 1;
      }
    });

    for (const dia in vendasPorDiaNoCiclo) {
      const rankingDia = Object.entries(vendasPorDiaNoCiclo[dia]).sort(
        (a, b) => b[1] - a[1],
      );
      const top3 = rankingDia.slice(0, 3).map((item) => item[0]);
      if (top3.includes(consultorFiltro)) {
        diasNoPodio++;
      }
    }
  }

  const taxaConversao =
    totalLancadas > 0 ? Math.round((efetivadas / totalLancadas) * 100) : 0;

  document.getElementById("cardTotalLancadas").textContent = totalLancadas;
  document.getElementById("statTotalValor").textContent =
    `R$ ${valorTotalEfetivado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  document.getElementById("statMediaDia").textContent = mediaDia;
  document.getElementById("statMelhorFechamento").textContent = melhorDia;
  document.getElementById("statMelhorQtd").textContent = `${melhorQtd} vendas`;
  document.getElementById("cardTotalRecusadas").textContent = recusadas;

  document.getElementById("cardQtdCredito").textContent =
    pagamentosContagem["Crédito"];
  document.getElementById("cardQtdDebito").textContent =
    pagamentosContagem["Débito"];
  document.getElementById("cardQtdPix").textContent = pagamentosContagem["Pix"];
  document.getElementById("cardQtdOutros").textContent =
    pagamentosContagem["Outros"];

  document.getElementById("cardQtdFiliacao").textContent = qtdFiliacao;
  document.getElementById("cardQtdRefiliacao").textContent = qtdRefiliacao;

  // Atualização correta da frequência no ciclo
  document.getElementById("statPodioDias").textContent =
    consultorFiltro === "TODOS"
      ? `${diasComVenda} dias`
      : `${diasNoPodio} dias`;
  document.getElementById("statDiasAtivos").textContent =
    `${diasComVenda} dias`;
  document.getElementById("statTaxaEfetiva").textContent = `${taxaConversao}%`;
  document.getElementById("statReceitaMediaDia").textContent =
    `R$ ${receitaMediaDia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  document.getElementById("txtQtdTotalBtn").textContent = totalLancadas;

  atualizarTermometrosDesempenho(
    valorTotalEfetivado,
    efetivadas,
    mesFiltro,
    consultorFiltro,
    meses,
  );
  renderizarGraficos(vendasPorDia, pagamentosContagem);
}

function atualizarTermometrosDesempenho(
  valorAtual,
  qtdAtual,
  mesFiltro,
  consultorFiltro,
  meses,
) {
  const agora = new Date();
  const ano = agora.getFullYear().toString();
  const mesIndex =
    mesFiltro === "TODOS" ? agora.getMonth().toString() : mesFiltro;
  const nomeMes = meses[mesIndex];

  document.getElementById("txtMesMetaDesempenhoFat").textContent = nomeMes;
  document.getElementById("txtMesMetaDesempenhoQtd").textContent = nomeMes;

  const alvoKey = consultorFiltro === "TODOS" ? "GERAL" : consultorFiltro;
  const chaveMeta = `${ano}_${mesIndex}_${alvoKey}`;
  const metaObj = metasCache[chaveMeta] || {
    metaFaturamento: consultorFiltro === "TODOS" ? 70000 : 7000,
    metaQtd: consultorFiltro === "TODOS" ? 1000 : 100,
  };

  const metaFat = metaObj.metaFaturamento || 7000;
  const metaQtd = metaObj.metaQtd || 100;

  const pctFat = Math.min(100, Math.round((valorAtual / metaFat) * 100));
  document.getElementById("barraProgressoMetaDesempenho").style.width =
    `${pctFat}%`;
  document.getElementById("txtValorAtualMetaDesempenho").textContent =
    `R$ ${valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  document.getElementById("txtValorObjetivoMetaDesempenho").textContent =
    `R$ ${metaFat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  document.getElementById("txtPercentualMetaDesempenho").textContent =
    `${pctFat}% Concluído`;

  const restFat = metaFat - valorAtual;
  document.getElementById("txtSubMetaDesempenhoFat").textContent =
    restFat > 0
      ? `Faltam R$ ${restFat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para bater a meta`
      : "🚀 META BATIDA!";

  const pctQtd = Math.min(100, Math.round((qtdAtual / metaQtd) * 100));
  document.getElementById("barraProgressoMetaDesempenhoQtd").style.width =
    `${pctQtd}%`;
  document.getElementById("txtQtdAtualMetaDesempenho").textContent =
    `${qtdAtual} vendas`;
  document.getElementById("txtQtdObjetivoMetaDesempenho").textContent =
    `${metaQtd} vendas`;
  document.getElementById("txtPercentualMetaDesempenhoQtd").textContent =
    `${pctQtd}% Concluído`;

  const restQtd = metaQtd - qtdAtual;
  document.getElementById("txtSubMetaDesempenhoQtd").textContent =
    restQtd > 0
      ? `Faltam ${restQtd} contratos para a meta`
      : "🎯 META DE VOLUME BATIDA!";
}

function renderizarGraficos(vendasPorDia, pagamentos) {
  const diasOrdenados = Object.keys(vendasPorDia).sort((a, b) => {
    const [d1, m1] = a.split("/").map(Number);
    const [d2, m2] = b.split("/").map(Number);
    return m1 !== m2 ? m1 - m2 : d1 - d2;
  });

  const valoresDias = diasOrdenados.map((d) => vendasPorDia[d]);

  const ctxDiario = document
    .getElementById("graficoVendasDiarias")
    .getContext("2d");
  if (chartDiarioInstancia) chartDiarioInstancia.destroy();

  chartDiarioInstancia = new Chart(ctxDiario, {
    type: "bar",
    data: {
      labels: diasOrdenados.length > 0 ? diasOrdenados : ["Sem dados"],
      datasets: [
        {
          label: "Vendas Efetivadas",
          data: valoresDias.length > 0 ? valoresDias : [0],
          backgroundColor: "#bd93f9",
          borderRadius: 4,
          hoverBackgroundColor: "#a371f7",
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

  const ctxPag = document.getElementById("graficoPagamentos").getContext("2d");
  if (chartPagamentosInstancia) chartPagamentosInstancia.destroy();

  chartPagamentosInstancia = new Chart(ctxPag, {
    type: "doughnut",
    data: {
      labels: Object.keys(pagamentos),
      datasets: [
        {
          data: Object.values(pagamentos),
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

function filtrarHistoricoTexto() {
  const busca = document
    .getElementById("buscaHistoricoInput")
    .value.toLowerCase()
    .trim();
  renderizarTabela(busca);
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

function obterClasseStatus(status) {
  const st = String(status || "").toUpperCase();
  if (
    st.includes("NÃO") ||
    st.includes("NAO") ||
    st.includes("RECUS") ||
    st.includes("CANCEL")
  ) {
    return "pill-status-recusado";
  }
  if (st.includes("CONCLU") || st === "OK") {
    return "pill-status-concluido";
  }
  return "pill-status-pendente";
}

function renderizarTabela(filtroTexto = "") {
  const tbody = document.getElementById("corpoTabelaDesempenho");
  const txtContagem = document.getElementById("txtContagemExibicao");
  const btnMais = document.getElementById("btnMostrarMais10");
  const btnTodos = document.getElementById("btnMostrarTodos");
  const btnRecolher = document.getElementById("btnRecolher10");

  if (!tbody) return;

  let listaParaExibir = vendasFiltradasAtuais;
  if (filtroTexto) {
    listaParaExibir = listaParaExibir.filter((v) => {
      const cliente = (v.cliente || v.CLIENTE || "").toLowerCase();
      const matricula = (
        v.matricula ||
        v.MATRÍCULA ||
        v.MATRICULA ||
        ""
      ).toLowerCase();
      return cliente.includes(filtroTexto) || matricula.includes(filtroTexto);
    });
  }

  const total = listaParaExibir.length;
  const listaFatiada = listaParaExibir.slice(0, limiteExibicao);

  txtContagem.textContent = `Exibindo ${listaFatiada.length} de ${total} contratos`;

  btnMais.style.display = limiteExibicao < total ? "inline-flex" : "none";
  btnTodos.style.display = limiteExibicao < total ? "inline-flex" : "none";
  btnRecolher.style.display = limiteExibicao > 10 ? "inline-flex" : "none";

  if (listaFatiada.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhuma venda encontrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = listaFatiada
    .map((v) => {
      const status = extrairStatus(v);
      const valor = extrairValor(v);
      const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
      const matricula = v.matricula || v.MATRÍCULA || v.MATRICULA || "S/N";
      const clienteCompleto = v.cliente || v.CLIENTE || "NÃO INFORMADO";
      const consultorCompleto = extrairConsultor(v);

      const clienteExibicao = formatarNomeCurto(clienteCompleto);
      const consultorExibicao = formatarNomeCurto(consultorCompleto);

      const tipo = v.tipoVenda || v["TIPO DE VENDA"] || "FILIAÇÃO";
      const pagamento =
        v.formaPagamento || v["FORMA DE PAGAMENTO"] || "NÃO INFORMADO";

      return `
      <tr>
        <td><span class="pill pill-matricula">${matricula}</span></td>
        <td><span class="pill pill-cliente" title="${clienteCompleto}">${clienteExibicao}</span></td>
        <td><span class="pill pill-data">${dataObj.toLocaleDateString("pt-BR")}</span></td>
        <td><span class="pill pill-consultor" title="${consultorCompleto}">${consultorExibicao}</span></td>
        <td><span class="pill ${obterClasseTipo(tipo)}">${tipo}</span></td>
        <td><span class="pill ${obterClassePagamento(pagamento)}">${pagamento}</span></td>
        <td><span class="pill ${obterClasseStatus(status)}">${status}</span></td>
        <td><span class="pill pill-valor">R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></td>
      </tr>
    `;
    })
    .join("");
}
