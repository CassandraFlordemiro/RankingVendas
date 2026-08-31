import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, collection, doc, getDocs, setDoc, deleteDoc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgtHlqlv4meTjW4VyJ8HrVCfUqMHaoUp0",
  authDomain: "rankingvendas-d56da.firebaseapp.com",
  projectId: "rankingvendas-d56da",
  storageBucket: "rankingvendas-d56da.firebasestorage.app",
  messagingSenderId: "55208086303",
  appId: "1:55208086303:web:fd78e3481750c04acf3e2a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const temaSalvo = localStorage.getItem('ranking_tema_preferido') || 'default';
if (temaSalvo === 'dracula') document.body.classList.add('theme-dracula');
else if (temaSalvo === 'light') document.body.classList.add('theme-light');
else if (temaSalvo === 'refuturiza') document.body.classList.add('theme-refuturiza');

// Elementos DOM
const filtroData = document.getElementById('filtro-data-auditoria');
const btnVerTodos = document.getElementById('btn-ver-todos');
const btnGerenciarMotivos = document.getElementById('btn-gerenciar-motivos');
const btnExportarAuditoria = document.getElementById('btn-exportar-auditoria');

const kpiTotalCancelado = document.getElementById('kpi-total-cancelado');
const kpiTotalEventos = document.getElementById('kpi-total-eventos');
const kpiMotivoPrincipal = document.getElementById('kpi-motivo-principal');
const kpiConsultorAfetado = document.getElementById('kpi-consultor-afetado');

const tbodyAuditoria = document.getElementById('tbody-auditoria');

// Modal de Motivos
const modalMotivos = document.getElementById('modal-motivos');
const btnFecharMotivos = document.getElementById('btn-fechar-motivos');
const novoMotivoInput = document.getElementById('novo-motivo-input');
const btnAdicionarMotivo = document.getElementById('btn-adicionar-motivo');
const listaMotivosContainer = document.getElementById('lista-motivos-container');

let todosRegistros = [];
let chartConsultores = null;
let chartMotivos = null;

const CORES_PALETA = [
    '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', 
    '#10b981', '#06b6d4', '#f97316', '#a855f7', '#64748b'
];

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        carregarAuditoria();
    }
});

async function carregarAuditoria() {
    try {
        // Busca logs da coleção 'cancelamentos' ordenada por timestamp
        const qLogs = query(collection(db, "cancelamentos"), orderBy("dataEstorno", "desc"));
        const snap = await getDocs(qLogs);

        todosRegistros = [];
        snap.forEach(d => {
            todosRegistros.push({ id: d.id, ...d.data() });
        });

        // Caso a coleção cancelamentos ainda não tenha registros, tenta mapear vendas retidas
        if (todosRegistros.length === 0) {
            const snapVendasRetidas = await getDocs(collection(db, "vendas"));
            snapVendasRetidas.forEach(d => {
                const v = d.data();
                if (v.status === "NAO_CONCLUIDO") {
                    todosRegistros.push({
                        id: d.id,
                        dataEstorno: v.data || "-",
                        dataCiclo: v.data || "-",
                        consultorNome: v.consultorNome || "Não Identificado",
                        quantidade: 1,
                        motivo: "Não Concluído / Recusado",
                        autor: "Sistema (Importação)"
                    });
                }
            });
        }

        renderizarPainel(todosRegistros);
    } catch (err) {
        console.error("Erro ao carregar auditoria:", err);
    }
}

