import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, collection, getDocs, doc, setDoc, writeBatch 
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
const inputSheetsUrl = document.getElementById('input-sheets-url');
const btnCarregarUrl = document.getElementById('btn-carregar-url');
const inputCsv = document.getElementById('input-csv');
const btnEscolherArquivo = document.getElementById('btn-escolher-arquivo');
const dropArea = document.getElementById('drop-area');

const cardFiltroConsultores = document.getElementById('card-filtro-consultores');
const gridChipsConsultores = document.getElementById('grid-chips-consultores');
const inputBuscaConsultor = document.getElementById('input-busca-consultor');
const btnMarcarTodos = document.getElementById('btn-marcar-todos');
const btnDesmarcarTodos = document.getElementById('btn-desmarcar-todos');

const summaryContainer = document.getElementById('summary-container');
const previewCard = document.getElementById('preview-card');
const tbodyPreview = document.getElementById('tbody-preview');
const btnInjetar = document.getElementById('btn-injetar-banco');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const checkResetTotal = document.getElementById('check-reset-total');

// Controles de Paginação
const btnVerMais = document.getElementById('btn-ver-mais');
const btnVerTudo = document.getElementById('btn-ver-tudo');
const btnRecolher = document.getElementById('btn-recolher');
const statusExibicaoLinhas = document.getElementById('status-exibicao-linhas');
const contadorLinhasFooter = document.getElementById('contador-linhas-footer');

// Modal Customizado
const modalConfirmacao = document.getElementById('modal-confirmacao');
const modalConfTitulo = document.getElementById('modal-conf-titulo');
const modalConfMensagem = document.getElementById('modal-conf-mensagem');
const modalConfIcone = document.getElementById('modal-conf-icone');
const btnConfCancelar = document.getElementById('btn-conf-cancelar');
const btnConfConfirmar = document.getElementById('btn-conf-confirmar');
let callbackConfirmacao = null;

function exibirModalCustomizado({ titulo, mensagem, icone = "⚠️", textoBotao = "Confirmar", corBotao = "#ef4444", apenasAviso = false, onConfirmar = null }) {
    modalConfTitulo.textContent = titulo;
    modalConfMensagem.textContent = mensagem;
    modalConfIcone.textContent = icone;
    btnConfConfirmar.textContent = textoBotao;
    btnConfConfirmar.style.backgroundColor = corBotao;
    
    if (apenasAviso) {
        btnConfCancelar.style.display = 'none';
        callbackConfirmacao = onConfirmar;
    } else {
        btnConfCancelar.style.display = 'block';
        callbackConfirmacao = onConfirmar;
    }
    
    modalConfirmacao.classList.add('active');
}

function fecharModalCustomizado() {
    modalConfirmacao.classList.remove('active');
    callbackConfirmacao = null;
}

btnConfCancelar.addEventListener('click', fecharModalCustomizado);
btnConfConfirmar.addEventListener('click', () => {
    if (callbackConfirmacao) callbackConfirmacao();
    fecharModalCustomizado();
});

modalConfirmacao.addEventListener('click', (e) => {
    if (e.target === modalConfirmacao) fecharModalCustomizado();
});

let todasVendasBrutas = [];
let mapaContagemConsultores = new Map();
let consultoresSelecionados = new Set();
let limiteExibicao = 60;

function encurtarNome(nomeCompleto) {
    if (!nomeCompleto) return "Não Identificado";
    
    let limpo = nomeCompleto.trim();
    const preposicoes = ["de", "da", "do", "dos", "das", "e"];
    const partes = limpo.split(/\s+/).filter(p => p.length > 0);

    if (partes.length === 1) return formatarPalavra(partes[0]);

    const primeiroNome = formatarPalavra(partes[0]);
    let segundoNome = "";
    for (let i = 1; i < partes.length; i++) {
        const palavra = partes[i].toLowerCase();
        if (!preposicoes.includes(palavra)) {
            segundoNome = formatarPalavra(partes[i]);
            break;
        }
    }

    return segundoNome ? `${primeiroNome} ${segundoNome}` : primeiroNome;
}

function formatarPalavra(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function padronizarData(strData) {
    if (!strData) return "";
    strData = strData.trim();
    if (strData.includes('/')) {
        const partes = strData.split('/');
        if (partes.length === 3) {
            const dia = partes[0].padStart(2, '0');
            const mes = partes[1].padStart(2, '0');
            const ano = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
            return `${ano}-${mes}-${dia}`;
        }
    }
    return strData;
}

// Leitura via Arquivo Local
btnEscolherArquivo.addEventListener('click', () => inputCsv.click());
inputCsv.addEventListener('change', (e) => {
    if (e.target.files.length > 0) lerArquivoCsv(e.target.files[0]);
});

dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = '#3b82f6';
});

dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = 'var(--box-border)';
    if (e.dataTransfer.files.length > 0) lerArquivoCsv(e.dataTransfer.files[0]);
});

function lerArquivoCsv(arquivo) {
    const reader = new FileReader();
    reader.onload = (e) => processarCsvTexto(e.target.result);
    reader.readAsText(arquivo, 'UTF-8');
}

// Leitura via Link
btnCarregarUrl.addEventListener('click', async () => {
    const url = inputSheetsUrl.value.trim();
    if (!url) {
        return exibirModalCustomizado({
            titulo: "Link Necessário",
            mensagem: "Por favor, cole o link da planilha do Google Sheets no campo correspondente.",
            icone: "🔗",
            textoBotao: "Entendido",
            corBotao: "#3b82f6",
            apenasAviso: true
        });
    }

    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
        return exibirModalCustomizado({
            titulo: "Link Inválido",
            mensagem: "O link fornecido não corresponde a uma planilha do Google Sheets válida.",
            icone: "⚠️",
            textoBotao: "Corrigir",
            corBotao: "#ef4444",
            apenasAviso: true
        });
    }

    const sheetId = match[1];
    const gidMatch = url.match(/gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : "0";

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    btnCarregarUrl.disabled = true;
    btnCarregarUrl.textContent = "Baixando dados...";

    try {
        const response = await fetch(exportUrl);
        if (!response.ok) throw new Error("Não foi possível acessar a planilha. Verifique se o compartilhamento está como 'Qualquer pessoa com o link'.");
        const textoCsv = await response.text();
        processarCsvTexto(textoCsv);
    } catch (err) {
        exibirModalCustomizado({
            titulo: "Erro de Acesso",
            mensagem: err.message || "Não foi possível carregar os dados pelo link. Baixe em CSV e selecione o arquivo.",
            icone: "⚠️",
            textoBotao: "Ok",
            corBotao: "#ef4444",
            apenasAviso: true
        });
    } finally {
        btnCarregarUrl.disabled = false;
        btnCarregarUrl.textContent = "📥 Puxar Dados do Link";
    }
});

function processarCsvTexto(conteudo) {
    const linhas = conteudo.split(/\r\n|\n/).filter(l => l.trim() !== "");
    if (linhas.length < 2) {
        return exibirModalCustomizado({
            titulo: "Planilha Vazia",
            mensagem: "O arquivo CSV não possui dados suficientes para importação.",
            icone: "📄",
            textoBotao: "Ok",
            corBotao: "#ef4444",
            apenasAviso: true
        });
    }

    todasVendasBrutas = [];
    mapaContagemConsultores = new Map();
    limiteExibicao = 60;
    if (inputBuscaConsultor) inputBuscaConsultor.value = "";

    const primeiraLinha = linhas[0];
    let sep = ",";
    if (primeiraLinha.includes(";")) sep = ";";
    else if (primeiraLinha.includes("\t")) sep = "\t";

    for (let i = 1; i < linhas.length; i++) {
        const colunas = linhas[i].split(sep).map(c => c.replace(/^"|"$/g, '').trim());
        if (colunas.length < 4) continue;

        let matricula = colunas[0] || `SEM_MATRICULA_${i}`;
        let clienteBruto = colunas[1] || "";
        let dataOriginal = colunas[2] || "";
        let vendedorBruto = colunas[3] || "NÃO IDENTIFICADO";
        let prospec = (colunas[4] || "FILIAÇÃO").toUpperCase();
        let modalidade = (colunas[5] || "CRÉDITO").toUpperCase();
        let statusBruto = (colunas[6] || "CONCLUÍDO").toUpperCase();

        const dataFormatada = padronizarData(dataOriginal);
        if (!dataFormatada || !vendedorBruto) continue;

        const consultorTratado = encurtarNome(vendedorBruto);
        const clienteTratado = clienteBruto ? encurtarNome(clienteBruto) : "Cliente";

        let modalidadeFinal = "CRÉDITO";
        if (modalidade.includes("DÉB") || modalidade.includes("DEB")) modalidadeFinal = "DÉBITO";
        else if (modalidade.includes("BOL")) modalidadeFinal = "BOLETO";
        else if (modalidade.includes("CRÉD") || modalidade.includes("CRED")) modalidadeFinal = "CRÉDITO";
        else modalidadeFinal = "NÃO INFORMADO";

        const statusFinal = statusBruto.includes("NÃO") || statusBruto.includes("NAO") || statusBruto.includes("CANCEL")
            ? "NAO_CONCLUIDO"
            : "CONCLUIDO";

        mapaContagemConsultores.set(
            consultorTratado, 
            (mapaContagemConsultores.get(consultorTratado) || 0) + 1
        );

        todasVendasBrutas.push({
            matricula: matricula,
            clienteNome: clienteTratado,
            data: dataFormatada,
            mesRef: dataFormatada.substring(0, 7),
            consultorNome: consultorTratado,
            tipo: prospec.includes("REFILI") ? "REFILIACAO" : "FILIACAO",
            modalidade: modalidadeFinal,
            status: statusFinal,
            importadoEm: Date.now()
        });
    }

    consultoresSelecionados.clear();
    for (const [nome] of mapaContagemConsultores.entries()) {
        const upper = nome.toUpperCase();
        if (!upper.includes("WEB") && !upper.includes("SITE") && !upper.includes("DIGITAL") && !upper.includes("B2B")) {
            consultoresSelecionados.add(nome);
        }
    }

    renderizarSeletorConsultores();
    aplicarFiltroEExibir();
}

