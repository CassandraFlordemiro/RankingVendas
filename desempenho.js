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

const temaSalvo = localStorage.getItem('ranking_tema_preferido') || 'default';
if (temaSalvo === 'dracula') document.body.classList.add('theme-dracula');
else if (temaSalvo === 'light') document.body.classList.add('theme-light');
else if (temaSalvo === 'refuturiza') document.body.classList.add('theme-refuturiza');

// Elementos DOM
const selectConsultor = document.getElementById('select-consultor');
const selectMes = document.getElementById('select-mes');
const nomeDisplay = document.getElementById('consultor-nome-display');
const avatarPlaceholder = document.getElementById('consultor-avatar-placeholder');
const avatarImg = document.getElementById('consultor-avatar-img');
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

const tbodyExtrato = document.getElementById('tbody-extrato');
const extratoQtdTotal = document.getElementById('extrato-qtd-total');

const btnChartBar = document.getElementById('btn-chart-bar');
const btnChartLine = document.getElementById('btn-chart-line');
const btnExportarConsultor = document.getElementById('btn-exportar-consultor');

let chartVendasInstance = null;
let chartPosicaoInstance = null;
let tipoGraficoVendas = 'bar';
let listaContratosConsultor = [];
let listaConsultores = [];

const agora = new Date();
const mesPadrao = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
if (selectMes && !selectMes.value) selectMes.value = mesPadrao;

const paramsUrl = new URLSearchParams(window.location.search);
let consultorIdAtual = paramsUrl.get('id');

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        inicializar();
    }
});

async function inicializar() {
    try {
        const snap = await getDocs(collection(db, "consultores"));
        selectConsultor.innerHTML = '';
        listaConsultores = [];

        snap.forEach(d => {
            const data = d.data();
            listaConsultores.push({
                id: d.id,
                nome: data.nome || "Consultor Sem Nome",
                foto: data.foto || "default"
            });
        });

        listaConsultores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

        listaConsultores.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nome;
            if (consultorIdAtual === c.id) opt.selected = true;
            selectConsultor.appendChild(opt);
        });

        if (!consultorIdAtual && listaConsultores.length > 0) {
            consultorIdAtual = listaConsultores[0].id;
            selectConsultor.value = consultorIdAtual;
        }

        carregarDadosConsultor();
    } catch (err) {
        console.error("Erro ao inicializar:", err);
    }
}

async function carregarDadosConsultor() {
    if (!consultorIdAtual) return;

    const consultorObj = listaConsultores.find(c => c.id === consultorIdAtual);
    const nomeConsultor = consultorObj ? consultorObj.nome : "Consultor";

    if (nomeDisplay) nomeDisplay.textContent = nomeConsultor;

    if (consultorObj && consultorObj.foto && consultorObj.foto !== "default") {
        avatarImg.src = consultorObj.foto;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
    } else {
        avatarPlaceholder.textContent = nomeConsultor.charAt(0).toUpperCase();
        avatarPlaceholder.style.display = 'flex';
        avatarImg.style.display = 'none';
    }

    processarMetricasMes(nomeConsultor);
}

