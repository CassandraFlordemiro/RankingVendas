import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, collection, getDocs, query, where 
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

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

const temaSalvo = localStorage.getItem('ranking_tema_preferido') || 'default';
if (temaSalvo === 'dracula') document.body.classList.add('theme-dracula');
else if (temaSalvo === 'light') document.body.classList.add('theme-light');
else if (temaSalvo === 'refuturiza') document.body.classList.add('theme-refuturiza');

// Elementos DOM
const selectMes = document.getElementById('select-mes-comparativo');
const deckContainer = document.getElementById('deck-consultores-container');
const btnDeckMarcar = document.getElementById('btn-deck-marcar-todos');
const btnDeckDesmarcar = document.getElementById('btn-deck-desmarcar-todos');

const kpiTotalEquipe = document.getElementById('kpi-total-equipe');
const kpiMediaEquipe = document.getElementById('kpi-media-equipe');
const kpiMvpNome = document.getElementById('kpi-mvp-nome');
const kpiCiclosQtd = document.getElementById('kpi-ciclos-qtd');
const kpiRetidosQtd = document.getElementById('kpi-retidos-qtd');

const btnAbrirRetidos = document.getElementById('btn-abrir-retidos');
const modalRetidos = document.getElementById('modal-retidos');
const btnFecharRetidos = document.getElementById('btn-fechar-retidos');
const tbodyRetidosModal = document.getElementById('tbody-retidos-modal');
const modalRetidosSubtitulo = document.getElementById('modal-retidos-subtitulo');
const btnExportarRetidosCsv = document.getElementById('btn-exportar-retidos-csv');
const btnExportarGeral = document.getElementById('btn-exportar-geral');

const btnEvolucaoBarras = document.getElementById('btn-evolucao-barras');
const btnEvolucaoLinhas = document.getElementById('btn-evolucao-linhas');

let listaConsultoresGeral = [];
let consultoresAtivosDeck = new Set();
let historicosMesAtual = [];
let vendasNaoConcluidasMes = [];
let tipoGraficoEvolucao = 'bar';

let chartBarras = null;
let chartDonut = null;
let chartEvolucao = null;

const agora = new Date();
const mesPadrao = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
selectMes.value = mesPadrao;

const CORES_PALETA = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#eab308', '#6366f1',
    '#14b8a6', '#f97316', '#a855f7', '#0284c7', '#059669'
];

async function carregarConsultores() {
    const snap = await getDocs(collection(db, "consultores"));
    listaConsultoresGeral = [];
    snap.forEach(d => listaConsultoresGeral.push({ id: d.id, ...d.data() }));
    listaConsultoresGeral.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    consultoresAtivosDeck.clear();
    listaConsultoresGeral.forEach(c => consultoresAtivosDeck.add(c.nome));

    renderizarDeckConsultores();
    carregarDadosMes();
}

function renderizarDeckConsultores() {
    deckContainer.innerHTML = '';
    listaConsultoresGeral.forEach(c => {
        const estaAtivo = consultoresAtivosDeck.has(c.nome);
        const item = document.createElement('div');
        item.className = `consultor-deck-item ${estaAtivo ? 'active' : 'excluded'}`;

        const avatarHtml = (c.foto && c.foto !== 'default')
            ? `<img src="${c.foto}" class="deck-avatar" alt="${c.nome}">`
            : `<div class="deck-placeholder">${c.nome.charAt(0).toUpperCase()}</div>`;

        item.innerHTML = `
            ${avatarHtml}
            <span class="deck-nome" title="${c.nome}">${c.nome}</span>
        `;

        item.addEventListener('click', () => {
            if (consultoresAtivosDeck.has(c.nome)) {
                consultoresAtivosDeck.delete(c.nome);
                item.classList.remove('active');
                item.classList.add('excluded');
            } else {
                consultoresAtivosDeck.add(c.nome);
                item.classList.add('active');
                item.classList.remove('excluded');
            }
            atualizarVisualizacoesDashboard();
        });

        deckContainer.appendChild(item);
    });
}

btnDeckMarcar.addEventListener('click', () => {
    listaConsultoresGeral.forEach(c => consultoresAtivosDeck.add(c.nome));
    renderizarDeckConsultores();
    atualizarVisualizacoesDashboard();
});

btnDeckDesmarcar.addEventListener('click', () => {
    consultoresAtivosDeck.clear();
    renderizarDeckConsultores();
    atualizarVisualizacoesDashboard();
});

