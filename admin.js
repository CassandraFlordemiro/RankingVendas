const db = firebase.firestore();
let consultoresLista = [];
let fotoBase64Temp = '';

document.addEventListener('DOMContentLoaded', () => {
  iniciarOuvinteConsultores();

  document.getElementById('buscaConsultoresInput').addEventListener('input', filtrarConsultores);
  document.getElementById('btnNovoConsultor').addEventListener('click', abrirModalNovo);
  document.getElementById('btnFecharModalConsultor').addEventListener('click', fecharModal);
  document.getElementById('btnCancelarModalConsultor').addEventListener('click', fecharModal);
  document.getElementById('formConsultorAdmin').addEventListener('submit', salvarConsultor);
  document.getElementById('inputFotoArquivo').addEventListener('change', handleUploadFoto);
  document.getElementById('inputFotoUrlAdmin').addEventListener('input', handleUrlFoto);
  document.getElementById('btnRemoverFoto').addEventListener('click', removerFoto);
});

function iniciarOuvinteConsultores() {
  db.collection('consultores').onSnapshot((snapshot) => {
    consultoresLista = [];
    snapshot.forEach(doc => consultoresLista.push({ id: doc.id, ...doc.data() }));

    // Se o banco ainda não tiver coleção de consultores, auto-popula a partir das vendas
    if (consultoresLista.length === 0) {
      sincronizarConsultoresDeVendas();
    } else {
      renderizarCardsConsultores(consultoresLista);
    }
  }, (err) => {
    console.error('Erro ao ler consultores:', err);
  });
}

