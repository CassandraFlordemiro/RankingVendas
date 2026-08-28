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
const selectMes = document.getElementById('select-mes-comparativo');
const deckContainer = document.getElementById('deck-consultores-container');
const btnDeckMarcar = document.getElementById('btn-deck-marcar-todos');
const btnDeckDesmarcar = document.getElementById('btn-deck-desmarcar-todos');

const kpiTotalEquipe = document.getElementById('kpi-total-equipe');
const kpiMediaEquipe = document.getElementById('kpi-media-equipe');
const kpiMvpNome = document.getElementById('kpi-mvp-nome');
const kpiCiclosQtd = document.getElementById('kpi-ciclos-qtd');
const kpiRetidosQtd = document.getElementById('kpi-retidos-qtd');

const tbodyRankingComparativo = document.getElementById('tbody-ranking-comparativo');
const contadorTabelaConsultores = document.getElementById('contador-tabela-consultores');

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
let todasVendasMes = [];
let vendasConcluidasMes = [];
let vendasNaoConcluidasMes = [];
let tipoGraficoEvolucao = 'bar';

let chartBarras = null;
let chartDonut = null;
let chartEvolucao = null;

const agora = new Date();
const mesAnoAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
if (selectMes && !selectMes.value) selectMes.value = mesAnoAtual;

const CORES_PALETA = [
    '#38bdf8', '#10b981', '#f59e0b', '#a855f7', '#ec4899', 
    '#06b6d4', '#84cc16', '#eab308', '#6366f1', '#14b8a6', 
    '#f97316', '#0284c7', '#059669', '#ef4444', '#d946ef'
];

// SVGs das Medalhas
const MEDALHA_OURO_SVG = `
<svg class="medalha-svg-box" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="16" fill="url(#grad-ouro)" stroke="#f59e0b" stroke-width="2"/>
    <path d="M14 12H18V24H15V14H14V12Z" fill="#78350f" font-weight="bold"/>
    <circle cx="18" cy="18" r="13" stroke="#fef08a" stroke-width="1.2" stroke-dasharray="2 2"/>
    <defs>
        <linearGradient id="grad-ouro" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stop-color="#fef08a"/>
            <stop offset="0.5" stop-color="#fbbf24"/>
            <stop offset="1" stop-color="#d97706"/>
        </linearGradient>
    </defs>
</svg>`;

const MEDALHA_PRATA_SVG = `
<svg class="medalha-svg-box" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="16" fill="url(#grad-prata)" stroke="#94a3b8" stroke-width="2"/>
    <path d="M13.5 14C13.5 12.5 15 11.5 17.5 11.5C20 11.5 21.5 12.5 21.5 14C21.5 16 19 18 14 22V24H22V21.5H17L19.5 19C21.5 17 22.5 15.5 22.5 14C22.5 11.5 20.5 10 17.5 10C14.5 10 12.5 11.5 12.5 14H13.5Z" fill="#334155"/>
    <circle cx="18" cy="18" r="13" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="2 2"/>
    <defs>
        <linearGradient id="grad-prata" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stop-color="#ffffff"/>
            <stop offset="0.5" stop-color="#cbd5e1"/>
            <stop offset="1" stop-color="#64748b"/>
        </linearGradient>
    </defs>
</svg>`;

const MEDALHA_BRONZE_SVG = `
<svg class="medalha-svg-box" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="16" fill="url(#grad-bronze)" stroke="#b45309" stroke-width="2"/>
    <path d="M13 12H21V14.5L16.5 17.5C18.5 17.5 21.5 18.5 21.5 21C21.5 23.5 19 24.5 17 24.5C14 24.5 12.5 23 12.5 21.5H14C14 22.5 15 23.2 17 23.2C19 23.2 20 22.2 20 21C20 19.5 18.5 18.8 16.5 18.8H15V17L19.5 13.5H13V12Z" fill="#451a03"/>
    <circle cx="18" cy="18" r="13" stroke="#fed7aa" stroke-width="1.2" stroke-dasharray="2 2"/>
    <defs>
        <linearGradient id="grad-bronze" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stop-color="#ffedd5"/>
            <stop offset="0.5" stop-color="#fb923c"/>
            <stop offset="1" stop-color="#c2410c"/>
        </linearGradient>
    </defs>
</svg>`;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        carregarConsultores();
    }
});

