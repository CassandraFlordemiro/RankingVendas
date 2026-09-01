const db = firebase.firestore();
let vendasCache = [];
let consultoresDisponiveis = [];
let consultoresSelecionados = new Set();
let metasCache = {};

let chartBarrasInstancia = null;
let chartDireitaInstancia = null;

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
    .getElementById("filtroMesComparativo")
    .addEventListener("change", processarComparativo);
  document
    .getElementById("btnCompararTop3")
    .addEventListener("click", selecionarTop3);
  document
    .getElementById("btnCompararTodos")
    .addEventListener("click", selecionarTodos);
  document
    .getElementById("btnLimparSelecao")
    .addEventListener("click", limparSelecao);

  iniciarOuvinteMetas();
  iniciarOuvinteComparativo();
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
    processarComparativo();
  });
}

function iniciarOuvinteComparativo() {
  db.collection("vendas").onSnapshot(
    (snapshot) => {
      vendasCache = [];
      const consultoresSet = new Set();

      snapshot.forEach((doc) => {
        const v = { id: doc.id, ...doc.data() };
        vendasCache.push(v);
        consultoresSet.add(extrairConsultor(v));
      });

      consultoresDisponiveis = Array.from(consultoresSet).sort();

      if (consultoresSelecionados.size === 0) {
        consultoresDisponiveis.forEach((c) => consultoresSelecionados.add(c));
      }

      renderizarCardsSelecao();
      processarComparativo();
    },
    (err) => {
      console.error("Erro ao ler vendas para comparativo:", err);
    },
  );
}

function renderizarCardsSelecao() {
  const container = document.getElementById("cardsConsultoresComparativo");
  if (!container) return;

  container.innerHTML = consultoresDisponiveis
    .map((c) => {
      const isChecked = consultoresSelecionados.has(c);
      const nomeCurto = formatarNomeCurto(c);
      const iniciais = nomeCurto
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("");

      return `
      <div class="consultant-card-select ${isChecked ? "selected" : ""}" onclick="toggleConsultor('${c}')" title="${c}">
        <div class="card-select-avatar-wrap">
          <div class="card-select-avatar">${iniciais}</div>
          <div class="card-select-check"><i class="fa-solid fa-check"></i></div>
        </div>
        <span class="card-select-name">${nomeCurto}</span>
      </div>
    `;
    })
    .join("");
}

window.toggleConsultor = function (consultor) {
  if (consultoresSelecionados.has(consultor)) {
    consultoresSelecionados.delete(consultor);
  } else {
    consultoresSelecionados.add(consultor);
  }
  renderizarCardsSelecao();
  processarComparativo();
};

function selecionarTop3() {
  const mesFiltro = document.getElementById("filtroMesComparativo").value;
  const contagem = {};

  vendasCache.forEach((v) => {
    const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
    if (mesFiltro !== "TODOS" && dataObj.getMonth().toString() !== mesFiltro)
      return;

    const st = extrairStatus(v);
    const ehRecusado =
      st.includes("NÃO") ||
      st.includes("NAO") ||
      st.includes("RECUS") ||
      st.includes("CANCEL");
    if ((st.includes("CONCLU") || st === "OK") && !ehRecusado) {
      const c = extrairConsultor(v);
      contagem[c] = (contagem[c] || 0) + 1;
    }
  });

  const top3 = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((i) => i[0]);
  consultoresSelecionados = new Set(top3);
  renderizarCardsSelecao();
  processarComparativo();
}

function selecionarTodos() {
  consultoresSelecionados = new Set(consultoresDisponiveis);
  renderizarCardsSelecao();
  processarComparativo();
}

function limparSelecao() {
  consultoresSelecionados.clear();
  renderizarCardsSelecao();
  processarComparativo();
}

