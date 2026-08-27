import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, getDoc, updateDoc, increment, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Trava de Segurança
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

// Gerenciador de Temas (Deep Blue, Dracula, Light, Refuturiza)
function aplicarTema(tema) {
    document.body.classList.remove('theme-dracula', 'theme-light', 'theme-refuturiza');
    if (tema === 'dracula') document.body.classList.add('theme-dracula');
    else if (tema === 'light') document.body.classList.add('theme-light');
    else if (tema === 'refuturiza') document.body.classList.add('theme-refuturiza');
    localStorage.setItem('ranking_tema_preferido', tema);
}

const temaSalvo = localStorage.getItem('ranking_tema_preferido') || 'default';
aplicarTema(temaSalvo);

document.querySelectorAll('.theme-option-btn').forEach(botao => {
    botao.addEventListener('click', (e) => {
        aplicarTema(e.currentTarget.getAttribute('data-theme'));
    });
});

// Elementos DOM
const listaAdmin = document.getElementById('lista-admin');
const listaRanking = document.getElementById('lista-ranking');
const inputNovoNome = document.getElementById('novo-nome');
const btnAdicionar = document.getElementById('btn-adicionar');

// Sidebar e Modais
const btnAbrirMenu = document.getElementById('btn-abrir-menu');
const btnFecharMenu = document.getElementById('btn-fechar-menu');
const sidebarDrawer = document.getElementById('sidebar-drawer');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnMenuLogout = document.getElementById('btn-menu-logout');

const modalGerenciar = document.getElementById('modal-gerenciar');
const btnMenuUsuarios = document.getElementById('btn-menu-usuarios');
const btnFecharModal = document.getElementById('btn-fechar-modal');
const listaGerenciar = document.getElementById('lista-gerenciar');

const modalEditar = document.getElementById('modal-editar');
const btnFecharEditar = document.getElementById('btn-fechar-editar');
const formEditar = document.getElementById('form-editar-consultor');
const editId = document.getElementById('edit-consultor-id');
const editNome = document.getElementById('edit-nome');
const editFoto = document.getElementById('edit-foto');
const editPreviewFoto = document.getElementById('edit-preview-foto');
const btnSalvarEdicao = document.getElementById('btn-salvar-edicao');

const modalHistorico = document.getElementById('modal-historico');
const btnMenuHistorico = document.getElementById('btn-menu-historico');
const btnFecharHistorico = document.getElementById('btn-fechar-historico');
const filtroDataHistorico = document.getElementById('filtro-data-historico');
const listaHistoricoRanking = document.getElementById('lista-historico-ranking');
const historicoVazio = document.getElementById('historico-vazio');
const btnExportarCsv = document.getElementById('btn-exportar-csv');

const modalConfirmacao = document.getElementById('modal-confirmacao');
const modalConfTitulo = document.getElementById('modal-conf-titulo');
const modalConfMensagem = document.getElementById('modal-conf-mensagem');
const modalConfIcone = document.getElementById('modal-conf-icone');
const btnConfCancelar = document.getElementById('btn-conf-cancelar');
const btnConfConfirmar = document.getElementById('btn-conf-confirmar');
let callbackConfirmacao = null;

// Checagem de redirecionamento para abrir o modal de gerenciar consultores automaticamente
const paramsUrl = new URLSearchParams(window.location.search);
if (paramsUrl.get('abrir') === 'usuarios') {
    modalGerenciar.classList.add('active');
}

function exibirConfirmacao({ titulo, mensagem, icone = "⚠️", textoBotao = "Confirmar", corBotao = "#ef4444", onConfirmar }) {
    modalConfTitulo.textContent = titulo;
    modalConfMensagem.textContent = mensagem;
    modalConfIcone.textContent = icone;
    btnConfConfirmar.textContent = textoBotao;
    btnConfConfirmar.style.backgroundColor = corBotao;
    callbackConfirmacao = onConfirmar;
    modalConfirmacao.classList.add('active');
}