async function carregarConsultores() {
    try {
        const snap = await getDocs(collection(db, "consultores"));
        listaConsultoresGeral = [];
        
        snap.forEach(d => {
            const data = d.data();
            listaConsultoresGeral.push({
                id: d.id,
                nome: data.nome || "Consultor Sem Nome",
                foto: data.foto || "default",
                ativo: data.ativo !== false
            });
        });

        listaConsultoresGeral.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

        consultoresAtivosDeck.clear();
        listaConsultoresGeral.forEach(c => consultoresAtivosDeck.add(c.nome));

        renderizarDeckConsultores();
        await carregarDadosMes();
    } catch (err) {
        console.error("Erro ao carregar consultores:", err);
    }
}

function renderizarDeckConsultores() {
    if (!deckContainer) return;
    deckContainer.innerHTML = '';

    if (listaConsultoresGeral.length === 0) {
        deckContainer.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted); padding: 8px;">Nenhum consultor encontrado.</span>`;
        return;
    }

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

if (btnDeckMarcar) {
    btnDeckMarcar.addEventListener('click', () => {
        listaConsultoresGeral.forEach(c => consultoresAtivosDeck.add(c.nome));
        renderizarDeckConsultores();
        atualizarVisualizacoesDashboard();
    });
}

if (btnDeckDesmarcar) {
    btnDeckDesmarcar.addEventListener('click', () => {
        consultoresAtivosDeck.clear();
        renderizarDeckConsultores();
        atualizarVisualizacoesDashboard();
    });
}

async function carregarDadosMes() {
    const mesEscolhido = selectMes ? selectMes.value : mesAnoAtual;

    try {
        const qVendas = query(
            collection(db, "vendas"),
            where("mesRef", "==", mesEscolhido)
        );
        const snapVendas = await getDocs(qVendas);

        todasVendasMes = [];
        vendasConcluidasMes = [];
        vendasNaoConcluidasMes = [];

        snapVendas.forEach(d => {
            const v = { id: d.id, ...d.data() };
            todasVendasMes.push(v);
            if (v.status === "CONCLUIDO") {
                vendasConcluidasMes.push(v);
            } else {
                vendasNaoConcluidasMes.push(v);
            }
        });

        if (kpiRetidosQtd) kpiRetidosQtd.textContent = vendasNaoConcluidasMes.length;

        atualizarVisualizacoesDashboard();
    } catch (err) {
        console.error("Erro ao carregar dados de vendas do mês:", err);
    }
}

function atualizarVisualizacoesDashboard() {
    const estatisticasPorConsultor = {};
    const diasUnicos = new Set();
    let volumeTotalGeral = 0;

    consultoresAtivosDeck.forEach(nome => {
        estatisticasPorConsultor[nome] = {
            nome: nome,
            concluidas: 0,
            retidas: 0,
            totalGeral: 0,
            filiacao: 0,
            refiliacao: 0,
            credito: 0,
            debito: 0,
            boleto: 0,
            diasAtivos: new Set()
        };
    });

    todasVendasMes.forEach(v => {
        const nome = v.consultorNome;
        if (consultoresAtivosDeck.has(nome)) {
            const stats = estatisticasPorConsultor[nome];
            stats.totalGeral++;

            if (v.status === "CONCLUIDO") {
                stats.concluidas++;
                volumeTotalGeral++;
                if (v.data) {
                    diasUnicos.add(v.data);
                    stats.diasAtivos.add(v.data);
                }

                if (v.tipo === "REFILIACAO") stats.refiliacao++;
                else stats.filiacao++;

                if (v.modalidade === "DÉBITO") stats.debito++;
                else if (v.modalidade === "BOLETO") stats.boleto++;
                else stats.credito++;
            } else {
                stats.retidas++;
            }
        }
    });

    const listaStats = Object.values(estatisticasPorConsultor).sort((a, b) => b.concluidas - a.concluidas);
    const listaGraficos = listaStats.map(s => [s.nome, s.concluidas]).filter(i => i[1] > 0);

    const qtdConsultoresAtivos = consultoresAtivosDeck.size;
    const media = qtdConsultoresAtivos > 0 ? (volumeTotalGeral / qtdConsultoresAtivos).toFixed(1) : "0.0";
    const mvpTexto = listaStats.length > 0 && listaStats[0].concluidas > 0 ? `${listaStats[0].nome} (${listaStats[0].concluidas})` : "-";

    if (kpiTotalEquipe) kpiTotalEquipe.textContent = volumeTotalGeral;
    if (kpiMediaEquipe) kpiMediaEquipe.textContent = media;
    if (kpiMvpNome) kpiMvpNome.textContent = mvpTexto;
    if (kpiCiclosQtd) kpiCiclosQtd.textContent = `${diasUnicos.size} dias`;

    renderizarGraficoBarras(listaGraficos);
    renderizarGraficoDonut(listaGraficos, volumeTotalGeral);
    renderizarGraficoEvolucao(listaStats);
    renderizarTabelaComparativa(listaStats, diasUnicos.size);
}

