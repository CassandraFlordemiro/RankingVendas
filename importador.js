const db = firebase.firestore();
let dadosBrutosProcessados = [];
let mapaConsultores = {};

const DICIONARIO_NOMES = {
  "ALEXANDRA GUERREIRO DA SILVA SPLITTER": "ALEXANDRA GUERREIRO",
  "ALEXANDRA GUERREIRO": "ALEXANDRA GUERREIRO",
  "SIMONE KNUPP ORTEGA": "SIMONE KNUPP",
  "SIMONE KNUPP": "SIMONE KNUPP",
  "CLAUDIO LUIZ DA SILVA": "CLAUDIO LUIZ",
  "CLAUDIO LUIZ": "CLAUDIO LUIZ",
  "ADRIELLE CRISTINA SANTANA PENA": "ADRIELLE CRISTINA",
  "ADRIELLE CRISTINA": "ADRIELLE CRISTINA",
  "KARINE MARCELA DINIZ PIMENTA SALDANHA": "KARINE MARCELA",
  "KARINE MARCELA": "KARINE MARCELA",
  "NATALIA CRISTINA DA SILVA SANTOS": "NATALIA CRISTINA",
  "NATALIA CRISTINA": "NATALIA CRISTINA",
  "PRISCILA LIMA DE OLIVEIRA": "PRISCILA LIMA",
  "PRISCILA LIMA": "PRISCILA LIMA",
  "MAYARA NUNES DE CARVALHO": "MAYARA NUNES",
  "MAYARA NUNES": "MAYARA NUNES",
  "THATIANE CHRISTINE DA SILVA LIMA": "THATIANE CHRISTINE",
  "THATIANE CHRISTINE": "THATIANE CHRISTINE",
};

document.addEventListener("DOMContentLoaded", () => {
  atualizarContadorBanco();
  configurarDropzone();

  document
    .getElementById("btnProcessarArquivo")
    .addEventListener("click", processarOrigemDados);
  document
    .getElementById("btnSalvarNoBanco")
    .addEventListener("click", salvarDadosNoFirestore);
  document
    .getElementById("btnZerarBanco")
    .addEventListener("click", confirmarZerarBanco);
  document
    .getElementById("btnMarcarTodos")
    .addEventListener("click", () => toggleTodosConsultores(true));
  document
    .getElementById("btnDesmarcarTodos")
    .addEventListener("click", () => toggleTodosConsultores(false));
  document
    .getElementById("buscaConsultorImport")
    .addEventListener("input", filtrarChipsConsultores);
});

function configurarDropzone() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("arquivoInput");
  const chipNome = document.getElementById("nomeArquivoSelecionado");
  const txtNome = document.getElementById("txtNomeArquivo");
  const btnRemover = document.getElementById("btnRemoverArquivo");

  dropZone.onclick = (e) => {
    if (e.target !== btnRemover && !btnRemover.contains(e.target)) {
      fileInput.click();
    }
  };

  fileInput.onchange = () => {
    if (fileInput.files.length > 0) {
      txtNome.textContent = fileInput.files[0].name;
      chipNome.style.display = "inline-flex";
    }
  };

  btnRemover.onclick = (e) => {
    e.stopPropagation();
    fileInput.value = "";
    chipNome.style.display = "none";
  };

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
      },
      false,
    );
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
      },
      false,
    );
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      fileInput.files = files;
      txtNome.textContent = files[0].name;
      chipNome.style.display = "inline-flex";
    }
  });
}

async function atualizarContadorBanco() {
  try {
    const snap = await db.collection("vendas").get();
    document.getElementById("badgeTotalBanco").textContent =
      `${snap.size} vendas registradas`;
  } catch (err) {
    document.getElementById("badgeTotalBanco").textContent =
      "Erro ao consultar banco";
  }
}