function fecharConfirmacao() {
    modalConfirmacao.classList.remove('active');
    callbackConfirmacao = null;
}

btnConfCancelar.addEventListener('click', fecharConfirmacao);
btnConfConfirmar.addEventListener('click', () => {
    if (callbackConfirmacao) callbackConfirmacao();
    fecharConfirmacao();
});

modalConfirmacao.addEventListener('click', (e) => {
    if (e.target === modalConfirmacao) fecharConfirmacao();
});

function abrirSidebar() {
    sidebarDrawer.classList.add('active');
    sidebarOverlay.classList.add('active');
}

function fecharSidebar() {
    sidebarDrawer.classList.remove('active');
    sidebarOverlay.classList.remove('active');
}

btnAbrirMenu.addEventListener('click', abrirSidebar);
btnFecharMenu.addEventListener('click', fecharSidebar);
sidebarOverlay.addEventListener('click', fecharSidebar);

btnMenuUsuarios.addEventListener('click', () => {
    fecharSidebar();
    modalGerenciar.classList.add('active');
});

btnFecharModal.addEventListener('click', () => modalGerenciar.classList.remove('active'));
btnFecharEditar.addEventListener('click', () => modalEditar.classList.remove('active'));
btnFecharHistorico.addEventListener('click', () => modalHistorico.classList.remove('active'));

btnMenuLogout.addEventListener('click', () => {
    exibirConfirmacao({
        titulo: "Encerrar Sessão",
        mensagem: "Deseja realmente sair do painel administrativo?",
        icone: "🚪",
        textoBotao: "Sair",
        corBotao: "#ef4444",
        onConfirmar: async () => {
            await signOut(auth);
            window.location.href = "login.html";
        }
    });
});

let posicoesAnteriores = new Map();
let indicesAnteriores = new Map();
let vendasAnteriores = new Map();
let primeiraRenderizacao = true;
let dadosCicloAtual = [];
let dadosHistoricoCarregados = [];