function renderizarTabelaComparativa(listaStats, totalCiclosMes) {
    if (!tbodyRankingComparativo) return;
    tbodyRankingComparativo.innerHTML = '';

    if (contadorTabelaConsultores) {
        contadorTabelaConsultores.textContent = `${listaStats.length} consultores ativos`;
    }

    if (listaStats.length === 0) {
        tbodyRankingComparativo.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum consultor selecionado no deck.</td></tr>`;
        return;
    }

    listaStats.forEach((s, idx) => {
        const posicao = idx + 1;
        
        let medalhaHtml = `<span class="badge-posicao-num">${posicao}º</span>`;
        if (posicao === 1 && s.concluidas > 0) medalhaHtml = MEDALHA_OURO_SVG;
        else if (posicao === 2 && s.concluidas > 0) medalhaHtml = MEDALHA_PRATA_SVG;
        else if (posicao === 3 && s.concluidas > 0) medalhaHtml = MEDALHA_BRONZE_SVG;

        const mediaDiaria = totalCiclosMes > 0 ? (s.concluidas / totalCiclosMes).toFixed(1) : "0.0";
        const taxaEfetivacao = s.totalGeral > 0 ? Math.round((s.concluidas / s.totalGeral) * 100) : 100;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;">${medalhaHtml}</td>
            <td style="font-weight: 700; color: #38bdf8; font-size: 0.94rem;">${s.nome}</td>
            <td style="text-align: center; font-weight: 800; font-size: 1.05rem; color: var(--text-main);">${s.concluidas}</td>
            <td style="text-align: center; color: var(--text-muted); font-weight: 700; font-size: 0.9rem;">${mediaDiaria}</td>
            <td style="text-align: center;">
                <span class="pill-mix pill-filiacao-table">${s.filiacao} F</span>
                <span style="color: var(--box-border); margin: 0 4px; opacity: 0.5;">|</span>
                <span class="pill-mix pill-refiliacao-table">${s.refiliacao} R</span>
            </td>
            <td style="text-align: center;">
                <span class="pill-mix pill-credito-table">${s.credito} C</span>
                <span style="color: var(--box-border); margin: 0 3px; opacity: 0.5;">•</span>
                <span class="pill-mix pill-debito-table">${s.debito} D</span>
                <span style="color: var(--box-border); margin: 0 3px; opacity: 0.5;">•</span>
                <span class="pill-mix pill-boleto-table">${s.boleto} B</span>
            </td>
            <td style="text-align: center;">
                <span class="pill-taxa">${taxaEfetivacao}%</span>
            </td>
        `;
        tbodyRankingComparativo.appendChild(tr);
    });
}