function processarComparativo() {
  const mesFiltro = document.getElementById("filtroMesComparativo").value;
  const mapa = {};

  consultoresSelecionados.forEach((c) => {
    mapa[c] = {
      consultor: c,
      lancadas: 0,
      efetivadas: 0,
      pendentes: 0,
      recusadas: 0,
      totalValor: 0,
      diasAtivos: new Set(),
      pagamentos: { credito: 0, debito: 0, pix: 0, outros: 0 },
    };
  });

  vendasCache.forEach((v) => {
    const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
    if (mesFiltro !== "TODOS" && dataObj.getMonth().toString() !== mesFiltro)
      return;

    const c = extrairConsultor(v);
    if (!consultoresSelecionados.has(c)) return;

    const st = extrairStatus(v);
    const valor = extrairValor(v);
    const pag = (
      v.formaPagamento ||
      v["FORMA DE PAGAMENTO"] ||
      ""
    ).toUpperCase();
    const diaChave = `${dataObj.getDate()}/${dataObj.getMonth()}`;

    mapa[c].lancadas += 1;

    const ehRecusado =
      st.includes("NÃO") ||
      st.includes("NAO") ||
      st.includes("RECUS") ||
      st.includes("CANCEL");

    if (ehRecusado) {
      mapa[c].recusadas += 1;
    } else if (st.includes("CONCLU") || st === "OK") {
      mapa[c].efetivadas += 1;
      mapa[c].totalValor += valor;
      mapa[c].diasAtivos.add(diaChave);

      if (pag.includes("CRÉD") || pag.includes("CRED"))
        mapa[c].pagamentos.credito++;
      else if (pag.includes("DÉB") || pag.includes("DEB"))
        mapa[c].pagamentos.debito++;
      else if (pag.includes("PIX")) mapa[c].pagamentos.pix++;
      else mapa[c].pagamentos.outros++;
    } else {
      mapa[c].pendentes += 1;
    }
  });

  const arrayComparativo = Object.values(mapa).sort(
    (a, b) => b.efetivadas - a.efetivadas || b.lancadas - a.lancadas,
  );

  atualizarTopCards(arrayComparativo);
  atualizarMetasComparativo(arrayComparativo, mesFiltro);
  renderizarGraficos(arrayComparativo);
  montarTabela(arrayComparativo);
}