async function sincronizarConsultoresDeVendas() {
  const snapVendas = await db.collection('vendas').get();
  const nomes = new Set();
  snapVendas.forEach(doc => {
    const v = doc.data();
    const c = v.consultor || v['NOME CONSULTOR'] || v['NOME_CONSULTOR'];
    if (c && typeof c === 'string' && c.trim() !== '') {
      nomes.add(c.trim().toUpperCase());
    }
  });

  for (const n of Array.from(nomes)) {
    await db.collection('consultores').add({
      nome: n,
      status: 'ativo',
      fotoUrl: '',
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

function filtrarConsultores() {
  const termo = document.getElementById('buscaConsultoresInput').value.toLowerCase().trim();
  const filtrados = consultoresLista.filter(c => (c.nome || '').toLowerCase().includes(termo));
  renderizarCardsConsultores(filtrados);
}

function renderizarCardsConsultores(lista) {
  const grid = document.getElementById('gridConsultoresAdmin');
  if (!grid) return;

  if (lista.length === 0) {
    grid.innerHTML = `<div class="text-muted" style="grid-column: 1/-1; padding: 24px; text-align: center;">Nenhum consultor encontrado.</div>`;
    return;
  }

  grid.innerHTML = lista.map(c => {
    const nomeCurto = window.formatarNomeCurto(c.nome);
    const iniciais = nomeCurto.split(' ').map(p => p[0]).slice(0, 2).join('');
    const ehAtivo = c.status !== 'inativo';
    const foto = c.fotoUrl || '';

    return `
      <div class="admin-consultant-card ${ehAtivo ? '' : 'card-inativo'}">
        <div class="admin-card-header">
          <span class="status-indicator-badge ${ehAtivo ? 'badge-ativo' : 'badge-inativo'}">
            ${ehAtivo ? 'Ativo' : 'Inativo'}
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
          <button class="btn btn-secondary-sm w-100" onclick="toggleStatusConsultor('${c.id}', '${ehAtivo ? 'inativo' : 'ativo'}')">
            <i class="fa-solid ${ehAtivo ? 'fa-user-slash' : 'fa-user-check'}"></i> ${ehAtivo ? 'Inativar' : 'Reativar'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.abrirModalNovo = function() {
  document.getElementById('modalConsultorTitulo').innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Consultor';
  document.getElementById('consultorIdAdmin').value = '';
  document.getElementById('formConsultorAdmin').reset();
  resetAvatarPreview();
  document.getElementById('modalConsultorAdmin').style.display = 'flex';
};

window.abrirModalEdicao = function(id) {
  const consultor = consultoresLista.find(c => c.id === id);
  if (!consultor) return;

  document.getElementById('modalConsultorTitulo').innerHTML = '<i class="fa-solid fa-user-pen"></i> Editar Consultor';
  document.getElementById('consultorIdAdmin').value = id;
  document.getElementById('inputNomeConsultorAdmin').value = consultor.nome || '';
  document.getElementById('inputFotoUrlAdmin').value = consultor.fotoUrl || '';
  document.getElementById('selectStatusConsultorAdmin').value = consultor.status || 'ativo';

  fotoBase64Temp = consultor.fotoUrl || '';
  atualizarAvatarPreview(consultor.nome, consultor.fotoUrl);

  document.getElementById('modalConsultorAdmin').style.display = 'flex';
};

function fecharModal() {
  document.getElementById('modalConsultorAdmin').style.display = 'none';
  document.getElementById('formConsultorAdmin').reset();
  resetAvatarPreview();
}

function handleUploadFoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    fotoBase64Temp = event.target.result;
    const nome = document.getElementById('inputNomeConsultorAdmin').value || 'Consultor';
    atualizarAvatarPreview(nome, fotoBase64Temp);
  };
  reader.readAsDataURL(file);
}

function handleUrlFoto(e) {
  const url = e.target.value.trim();
  fotoBase64Temp = url;
  const nome = document.getElementById('inputNomeConsultorAdmin').value || 'Consultor';
  atualizarAvatarPreview(nome, url);
}

function removerFoto() {
  fotoBase64Temp = '';
  document.getElementById('inputFotoUrlAdmin').value = '';
  document.getElementById('inputFotoArquivo').value = '';
  const nome = document.getElementById('inputNomeConsultorAdmin').value || 'Consultor';
  atualizarAvatarPreview(nome, '');
}

function atualizarAvatarPreview(nome, fotoSrc) {
  const iniciaisEl = document.getElementById('txtIniciaisPreview');
  const imgEl = document.getElementById('imgAvatarPreview');
  const btnRemover = document.getElementById('btnRemoverFoto');

  const limpo = window.formatarNomeCurto(nome);
  const iniciais = limpo.split(' ').map(p => p[0]).slice(0, 2).join('');
  iniciaisEl.textContent = iniciais || '--';

  if (fotoSrc) {
    imgEl.src = fotoSrc;
    imgEl.style.display = 'block';
    iniciaisEl.style.display = 'none';
    btnRemover.style.display = 'inline-flex';
  } else {
    imgEl.style.display = 'none';
    iniciaisEl.style.display = 'block';
    btnRemover.style.display = 'none';
  }
}

function resetAvatarPreview() {
  fotoBase64Temp = '';
  atualizarAvatarPreview('', '');
}

async function salvarConsultor(e) {
  e.preventDefault();

  const id = document.getElementById('consultorIdAdmin').value;
  const nome = document.getElementById('inputNomeConsultorAdmin').value.trim().toUpperCase();
  const status = document.getElementById('selectStatusConsultorAdmin').value;
  const fotoUrl = fotoBase64Temp || document.getElementById('inputFotoUrlAdmin').value.trim();

  const dados = {
    nome,
    status,
    fotoUrl,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (id) {
      await db.collection('consultores').doc(id).update(dados);
    } else {
      dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('consultores').add(dados);
    }
    fecharModal();
  } catch (err) {
    alert('Erro ao salvar consultor: ' + err.message);
  }
}

window.toggleStatusConsultor = async function(id, novoStatus) {
  try {
    await db.collection('consultores').doc(id).update({ status: novoStatus });
  } catch (err) {
    alert('Erro ao alterar status: ' + err.message);
  }
};