function obterDataHojeString() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function formatarHora(timestamp) {
    if (!timestamp) return "Sem vendas hoje";
    const data = new Date(timestamp);
    return `Última: ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function obterMedalhaOuPosicao(posicao) {
    if (posicao === 1) return `<img src="icones/Ouro.svg" alt="1º Lugar" style="width: 28px; height: 28px;">`;
    if (posicao === 2) return `<img src="icones/Prata.svg" alt="2º Lugar" style="width: 28px; height: 28px;">`;
    if (posicao === 3) return `<img src="icones/Bronze.svg" alt="3º Lugar" style="width: 28px; height: 28px;">`;
    return `<span>${posicao}º</span>`;
}

function calcularEstiloGradiente(index, total) {
    if (total <= 1) {
        return { background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.35)' };
    }
    const progresso = index / (total - 1);
    const hue = 140 - (progresso * 140);
    return {
        background: `linear-gradient(90deg, hsla(${hue}, 65%, 45%, 0.15) 0%, var(--box-bg) 100%)`,
        border: `1px solid hsla(${hue}, 60%, 50%, 0.28)`
    };
}

function processarImagem(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const tamanhoMaximo = 150;
                const proporcao = tamanhoMaximo / img.width;
                canvas.width = tamanhoMaximo;
                canvas.height = img.height * proporcao;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// ==========================================================================
// VIRADA AUTOMÁTICA DE DIA (MEIA-NOITE)
// ==========================================================================
async function verificarViradaDeDia(consultores) {
    const dataHoje = obterDataHojeString();
    const configRef = doc(db, "configuracoes", "ciclo_atual");
    const configSnap = await getDoc(configRef);

    if (!configSnap.exists()) {
        await setDoc(configRef, { dataCicloAtivo: dataHoje });
        return;
    }

    const dataCicloAtivo = configSnap.data().dataCicloAtivo;

    if (dataCicloAtivo !== dataHoje) {
        const batch = writeBatch(db);
        consultores.forEach((c) => {
            const cRef = doc(db, "consultores", c.id);
            batch.update(cRef, { vendas: 0, ultimaVenda: 0 });
        });
        batch.set(configRef, { dataCicloAtivo: dataHoje });
        await batch.commit();
    }
}

// ==========================================================================
// DASHBOARD PRINCIPAL (FILTRO: ATIVOS APENAS NA OPERAÇÃO)
// ==========================================================================
function carregarDashboard() {
    const consultoresRef = collection(db, "consultores");

    onSnapshot(consultoresRef, async (snapshot) => {
        const elementosExistentes = listaRanking.querySelectorAll('.card-consultor');
        elementosExistentes.forEach(el => {
            const id = el.getAttribute('data-id');
            if (id) posicoesAnteriores.set(id, el.getBoundingClientRect().top);
        });

        const todosConsultores = [];
        snapshot.forEach((docSnap) => {
            todosConsultores.push({ id: docSnap.id, ...docSnap.data() });
        });

        const consultoresAtivos = todosConsultores.filter(c => c.ativo !== false);
        dadosCicloAtual = consultoresAtivos;

        await verificarViradaDeDia(consultoresAtivos);

        const consultoresAlfabetico = [...consultoresAtivos].sort((a, b) => 
            a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
        );

        // 1. Painel Administrativo (Apenas Ativos)
        listaAdmin.innerHTML = '';
        consultoresAlfabetico.forEach((consultor) => {
            const id = consultor.id;
            const vendas = consultor.vendas || 0;
            const horaFormatada = formatarHora(consultor.ultimaVenda);

            const visualFoto = consultor.foto && consultor.foto !== "default"
                ? `<img src="${consultor.foto}" alt="${consultor.nome}" class="foto-consultor">`
                : `<div class="foto-placeholder"></div>`;

            const li = document.createElement('li');
            li.className = 'card-consultor';
            li.innerHTML = `
                <div class="consultor-info">
                    ${visualFoto}
                    <div class="consultor-detalhes">
                        <span class="nome">${consultor.nome}</span>
                        <span class="hora-ultima-venda">${horaFormatada}</span>
                    </div>
                </div>
                <div class="consultor-acoes">
                    <button class="btn-menos" data-id="${id}" data-nome="${consultor.nome}" data-vendas="${vendas}" ${vendas === 0 ? 'disabled' : ''}>-</button>
                    <span class="contador-vendas">${vendas}</span>
                    <button class="btn-mais" data-id="${id}" data-nome="${consultor.nome}">+</button>
                </div>
            `;
            listaAdmin.appendChild(li);
        });

        document.querySelectorAll('.btn-mais').forEach(botao => {
            botao.addEventListener('click', function() {
                registrarVenda(this.getAttribute('data-id'), this.getAttribute('data-nome'), 1);
            });
        });

        document.querySelectorAll('.btn-menos').forEach(botao => {
            botao.addEventListener('click', function() {
                const idConsultor = this.getAttribute('data-id');
                const nomeConsultor = this.getAttribute('data-nome');
                const vendasAtuais = parseInt(this.getAttribute('data-vendas'));
                if (vendasAtuais > 0) registrarVenda(idConsultor, nomeConsultor, -1);
            });
        });

        // 2. Modal Gerenciar Usuários (Lista Ativos e Inativos com Confirmação na Reativação)
        listaGerenciar.innerHTML = '';
        const todosOrdenados = [...todosConsultores].sort((a, b) => {
            if ((a.ativo !== false) === (b.ativo !== false)) {
                return a.nome.localeCompare(b.nome, 'pt-BR');
            }
            return a.ativo === false ? 1 : -1;
        });

        todosOrdenados.forEach((consultor) => {
            const id = consultor.id;
            const estaAtivo = consultor.ativo !== false;
            const visualFoto = consultor.foto && consultor.foto !== "default"
                ? `<img src="${consultor.foto}" alt="${consultor.nome}" class="foto-consultor" style="${!estaAtivo ? 'filter: grayscale(100%); opacity: 0.6;' : ''}">`
                : `<div class="foto-placeholder" style="${!estaAtivo ? 'background: #64748b;' : ''}"></div>`;

            const li = document.createElement('li');
            li.className = 'item-gerenciamento';
            if (!estaAtivo) li.style.opacity = '0.7';

            li.innerHTML = `
                <div class="item-gerenciamento-info">
                    ${visualFoto}
                    <div>
                        <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">${consultor.nome}</span>
                        ${!estaAtivo ? '<span style="font-size: 0.72rem; color: #ef4444; font-weight: bold; margin-left: 6px;">(Inativo)</span>' : ''}
                    </div>
                </div>
                <div class="item-gerenciamento-acoes">
                    <a href="desempenho.html?id=${id}" class="btn-acao-modal btn-acao-editar" style="text-decoration: none; display: inline-flex; align-items: center;" title="Ver Métricas">📈 Gráficos</a>
                    <button class="btn-acao-modal btn-acao-editar btn-editar-usr" data-id="${id}" data-nome="${consultor.nome}" data-foto="${consultor.foto || 'default'}">Editar</button>
                    ${estaAtivo 
                        ? `<button class="btn-acao-modal btn-acao-excluir btn-desativar-usr" data-id="${id}" data-nome="${consultor.nome}">Desativar</button>`
                        : `<button class="btn-acao-modal btn-reativar-usr" data-id="${id}" data-nome="${consultor.nome}" style="background: #22c55e; color: white;">Reativar</button>`
                    }
                </div>
            `;
            listaGerenciar.appendChild(li);
        });

        document.querySelectorAll('.btn-editar-usr').forEach(botao => {
            botao.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                const nome = this.getAttribute('data-nome');
                const foto = this.getAttribute('data-foto');

                editId.value = id;
                editNome.value = nome;
                editFoto.value = "";
                editPreviewFoto.src = (foto && foto !== "default") ? foto : "icones/Ouro.svg";
                modalEditar.classList.add('active');
            });
        });

        // Desativação (Soft Delete)
        document.querySelectorAll('.btn-desativar-usr').forEach(botao => {
            botao.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                const nome = this.getAttribute('data-nome');

                exibirConfirmacao({
                    titulo: "Desativar Consultor",
                    mensagem: `Deseja desativar ${nome}? Os dados e gráficos históricos continuarão preservados para consultas e relatórios.`,
                    icone: "⚠️",
                    textoBotao: "Desativar",
                    corBotao: "#ef4444",
                    onConfirmar: async () => {
                        await updateDoc(doc(db, "consultores", id), {
                            ativo: false,
                            vendas: 0,
                            dataDesativacao: Date.now()
                        });
                    }
                });
            });
        });

        // Reativação com Confirmação
        document.querySelectorAll('.btn-reativar-usr').forEach(botao => {
            botao.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                const nome = this.getAttribute('data-nome');

                exibirConfirmacao({
                    titulo: "Reativar Consultor",
                    mensagem: `Deseja reintegrar ${nome} à equipe ativa? Ele voltará a aparecer no painel e no ranking em tempo real.`,
                    icone: "🔄",
                    textoBotao: "Reativar",
                    corBotao: "#22c55e",
                    onConfirmar: async () => {
                        await updateDoc(doc(db, "consultores", id), {
                            ativo: true
                        });
                    }
                });
            });
        });

        // 3. Ranking em Tempo Real (Apenas Ativos)
        const consultoresRanking = [...consultoresAtivos].sort((a, b) => {
            const vendasA = a.vendas || 0;
            const vendasB = b.vendas || 0;
            if (vendasB !== vendasA) return vendasB - vendasA;

            if (vendasA > 0) {
                const tempoA = a.ultimaVenda || 0;
                const tempoB = b.ultimaVenda || 0;
                if (tempoB !== tempoA) return tempoB - tempoA;
            }
            return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
        });

        listaRanking.innerHTML = '';
        const totalConsultores = consultoresRanking.length;

        consultoresRanking.forEach((consultor, index) => {
            const posicao = index + 1;
            const li = document.createElement('li');
            li.className = 'card-consultor';
            li.setAttribute('data-id', consultor.id);

            const estiloCor = calcularEstiloGradiente(index, totalConsultores);
            li.style.background = estiloCor.background;
            li.style.border = estiloCor.border;

            const visualFoto = consultor.foto && consultor.foto !== "default"
                ? `<img src="${consultor.foto}" alt="${consultor.nome}" class="foto-consultor">`
                : `<div class="foto-placeholder"></div>`;

            const horaFormatada = formatarHora(consultor.ultimaVenda);

            li.innerHTML = `
                <div class="consultor-info">
                    <div class="posicao-box">
                        ${obterMedalhaOuPosicao(posicao)}
                    </div>
                    ${visualFoto}
                    <div class="consultor-detalhes">
                        <span class="nome">${consultor.nome}</span>
                        <span class="hora-ultima-venda">${horaFormatada}</span>
                    </div>
                </div>
                <div class="vendas-destaque">${consultor.vendas || 0}</div>
            `;
            listaRanking.appendChild(li);

            if (!primeiraRenderizacao) {
                const topoAnterior = posicoesAnteriores.get(consultor.id);
                const topoAtual = li.getBoundingClientRect().top;
                const indexPassado = indicesAnteriores.get(consultor.id);
                const vendasPassadas = vendasAnteriores.get(consultor.id) || 0;

                if (topoAnterior !== undefined) {
                    const deltaY = topoAnterior - topoAtual;
                    if (deltaY !== 0) {
                        li.style.transform = `translateY(${deltaY}px)`;
                        li.style.transition = 'none';
                        requestAnimationFrame(() => {
                            li.style.transition = 'transform 1s cubic-bezier(0.16, 1, 0.3, 1)';
                            li.style.transform = 'translateY(0)';
                        });
                    }
                }

                if ((consultor.vendas || 0) > vendasPassadas) {
                    li.classList.add('card-animar-venda');
                } else if (indexPassado !== undefined && index > indexPassado) {
                    li.classList.add('card-animar-queda');
                }
            }

            indicesAnteriores.set(consultor.id, index);
            vendasAnteriores.set(consultor.id, consultor.vendas || 0);
        });

        primeiraRenderizacao = false;
    });
}

// ==========================================================================
// REGISTRO DE VENDAS
// ==========================================================================
async function registrarVenda(id, nome, quantidade) {
    const dataHoje = obterDataHojeString();

    const consultorRef = doc(db, "consultores", id);
    const atualizacao = { vendas: increment(quantidade) };
    if (quantidade > 0) atualizacao.ultimaVenda = Date.now();
    await updateDoc(consultorRef, atualizacao);

    const histRef = doc(db, "historicos", dataHoje);
    const histSnap = await getDoc(histRef);

    let ranking = [];
    if (histSnap.exists()) {
        const dados = histSnap.data();
        if (Array.isArray(dados.ranking)) {
            ranking = dados.ranking;
        } else if (typeof dados.ranking === 'object' && dados.ranking !== null) {
            ranking = Object.keys(dados.ranking).map(k => ({
                id: k,
                nome: dados.ranking[k].nome,
                foto: dados.ranking[k].foto || "default",
                vendas: dados.ranking[k].vendas || 0
            }));
        }
    }

    dadosCicloAtual.forEach(consultor => {
        const existe = ranking.find(r => r.id === consultor.id || r.nome === consultor.nome);
        if (!existe) {
            ranking.push({
                id: consultor.id,
                nome: consultor.nome,
                foto: consultor.foto || "default",
                vendas: 0
            });
        }
    });

    const indexConsultor = ranking.findIndex(c => c.id === id || c.nome === nome);
    const consultorAtivo = dadosCicloAtual.find(c => c.id === id);
    const fotoConsultor = consultorAtivo ? (consultorAtivo.foto || "default") : "default";

    if (indexConsultor >= 0) {
        ranking[indexConsultor].vendas = Math.max(0, (ranking[indexConsultor].vendas || 0) + quantidade);
        if (fotoConsultor !== "default") ranking[indexConsultor].foto = fotoConsultor;
    }

    ranking.sort((a, b) => (b.vendas || 0) - (a.vendas || 0));

    await setDoc(histRef, {
        dataCiclo: dataHoje,
        ultimaAtualizacao: Date.now(),
        ranking: ranking
    });
}

// ==========================================================================
// CONSULTA HISTÓRICO POR DATA
// ==========================================================================
btnMenuHistorico.addEventListener('click', () => {
    fecharSidebar();
    const hoje = obterDataHojeString();
    filtroDataHistorico.value = hoje;
    carregarHistoricoPorData(hoje);
    modalHistorico.classList.add('active');
});

filtroDataHistorico.addEventListener('change', (e) => {
    carregarHistoricoPorData(e.target.value);
});

async function carregarHistoricoPorData(dataString) {
    listaHistoricoRanking.innerHTML = '';
    historicoVazio.style.display = 'none';

    if (!dataString) return;

    const docRef = doc(db, "historicos", dataString);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        historicoVazio.style.display = 'block';
        dadosHistoricoCarregados = [];
        return;
    }

    const docHistorico = docSnap.data();
    let rankingRaw = docHistorico.ranking;

    if (Array.isArray(rankingRaw)) {
        dadosHistoricoCarregados = [...rankingRaw];
    } else if (typeof rankingRaw === 'object' && rankingRaw !== null) {
        dadosHistoricoCarregados = Object.keys(rankingRaw).map(k => ({
            id: k,
            nome: rankingRaw[k].nome,
            foto: rankingRaw[k].foto || "default",
            vendas: rankingRaw[k].vendas || 0
        }));
    } else {
        dadosHistoricoCarregados = [];
    }

    if (dataString === obterDataHojeString() && dadosCicloAtual.length > 0) {
        dadosCicloAtual.forEach(c => {
            const existe = dadosHistoricoCarregados.find(r => r.id === c.id || r.nome === c.nome);
            if (!existe) {
                dadosHistoricoCarregados.push({
                    id: c.id,
                    nome: c.nome,
                    foto: c.foto || "default",
                    vendas: 0
                });
            }
        });
    }

    dadosHistoricoCarregados.sort((a, b) => {
        const vA = a.vendas || 0;
        const vB = b.vendas || 0;
        if (vB !== vA) return vB - vA;
        return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    if (dadosHistoricoCarregados.length === 0) {
        historicoVazio.style.display = 'block';
        return;
    }

    let divisorTop3Inserido = false;
    let divisorZeradosInserido = false;

    dadosHistoricoCarregados.forEach((item, index) => {
        const totalVendas = item.vendas || 0;
        const posicao = index + 1;

        if (index === 3 && !divisorTop3Inserido && totalVendas > 0) {
            const linhaTop3 = document.createElement('div');
            linhaTop3.className = 'divisor-historico-top3';
            listaHistoricoRanking.appendChild(linhaTop3);
            divisorTop3Inserido = true;
        }

        if (totalVendas === 0 && !divisorZeradosInserido) {
            const linhaZerados = document.createElement('div');
            linhaZerados.className = 'divisor-historico-zerados';
            linhaZerados.innerHTML = `<span>Sem Vendas no Ciclo</span>`;
            listaHistoricoRanking.appendChild(linhaZerados);
            divisorZeradosInserido = true;
        }

        const inicial = item.nome ? item.nome.charAt(0).toUpperCase() : "?";

        const visualFoto = item.foto && item.foto !== "default"
            ? `<img src="${item.foto}" alt="${item.nome}" class="foto-consultor" style="width: 34px; height: 34px; object-fit: cover; border-radius: 50%;">`
            : `<div class="foto-placeholder" style="width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; color: #fff; border-radius: 50%;">${inicial}</div>`;

        const exibicaoPosicao = totalVendas > 0 
            ? obterMedalhaOuPosicao(posicao)
            : `<span style="font-size: 0.85rem; color: var(--text-muted);">-</span>`;

        const li = document.createElement('li');
        li.className = `item-gerenciamento ${totalVendas === 0 ? 'item-historico-zerado' : ''}`;
        li.innerHTML = `
            <div class="item-gerenciamento-info">
                <div class="posicao-box" style="width: 28px; display: flex; justify-content: center; align-items: center;">
                    ${exibicaoPosicao}
                </div>
                ${visualFoto}
                <span style="font-weight: 600; color: var(--text-main); font-size: 0.92rem;">${item.nome}</span>
            </div>
            <span style="font-weight: 700; color: var(--text-main); font-size: 1.05rem; padding-right: 6px;">
                ${totalVendas} ${totalVendas === 1 ? 'venda' : 'vendas'}
            </span>
        `;
        listaHistoricoRanking.appendChild(li);
    });
}

btnExportarCsv.addEventListener('click', () => {
    const dados = dadosHistoricoCarregados.length > 0 ? dadosHistoricoCarregados : dadosCicloAtual;
    if (dados.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,Posição,Consultor,Vendas\n";
    dados.forEach((item, index) => {
        csvContent += `${index + 1},"${item.nome}",${item.vendas || 0}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ranking_Vendas_${filtroDataHistorico.value || 'Atual'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// ==========================================================================
// CADASTRO, EDIÇÃO E ENCERRAMENTO
// ==========================================================================
formEditar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editId.value;
    const novoNome = editNome.value.trim();
    const novaFotoArquivo = editFoto.files[0];

    if (!novoNome) return;

    btnSalvarEdicao.textContent = "Salvando...";
    btnSalvarEdicao.disabled = true;

    const dadosAtualizados = { nome: novoNome };
    if (novaFotoArquivo) dadosAtualizados.foto = await processarImagem(novaFotoArquivo);

    await updateDoc(doc(db, "consultores", id), dadosAtualizados);
    btnSalvarEdicao.textContent = "Salvar Alterações";
    btnSalvarEdicao.disabled = false;
    modalEditar.classList.remove('active');
});

