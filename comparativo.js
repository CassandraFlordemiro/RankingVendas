import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const selectMesComp = document.getElementById('select-mes-comp');
const btnExportarEquipe = document.getElementById('btn-exportar-equipe');
const kpiEquipeTotal = document.getElementById('kpi-equipe-total');
const kpiVolumeLabel = document.getElementById('kpi-volume-label');
const kpiEquipeMedia = document.getElementById('kpi-equipe-media');
const kpiEquipeMvp = document.getElementById('kpi-equipe-mvp');
const kpiMvpLabel = document.getElementById('kpi-mvp-label');
const kpiEquipeCiclos = document.getElementById('kpi-equipe-ciclos');
const tbodyComparativo = document.getElementById('tbody-comparativo');
const deckGrid = document.getElementById('deck-grid');
const btnToggleAll = document.getElementById('btn-toggle-all');
const btnDeckPrev = document.getElementById('btn-deck-prev');
const btnDeckNext = document.getElementById('btn-deck-next');

const btnCompBar = document.getElementById('btn-comp-bar');
const btnCompLine = document.getElementById('btn-comp-line');

let tipoGraficoConfronto = 'bar';

let chartRankingInstance = null;
let chartDonutInstance = null;
let chartConfrontoInstance = null;

let dadosBrutosEquipe = [];
let docsDoMesAtual = [];
let consultoresSelecionados = new Set();

const PALETA_CORES = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#6366f1'
];

function obterMedalhaOuPosicao(posicao) {
    if (posicao === 1) return `<img src="icones/Ouro.svg" alt="1º Lugar" style="width: 26px; height: 26px;">`;
    if (posicao === 2) return `<img src="icones/Prata.svg" alt="2º Lugar" style="width: 26px; height: 26px;">`;
    if (posicao === 3) return `<img src="icones/Bronze.svg" alt="3º Lugar" style="width: 26px; height: 26px;">`;
    return `<span style="font-weight: 800; font-size: 1.1rem; color: var(--text-muted);">${posicao}º</span>`;
}

async function carregarDadosMes() {
    const mesEscolhido = selectMesComp.value;

    const snapConsultores = await getDocs(collection(db, "consultores"));
    const mapaConsultores = new Map();
    snapConsultores.forEach(docSnap => {
        mapaConsultores.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
    });

    const snapHistoricos = await getDocs(collection(db, "historicos"));
    docsDoMesAtual = [];

    snapHistoricos.forEach(docSnap => {
        if (docSnap.id.startsWith(mesEscolhido)) {
            docsDoMesAtual.push({ dataId: docSnap.id, docData: docSnap.data() });
        }
    });

    docsDoMesAtual.sort((a, b) => a.dataId.localeCompare(b.dataId));

    const consolidados = new Map();

    docsDoMesAtual.forEach(({ docData }) => {
        let ranking = docData.ranking || [];
        if (!Array.isArray(ranking) && typeof ranking === 'object') {
            ranking = Object.values(ranking);
        }

        ranking.sort((a, b) => (b.vendas || 0) - (a.vendas || 0));

        ranking.forEach((r, idx) => {
            const idKey = r.id || r.nome;
            const infoBase = mapaConsultores.get(r.id) || { nome: r.nome, foto: r.foto || "default" };

            if (!consolidados.has(idKey)) {
                consolidados.set(idKey, {
                    id: r.id || idKey,
                    nome: infoBase.nome || r.nome,
                    foto: infoBase.foto || r.foto || "default",
                    totalVendas: 0,
                    diasComVenda: 0,
                    diasNoPodio: 0,
                    vendasPorDia: []
                });
            }

            const item = consolidados.get(idKey);
            const qtd = r.vendas || 0;
            item.totalVendas += qtd;
            if (qtd > 0) item.diasComVenda++;
            if (idx < 3 && qtd > 0) item.diasNoPodio++;
            item.vendasPorDia.push(qtd);
        });
    });

    dadosBrutosEquipe = Array.from(consolidados.values()).sort((a, b) => b.totalVendas - a.totalVendas);
    consultoresSelecionados = new Set(dadosBrutosEquipe.map(c => c.id));

    montarDeckCards();
    aplicarFiltrosERenderizar();
    verificarVisibilidadeSetas();
}