async function processarMetricasMes(nomeConsultor) {
    const mesEscolhido = selectMes ? selectMes.value : mesPadrao;

    try {
        const qVendas = query(
            collection(db, "vendas"),
            where("mesRef", "==", mesEscolhido)
        );
        const snapVendas = await getDocs(qVendas);

        const todasVendasMes = [];
        listaContratosConsultor = [];

        snapVendas.forEach(d => {
            const v = { id: d.id, ...d.data() };
            todasVendasMes.push(v);
            if (v.consultorNome === nomeConsultor) {
                listaContratosConsultor.push(v);
            }
        });

        // 1. Mapear todas as datas do mês
        const setDatas = new Set();
        todasVendasMes.forEach(v => {
            if (v.data) setDatas.add(v.data);
        });
        const datasOrdenadas = Array.from(setDatas).sort();

        // 2. Contabilizar vendas diárias e ranking por dia
        const vendasPorDia = {};
        const rankingPorDia = {};

        datasOrdenadas.forEach(d => {
            vendasPorDia[d] = 0;
            rankingPorDia[d] = {};
        });

        todasVendasMes.forEach(v => {
            if (v.status === "CONCLUIDO" && v.data) {
                const cNome = v.consultorNome;
                rankingPorDia[v.data][cNome] = (rankingPorDia[v.data][cNome] || 0) + 1;
                if (cNome === nomeConsultor) {
                    vendasPorDia[v.data] = (vendasPorDia[v.data] || 0) + 1;
                }
            }
        });

        // 3. Montar dados para os Gráficos
        const labelsDias = [];
        const dadosVendas = [];
        const dadosPosicoes = [];

        let totalConcluidas = 0;
        let diasComVenda = 0;
        let diasNoPodio = 0;
        let melhorQtd = -1;
        let melhorDataStr = "-";
        let piorQtd = 999999;
        let piorDataStr = "-";

        datasOrdenadas.forEach(d => {
            const p = d.split('-');
            const diaFormatado = `${p[2]}/${p[1]}`;
            labelsDias.push(diaFormatado);

            const qtdDia = vendasPorDia[d] || 0;
            dadosVendas.push(qtdDia);
            totalConcluidas += qtdDia;

            if (qtdDia > 0) diasComVenda++;

            // Posição no dia
            const rankingDiaOrdenado = Object.entries(rankingPorDia[d]).sort((a, b) => b[1] - a[1]);
            const index = rankingDiaOrdenado.findIndex(item => item[0] === nomeConsultor);
            const posDia = index >= 0 ? (index + 1) : rankingDiaOrdenado.length + 1;

            dadosPosicoes.push(qtdDia > 0 ? posDia : null);

            if (posDia <= 3 && qtdDia > 0) {
                diasNoPodio++;
            }

            if (qtdDia > melhorQtd && qtdDia > 0) {
                melhorQtd = qtdDia;
                melhorDataStr = `${diaFormatado} (${qtdDia})`;
            }

            if (qtdDia < piorQtd && qtdDia > 0) {
                piorQtd = qtdDia;
                piorDataStr = `${diaFormatado} (${qtdDia})`;
            }
        });

        const totalCiclos = datasOrdenadas.length;
        const mediaPorCiclo = totalCiclos > 0 ? (totalConcluidas / totalCiclos).toFixed(1) : "0.0";
        const diasZerados = totalCiclos - diasComVenda;
        const pctPodio = totalCiclos > 0 ? Math.round((diasNoPodio / totalCiclos) * 100) : 0;
        const pctAtivos = totalCiclos > 0 ? Math.round((diasComVenda / totalCiclos) * 100) : 0;

        if (kpiTotalVendas) kpiTotalVendas.textContent = totalConcluidas;
        if (kpiMediaVendas) kpiMediaVendas.textContent = mediaPorCiclo;
        if (kpiMelhorDia) kpiMelhorDia.textContent = melhorQtd > 0 ? melhorDataStr : "-";
        if (kpiPiorDia) kpiPiorDia.textContent = piorQtd !== 999999 ? piorDataStr : "-";

        if (kpiPodioDias) kpiPodioDias.textContent = `${diasNoPodio} dias`;
        if (kpiPodioPorcentagem) kpiPodioPorcentagem.textContent = `${pctPodio}% dos ciclos`;
        if (kpiAtivosDias) kpiAtivosDias.textContent = `${diasComVenda} dias`;
        if (kpiAtivosPorcentagem) kpiAtivosPorcentagem.textContent = `${pctAtivos}% dos ciclos`;
        if (kpiZeradosDias) kpiZeradosDias.textContent = `${diasZerados} dias`;

        // 4. Posição Geral no Mês
        const acumuladoGeral = {};
        todasVendasMes.forEach(v => {
            if (v.status === "CONCLUIDO") {
                acumuladoGeral[v.consultorNome] = (acumuladoGeral[v.consultorNome] || 0) + 1;
            }
        });

        const rankingGeralOrdenado = Object.keys(acumuladoGeral).sort((a, b) => acumuladoGeral[b] - acumuladoGeral[a]);
        const posicaoMes = rankingGeralOrdenado.indexOf(nomeConsultor) + 1;

        if (badgePosicaoContainer) {
            badgePosicaoContainer.textContent = posicaoMes > 0 ? `${posicaoMes}º Lugar Geral no Mês` : 'Sem classificação';
        }

        renderizarGraficoVendas(labelsDias, dadosVendas, nomeConsultor);
        renderizarGraficoPosicoes(labelsDias, dadosPosicoes, nomeConsultor);
        renderizarExtratoClientes();
    } catch (err) {
        console.error("Erro ao processar métricas do consultor:", err);
    }
}

