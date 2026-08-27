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

// Trava de Autenticação
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

// Sincroniza Tema Salvo
const temaSalvo = localStorage.getItem('ranking_tema_preferido') || 'default';
if (temaSalvo === 'dracula') document.body.classList.add('theme-dracula');
else if (temaSalvo === 'light') document.body.classList.add('theme-light');
else if (temaSalvo === 'refuturiza') document.body.classList.add('theme-refuturiza');

// Elementos DOM
const selectConsultor = document.getElementById('select-consultor');
const selectMes = document.getElementById('select-mes');
const consultorNomeDisplay = document.getElementById('consultor-nome-display');
const consultorAvatarImg = document.getElementById('consultor-avatar-img');
const consultorAvatarPlaceholder = document.getElementById('consultor-avatar-placeholder');
const badgePosicaoContainer = document.getElementById('badge-posicao-container');

const kpiTotalVendas = document.getElementById('kpi-total-vendas');
const kpiMediaVendas = document.getElementById('kpi-media-vendas');
const kpiMelhorDia = document.getElementById('kpi-melhor-dia');
const kpiPiorDia = document.getElementById('kpi-pior-dia');

const kpiPodioDias = document.getElementById('kpi-podio-dias');
const kpiPodioPorcentagem = document.getElementById('kpi-podio-porcentagem');
const kpiAtivosDias = document.getElementById('kpi-ativos-dias');
const kpiAtivosPorcentagem = document.getElementById('kpi-ativos-porcentagem');
const kpiZeradosDias = document.getElementById('kpi-zerados-dias');

const btnChartBar = document.getElementById('btn-chart-bar');
const btnChartLine = document.getElementById('btn-chart-line');
const btnExportarConsultor = document.getElementById('btn-exportar-consultor');

let listaConsultores = [];
let chartVendasInstance = null;
let chartPosicaoInstance = null;
let tipoGrafico = 'bar';
let dadosHistoricoConsultor = [];

function obterCorDestaque() {
    if (temaSalvo === 'refuturiza') return '#ff4d00';
    if (temaSalvo === 'dracula') return '#bd93f9';
    return '#3b82f6';
}

function obterCorSecundaria() {
    if (temaSalvo === 'refuturiza') return '#22c55e';
    if (temaSalvo === 'dracula') return '#50fa7b';
    return '#10b981';
}

function obterMedalhaOuPosicaoMensal(posicao) {
    if (posicao === 1) return `<img src="icones/Ouro.svg" alt="1º Lugar" style="width: 22px; height: 22px;"> <span>1º Lugar Geral</span>`;
    if (posicao === 2) return `<img src="icones/Prata.svg" alt="2º Lugar" style="width: 22px; height: 22px;"> <span>2º Lugar Geral</span>`;
    if (posicao === 3) return `<img src="icones/Bronze.svg" alt="3º Lugar" style="width: 22px; height: 22px;"> <span>3º Lugar Geral</span>`;
    return `<span>${posicao}º Lugar Geral</span>`;
}

// 1. Carrega todos os consultores (Ativos e Inativos)
async function carregarConsultores() {
    const snap = await getDocs(collection(db, "consultores"));
    listaConsultores = [];
    selectConsultor.innerHTML = '';

    snap.forEach((d) => {
        listaConsultores.push({ id: d.id, ...d.data() });
    });

    listaConsultores.sort((a, b) => {
        if ((a.ativo !== false) === (b.ativo !== false)) {
            return a.nome.localeCompare(b.nome, 'pt-BR');
        }
        return a.ativo === false ? 1 : -1;
    });

    listaConsultores.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.ativo === false ? `${c.nome} (Inativo)` : c.nome;
        selectConsultor.appendChild(opt);
    });

    const urlParams = new URLSearchParams(window.location.search);
    const idUrl = urlParams.get('id');

    if (idUrl && listaConsultores.some(c => c.id === idUrl)) {
        selectConsultor.value = idUrl;
    }

    atualizarDashboard();
}