function montarDeckCards() {
    deckGrid.innerHTML = '';
    atualizarBotaoToggle();

    dadosBrutosEquipe.forEach(consultor => {
        const card = document.createElement('div');
        const estaAtivo = consultoresSelecionados.has(consultor.id);
        card.className = `consultor-card-item ${estaAtivo ? 'active' : ''}`;
        card.setAttribute('data-id', consultor.id);

        const visualFoto = consultor.foto && consultor.foto !== "default"
            ? `<img src="${consultor.foto}" alt="${consultor.nome}" class="card-avatar-img">`
            : `<div class="card-avatar-placeholder">${consultor.nome.charAt(0).toUpperCase()}</div>`;

        card.innerHTML = `
            <div class="card-avatar-wrapper">
                ${visualFoto}
            </div>
            <span class="card-nome" title="${consultor.nome}">${consultor.nome}</span>
        `;

        card.addEventListener('click', () => {
            if (consultoresSelecionados.has(consultor.id)) {
                consultoresSelecionados.delete(consultor.id);
                card.classList.remove('active');
            } else {
                consultoresSelecionados.add(consultor.id);
                card.classList.add('active');
            }
            atualizarBotaoToggle();
            aplicarFiltrosERenderizar();
        });

        deckGrid.appendChild(card);
    });
}

function verificarVisibilidadeSetas() {
    const precisaRolagem = deckGrid.scrollWidth > deckGrid.clientWidth + 5;
    btnDeckPrev.style.display = precisaRolagem ? 'flex' : 'none';
    btnDeckNext.style.display = precisaRolagem ? 'flex' : 'none';
}

btnDeckPrev.addEventListener('click', () => {
    deckGrid.scrollBy({ left: -180, behavior: 'smooth' });
});

btnDeckNext.addEventListener('click', () => {
    deckGrid.scrollBy({ left: 180, behavior: 'smooth' });
});

deckGrid.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
        e.preventDefault();
        deckGrid.scrollLeft += e.deltaY;
    }
}, { passive: false });

window.addEventListener('resize', verificarVisibilidadeSetas);

function atualizarBotaoToggle() {
    if (consultoresSelecionados.size === dadosBrutosEquipe.length && dadosBrutosEquipe.length > 0) {
        btnToggleAll.textContent = "Desmarcar Todos";
    } else {
        btnToggleAll.textContent = "Selecionar Todos";
    }
}

btnToggleAll.addEventListener('click', () => {
    if (consultoresSelecionados.size === dadosBrutosEquipe.length) {
        consultoresSelecionados.clear();
    } else {
        consultoresSelecionados = new Set(dadosBrutosEquipe.map(c => c.id));
    }
    montarDeckCards();
    atualizarBotaoToggle();
    aplicarFiltrosERenderizar();
});