function renderizarGraficoVendas(labels, data, nome) {
    const canvas = document.getElementById('meuGrafico');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartVendasInstance) chartVendasInstance.destroy();

    chartVendasInstance = new Chart(ctx, {
        type: tipoGraficoVendas,
        data: {
            labels: labels,
            datasets: [{
                label: `Vendas de ${nome}`,
                data: data,
                backgroundColor: tipoGraficoVendas === 'bar' ? '#38bdf8' : 'rgba(56, 189, 248, 0.15)',
                borderColor: '#38bdf8',
                borderWidth: 2,
                borderRadius: 5,
                tension: 0.35,
                fill: tipoGraficoVendas === 'line',
                pointRadius: tipoGraficoVendas === 'line' ? 3 : undefined
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

function renderizarGraficoPosicoes(labels, dataPosicoes, nome) {
    const canvas = document.getElementById('graficoPosicao');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartPosicaoInstance) chartPosicaoInstance.destroy();

    chartPosicaoInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Posição de ${nome}`,
                data: dataPosicoes,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.3,
                spanGaps: true,
                pointRadius: 4,
                pointBackgroundColor: '#10b981',
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.raw}º Lugar`
                    }
                }
            },
            scales: {
                y: {
                    reverse: true, // 1º Lugar no topo
                    beginAtZero: false,
                    min: 1,
                    ticks: {
                        stepSize: 1,
                        color: '#94a3b8',
                        callback: (v) => `${v}º`
                    },
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

function renderizarExtratoClientes() {
    if (!tbodyExtrato) return;
    tbodyExtrato.innerHTML = '';

    listaContratosConsultor.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    if (extratoQtdTotal) {
        extratoQtdTotal.textContent = `${listaContratosConsultor.length} contratos`;
    }

    if (listaContratosConsultor.length === 0) {
        tbodyExtrato.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum contrato registrado para este mês.</td></tr>`;
        return;
    }

    listaContratosConsultor.forEach(item => {
        const partes = (item.data || '').split('-');
        const dataBr = partes.length === 3 ? `${partes[2]}/${partes[1]}` : (item.data || '-');

        const tagTipo = item.tipo === 'REFILIACAO'
            ? `<span class="badge-tag badge-refiliacao">REFILIAÇÃO</span>`
            : `<span class="badge-tag badge-filiacao">FILIAÇÃO</span>`;

        let tagMod = `<span class="badge-tag badge-credito">CRÉDITO</span>`;
        if (item.modalidade === 'DÉBITO') tagMod = `<span class="badge-tag badge-debito">DÉBITO</span>`;
        else if (item.modalidade === 'BOLETO') tagMod = `<span class="badge-tag badge-boleto">BOLETO</span>`;

        const tagStatus = item.status === 'CONCLUIDO'
            ? `<span class="badge-tag badge-concluido">CONCLUÍDO</span>`
            : `<span class="badge-tag badge-retido">NÃO CONCLUÍDO</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: var(--text-muted); font-size: 0.82rem;">${dataBr}</td>
            <td style="font-family: monospace; font-weight: 700;">${item.matricula || '-'}</td>
            <td style="font-weight: 600;">${item.clienteNome || 'Cliente'}</td>
            <td style="text-align: center;">${tagTipo}</td>
            <td style="text-align: center;">${tagMod}</td>
            <td style="text-align: center;">${tagStatus}</td>
        `;
        tbodyExtrato.appendChild(tr);
    });
}

if (btnChartBar) {
    btnChartBar.addEventListener('click', () => {
        tipoGraficoVendas = 'bar';
        btnChartBar.classList.add('active');
        if (btnChartLine) btnChartLine.classList.remove('active');
        carregarDadosConsultor();
    });
}

if (btnChartLine) {
    btnChartLine.addEventListener('click', () => {
        tipoGraficoVendas = 'line';
        btnChartLine.classList.add('active');
        if (btnChartBar) btnChartBar.classList.remove('active');
        carregarDadosConsultor();
    });
}

if (selectConsultor) {
    selectConsultor.addEventListener('change', (e) => {
        consultorIdAtual = e.target.value;
        carregarDadosConsultor();
    });
}

if (selectMes) {
    selectMes.addEventListener('change', carregarDadosConsultor);
}

if (btnExportarConsultor) {
    btnExportarConsultor.addEventListener('click', () => {
        if (listaContratosConsultor.length === 0) return;
        let csv = "data:text/csv;charset=utf-8,Data,Matricula,Cliente,Tipo,Modalidade,Status\n";
        listaContratosConsultor.forEach(d => {
            csv += `"${d.data}","${d.matricula}","${d.clienteNome}","${d.tipo}","${d.modalidade}","${d.status}"\n`;
        });
        const link = document.createElement("a");
        link.href = encodeURI(csv);
        link.download = `Extrato_${nomeDisplay.textContent}_${selectMes.value}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}