function processarOrigemDados() {
  const fileInput = document.getElementById("arquivoInput");
  let linkInput = document.getElementById("linkGoogleSheets").value.trim();

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const extensao = file.name.split(".").pop().toLowerCase();

    if (extensao === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => normalizarPlanilha(results.data),
      });
    } else if (extensao === "xlsx" || extensao === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        normalizarPlanilha(json);
      };
      reader.readAsArrayBuffer(file);
    }
  } else if (linkInput) {
    if (linkInput.includes("/edit")) {
      linkInput = linkInput.split("/edit")[0] + "/export?format=csv";
    }

    Papa.parse(linkInput, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => normalizarPlanilha(results.data),
      error: (err) => alert("Erro ao carregar link: " + err.message),
    });
  } else {
    alert("Por favor, selecione um arquivo ou cole o link do Google Sheets.");
  }
}

function parseDataFlexivel(valorData) {
  if (!valorData) return new Date();
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

function padronizarConsultor(nomeBruto) {
  if (!nomeBruto) return "VENDA EXTERNA / SITE";
  const limpo = String(nomeBruto).toUpperCase().trim();

  if (DICIONARIO_NOMES[limpo]) return DICIONARIO_NOMES[limpo];

  for (const [chave, padrao] of Object.entries(DICIONARIO_NOMES)) {
    if (limpo.includes(chave) || chave.includes(limpo)) {
      return padrao;
    }
  }

  if (
    limpo.includes("WEB SITE") ||
    limpo.includes("SITE") ||
    limpo.includes("DIGITAL") ||
    limpo.includes("WHATSAPP") ||
    limpo.includes("RECEPÇÃO")
  ) {
    return "VENDA EXTERNA / SITE";
  }

  return limpo;
}

function normalizarPlanilha(linhas) {
  dadosBrutosProcessados = [];
  mapaConsultores = {};

  linhas.forEach((linha) => {
    const matricula = String(
      linha["MARÍCULA"] ||
        linha["MATRÍCULA"] ||
        linha["MATRICULA"] ||
        linha["matricula"] ||
        "",
    )
      .trim()
      .toUpperCase();

    const cliente = String(
      linha["CLIENTE"] || linha["cliente"] || linha["Nome do Cliente"] || "",
    )
      .trim()
      .toUpperCase();

    const consultorBruto = String(
      linha["NOME CONSULTOR"] ||
        linha["NOME_CONSULTOR"] ||
        linha["consultor"] ||
        "",
    )
      .trim()
      .toUpperCase();

    const consultor = padronizarConsultor(consultorBruto);

    const tipo = String(
      linha["TIPO DE VENDA"] ||
        linha["tipoVenda"] ||
        linha["TIPO"] ||
        "FILIAÇÃO",
    )
      .trim()
      .toUpperCase();

    const pagamento = String(
      linha["ORMA DE PAGAMENT"] ||
        linha["FORMA DE PAGAMENTO"] ||
        linha["formaPagamento"] ||
        "NÃO INFORMADO",
    )
      .trim()
      .toUpperCase();

    const statusBruto = String(
      linha["S TATUS VENDA"] ||
        linha["STATUS VENDA"] ||
        linha["status"] ||
        "CONCLUÍDO",
    )
      .trim()
      .toUpperCase();

    let status = "PENDENTE";
    if (statusBruto.includes("CONCLU") || statusBruto === "OK")
      status = "CONCLUÍDO";
    if (
      statusBruto.includes("NÃO") ||
      statusBruto.includes("NAO") ||
      statusBruto.includes("RECUS")
    )
      status = "NÃO CONCLUÍDO";

    const isConcluido = status === "CONCLUÍDO";
    const campoData =
      linha["DATA VENDA"] || linha["dataVenda"] || linha["DATA"] || "";
    const dataObj = parseDataFlexivel(campoData);

    const valorBruto = linha["VALOR"] || linha["valor"] || 66.8;
    const valor =
      typeof valorBruto === "number"
        ? valorBruto
        : parseFloat(String(valorBruto).replace(",", ".")) || 66.8;

    if (cliente || matricula) {
      dadosBrutosProcessados.push({
        matricula: matricula || "S/N",
        cliente: cliente || "NÃO INFORMADO",
        dataVenda: dataObj,
        consultor: consultor,
        tipoVenda: tipo,
        formaPagamento: pagamento,
        status: status,
        valor: valor,
        observacao: linha["OBSERVAÇÃO PÓS"] || "",
        etapasPosVenda: {
          ligacao: isConcluido,
          linkEnviado: isConcluido,
          docsRecebidos: isConcluido,
        },
      });

      mapaConsultores[consultor] = (mapaConsultores[consultor] || 0) + 1;
    }
  });

  montarPainelSelecao();
  exibirPrevia();
}

function montarPainelSelecao() {
  const secao = document.getElementById("secaoSelecaoConsultores");
  const grid = document.getElementById("gridConsultoresDetectados");
  secao.style.display = "block";

  const consultores = Object.keys(mapaConsultores).sort(
    (a, b) => mapaConsultores[b] - mapaConsultores[a],
  );

  grid.innerHTML = consultores
    .map(
      (c) => `
    <label class="consultant-chip" data-nome="${c.toLowerCase()}">
      <input type="checkbox" class="check-consultor" value="${c}" checked onchange="atualizarContagemSelecionados()" />
      <span class="chip-title" title="${c}">${c}</span>
      <span class="chip-count">${mapaConsultores[c]}</span>
    </label>
  `,
    )
    .join("");

  atualizarContagemSelecionados();
}

function filtrarChipsConsultores() {
  const termo = document
    .getElementById("buscaConsultorImport")
    .value.toLowerCase()
    .trim();
  const chips = document.querySelectorAll(".consultant-chip");

  chips.forEach((chip) => {
    const nome = chip.getAttribute("data-nome") || "";
    chip.style.display = nome.includes(termo) ? "flex" : "none";
  });
}

function toggleTodosConsultores(marcar) {
  document.querySelectorAll(".consultant-chip").forEach((chip) => {
    if (chip.style.display !== "none") {
      const cb = chip.querySelector(".check-consultor");
      if (cb) cb.checked = marcar;
    }
  });
  atualizarContagemSelecionados();
}

function atualizarContagemSelecionados() {
  const selecionados = Array.from(
    document.querySelectorAll(".check-consultor:checked"),
  ).map((cb) => cb.value);
  const totalContratos = dadosBrutosProcessados.filter((d) =>
    selecionados.includes(d.consultor),
  ).length;

  document.getElementById("txtQtdConsultoresSel").textContent =
    selecionados.length;
  document.getElementById("txtQtdImportar").textContent = totalContratos;
}

function obterClasseTipo(tipo) {
  if (tipo.includes("REFIL")) return "pill-tipo-refiliacao";
  return "pill-tipo-filiacao";
}

function obterClassePagamento(pag) {
  if (pag.includes("CRÉD") || pag.includes("CRED")) return "pill-pag-credito";
  if (pag.includes("DÉB") || pag.includes("DEB")) return "pill-pag-debito";
  if (pag.includes("PIX")) return "pill-pag-pix";
  return "pill-pag-outro";
}

function obterClasseStatus(status) {
  if (status === "CONCLUÍDO") return "pill-status-concluido";
  if (status === "NÃO CONCLUÍDO") return "pill-status-recusado";
  return "pill-status-pendente";
}

function exibirPrevia() {
  const secao = document.getElementById("secaoPrevia");
  const tbody = document.getElementById("corpoPrevia");
  const badgeQtd = document.getElementById("badgeQtdLida");

  secao.style.display = "block";
  badgeQtd.textContent = `${dadosBrutosProcessados.length} linhas lidas`;

  const primeiras10 = dadosBrutosProcessados.slice(0, 10);
  tbody.innerHTML = primeiras10
    .map((d) => {
      return `
      <tr>
        <td><span class="pill pill-matricula">${d.matricula}</span></td>
        <td><span class="pill pill-cliente" title="${d.cliente}">${d.cliente}</span></td>
        <td><span class="pill pill-data">${d.dataVenda.toLocaleDateString("pt-BR")}</span></td>
        <td><span class="pill pill-consultor">${d.consultor}</span></td>
        <td><span class="pill ${obterClasseTipo(d.tipoVenda)}">${d.tipoVenda}</span></td>
        <td><span class="pill ${obterClassePagamento(d.formaPagamento)}">${d.formaPagamento}</span></td>
        <td><span class="pill ${obterClasseStatus(d.status)}">${d.status}</span></td>
        <td><span class="pill pill-valor">R$ ${d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></td>
      </tr>
    `;
    })
    .join("");
}

async function salvarDadosNoFirestore() {
  const selecionados = Array.from(
    document.querySelectorAll(".check-consultor:checked"),
  ).map((cb) => cb.value);
  const paraGravar = dadosBrutosProcessados.filter((d) =>
    selecionados.includes(d.consultor),
  );

  if (paraGravar.length === 0) {
    alert("Nenhum consultor selecionado para importação.");
    return;
  }

  if (!confirm(`Deseja gravar ${paraGravar.length} contratos no Firestore?`))
    return;

  const progressoArea = document.getElementById("progressoArea");
  const progressoBarra = document.getElementById("progressoBarra");
  const progressoTexto = document.getElementById("progressoTexto");
  const progressoPct = document.getElementById("progressoPorcentagem");
  const btnSalvar = document.getElementById("btnSalvarNoBanco");

  progressoArea.style.display = "block";
  btnSalvar.disabled = true;

  const total = paraGravar.length;
  const TAMANHO_LOTE = 400;
  let processados = 0;

  for (let i = 0; i < total; i += TAMANHO_LOTE) {
    const loteAtual = paraGravar.slice(i, i + TAMANHO_LOTE);
    const batch = db.batch();

    loteAtual.forEach((item) => {
      const novoDocRef = db.collection("vendas").doc();
      batch.set(novoDocRef, {
        ...item,
        dataVenda: firebase.firestore.Timestamp.fromDate(item.dataVenda),
      });
    });

    await batch.commit();
    processados += loteAtual.length;

    const pct = Math.round((processados / total) * 100);
    progressoBarra.style.width = `${pct}%`;
    progressoTexto.textContent = `Gravando: ${processados} de ${total}`;
    progressoPct.textContent = `${pct}%`;
  }

  alert("Base de dados atualizada com sucesso!");
  atualizarContadorBanco();
  btnSalvar.disabled = false;
  document.getElementById("secaoSelecaoConsultores").style.display = "none";
  document.getElementById("secaoPrevia").style.display = "none";
}

async function confirmarZerarBanco() {
  const confirmacao1 = confirm(
    "ATENÇÃO: Isso apagará permanentemente TODAS as vendas do sistema! Tem certeza?",
  );
  if (!confirmacao1) return;

  const confirmacao2 = prompt(
    "Digite ZERAR em letras maiúsculas para confirmar:",
  );
  if (confirmacao2 !== "ZERAR") {
    alert("Operação cancelada.");
    return;
  }

  const progressoArea = document.getElementById("progressoArea");
  const progressoBarra = document.getElementById("progressoBarra");
  const progressoTexto = document.getElementById("progressoTexto");
  const progressoPct = document.getElementById("progressoPorcentagem");

  progressoArea.style.display = "block";
  progressoTexto.textContent = "Apagando registros...";

  try {
    const snapshot = await db.collection("vendas").get();
    const total = snapshot.size;
    let apagados = 0;

    const docs = snapshot.docs;
    const TAMANHO_LOTE = 400;

    for (let i = 0; i < docs.length; i += TAMANHO_LOTE) {
      const lote = docs.slice(i, i + TAMANHO_LOTE);
      const batch = db.batch();

      lote.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      apagados += lote.length;

      const pct = Math.round((apagados / total) * 100);
      progressoBarra.style.width = `${pct}%`;
      progressoTexto.textContent = `Apagando: ${apagados} de ${total}`;
      progressoPct.textContent = `${pct}%`;
    }

    alert("Banco de dados zerado com sucesso.");
    atualizarContadorBanco();
    progressoArea.style.display = "none";
  } catch (err) {
    alert("Erro ao zerar banco: " + err.message);
  }
}