// 2. Coleta dados e calcula a classificação geral, KPIs e Métricas de Consistência
async function atualizarDashboard() {
    const consultorId = selectConsultor.value;
    const mesEscolhido = selectMes.value;

    const consultor = listaConsultores.find(c => c.id === consultorId);
    if (!consultor) return;

    consultorNomeDisplay.textContent = consultor.nome + (consultor.ativo === false ? " (Inativo)" : "");
    if (consultor.foto && consultor.foto !== "default") {
        consultorAvatarImg.src = consultor.foto;
        consultorAvatarImg.style.display = 'block';
        consultorAvatarPlaceholder.style.display = 'none';
    } else {
        consultorAvatarPlaceholder.textContent = consultor.nome.charAt(0).toUpperCase();
        consultorAvatarPlaceholder.style.display = 'flex';
        consultorAvatarImg.style.display = 'none';
    }

    const snapHistoricos = await getDocs(collection(db, "historicos"));
    const docsDoMes = [];
    const acumuladoMensalGeral = new Map();

    snapHistoricos.forEach((docSnap) => {
        const dataId = docSnap.id;
        if (dataId.startsWith(mesEscolhido)) {
            const docData = docSnap.data();
            docsDoMes.push({ dataId, docData });

            let ranking = docData.ranking || [];
            if (!Array.isArray(ranking) && typeof ranking === 'object') {
                ranking = Object.values(ranking);
            }

            ranking.forEach(r => {
                const idChave = r.id || r.nome;
                const totalAtual = acumuladoMensalGeral.get(idChave) || 0;
                acumuladoMensalGeral.set(idChave, totalAtual + (r.vendas || 0));
            });
        }
    });

    const arrayAcumulado = Array.from(acumuladoMensalGeral.entries())
        .map(([id, vendas]) => ({ id, vendas }))
        .sort((a, b) => b.vendas - a.vendas);

    const indexRankingGeral = arrayAcumulado.findIndex(item => item.id === consultor.id || item.id === consultor.nome);
    const posicaoGeral = indexRankingGeral >= 0 ? indexRankingGeral + 1 : listaConsultores.length;

    badgePosicaoContainer.innerHTML = obterMedalhaOuPosicaoMensal(posicaoGeral);

    docsDoMes.sort((a, b) => a.dataId.localeCompare(b.dataId));

    const labelsDias = [];
    const valoresVendas = [];
    const valoresPosicoes = [];
    dadosHistoricoConsultor = [];

    let somaTotal = 0;
    let melhorVenda = -1;
    let melhorDiaTexto = "-";
    let piorVenda = 999999;
    let piorDiaTexto = "-";
    let diasComRegistro = 0;
    let totalMaxConsultores = 10;

    let totalDiasNoMes = docsDoMes.length;
    let diasNoPodio = 0;
    let diasAtivosComVenda = 0;
    let diasZerados = 0;

    docsDoMes.forEach(({ dataId, docData }) => {
        let ranking = docData.ranking || [];

        if (!Array.isArray(ranking) && typeof ranking === 'object') {
            ranking = Object.values(ranking);
        }

        ranking.sort((a, b) => (b.vendas || 0) - (a.vendas || 0));
        if (ranking.length > totalMaxConsultores) totalMaxConsultores = ranking.length;

        const indexPos = ranking.findIndex(r => r.id === consultor.id || r.nome === consultor.nome);
        const item = indexPos >= 0 ? ranking[indexPos] : null;
        const qtd = item ? (item.vendas || 0) : 0;
        const posicao = indexPos >= 0 ? indexPos + 1 : null;

        const diaFormatado = dataId.split('-')[2] + '/' + dataId.split('-')[1];
        labelsDias.push(diaFormatado);
        valoresVendas.push(qtd);
        valoresPosicoes.push(posicao);

        dadosHistoricoConsultor.push({ data: dataId, vendas: qtd, posicao: posicao || '-' });

        somaTotal += qtd;
        if (qtd > 0) {
            diasComRegistro++;
            diasAtivosComVenda++;
        } else {
            diasZerados++;
        }

        if (posicao && posicao <= 3 && qtd > 0) {
            diasNoPodio++;
        }

        if (qtd > melhorVenda) {
            melhorVenda = qtd;
            melhorDiaTexto = `${diaFormatado} (${qtd})`;
        }

        if (qtd < piorVenda) {
            piorVenda = qtd;
            piorDiaTexto = `${diaFormatado} (${qtd})`;
        }
    });

    kpiTotalVendas.textContent = somaTotal;
    const media = diasComRegistro > 0 ? (somaTotal / diasComRegistro).toFixed(1) : "0.0";
    kpiMediaVendas.textContent = media;
    kpiMelhorDia.textContent = melhorVenda >= 0 ? melhorDiaTexto : "-";
    kpiPiorDia.textContent = piorVenda < 999999 ? piorDiaTexto : "-";

    // Atualização da Box 2: Consistência
    kpiPodioDias.textContent = `${diasNoPodio} ${diasNoPodio === 1 ? 'dia' : 'dias'}`;
    const pctPodio = totalDiasNoMes > 0 ? Math.round((diasNoPodio / totalDiasNoMes) * 100) : 0;
    kpiPodioPorcentagem.textContent = `${pctPodio}% dos ciclos`;

    kpiAtivosDias.textContent = `${diasAtivosComVenda} ${diasAtivosComVenda === 1 ? 'dia' : 'dias'}`;
    const pctAtivos = totalDiasNoMes > 0 ? Math.round((diasAtivosComVenda / totalDiasNoMes) * 100) : 0;
    kpiAtivosPorcentagem.textContent = `${pctAtivos}% dos ciclos`;

    kpiZeradosDias.textContent = `${diasZerados} ${diasZerados === 1 ? 'dia' : 'dias'}`;

    renderizarGraficoVendas(labelsDias, valoresVendas, consultor.nome);
    renderizarGraficoPosicoes(labelsDias, valoresPosicoes, consultor.nome, totalMaxConsultores);
}