function renderizarSeletorConsultores() {
    gridChipsConsultores.innerHTML = '';
    cardFiltroConsultores.style.display = 'flex';

    const termoBusca = inputBuscaConsultor ? inputBuscaConsultor.value.trim().toLowerCase() : "";
    const listaOrdenada = Array.from(mapaContagemConsultores.entries()).sort((a, b) => b[1] - a[1]);

    listaOrdenada.forEach(([nome, total]) => {
        if (termoBusca && !nome.toLowerCase().includes(termoBusca)) return;

        const estaSelecionado = consultoresSelecionados.has(nome);

        const chip = document.createElement('div');
        chip.className = `consultor-chip-label ${estaSelecionado ? 'active' : 'excluded'}`;
        chip.setAttribute('data-nome', nome);
        chip.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${estaSelecionado ? 'checked' : ''} style="accent-color: #38bdf8; cursor: pointer;">
                <span style="font-weight: 700;">${nome}</span>
            </div>
            <span class="chip-count">${total} vendas</span>
        `;

        chip.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = chip.querySelector('input');
                cb.checked = !cb.checked;
            }
            const marcado = chip.querySelector('input').checked;
            if (marcado) {
                consultoresSelecionados.add(nome);
                chip.classList.add('active');
                chip.classList.remove('excluded');
            } else {
                consultoresSelecionados.delete(nome);
                chip.classList.remove('active');
                chip.classList.add('excluded');
            }
            aplicarFiltroEExibir();
        });

        gridChipsConsultores.appendChild(chip);
    });
}

inputBuscaConsultor.addEventListener('input', renderizarSeletorConsultores);

btnMarcarTodos.addEventListener('click', () => {
    for (const [nome] of mapaContagemConsultores.entries()) {
        consultoresSelecionados.add(nome);
    }
    renderizarSeletorConsultores();
    aplicarFiltroEExibir();
});

btnDesmarcarTodos.addEventListener('click', () => {
    consultoresSelecionados.clear();
    renderizarSeletorConsultores();
    aplicarFiltroEExibir();
});

function obterVendasFiltradas() {
    return todasVendasBrutas.filter(v => consultoresSelecionados.has(v.consultorNome));
}

function aplicarFiltroEExibir() {
    const vendasValidas = obterVendasFiltradas();

    let concluidos = 0;
    let retidos = 0;
    let filiacoes = 0;
    let refiliacoes = 0;
    let debito = 0;
    let credito = 0;
    let boleto = 0;

    vendasValidas.forEach(v => {
        if (v.status === "CONCLUIDO") concluidos++;
        else retidos++;

        if (v.tipo === "REFILIACAO") refiliacoes++;
        else filiacoes++;

        if (v.modalidade === "DÉBITO") debito++;
        else if (v.modalidade === "BOLETO") boleto++;
        else credito++;
    });

    document.getElementById('sum-total-linhas').textContent = vendasValidas.length;
    document.getElementById('sum-consultores-qtd').textContent = consultoresSelecionados.size;
    document.getElementById('sum-status-concluido').textContent = concluidos;
    document.getElementById('sum-status-retido').textContent = retidos;
    document.getElementById('sum-filiacoes-qtd').textContent = filiacoes;
    document.getElementById('sum-refiliacoes-qtd').textContent = refiliacoes;
    document.getElementById('sum-debito-qtd').textContent = debito;
    document.getElementById('sum-credito-qtd').textContent = credito;
    document.getElementById('sum-boleto-qtd').textContent = boleto;

    summaryContainer.style.display = 'grid';
    previewCard.style.display = 'flex';

    renderizarPreviewTabela(vendasValidas);
}

function renderizarPreviewTabela(vendas) {
    tbodyPreview.innerHTML = '';
    const total = vendas.length;
    const exibidas = vendas.slice(0, limiteExibicao);

    exibidas.forEach((v, idx) => {
        const tr = document.createElement('tr');
        
        const partes = v.data.split('-');
        const dataBr = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : v.data;

        const tagTipo = v.tipo === 'REFILIACAO'
            ? `<span class="badge-tag badge-refiliacao">REFILIAÇÃO</span>`
            : `<span class="badge-tag badge-filiacao">FILIAÇÃO</span>`;

        let tagModalidade = `<span class="badge-tag badge-credito">CRÉDITO</span>`;
        if (v.modalidade === 'DÉBITO') tagModalidade = `<span class="badge-tag badge-debito">DÉBITO</span>`;
        else if (v.modalidade === 'BOLETO') tagModalidade = `<span class="badge-tag badge-boleto">BOLETO</span>`;

        const tagStatus = v.status === 'CONCLUIDO'
            ? `<span class="badge-tag badge-status-concluido">CONCLUÍDO</span>`
            : `<span class="badge-tag badge-status-retido">NÃO CONCLUÍDO</span>`;

        tr.innerHTML = `
            <td style="color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
            <td style="font-weight: 800; font-family: monospace; font-size: 0.88rem; color: var(--text-main);">${v.matricula}</td>
            <td style="font-weight: 600; color: var(--text-main);">${v.clienteNome}</td>
            <td style="text-align: center; font-weight: 600; color: var(--text-muted); font-size: 0.84rem;">${dataBr}</td>
            <td style="font-weight: 700; color: #38bdf8; font-size: 0.9rem;">${v.consultorNome}</td>
            <td style="text-align: center;">${tagTipo}</td>
            <td style="text-align: center;">${tagModalidade}</td>
            <td style="text-align: center;">${tagStatus}</td>
        `;
        tbodyPreview.appendChild(tr);
    });

    statusExibicaoLinhas.textContent = `Exibindo ${exibidas.length} de ${total} vendas filtradas`;
    contadorLinhasFooter.textContent = `${exibidas.length} de ${total} carregadas`;

    btnVerMais.style.display = exibidas.length < total ? 'inline-block' : 'none';
    btnVerTudo.style.display = exibidas.length < total ? 'inline-block' : 'none';
    btnRecolher.style.display = limiteExibicao > 60 ? 'inline-block' : 'none';
}

btnVerMais.addEventListener('click', () => {
    limiteExibicao += 60;
    renderizarPreviewTabela(obterVendasFiltradas());
});

btnVerTudo.addEventListener('click', () => {
    limiteExibicao = todasVendasBrutas.length;
    renderizarPreviewTabela(obterVendasFiltradas());
});

btnRecolher.addEventListener('click', () => {
    limiteExibicao = 60;
    renderizarPreviewTabela(obterVendasFiltradas());
});

async function limparColecao(nomeColecao) {
    const snap = await getDocs(collection(db, nomeColecao));
    const BATCH_SIZE = 400;
    const docsArray = snap.docs;

    for (let i = 0; i < docsArray.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = docsArray.slice(i, i + BATCH_SIZE);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
}

btnInjetar.addEventListener('click', () => {
    const vendasFinal = obterVendasFiltradas();

    if (vendasFinal.length === 0) {
        return exibirModalCustomizado({
            titulo: "Seleção Vazia",
            mensagem: "Nenhum consultor selecionado para gravação no banco de dados.",
            icone: "⚠️",
            textoBotao: "Entendido",
            corBotao: "#3b82f6",
            apenasAviso: true
        });
    }

    const deveResetar = checkResetTotal.checked;

    exibirModalCustomizado({
        titulo: deveResetar ? "Reset e Gravação Oficial" : "Confirmar Importação",
        mensagem: deveResetar 
            ? `O banco de dados de teste será APAGADO e substituído pelas ${vendasFinal.length} vendas de ${consultoresSelecionados.size} consultores selecionados. Deseja prosseguir?`
            : `Deseja gravar ${vendasFinal.length} vendas de ${consultoresSelecionados.size} consultores no banco atual?`,
        icone: deveResetar ? "⚠️" : "🚀",
        textoBotao: "Confirmar Gravação",
        corBotao: deveResetar ? "#ef4444" : "#10b981",
        onConfirmar: async () => {
            btnInjetar.disabled = true;
            btnInjetar.textContent = "Processando...";
            progressContainer.style.display = 'block';

            // 1. Reset
            if (deveResetar) {
                btnInjetar.textContent = "Limpando banco antigo...";
                await limparColecao("consultores");
                await limparColecao("historicos");
                await limparColecao("vendas");
                progressFill.style.width = "20%";
            }

            // 2. Cadastrar Consultores
            btnInjetar.textContent = "Cadastrando consultores selecionados...";
            const snapConsultores = await getDocs(collection(db, "consultores"));
            const mapaConsultores = new Map();
            snapConsultores.forEach(d => {
                mapaConsultores.set(d.data().nome.toUpperCase().trim(), d.id);
            });

            for (const nome of consultoresSelecionados) {
                const chaveBusca = nome.toUpperCase().trim();
                if (!mapaConsultores.has(chaveBusca)) {
                    const novoDoc = doc(collection(db, "consultores"));
                    await setDoc(novoDoc, {
                        nome: nome,
                        foto: "default",
                        vendas: 0,
                        ativo: true,
                        criadoEm: Date.now()
                    });
                    mapaConsultores.set(chaveBusca, novoDoc.id);
                }
            }
            progressFill.style.width = "40%";

            // 3. Gravar Vendas
            btnInjetar.textContent = "Gravando contratos detalhados...";
            const BATCH_SIZE = 400;
            const total = vendasFinal.length;

            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = vendasFinal.slice(i, i + BATCH_SIZE);

                chunk.forEach(v => {
                    const docRef = doc(collection(db, "vendas"));
                    const consultorId = mapaConsultores.get(v.consultorNome.toUpperCase().trim()) || "anonimo";
                    batch.set(docRef, {
                        ...v,
                        consultorId: consultorId
                    });
                });

                await batch.commit();
                const progresso = 40 + Math.round(((i + chunk.length) / total) * 35);
                progressFill.style.width = `${progresso}%`;
            }

            // 4. Consolidar Históricos Diários (Considerando Vendas Concluídas para Pontuação Oficial)
            btnInjetar.textContent = "Gerando fechamentos diários...";
            const agrupadoPorData = {};
            vendasFinal.forEach(v => {
                if (!agrupadoPorData[v.data]) agrupadoPorData[v.data] = {};
                const cNome = v.consultorNome;
                if (!agrupadoPorData[v.data][cNome]) {
                    agrupadoPorData[v.data][cNome] = {
                        id: mapaConsultores.get(cNome.toUpperCase().trim()) || cNome,
                        nome: cNome,
                        foto: "default",
                        vendas: 0,
                        filiacoes: 0,
                        refiliacoes: 0,
                        debito: 0,
                        credito: 0,
                        boleto: 0,
                        concluidas: 0,
                        naoConcluidas: 0
                    };
                }
                
                if (v.status === "CONCLUIDO") {
                    agrupadoPorData[v.data][cNome].vendas++;
                    agrupadoPorData[v.data][cNome].concluidas++;
                } else {
                    agrupadoPorData[v.data][cNome].naoConcluidas++;
                }

                if (v.tipo === "FILIACAO") agrupadoPorData[v.data][cNome].filiacoes++;
                else agrupadoPorData[v.data][cNome].refiliacoes++;

                if (v.modalidade === "DÉBITO") agrupadoPorData[v.data][cNome].debito++;
                else if (v.modalidade === "BOLETO") agrupadoPorData[v.data][cNome].boleto++;
                else agrupadoPorData[v.data][cNome].credito++;
            });

            for (const [dataCiclo, mapaRanking] of Object.entries(agrupadoPorData)) {
                const rankingArray = Object.values(mapaRanking).sort((a, b) => b.vendas - a.vendas);
                await setDoc(doc(db, "historicos", dataCiclo), {
                    dataCiclo: dataCiclo,
                    ultimaAtualizacao: Date.now(),
                    ranking: rankingArray
                });
            }

            progressFill.style.width = "100%";

            exibirModalCustomizado({
                titulo: "Sucesso!",
                mensagem: `${vendasFinal.length} vendas reais de ${consultoresSelecionados.size} consultores foram importadas e consolidadas com sucesso.`,
                icone: "✅",
                textoBotao: "Ir para o Painel",
                corBotao: "#10b981",
                apenasAviso: true,
                onConfirmar: () => {
                    window.location.href = "admin.html";
                }
            });
        }
    });
});