async function carregarDadosMes() {
    const mesEscolhido = selectMes.value || mesPadrao;

    // 1. Carregar Fechamentos Diários da coleção 'historicos'
    const snapHistoricos = await getDocs(collection(db, "historicos"));
    historicosMesAtual = [];

    snapHistoricos.forEach(d => {
        if (d.id.startsWith(mesEscolhido)) {
            historicosMesAtual.push({ dataId: d.id, ...d.data() });
        }
    });

    historicosMesAtual.sort((a, b) => a.dataId.localeCompare(b.dataId));

    // 2. Carregar Vendas Não Concluídas da coleção 'vendas' para auditoria
    const qRetidos = query(
        collection(db, "vendas"),
        where("mesRef", "==", mesEscolhido),
        where("status", "==", "NAO_CONCLUIDO")
    );
    const snapRetidos = await getDocs(qRetidos);
    vendasNaoConcluidasMes = [];
    snapRetidos.forEach(d => vendasNaoConcluidasMes.push({ id: d.id, ...d.data() }));
    vendasNaoConcluidasMes.sort((a, b) => b.data.localeCompare(a.data));

    kpiRetidosQtd.textContent = vendasNaoConcluidasMes.length;

    atualizarVisualizacoesDashboard();
}

function atualizarVisualizacoesDashboard() {
    const totaisPorConsultor = {};
    let volumeTotalGeral = 0;

    historicosMesAtual.forEach(item => {
        let ranking = item.ranking || [];
        if (!Array.isArray(ranking) && typeof ranking === 'object') ranking = Object.values(ranking);

        ranking.forEach(r => {
            const nome = r.nome;
            if (consultoresAtivosDeck.has(nome)) {
                const qtdVendas = r.vendas || 0;
                totaisPorConsultor[nome] = (totaisPorConsultor[nome] || 0) + qtdVendas;
                volumeTotalGeral += qtdVendas;
            }
        });
    });

    // Ordenar Ranking
    const listaOrdenada = Object.entries(totaisPorConsultor).sort((a, b) => b[1] - a[1]);

    // Atualizar KPIs
    const qtdConsultoresAtivos = consultoresAtivosDeck.size;
    const media = qtdConsultoresAtivos > 0 ? (volumeTotalGeral / qtdConsultoresAtivos).toFixed(1) : "0.0";
    const mvpTexto = listaOrdenada.length > 0 ? `${listaOrdenada[0][0]} (${listaOrdenada[0][1]})` : "-";

    kpiTotalEquipe.textContent = volumeTotalGeral;
    kpiMediaEquipe.textContent = media;
    kpiMvpNome.textContent = mvpTexto;
    kpiCiclosQtd.textContent = `${historicosMesAtual.length} dias`;

    renderizarGraficoBarras(listaOrdenada);
    renderizarGraficoDonut(listaOrdenada, volumeTotalGeral);
    renderizarGraficoEvolucao();
}

function renderizarGraficoBarras(listaOrdenada) {
    const ctx = document.getElementById('graficoBarrasGeral').getContext('2d');
    if (chartBarras) chartBarras.destroy();

    const labels = listaOrdenada.map(i => i[0]);
    const dados = listaOrdenada.map(i => i[1]);
    const cores = labels.map((_, idx) => CORES_PALETA[idx % CORES_PALETA.length]);

    chartBarras = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: dados,
                backgroundColor: cores,
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
                    ticks: { color: '#94a3b8' },
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

function renderizarGraficoDonut(listaOrdenada, total) {
    const ctx = document.getElementById('graficoDonutShare').getContext('2d');
    if (chartDonut) chartDonut.destroy();

    if (total === 0) return;

    const labels = listaOrdenada.map(i => i[0]);
    const dados = listaOrdenada.map(i => i[1]);
    const cores = labels.map((_, idx) => CORES_PALETA[idx % CORES_PALETA.length]);

    chartDonut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dados,
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
                    position: 'right',
                    labels: { color: '#94a3b8', boxWidth: 12, font: { size: 10 } }
                }
            },
            cutout: '65%'
        }
    });
}