function atualizarTopCards(dados) {
  if (dados.length === 0) {
    document.getElementById("cardLiderVendas").textContent = "--";
    document.getElementById("cardLiderVendasQtd").textContent = "0 vendas";
    document.getElementById("cardLiderConversao").textContent = "--";
    document.getElementById("cardLiderConversaoTaxa").textContent = "0%";
    document.getElementById("cardTotalGrupoEfetivadas").textContent = "0";
    document.getElementById("cardTotalGrupoLancadas").textContent =
      "de 0 lançadas";
    document.getElementById("cardReceitaGrupo").textContent = "R$ 0,00";
    return;
  }

  const liderVendas = dados[0];
  document.getElementById("cardLiderVendas").textContent = formatarNomeCurto(
    liderVendas.consultor,
  );
  document.getElementById("cardLiderVendasQtd").textContent =
    `${liderVendas.efetivadas} vendas efetivadas`;

  const ordenadosPorConversao = [...dados]
    .filter((d) => d.lancadas > 0)
    .sort((a, b) => b.efetivadas / b.lancadas - a.efetivadas / a.lancadas);
  if (ordenadosPorConversao.length > 0) {
    const liderConv = ordenadosPorConversao[0];
    const taxaConv = Math.round(
      (liderConv.efetivadas / liderConv.lancadas) * 100,
    );
    document.getElementById("cardLiderConversao").textContent =
      formatarNomeCurto(liderConv.consultor);
    document.getElementById("cardLiderConversaoTaxa").textContent =
      `${taxaConv}% de efetivação`;
  }

  let grupoLancadas = 0;
  let grupoEfetivadas = 0;
  let grupoReceita = 0;

  dados.forEach((d) => {
    grupoLancadas += d.lancadas;
    grupoEfetivadas += d.efetivadas;
    grupoReceita += d.totalValor;
  });

  document.getElementById("cardTotalGrupoEfetivadas").textContent =
    grupoEfetivadas;
  document.getElementById("cardTotalGrupoLancadas").textContent =
    `de ${grupoLancadas} lançadas`;
  document.getElementById("cardReceitaGrupo").textContent =
    `R$ ${grupoReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function atualizarMetasComparativo(dados, mesFiltro) {
  const agora = new Date();
  const ano = agora.getFullYear().toString();
  const mesIndex =
    mesFiltro === "TODOS" ? agora.getMonth().toString() : mesFiltro;

  let totalMetaFat = 0;
  let totalMetaQtd = 0;
  let atualFat = 0;
  let atualQtd = 0;

  dados.forEach((d) => {
    atualFat += d.totalValor;
    atualQtd += d.efetivadas;

    const chave = `${ano}_${mesIndex}_${d.consultor}`;
    const metaObj = metasCache[chave] || {
      metaFaturamento: 7000,
      metaQtd: 100,
    };

    totalMetaFat += metaObj.metaFaturamento || 7000;
    totalMetaQtd += metaObj.metaQtd || 100;
  });

  if (totalMetaFat === 0) totalMetaFat = 70000;
  if (totalMetaQtd === 0) totalMetaQtd = 1000;

  const pctFat = Math.min(100, Math.round((atualFat / totalMetaFat) * 100));
  document.getElementById("barraProgressoMetaComparativo").style.width =
    `${pctFat}%`;
  document.getElementById("txtValorAtualMetaComparativo").textContent =
    `R$ ${atualFat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  document.getElementById("txtValorObjetivoMetaComparativo").textContent =
    `R$ ${totalMetaFat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  document.getElementById("txtPercentualMetaComparativo").textContent =
    `${pctFat}% Concluído`;

  const restFat = totalMetaFat - atualFat;
  document.getElementById("txtSubMetaComparativoFat").textContent =
    restFat > 0
      ? `Faltam R$ ${restFat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para a meta combinada`
      : "🚀 META DO GRUPO BATIDA!";

  const pctQtd = Math.min(100, Math.round((atualQtd / totalMetaQtd) * 100));
  document.getElementById("barraProgressoMetaComparativoQtd").style.width =
    `${pctQtd}%`;
  document.getElementById("txtQtdAtualMetaComparativo").textContent =
    `${atualQtd} vendas`;
  document.getElementById("txtQtdObjetivoMetaComparativo").textContent =
    `${totalMetaQtd} vendas`;
  document.getElementById("txtPercentualMetaComparativoQtd").textContent =
    `${pctQtd}% Concluído`;

  const restQtd = totalMetaQtd - atualQtd;
  document.getElementById("txtSubMetaComparativoQtd").textContent =
    restQtd > 0
      ? `Faltam ${restQtd} contratos combinados`
      : "🎯 META DE CONTRATOS BATIDA!";
}

function renderizarGraficos(dados) {
  const nomesLabels = dados.map((d) => formatarNomeCurto(d.consultor));

  const ctxBarras = document
    .getElementById("graficoBarrasComparativo")
    .getContext("2d");
  if (chartBarrasInstancia) chartBarrasInstancia.destroy();

  chartBarrasInstancia = new Chart(ctxBarras, {
    type: "bar",
    data: {
      labels: nomesLabels.length > 0 ? nomesLabels : ["Sem seleção"],
      datasets: [
        {
          label: "Efetivadas",
          data: dados.map((d) => d.efetivadas),
          backgroundColor: "#50fa7b",
          borderRadius: 4,
        },
        {
          label: "Lançadas",
          data: dados.map((d) => d.lancadas),
          backgroundColor: "#bd93f9",
          borderRadius: 4,
        },
        {
          label: "Recusadas",
          data: dados.map((d) => d.recusadas),
          backgroundColor: "#ff5555",
          borderRadius: 4,
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

  const ctxDireita = document
    .getElementById("graficoRadarComparativo")
    .getContext("2d");
  const tituloDireita = document
    .querySelector("#graficoRadarComparativo")
    .closest(".chart-panel")
    .querySelector("h4");
  if (chartDireitaInstancia) chartDireitaInstancia.destroy();

  if (dados.length === 2) {
    if (tituloDireita)
      tituloDireita.innerHTML =
        '<i class="fa-solid fa-bolt text-yellow"></i> Duelo Direto Mano a Mano';

    const c1 = dados[0];
    const c2 = dados[1];
    const taxa1 =
      c1.lancadas > 0 ? Math.round((c1.efetivadas / c1.lancadas) * 100) : 0;
    const taxa2 =
      c2.lancadas > 0 ? Math.round((c2.efetivadas / c2.lancadas) * 100) : 0;

    chartDireitaInstancia = new Chart(ctxDireita, {
      type: "bar",
      data: {
        labels: [
          "Vendas Efetivadas",
          "Taxa Conversão (%)",
          "Dias Ativos",
          "Vendas Cartão (Créd+Déb)",
        ],
        datasets: [
          {
            label: formatarNomeCurto(c1.consultor),
            data: [
              c1.efetivadas,
              taxa1,
              c1.diasAtivos.size,
              c1.pagamentos.credito + c1.pagamentos.debito,
            ],
            backgroundColor: "#50fa7b",
            borderRadius: 4,
          },
          {
            label: formatarNomeCurto(c2.consultor),
            data: [
              c2.efetivadas,
              taxa2,
              c2.diasAtivos.size,
              c2.pagamentos.credito + c2.pagamentos.debito,
            ],
            backgroundColor: "#bd93f9",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#f8f8f2", font: { size: 10 } },
          },
        },
        scales: {
          x: {
            ticks: { color: "#6272a4" },
            grid: { color: "rgba(255,255,255,0.05)" },
          },
          y: {
            ticks: { color: "#8be9fd", font: { size: 10, weight: "600" } },
            grid: { display: false },
          },
        },
      },
    });
  } else {
    if (tituloDireita)
      tituloDireita.innerHTML =
        '<i class="fa-solid fa-chart-pie text-green"></i> Eficiência e Conversão (%) da Equipe';

    const taxas = dados.map((d) =>
      d.lancadas > 0 ? Math.round((d.efetivadas / d.lancadas) * 100) : 0,
    );

    chartDireitaInstancia = new Chart(ctxDireita, {
      type: "bar",
      data: {
        labels: nomesLabels.length > 0 ? nomesLabels : ["Sem dados"],
        datasets: [
          {
            label: "Taxa de Conversão (%)",
            data: taxas.length > 0 ? taxas : [0],
            backgroundColor: "#8be9fd",
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
            ticks: { color: "#6272a4", callback: (v) => v + "%" },
            grid: { color: "rgba(255,255,255,0.05)" },
            max: 100,
          },
        },
      },
    });
  }
}

// Renderiza as medalhas SVG nos 3 primeiros colocados da tabela de confronto
function obterIconePodio(pos) {
  if (pos === 1) {
    return `<div class="medal-wrapper medal-gold" title="1º Lugar"><img src="icones/Ouro.svg" alt="1º Lugar" class="medal-svg" onerror="this.onerror=null; this.parentElement.innerHTML='🥇 1º';" /></div>`;
  }
  if (pos === 2) {
    return `<div class="medal-wrapper medal-silver" title="2º Lugar"><img src="icones/Prata.svg" alt="2º Lugar" class="medal-svg" onerror="this.onerror=null; this.parentElement.innerHTML='🥈 2º';" /></div>`;
  }
  if (pos === 3) {
    return `<div class="medal-wrapper medal-bronze" title="3º Lugar"><img src="icones/Bronze.svg" alt="3º Lugar" class="medal-svg" onerror="this.onerror=null; this.parentElement.innerHTML='🥉 3º';" /></div>`;
  }
  return `<span class="pill pill-data pill-pos-num">${pos}º</span>`;
}

function montarTabela(dados) {
  const tbody = document.getElementById("corpoComparativo");
  const txtContagem = document.getElementById("txtContagemComparativo");
  if (!tbody) return;

  txtContagem.textContent = `Exibindo ${dados.length} consultores em disputa`;

  if (dados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 28px;">Nenhum consultor selecionado para confronto.</td></tr>`;
    return;
  }

  tbody.innerHTML = dados
    .map((item, idx) => {
      const taxa =
        item.lancadas > 0
          ? Math.round((item.efetivadas / item.lancadas) * 100)
          : 0;
      const nomeCurto = formatarNomeCurto(item.consultor);
      const posicao = idx + 1;

      return `
      <tr class="ranking-row ${posicao === 1 ? "row-leader" : ""}">
        <td class="text-center">${obterIconePodio(posicao)}</td>
        <td><span class="pill pill-consultor" title="${item.consultor}">${nomeCurto}</span></td>
        <td class="text-center"><span class="pill pill-matricula">${item.lancadas}</span></td>
        <td class="text-center"><span class="pill pill-status-concluido">${item.efetivadas}</span></td>
        <td class="text-center"><span class="pill pill-status-pendente">${item.pendentes}</span></td>
        <td class="text-center"><span class="pill pill-status-recusado">${item.recusadas}</span></td>
        <td class="text-center"><span class="pill pill-tipo-filiacao">${taxa}%</span></td>
        <td class="text-right"><span class="pill pill-valor">R$ ${item.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></td>
      </tr>
    `;
    })
    .join("");
}