function renderizarGraficoBarras(listaOrdenada) {
    const canvas = document.getElementById('graficoBarrasGeral');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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
    const canvas = document.getElementById('graficoDonutShare');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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

function renderizarGraficoEvolucao(listaStats = []) {
    const canvas = document.getElementById('graficoEvolucaoLinhas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartEvolucao) chartEvolucao.destroy();

    const setDatas = new Set();
    vendasConcluidasMes.forEach(v => {
        if (v.data) setDatas.add(v.data);
    });
    const datasOrdenadas = Array.from(setDatas).sort();

    const labelsDias = datasOrdenadas.map(d => {
        const p = d.split('-');
        return `${p[2]}/${p[1]}`;
    });

    const mapaConsultorDia = {};
    consultoresAtivosDeck.forEach(nome => {
        mapaConsultorDia[nome] = {};
        datasOrdenadas.forEach(d => mapaConsultorDia[nome][d] = 0);
    });

    vendasConcluidasMes.forEach(v => {
        if (consultoresAtivosDeck.has(v.consultorNome) && v.data) {
            mapaConsultorDia[v.consultorNome][v.data] = (mapaConsultorDia[v.consultorNome][v.data] || 0) + 1;
        }
    });

    const consultoresOrdenados = listaStats
        .filter(s => consultoresAtivosDeck.has(s.nome) && s.concluidas > 0)
        .map(s => s.nome);

    const datasets = consultoresOrdenados.map((nome, idx) => {
        const cor = CORES_PALETA[idx % CORES_PALETA.length];
        const dados = datasOrdenadas.map(d => mapaConsultorDia[nome][d]);

        return {
            label: nome,
            data: dados,
            backgroundColor: tipoGraficoEvolucao === 'bar' ? cor : `${cor}22`,
            borderColor: cor,
            borderWidth: 2,
            borderRadius: 4,
            tension: 0.3,
            fill: tipoGraficoEvolucao === 'line' ? false : undefined,
            pointRadius: tipoGraficoEvolucao === 'line' ? 3 : undefined,
            pointHoverRadius: 6
        };
    });

    chartEvolucao = new Chart(ctx, {
        type: tipoGraficoEvolucao,
        data: {
            labels: labelsDias,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        boxWidth: 12,
                        font: { size: 11, weight: 'bold' }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
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

if (btnEvolucaoBarras) {
    btnEvolucaoBarras.addEventListener('click', () => {
        tipoGraficoEvolucao = 'bar';
        atualizarVisualizacoesDashboard();
    });
}

if (btnEvolucaoLinhas) {
    btnEvolucaoLinhas.addEventListener('click', () => {
        tipoGraficoEvolucao = 'line';
        atualizarVisualizacoesDashboard();
    });
}

if (selectMes) {
    selectMes.addEventListener('change', carregarDadosMes);
}

// Modal Retidos
if (btnAbrirRetidos) {
    btnAbrirRetidos.addEventListener('click', () => {
        if (!tbodyRetidosModal) return;
        tbodyRetidosModal.innerHTML = '';
        if (modalRetidosSubtitulo) {
            modalRetidosSubtitulo.textContent = `${vendasNaoConcluidasMes.length} contratos não concluídos/retidos em ${selectMes.value}`;
        }

        if (vendasNaoConcluidasMes.length === 0) {
            tbodyRetidosModal.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum contrato retido encontrado neste mês.</td></tr>`;
        } else {
            vendasNaoConcluidasMes.forEach(v => {
                const tr = document.createElement('tr');
                const partes = (v.data || '').split('-');
                const dataBr = partes.length === 3 ? `${partes[2]}/${partes[1]}` : (v.data || '-');

                tr.innerHTML = `
                    <td style="color: var(--text-muted); font-size: 0.82rem;">${dataBr}</td>
                    <td style="font-family: monospace; font-weight: 700;">${v.matricula || '-'}</td>
                    <td style="font-weight: 600;">${v.clienteNome || 'Cliente'}</td>
                    <td style="font-weight: 700; color: #38bdf8;">${v.consultorNome || '-'}</td>
                    <td style="text-align: center;"><span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.15); color: #fbbf24;">${v.tipo || 'FILIACAO'}</span></td>
                    <td style="text-align: center;"><span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(168, 85, 247, 0.15); color: #c084fc;">${v.modalidade || 'OUTRO'}</span></td>
                `;
                tbodyRetidosModal.appendChild(tr);
            });
        }

        if (modalRetidos) modalRetidos.classList.add('active');
    });
}

if (btnFecharRetidos) {
    btnFecharRetidos.addEventListener('click', () => modalRetidos && modalRetidos.classList.remove('active'));
}

if (modalRetidos) {
    modalRetidos.addEventListener('click', (e) => {
        if (e.target === modalRetidos) modalRetidos.classList.remove('active');
    });
}

// Exportação CSV de Retidos
if (btnExportarRetidosCsv) {
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
}

// Exportação Geral Consolidada
if (btnExportarGeral) {
    btnExportarGeral.addEventListener('click', async () => {
        const mesEscolhido = selectMes ? selectMes.value : mesAnoAtual;
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
}