function aplicarFiltrosERenderizar() {
    const equipeFiltrada = dadosBrutosEquipe.filter(c => consultoresSelecionados.has(c.id));
    const totalCiclos = docsDoMesAtual.length;
    const totalSelecionados = consultoresSelecionados.size;
    const totalGeral = dadosBrutosEquipe.length;

    if (totalSelecionados === 0) {
        kpiVolumeLabel.textContent = "Volume Filtrado";
        kpiMvpLabel.textContent = "Nenhum Selecionado";
    } else if (totalSelecionados === totalGeral) {
        kpiVolumeLabel.textContent = "Volume Total da Equipe";
        kpiMvpLabel.textContent = "👑 MVP do Mês (1º Lugar)";
    } else if (totalSelecionados === 2) {
        kpiVolumeLabel.textContent = "Volume do Duelo";
        kpiMvpLabel.textContent = "🥊 Vencedor do Duelo (1x1)";
    } else if (totalSelecionados === 1) {
        kpiVolumeLabel.textContent = "Volume Individual";
        kpiMvpLabel.textContent = "👤 Desempenho do Consultor";
    } else {
        kpiVolumeLabel.textContent = "Volume do Confronto";
        kpiMvpLabel.textContent = "🎯 Líder do Confronto";
    }

    const somaTotal = equipeFiltrada.reduce((acc, c) => acc + c.totalVendas, 0);
    const mediaPorConsultor = equipeFiltrada.length > 0 ? (somaTotal / equipeFiltrada.length).toFixed(1) : "0.0";
    const mvp = equipeFiltrada.length > 0 && equipeFiltrada[0].totalVendas > 0 ? `${equipeFiltrada[0].nome} (${equipeFiltrada[0].totalVendas})` : "-";

    kpiEquipeTotal.textContent = somaTotal;
    kpiEquipeMedia.textContent = mediaPorConsultor;
    kpiEquipeMvp.textContent = mvp;
    kpiEquipeCiclos.textContent = `${totalCiclos} ${totalCiclos === 1 ? 'dia' : 'dias'}`;

    renderizarGraficoRanking(equipeFiltrada);
    renderizarGraficoDonut(equipeFiltrada, somaTotal);
    renderizarGraficoConfronto(equipeFiltrada, docsDoMesAtual);

    tbodyComparativo.innerHTML = '';
    if (equipeFiltrada.length === 0) {
        tbodyComparativo.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 1rem;">
                    Nenhum consultor selecionado no deck. Clique nos cards acima para comparar.
                </td>
            </tr>
        `;
        return;
    }

    equipeFiltrada.forEach((c, index) => {
        const posicao = index + 1;
        const mediaDiaria = totalCiclos > 0 ? (c.totalVendas / totalCiclos).toFixed(1) : "0.0";
        const diasZerados = totalCiclos - c.diasComVenda;
        const pctPodio = totalCiclos > 0 ? Math.round((c.diasNoPodio / totalCiclos) * 100) : 0;

        const inicial = c.nome ? c.nome.charAt(0).toUpperCase() : "?";
        const visualFoto = c.foto && c.foto !== "default"
            ? `<img src="${c.foto}" alt="${c.nome}" class="foto-consultor" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--box-border);">`
            : `<div class="foto-placeholder" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; font-weight: 800; color: #fff; border-radius: 50%; background: #ff4d00;">${inicial}</div>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;">${obterMedalhaOuPosicao(posicao)}</td>
            <td>
                <div class="user-cell">
                    ${visualFoto}
                    <span>${c.nome}</span>
                </div>
            </td>
            <td style="text-align: center; font-weight: 800; font-size: 1.2rem; color: var(--text-main);">${c.totalVendas}</td>
            <td style="text-align: center; font-weight: 700; font-size: 1.05rem; color: var(--text-muted);">${mediaDiaria}</td>
            <td style="text-align: center;">
                <span class="metric-badge orange">🏆 ${c.diasNoPodio} dias (${pctPodio}%)</span>
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                    <span class="metric-badge green" title="Dias com venda">🟢 ${c.diasComVenda} ativos</span>
                    <span class="metric-badge red" title="Dias zerados">🔴 ${diasZerados} zerados</span>
                </div>
            </td>
            <td style="text-align: center;">
                <a href="desempenho.html?id=${c.id}" class="btn-acao-modal btn-acao-editar" style="text-decoration: none; display: inline-flex; align-items: center; padding: 6px 14px; font-weight: 700;" title="Ver Dashboard Individual">📈 Individual</a>
            </td>
        `;
        tbodyComparativo.appendChild(tr);
    });
}

