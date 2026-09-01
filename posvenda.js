const db = firebase.firestore();
let vendasPosCache = [];
let vendasFiltradasAtuais = [];
let limiteExibicao = 10;

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
  iniciarOuvintePosVenda();
  document
    .getElementById("filtroBusca")
    .addEventListener("input", filtrarTratativas);
  document
    .getElementById("filtroConsultorPos")
    .addEventListener("change", filtrarTratativas);
  document
    .getElementById("filtroStatus")
    .addEventListener("change", filtrarTratativas);
  document
    .getElementById("btnExportarPlanilha")
    .addEventListener("click", exportarPlanilhaPos);

  document.getElementById("btnMostrarMais10").addEventListener("click", () => {
    limiteExibicao += 10;
    renderizarTabelaPos();
  });

  document.getElementById("btnMostrarTodos").addEventListener("click", () => {
    limiteExibicao = vendasFiltradasAtuais.length;
    renderizarTabelaPos();
  });

  document.getElementById("btnRecolher10").addEventListener("click", () => {
    limiteExibicao = 10;
    renderizarTabelaPos();
  });
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
  return "PENDENTE";
}

function iniciarOuvintePosVenda() {
  db.collection("vendas").onSnapshot(
    (snapshot) => {
      vendasPosCache = [];
      const consultoresSet = new Set();

      snapshot.forEach((doc) => {
        const v = { id: doc.id, ...doc.data() };
        vendasPosCache.push(v);
        consultoresSet.add(extrairConsultor(v));
      });

      vendasPosCache.sort((a, b) => {
        const dataA = parseDataFlexivel(
          a.dataVenda || a.DATA_VENDA || a.data,
        ).getTime();
        const dataB = parseDataFlexivel(
          b.dataVenda || b.DATA_VENDA || b.data,
        ).getTime();
        return dataB - dataA;
      });

      preencherSelectConsultores(Array.from(consultoresSet).sort());
      atualizarMetricasOperacionais();
      filtrarTratativas();
    },
    (err) => {
      console.error("Erro ao ler pós-venda:", err);
    },
  );
}

function preencherSelectConsultores(consultores) {
  const select = document.getElementById("filtroConsultorPos");
  const valorAtual = select.value;

  select.innerHTML = '<option value="TODOS">Todos os Consultores</option>';
  consultores.forEach((c) => {
    select.innerHTML += `<option value="${c}">${formatarNomeCurto(c)}</option>`;
  });

  if (consultores.includes(valorAtual)) {
    select.value = valorAtual;
  }
}

function atualizarMetricasOperacionais() {
  let pendentes = 0;
  let concluidas = 0;
  let recusadas = 0;

  vendasPosCache.forEach((v) => {
    const st = extrairStatus(v);
    const ehRecusado =
      st.includes("NÃO") ||
      st.includes("NAO") ||
      st.includes("RECUS") ||
      st.includes("CANCEL");

    if (ehRecusado) {
      recusadas++;
    } else if (st.includes("CONCLU") || st === "OK") {
      concluidas++;
    } else {
      pendentes++;
    }
  });

  const total = concluidas + recusadas + pendentes;
  const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  document.getElementById("statPendentes").textContent = pendentes;
  document.getElementById("statConcluidas").textContent = concluidas;
  document.getElementById("statRecusadas").textContent = recusadas;
  document.getElementById("statConversao").textContent = `${taxa}%`;
}