function renderizarPainel(registros) {
    let volumeCancelado = 0;
    const mapaConsultores = {};
    const mapaMotivos = {};

    tbodyAuditoria.innerHTML = '';

    if (registros.length === 0) {
        tbodyAuditoria.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 22px;">Nenhum registro de estorno encontrado.</td></tr>`;
    }

    registros.forEach(r => {
        const qtd = Number(r.quantidade) || 1;
        volumeCancelado += qtd;

        const consultor = r.consultorNome || "Não Identificado";
        const motivo = r.motivo || "Outros";

        mapaConsultores[consultor] = (mapaConsultores[consultor] || 0) + qtd;
        mapaMotivos[motivo] = (mapaMotivos[motivo] || 0) + qtd;

        // Formatação de Datas
        const formatarDataBr = (str) => {
            if (!str || str === "-") return "-";
            const p = str.split('T')[0].split('-');
            return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : str;
        };

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: var(--text-muted); font-size: 0.85rem;">${formatarDataBr(r.dataEstorno)}</td>
            <td style="font-weight: 600; font-size: 0.88rem;">${formatarDataBr(r.dataCiclo)}</td>
            <td style="font-weight: 700; color: #38bdf8;">${consultor}</td>
            <td style="text-align: center; font-weight: 800; color: #ef4444;">${qtd}</td>
            <td><span style="font-size: 0.78rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">${motivo}</span></td>
            <td style="color: var(--text-muted); font-size: 0.84rem;">${r.autor || 'Admin'}</td>
        `;
        tbodyAuditoria.appendChild(tr);
    });

    // Identificar MVP Negativo e Motivo Principal
    const consultoresOrdenados = Object.entries(mapaConsultores).sort((a, b) => b[1] - a[1]);
    const motivosOrdenados = Object.entries(mapaMotivos).sort((a, b) => b[1] - a[1]);

    kpiTotalCancelado.textContent = volumeCancelado;
    kpiTotalEventos.textContent = registros.length;
    kpiMotivoPrincipal.textContent = motivosOrdenados.length > 0 ? motivosOrdenados[0][0] : "-";
    kpiConsultorAfetado.textContent = consultoresOrdenados.length > 0 ? `${consultoresOrdenados[0][0]} (${consultoresOrdenados[0][1]})` : "-";

    renderizarGraficoConsultores(consultoresOrdenados);
    renderizarGraficoMotivos(motivosOrdenados);
}

function renderizarGraficoConsultores(dados) {
    const canvas = document.getElementById('graficoConsultores');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartConsultores) chartConsultores.destroy();

    const labels = dados.map(d => d[0]);
    const valores = dados.map(d => d[1]);

    chartConsultores = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: '#ef4444',
                borderRadius: 6,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: '#94a3b8' },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' }
                },
                x: {
                    ticks: { color: '#94a3b8', font: { size: 10 } },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderizarGraficoMotivos(dados) {
    const canvas = document.getElementById('graficoMotivos');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartMotivos) chartMotivos.destroy();

    if (dados.length === 0) return;

    const labels = dados.map(d => d[0]);
    const valores = dados.map(d => d[1]);
    const cores = labels.map((_, idx) => CORES_PALETA[idx % CORES_PALETA.length]);

    chartMotivos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: cores,
                borderWidth: 2,
                borderColor: '#1e293b'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', boxWidth: 10, font: { size: 10 } }
                }
            },
            cutout: '60%'
        }
    });
}

// Filtro por Data
filtroData.addEventListener('change', (e) => {
    const dataFiltro = e.target.value;
    if (!dataFiltro) {
        renderizarPainel(todosRegistros);
        return;
    }
    const filtrados = todosRegistros.filter(r => r.dataCiclo === dataFiltro || (r.dataEstorno && r.dataEstorno.startsWith(dataFiltro)));
    renderizarPainel(filtrados);
});

btnVerTodos.addEventListener('click', () => {
    filtroData.value = '';
    renderizarPainel(todosRegistros);
});

// Exportação CSV
btnExportarAuditoria.addEventListener('click', () => {
    if (todosRegistros.length === 0) return alert("Nenhum registro para exportar.");

    let csv = "data:text/csv;charset=utf-8,Data Estorno,Data Ciclo,Consultor,Quantidade,Motivo,Autor\n";
    todosRegistros.forEach(r => {
        csv += `"${r.dataEstorno || ''}","${r.dataCiclo || ''}","${r.consultorNome || ''}","${r.quantidade || 1}","${r.motivo || ''}","${r.autor || ''}"\n`;
    });

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `Auditoria_Cancelamentos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Gestão de Motivos / Justificativas
btnGerenciarMotivos.addEventListener('click', abrirModalMotivos);
btnFecharMotivos.addEventListener('click', () => modalMotivos.classList.remove('active'));
modalMotivos.addEventListener('click', (e) => {
    if (e.target === modalMotivos) modalMotivos.classList.remove('active');
});

async function abrirModalMotivos() {
    modalMotivos.classList.add('active');
    await carregarListaMotivos();
}

async function carregarListaMotivos() {
    listaMotivosContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Carregando...</span>';
    const snap = await getDocs(collection(db, "motivos_cancelamento"));

    listaMotivosContainer.innerHTML = '';
    const motivos = [];
    snap.forEach(d => motivos.push({ id: d.id, ...d.data() }));

    if (motivos.length === 0) {
        listaMotivosContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Nenhum motivo cadastrado.</span>';
        return;
    }

    motivos.forEach(m => {
        const item = document.createElement('div');
        item.className = 'badge-motivo-item';
        item.innerHTML = `
            <span>${m.descricao}</span>
            <button data-id="${m.id}" style="background: transparent; border: none; color: #ef4444; font-weight: bold; cursor: pointer; font-size: 1rem;" title="Remover">&times;</button>
        `;

        item.querySelector('button').addEventListener('click', async () => {
            if (confirm(`Deseja excluir o motivo "${m.descricao}"?`)) {
                await deleteDoc(doc(db, "motivos_cancelamento", m.id));
                carregarListaMotivos();
            }
        });

        listaMotivosContainer.appendChild(item);
    });
}

btnAdicionarMotivo.addEventListener('click', async () => {
    const desc = novoMotivoInput.value.trim();
    if (!desc) return alert("Digite o texto da justificativa.");

    btnAdicionarMotivo.disabled = true;
    const novoDoc = doc(collection(db, "motivos_cancelamento"));
    await setDoc(novoDoc, {
        descricao: desc,
        criadoEm: Date.now()
    });

    novoMotivoInput.value = '';
    btnAdicionarMotivo.disabled = false;
    carregarListaMotivos();
});