function renderizarGraficoRanking(equipe) {
    const ctx = document.getElementById('graficoRankingAcumulado').getContext('2d');
    if (chartRankingInstance) chartRankingInstance.destroy();

    const labels = equipe.length > 0 ? equipe.map(c => c.nome) : ['Sem seleção'];
    const data = equipe.length > 0 ? equipe.map(c => c.totalVendas) : [0];
    const cores = equipe.length > 0 ? labels.map((_, i) => PALETA_CORES[i % PALETA_CORES.length]) : ['#334155'];

    chartRankingInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vendas no Mês',
                data: data,
                backgroundColor: cores,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#94a3b8', font: { weight: '600' } },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' }
                },
                x: {
                    ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#fff', font: { weight: '700' } },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderizarGraficoDonut(equipe, totalSoma) {
    const ctx = document.getElementById('graficoMarketShare').getContext('2d');
    if (chartDonutInstance) chartDonutInstance.destroy();

    const labels = equipe.length > 0 ? equipe.map(c => c.nome) : ['Sem dados'];
    const data = equipe.length > 0 ? equipe.map(c => c.totalVendas) : [1];
    const cores = equipe.length > 0 ? PALETA_CORES : ['#334155'];

    chartDonutInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: cores,
                borderWidth: 2,
                borderColor: getComputedStyle(document.body).getPropertyValue('--sidebar-bg').trim() || '#0f172a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 10,
                        color: getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#fff',
                        font: { size: 11, weight: '600' }
                    }
                }
            }
        }
    });
}

function renderizarGraficoConfronto(equipe, docsDoMes) {
    const ctx = document.getElementById('graficoLinhasMulti').getContext('2d');
    if (chartConfrontoInstance) chartConfrontoInstance.destroy();

    const labelsDias = docsDoMes.length > 0 ? docsDoMes.map(d => d.dataId.split('-')[2] + '/' + d.dataId.split('-')[1]) : ['Sem dados'];

    const datasets = equipe.length > 0 ? equipe.map((consultor, idx) => {
        const cor = PALETA_CORES[idx % PALETA_CORES.length];
        const dadosLinha = docsDoMes.map(docItem => {
            let ranking = docItem.docData.ranking || [];
            if (!Array.isArray(ranking) && typeof ranking === 'object') {
                ranking = Object.values(ranking);
            }
            const item = ranking.find(r => r.id === consultor.id || r.nome === consultor.nome);
            return item ? (item.vendas || 0) : 0;
        });

        if (tipoGraficoConfronto === 'bar') {
            return {
                label: consultor.nome,
                data: dadosLinha,
                backgroundColor: `${cor}dd`,
                borderColor: cor,
                borderWidth: 1,
                borderRadius: 4
            };
        } else {
            return {
                label: consultor.nome,
                data: dadosLinha,
                borderColor: cor,
                backgroundColor: `${cor}15`,
                tension: 0.35,
                pointRadius: 4,
                borderWidth: 2.5
            };
        }
    }) : [{
        label: 'Nenhum consultor selecionado',
        data: labelsDias.map(() => 0),
        borderColor: '#334155',
        borderWidth: 1,
        pointRadius: 0
    }];

    chartConfrontoInstance = new Chart(ctx, {
        type: tipoGraficoConfronto,
        data: {
            labels: labelsDias,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#fff', font: { weight: '700' } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#94a3b8',
                        font: { weight: '600' }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' }
                },
                x: {
                    ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#94a3b8', font: { weight: '600' } },
                    grid: { display: false }
                }
            }
        }
    });
}

btnCompBar.addEventListener('click', () => {
    tipoGraficoConfronto = 'bar';
    btnCompBar.classList.add('active');
    btnCompLine.classList.remove('active');
    aplicarFiltrosERenderizar();
});

btnCompLine.addEventListener('click', () => {
    tipoGraficoConfronto = 'line';
    btnCompLine.classList.add('active');
    btnCompBar.classList.remove('active');
    aplicarFiltrosERenderizar();
});

btnExportarEquipe.addEventListener('click', () => {
    const equipeFiltrada = dadosBrutosEquipe.filter(c => consultoresSelecionados.has(c.id));
    if (equipeFiltrada.length === 0) {
        alert("Sem dados selecionados para exportar.");
        return;
    }

    let csv = "data:text/csv;charset=utf-8,Posicao,Consultor,Total_Vendas,Dias_Com_Venda,Dias_Podio\n";
    equipeFiltrada.forEach((c, index) => {
        csv += `${index + 1},"${c.nome}",${c.totalVendas},${c.diasComVenda},${c.diasNoPodio}\n`;
    });

    const encoded = encodeURI(csv);
    const link = document.createElement("a");
    link.href = encoded;
    link.download = `Comparativo_Personalizado_${selectMesComp.value}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

selectMesComp.addEventListener('change', carregarDadosMes);
carregarDadosMes();