function filtrarTratativas() {
  const termo = document
    .getElementById("filtroBusca")
    .value.toLowerCase()
    .trim();
  const filtroConsultor = document.getElementById("filtroConsultorPos").value;
  const filtroStatus = document.getElementById("filtroStatus").value;

  vendasFiltradasAtuais = vendasPosCache.filter((v) => {
    const cliente = (v.cliente || v.CLIENTE || "").toLowerCase();
    const matricula = (
      v.matricula ||
      v.MATRÍCULA ||
      v.MATRICULA ||
      ""
    ).toLowerCase();
    const consultor = extrairConsultor(v);
    const st = extrairStatus(v);

    const matchTexto =
      cliente.includes(termo) ||
      matricula.includes(termo) ||
      consultor.toLowerCase().includes(termo);
    const matchConsultor =
      filtroConsultor === "TODOS" || consultor === filtroConsultor;

    const ehRecusado =
      st.includes("NÃO") ||
      st.includes("NAO") ||
      st.includes("RECUS") ||
      st.includes("CANCEL");
    const ehConcluido = (st.includes("CONCLU") || st === "OK") && !ehRecusado;

    let matchStatus = true;
    if (filtroStatus === "PENDENTE") {
      matchStatus = !ehConcluido && !ehRecusado;
    } else if (filtroStatus === "CONCLUÍDO") {
      matchStatus = ehConcluido;
    } else if (filtroStatus === "NÃO CONCLUÍDO") {
      matchStatus = ehRecusado;
    }

    return matchTexto && matchConsultor && matchStatus;
  });

  limiteExibicao = 10;
  renderizarTabelaPos();
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

function renderizarTabelaPos() {
  const tbody = document.getElementById("corpoPosVenda");
  const txtContagem = document.getElementById("txtContagemPos");
  const btnMais = document.getElementById("btnMostrarMais10");
  const btnTodos = document.getElementById("btnMostrarTodos");
  const btnRecolher = document.getElementById("btnRecolher10");
  const txtQtdTotalBtn = document.getElementById("txtQtdTotalBtn");

  if (!tbody) return;

  const total = vendasFiltradasAtuais.length;
  const listaFatiada = vendasFiltradasAtuais.slice(0, limiteExibicao);

  txtContagem.textContent = `Exibindo ${listaFatiada.length} de ${total} contratos`;
  txtQtdTotalBtn.textContent = total;

  btnMais.style.display = limiteExibicao < total ? "inline-flex" : "none";
  btnTodos.style.display = limiteExibicao < total ? "inline-flex" : "none";
  btnRecolher.style.display = limiteExibicao > 10 ? "inline-flex" : "none";

  if (listaFatiada.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--text-muted); padding: 28px;">Nenhuma tratativa encontrada com os filtros atuais.</td></tr>`;
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
      const status = extrairStatus(v);
      const obs = v.observacao || "";

      const etapas = v.etapasPosVenda || {
        ligacao: false,
        linkEnviado: false,
        docsRecebidos: false,
      };

      return `
      <tr>
        <td><span class="pill pill-matricula">${matricula}</span></td>
        <td><span class="pill pill-cliente" title="${clienteCompleto}">${clienteExibicao}</span></td>
        <td><span class="pill pill-data">${dataObj.toLocaleDateString("pt-BR")}</span></td>
        <td><span class="pill pill-consultor" title="${consultorCompleto}">${consultorExibicao}</span></td>
        <td><span class="pill ${obterClasseTipo(tipo)}">${tipo}</span></td>
        <td><span class="pill ${obterClassePagamento(pagamento)}">${pagamento}</span></td>
        <td class="text-center">
          <input type="checkbox" class="checkbox-step" ${etapas.ligacao ? "checked" : ""} onchange="alterarEtapa('${v.id}', 'ligacao', this.checked)" />
        </td>
        <td class="text-center">
          <input type="checkbox" class="checkbox-step" ${etapas.linkEnviado ? "checked" : ""} onchange="alterarEtapa('${v.id}', 'linkEnviado', this.checked)" />
        </td>
        <td class="text-center">
          <input type="checkbox" class="checkbox-step" ${etapas.docsRecebidos ? "checked" : ""} onchange="alterarEtapa('${v.id}', 'docsRecebidos', this.checked)" />
        </td>
        <td><span class="pill ${obterClasseStatus(status)}">${status}</span></td>
        <td>
          <input type="text" class="input-obs" value="${obs}" placeholder="Ex: ligar 15h..." onblur="salvarObs('${v.id}', this.value)" />
        </td>
        <td class="text-center">
          <button class="btn btn-danger-sm" title="Marcar como Não Concluído / Recusado" onclick="marcarNaoConcluido('${v.id}')">
            <i class="fa-solid fa-ban"></i>
          </button>
        </td>
      </tr>
    `;
    })
    .join("");
}

window.alterarEtapa = async function (id, etapa, valor) {
  const docRef = db.collection("vendas").doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return;

  const dados = doc.data();
  const etapas = dados.etapasPosVenda || {
    ligacao: false,
    linkEnviado: false,
    docsRecebidos: false,
  };
  etapas[etapa] = valor;

  const todasConcluidas =
    etapas.ligacao && etapas.linkEnviado && etapas.docsRecebidos;
  const novoStatus = todasConcluidas ? "CONCLUÍDO" : "PENDENTE";

  await docRef.update({
    etapasPosVenda: etapas,
    status: novoStatus,
    STATUS_VENDA: novoStatus,
  });
};

window.salvarObs = async function (id, valor) {
  await db.collection("vendas").doc(id).update({ observacao: valor });
};

window.marcarNaoConcluido = async function (id) {
  if (confirm("Deseja marcar este contrato como NÃO CONCLUÍDO / RECUSADO?")) {
    await db.collection("vendas").doc(id).update({
      status: "NÃO CONCLUÍDO",
      STATUS_VENDA: "NÃO CONCLUÍDO",
    });
  }
};

function exportarPlanilhaPos() {
  if (vendasPosCache.length === 0) {
    alert("Nenhum dado para exportar.");
    return;
  }

  const linhas = vendasPosCache.map((v) => {
    const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
    return {
      MATRÍCULA: v.matricula || v.MATRÍCULA || v.MATRICULA || "S/N",
      CLIENTE: v.cliente || v.CLIENTE || "NÃO INFORMADO",
      "DATA VENDA": dataObj.toLocaleDateString("pt-BR"),
      "NOME CONSULTOR": extrairConsultor(v),
      "TIPO DE VENDA": v.tipoVenda || v["TIPO DE VENDA"] || "FILIAÇÃO",
      "FORMA DE PAGAMENTO":
        v.formaPagamento || v["FORMA DE PAGAMENTO"] || "NÃO INFORMADO",
      "STATUS VENDA": extrairStatus(v),
      "OBSERVAÇÃO PÓS": v.observacao || "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PosVenda");
  XLSX.writeFile(
    wb,
    `PosVenda_Export_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