btnAdicionar.addEventListener('click', async () => {
    const nome = inputNovoNome.value.trim();
    const arquivoFoto = document.getElementById('nova-foto').files[0];

    if (nome === "") {
        inputNovoNome.focus();
        return;
    }

    let fotoFinal = "default";
    if (arquivoFoto) fotoFinal = await processarImagem(arquivoFoto);

    await addDoc(collection(db, "consultores"), {
        nome: nome,
        vendas: 0,
        foto: fotoFinal,
        ativo: true,
        ultimaVenda: 0
    });

    inputNovoNome.value = "";
    document.getElementById('nova-foto').value = "";
    fecharSidebar();
});

document.getElementById('btn-zerar').addEventListener('click', () => {
    fecharSidebar();
    exibirConfirmacao({
        titulo: "Encerrar Ciclo Manualmente",
        mensagem: "O histórico do dia permanecerá gravado com todas as vendas. Deseja zerar o placar da equipe?",
        icone: "🔄",
        textoBotao: "Zerar Placar",
        corBotao: "#ef4444",
        onConfirmar: async () => {
            const batch = writeBatch(db);
            dadosCicloAtual.forEach((c) => {
                const cRef = doc(db, "consultores", c.id);
                batch.update(cRef, { vendas: 0, ultimaVenda: 0 });
            });
            await batch.commit();
        }
    });
});

carregarDashboard();