function renderizarGraficoEvolucao() {
    const ctx = document.getElementById('graficoEvolucaoLinhas').getContext('2d');
    if (chartEvolucao) chartEvolucao.destroy();

    const labelsDias = historicosMesAtual.map(h => {
        const p = h.dataId.split('-');
        return `${p[2]}/${p[1]}`;
    });

    const totaisPorDia = historicosMesAtual.map(h => {
        let ranking = h.ranking || [];
        if (!Array.isArray(ranking) && typeof ranking === 'object') ranking = Object.values(ranking);
        return ranking
            .filter(r => consultoresAtivosDeck.has(r.nome))
            .reduce((acc, curr) => acc + (curr.vendas || 0), 0);
    });

    chartEvolucao = new Chart(ctx, {
        type: tipoGraficoEvolucao,
        data: {
            labels: labelsDias,
            datasets: [{
                label: 'Volume Concluído por Dia',
                data: totaisPorDia,
                backgroundColor: tipoGraficoEvolucao === 'bar' ? '#3b82f6' : 'rgba(59, 130, 246, 0.15)',
                borderColor: '#3b82f6',
                borderWidth: 2,
                borderRadius: 4,
                tension: 0.3,
                fill: tipoGraficoEvolucao === 'line'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            }
        }
    });
}

btnEvolucaoBarras.addEventListener('click', () => {
    tipoGraficoEvolucao = 'bar';
    renderizarGraficoEvolucao();
});

btnEvolucaoLinhas.addEventListener('click', () => {
    tipoGraficoEvolucao = 'line';
    renderizarGraficoEvolucao();
});

selectMes.addEventListener('change', carregarDadosMes);

// Modal de Relatório de Vendas Não Concluídas
btnAbrirRetidos.addEventListener('click', () => {
    tbodyRetidosModal.innerHTML = '';
    modalRetidosSubtitulo.textContent = `${vendasNaoConcluidasMes.length} contratos não concluídos/retidos em ${selectMes.value}`;

    if (vendasNaoConcluidasMes.length === 0) {
        tbodyRetidosModal.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum contrato retido encontrado neste mês.</td></tr>`;
    } else {
        vendasNaoConcluidasMes.forEach(v => {
            const tr = document.createElement('tr');
            const partes = v.data.split('-');
            const dataBr = partes.length === 3 ? `${partes[2]}/${partes[1]}` : v.data;

            tr.innerHTML = `
                <td style="color: var(--text-muted); font-size: 0.82rem;">${dataBr}</td>
                <td style="font-family: monospace; font-weight: 700;">${v.matricula}</td>
                <td style="font-weight: 600;">${v.clienteNome || 'Cliente'}</td>
                <td style="font-weight: 700; color: #38bdf8;">${v.consultorNome}</td>
                <td style="text-align: center;"><span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.15); color: #fbbf24;">${v.tipo}</span></td>
                <td style="text-align: center;"><span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(168, 85, 247, 0.15); color: #c084fc;">${v.modalidade}</span></td>
            `;
            tbodyRetidosModal.appendChild(tr);
        });
    }

    modalRetidos.classList.add('active');
});

btnFecharRetidos.addEventListener('click', () => modalRetidos.classList.remove('active'));
modalRetidos.addEventListener('click', (e) => {
    if (e.target === modalRetidos) modalRetidos.classList.remove('active');
});

// Exportação CSV de Não Concluídos
btnExportarRetidosCsv.addEventListener('click', () => {
    if (vendasNaoConcluidasMes.length === 0) return;
    let csv = "data:text/csv;charset=utf-8,Data,Matricula,Cliente,Consultor,Tipo,Modalidade,Status\n";
    vendasNaoConcluidasMes.forEach(d => {
        csv += `"${d.data}","${d.matricula}","${d.clienteNome}","${d.consultorNome}","${d.tipo}","${d.modalidade}","NAO_CONCLUIDO"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `Relatorio_Nao_Concluidos_${selectMes.value}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Exportação Geral Consolidada
btnExportarGeral.addEventListener('click', async () => {
    const mesEscolhido = selectMes.value || mesPadrao;
    const qVendas = query(collection(db, "vendas"), where("mesRef", "==", mesEscolhido));
    const snap = await getDocs(qVendas);
    
    if (snap.empty) return;

    let csv = "data:text/csv;charset=utf-8,Data,Matricula,Cliente,Consultor,Tipo,Modalidade,Status\n";
    snap.forEach(doc => {
        const d = doc.data();
        csv += `"${d.data}","${d.matricula}","${d.clienteNome}","${d.consultorNome}","${d.tipo}","${d.modalidade}","${d.status}"\n`;
    });

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `Extrato_Geral_Vendas_${mesEscolhido}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

carregarConsultores();