// Gráfico 1: Volume de Vendas
function renderizarGraficoVendas(labels, data, nomeConsultor) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    const corTema = obterCorDestaque();

    if (chartVendasInstance) {
        chartVendasInstance.destroy();
    }

    chartVendasInstance = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: labels.length > 0 ? labels : ['Sem dados'],
            datasets: [{
                label: `Vendas de ${nomeConsultor}`,
                data: data.length > 0 ? data : [0],
                backgroundColor: tipoGrafico === 'bar' ? `${corTema}cc` : `${corTema}22`,
                borderColor: corTema,
                borderWidth: 2,
                borderRadius: tipoGrafico === 'bar' ? 6 : 0,
                fill: tipoGrafico === 'line',
                tension: 0.35,
                pointBackgroundColor: corTema,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#fff' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#94a3b8'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' }
                },
                x: {
                    ticks: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#94a3b8'
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// Gráfico 2: Evolução de Posição
function renderizarGraficoPosicoes(labels, data, nomeConsultor, totalConsultores) {
    const ctx = document.getElementById('graficoPosicoes').getContext('2d');
    const corSecundaria = obterCorSecundaria();

    if (chartPosicaoInstance) {
        chartPosicaoInstance.destroy();
    }

    chartPosicaoInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length > 0 ? labels : ['Sem dados'],
            datasets: [{
                label: `Posição de ${nomeConsultor}`,
                data: data.length > 0 ? data : [1],
                borderColor: corSecundaria,
                backgroundColor: `${corSecundaria}18`,
                borderWidth: 2.5,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: corSecundaria,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#fff' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed.y;
                            return ` Posição: ${val}º Lugar`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    reverse: true,
                    min: 1,
                    max: Math.max(5, totalConsultores),
                    ticks: {
                        stepSize: 1,
                        callback: (val) => `${val}º`,
                        color: getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#94a3b8'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' }
                },
                x: {
                    ticks: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#94a3b8'
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// Event Listeners
selectConsultor.addEventListener('change', atualizarDashboard);
selectMes.addEventListener('change', atualizarDashboard);

btnChartBar.addEventListener('click', () => {
    tipoGrafico = 'bar';
    btnChartBar.classList.add('active');
    btnChartLine.classList.remove('active');
    atualizarDashboard();
});

btnChartLine.addEventListener('click', () => {
    tipoGrafico = 'line';
    btnChartLine.classList.add('active');
    btnChartBar.classList.remove('active');
    atualizarDashboard();
});

btnExportarConsultor.addEventListener('click', () => {
    if (dadosHistoricoConsultor.length === 0) {
        alert("Sem dados no período para exportar.");
        return;
    }
    const nome = consultorNomeDisplay.textContent;
    let csv = "data:text/csv;charset=utf-8,Data,Consultor,Vendas,Posicao\n";
    dadosHistoricoConsultor.forEach(d => {
        csv += `${d.data},"${nome}",${d.vendas},${d.posicao}\n`;
    });
    const encoded = encodeURI(csv);
    const link = document.createElement("a");
    link.href = encoded;
    link.download = `Desempenho_${nome}_${selectMes.value}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

carregarConsultores();