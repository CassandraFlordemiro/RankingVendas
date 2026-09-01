const db = firebase.firestore();
let consultoresLista = [];
let metasCarregadas = {};
let fotoBase64Temp = "";

document.addEventListener("DOMContentLoaded", () => {
  const agora = new Date();
  const selectMes = document.getElementById("selectMesMetasAdmin");
  const selectAno = document.getElementById("selectAnoMetasAdmin");

  selectMes.value = agora.getMonth().toString();
  selectAno.value = agora.getFullYear().toString();

  selectMes.addEventListener("change", carregarMetasMes);
  selectAno.addEventListener("change", carregarMetasMes);
  document
    .getElementById("btnSalvarTodasMetas")
    .addEventListener("click", salvarTodasMetas);

  document
    .getElementById("buscaConsultoresInput")
    .addEventListener("input", filtrarConsultores);
  document
    .getElementById("btnNovoConsultor")
    .addEventListener("click", abrirModalNovo);
  document
    .getElementById("btnFecharModalConsultor")
    .addEventListener("click", fecharModal);
  document
    .getElementById("btnCancelarModalConsultor")
    .addEventListener("click", fecharModal);
  document
    .getElementById("formConsultorAdmin")
    .addEventListener("submit", salvarConsultor);
  document
    .getElementById("inputFotoArquivo")
    .addEventListener("change", handleUploadFoto);
  document
    .getElementById("inputFotoUrlAdmin")
    .addEventListener("input", handleUrlFoto);
  document
    .getElementById("btnRemoverFoto")
    .addEventListener("click", removerFoto);

  iniciarOuvinteConsultores();
});

function iniciarOuvinteConsultores() {
  db.collection("consultores").onSnapshot(
    (snapshot) => {
      consultoresLista = [];
      snapshot.forEach((doc) =>
        consultoresLista.push({ id: doc.id, ...doc.data() }),
      );

      if (consultoresLista.length === 0) {
        sincronizarConsultoresDeVendas();
      } else {
        renderizarCardsConsultores(consultoresLista);
        carregarMetasMes();
      }
    },
    (err) => {
      console.error("Erro ao ler consultores:", err);
    },
  );
}

async function sincronizarConsultoresDeVendas() {
  const snapVendas = await db.collection("vendas").get();
  const nomes = new Set();
  snapVendas.forEach((doc) => {
    const v = doc.data();
    const c = v.consultor || v["NOME CONSULTOR"] || v["NOME_CONSULTOR"];
    if (c && typeof c === "string" && c.trim() !== "") {
      nomes.add(c.trim().toUpperCase());
    }
  });

  for (const n of Array.from(nomes)) {
    await db.collection("consultores").add({
      nome: n,
      status: "ativo",
      fotoUrl: "",
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
}

// =========================================================
// GESTÃO DE METAS MÊS A MÊS NO FIRESTORE
// =========================================================

async function carregarMetasMes() {
  const mes = document.getElementById("selectMesMetasAdmin").value;
  const ano = document.getElementById("selectAnoMetasAdmin").value;
  const tbody = document.getElementById("corpoTabelaMetasAdmin");

  tbody.innerHTML = `<tr><td colspan="5" class="loading">Buscando metas de ${ano}...</td></tr>`;

  try {
    const snap = await db
      .collection("metas")
      .where("ano", "==", ano)
      .where("mes", "==", mes)
      .get();

    metasCarregadas = {};
    snap.forEach((doc) => {
      const data = doc.data();
      metasCarregadas[data.consultor] = data;
    });

    renderizarTabelaMetas();
  } catch (err) {
    console.error("Erro ao buscar metas:", err);
  }
}

function renderizarTabelaMetas() {
  const tbody = document.getElementById("corpoTabelaMetasAdmin");
  if (!tbody) return;

  const consultoresAtivos = consultoresLista.filter(
    (c) => c.status !== "inativo",
  );

  // Linha 1: Meta Geral da Equipe
  const metaGeral = metasCarregadas["GERAL"] || {
    metaFaturamento: 70000,
    metaQtd: 1000,
  };

  let html = `
    <tr class="row-meta-geral">
      <td>
        <div class="consultor-avatar-pill">
          <div class="mini-avatar"><i class="fa-solid fa-users text-primary"></i></div>
          <strong class="text-primary">META GERAL DA EQUIPE</strong>
        </div>
      </td>
      <td><span class="badge badge-ativo">Equipe Completa</span></td>
      <td>
        <div class="input-meta-wrap">
          <span>R$</span>
          <input type="number" step="0.01" class="input-meta-valor" id="metaFat_GERAL" value="${metaGeral.metaFaturamento}" />
        </div>
      </td>
      <td>
        <div class="input-meta-wrap">
          <input type="number" class="input-meta-valor" id="metaQtd_GERAL" value="${metaGeral.metaQtd}" />
          <span>vendas</span>
        </div>
      </td>
      <td class="text-center">
        <button class="btn btn-secondary-sm" onclick="salvarMetaIndividual('GERAL')" title="Salvar Meta Geral">
          <i class="fa-solid fa-check"></i> Salvar
        </button>
      </td>
    </tr>
  `;

  // Linhas por Consultor Ativo
  consultoresAtivos.forEach((c) => {
    const nomeCurto = window.formatarNomeCurto(c.nome);
    const iniciais = nomeCurto
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("");
    const metaConsultor = metasCarregadas[c.nome] || {
      metaFaturamento: 7000,
      metaQtd: 100,
    };
    const safeId = c.nome.replace(/[^a-zA-Z0-9]/g, "_");

    html += `
      <tr>
        <td>
          <div class="consultor-avatar-pill">
            <div class="mini-avatar">${iniciais}</div>
            <span class="consultor-name-text" title="${c.nome}">${nomeCurto}</span>
          </div>
        </td>
        <td><span class="badge badge-ativo">Ativo</span></td>
        <td>
          <div class="input-meta-wrap">
            <span>R$</span>
            <input type="number" step="0.01" class="input-meta-valor" id="metaFat_${safeId}" value="${metaConsultor.metaFaturamento}" />
          </div>
        </td>
        <td>
          <div class="input-meta-wrap">
            <input type="number" class="input-meta-valor" id="metaQtd_${safeId}" value="${metaConsultor.metaQtd}" />
            <span>vendas</span>
          </div>
        </td>
        <td class="text-center">
          <button class="btn btn-secondary-sm" onclick="salvarMetaIndividual('${c.nome}')" title="Salvar Meta do Consultor">
            <i class="fa-solid fa-check"></i> Salvar
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

window.salvarMetaIndividual = async function (nomeConsultor) {
  const mes = document.getElementById("selectMesMetasAdmin").value;
  const ano = document.getElementById("selectAnoMetasAdmin").value;
  const safeId =
    nomeConsultor === "GERAL"
      ? "GERAL"
      : nomeConsultor.replace(/[^a-zA-Z0-9]/g, "_");

  const fatInput = document.getElementById(`metaFat_${safeId}`);
  const qtdInput = document.getElementById(`metaQtd_${safeId}`);

  const metaFaturamento = parseFloat(fatInput.value) || 0;
  const metaQtd = parseInt(qtdInput.value, 10) || 0;

  const docKey = `${ano}_${mes}_${safeId}`;

  try {
    await db.collection("metas").doc(docKey).set({
      ano,
      mes,
      consultor: nomeConsultor,
      metaFaturamento,
      metaQtd,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });

    alert(
      `Meta de ${nomeConsultor === "GERAL" ? "Equipe" : window.formatarNomeCurto(nomeConsultor)} salva com sucesso!`,
    );
  } catch (err) {
    alert("Erro ao salvar meta: " + err.message);
  }
};

async function salvarTodasMetas() {
  const mes = document.getElementById("selectMesMetasAdmin").value;
  const ano = document.getElementById("selectAnoMetasAdmin").value;
  const btn = document.getElementById("btnSalvarTodasMetas");

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  const consultoresAtivos = consultoresLista.filter(
    (c) => c.status !== "inativo",
  );
  const listaAlvos = ["GERAL", ...consultoresAtivos.map((c) => c.nome)];

  try {
    const batch = db.batch();

    listaAlvos.forEach((nome) => {
      const safeId =
        nome === "GERAL" ? "GERAL" : nome.replace(/[^a-zA-Z0-9]/g, "_");
      const fatInput = document.getElementById(`metaFat_${safeId}`);
      const qtdInput = document.getElementById(`metaQtd_${safeId}`);

      if (fatInput && qtdInput) {
        const metaFaturamento = parseFloat(fatInput.value) || 0;
        const metaQtd = parseInt(qtdInput.value, 10) || 0;
        const docKey = `${ano}_${mes}_${safeId}`;
        const ref = db.collection("metas").doc(docKey);

        batch.set(ref, {
          ano,
          mes,
          consultor: nome,
          metaFaturamento,
          metaQtd,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    await batch.commit();
    alert(`Todas as metas de ${ano} salvas com sucesso!`);
  } catch (err) {
    alert("Erro ao salvar lote de metas: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      '<i class="fa-solid fa-floppy-disk"></i> Salvar Metas do Mês';
  }
}

// =========================================================
// GESTÃO DE CONSULTORES & FOTOS
// =========================================================

function filtrarConsultores() {
  const termo = document
    .getElementById("buscaConsultoresInput")
    .value.toLowerCase()
    .trim();
  const filtrados = consultoresLista.filter((c) =>
    (c.nome || "").toLowerCase().includes(termo),
  );
  renderizarCardsConsultores(filtrados);
}

function renderizarCardsConsultores(lista) {
  const grid = document.getElementById("gridConsultoresAdmin");
  if (!grid) return;

  if (lista.length === 0) {
    grid.innerHTML = `<div class="text-muted" style="grid-column: 1/-1; padding: 24px; text-align: center;">Nenhum consultor encontrado.</div>`;
    return;
  }

  grid.innerHTML = lista
    .map((c) => {
      const nomeCurto = window.formatarNomeCurto(c.nome);
      const iniciais = nomeCurto
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("");
      const ehAtivo = c.status !== "inativo";
      const foto = c.fotoUrl || "";

      return `
      <div class="admin-consultant-card ${ehAtivo ? "" : "card-inativo"}">
        <div class="admin-card-header">
          <span class="status-indicator-badge ${ehAtivo ? "badge-ativo" : "badge-inativo"}">
            ${ehAtivo ? "Ativo" : "Inativo"}
          </span>
          <button class="btn-icon-action" onclick="abrirModalEdicao('${c.id}')" title="Editar Consultor">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        </div>

        <div class="admin-card-avatar-wrap">
          ${foto ? `<img src="${foto}" alt="${nomeCurto}" class="admin-avatar-img" />` : `<div class="admin-avatar-placeholder">${iniciais}</div>`}
        </div>

        <div class="admin-card-body">
          <h4 title="${c.nome}">${nomeCurto}</h4>
          <small class="text-muted">${c.nome}</small>
        </div>

        <div class="admin-card-footer">
          <button class="btn btn-secondary-sm w-100" onclick="toggleStatusConsultor('${c.id}', '${ehAtivo ? "inativo" : "ativo"}')">
            <i class="fa-solid ${ehAtivo ? "fa-user-slash" : "fa-user-check"}"></i> ${ehAtivo ? "Inativar" : "Reativar"}
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

window.abrirModalNovo = function () {
  document.getElementById("modalConsultorTitulo").innerHTML =
    '<i class="fa-solid fa-user-plus"></i> Novo Consultor';
  document.getElementById("consultorIdAdmin").value = "";
  document.getElementById("formConsultorAdmin").reset();
  resetAvatarPreview();
  document.getElementById("modalConsultorAdmin").style.display = "flex";
};

window.abrirModalEdicao = function (id) {
  const consultor = consultoresLista.find((c) => c.id === id);
  if (!consultor) return;

  document.getElementById("modalConsultorTitulo").innerHTML =
    '<i class="fa-solid fa-user-pen"></i> Editar Consultor';
  document.getElementById("consultorIdAdmin").value = id;
  document.getElementById("inputNomeConsultorAdmin").value =
    consultor.nome || "";
  document.getElementById("inputFotoUrlAdmin").value = consultor.fotoUrl || "";
  document.getElementById("selectStatusConsultorAdmin").value =
    consultor.status || "ativo";

  fotoBase64Temp = consultor.fotoUrl || "";
  atualizarAvatarPreview(consultor.nome, consultor.fotoUrl);

  document.getElementById("modalConsultorAdmin").style.display = "flex";
};

function fecharModal() {
  document.getElementById("modalConsultorAdmin").style.display = "none";
  document.getElementById("formConsultorAdmin").reset();
  resetAvatarPreview();
}

function handleUploadFoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    fotoBase64Temp = event.target.result;
    const nome =
      document.getElementById("inputNomeConsultorAdmin").value || "Consultor";
    atualizarAvatarPreview(nome, fotoBase64Temp);
  };
  reader.readAsDataURL(file);
}

function handleUrlFoto(e) {
  const url = e.target.value.trim();
  fotoBase64Temp = url;
  const nome =
    document.getElementById("inputNomeConsultorAdmin").value || "Consultor";
  atualizarAvatarPreview(nome, url);
}

function removerFoto() {
  fotoBase64Temp = "";
  document.getElementById("inputFotoUrlAdmin").value = "";
  document.getElementById("inputFotoArquivo").value = "";
  const nome =
    document.getElementById("inputNomeConsultorAdmin").value || "Consultor";
  atualizarAvatarPreview(nome, "");
}

function atualizarAvatarPreview(nome, fotoSrc) {
  const iniciaisEl = document.getElementById("txtIniciaisPreview");
  const imgEl = document.getElementById("imgAvatarPreview");
  const btnRemover = document.getElementById("btnRemoverFoto");

  const limpo = window.formatarNomeCurto(nome);
  const iniciais = limpo
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  iniciaisEl.textContent = iniciais || "--";

  if (fotoSrc) {
    imgEl.src = fotoSrc;
    imgEl.style.display = "block";
    iniciaisEl.style.display = "none";
    btnRemover.style.display = "inline-flex";
  } else {
    imgEl.style.display = "none";
    iniciaisEl.style.display = "block";
    btnRemover.style.display = "none";
  }
}

function resetAvatarPreview() {
  fotoBase64Temp = "";
  atualizarAvatarPreview("", "");
}

async function salvarConsultor(e) {
  e.preventDefault();

  const id = document.getElementById("consultorIdAdmin").value;
  const nome = document
    .getElementById("inputNomeConsultorAdmin")
    .value.trim()
    .toUpperCase();
  const status = document.getElementById("selectStatusConsultorAdmin").value;
  const fotoUrl =
    fotoBase64Temp || document.getElementById("inputFotoUrlAdmin").value.trim();

  const dados = {
    nome,
    status,
    fotoUrl,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    if (id) {
      await db.collection("consultores").doc(id).update(dados);
    } else {
      dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("consultores").add(dados);
    }
    fecharModal();
  } catch (err) {
    alert("Erro ao salvar consultor: " + err.message);
  }
}

window.toggleStatusConsultor = async function (id, novoStatus) {
  try {
    await db.collection("consultores").doc(id).update({ status: novoStatus });
  } catch (err) {
    alert("Erro ao alterar status: " + err.message);
  }
};
