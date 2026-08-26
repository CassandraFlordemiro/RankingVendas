// Importações diretas do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, increment, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Suas credenciais
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
    if (!user) {
        window.location.href = "login.html";
    }
});

// ==========================================================================
// GERENCIADOR DE TEMAS DE CORES
// ==========================================================================
function aplicarTema(tema) {
    document.body.classList.remove('theme-dracula', 'theme-light');
    if (tema === 'dracula') {
        document.body.classList.add('theme-dracula');
    } else if (tema === 'light') {
        document.body.classList.add('theme-light');
    }
    localStorage.setItem('ranking_tema_preferido', tema);
}

// Carrega tema salvo anteriormente
const temaSalvo = localStorage.getItem('ranking_tema_preferido') || 'default';
aplicarTema(temaSalvo);

// Eventos de clique nas opções de tema
document.querySelectorAll('.theme-option-btn').forEach(botao => {
    botao.addEventListener('click', (e) => {
        const temaEscolhido = e.currentTarget.getAttribute('data-theme');
        aplicarTema(temaEscolhido);
    });
});

// Elementos DOM
const listaAdmin = document.getElementById('lista-admin');
const listaRanking = document.getElementById('lista-ranking');
const inputNovoNome = document.getElementById('novo-nome');
const btnAdicionar = document.getElementById('btn-adicionar');

// Controle da Barra Lateral
const btnAbrirMenu = document.getElementById('btn-abrir-menu');
const btnFecharMenu = document.getElementById('btn-fechar-menu');
const sidebarDrawer = document.getElementById('sidebar-drawer');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnMenuLogout = document.getElementById('btn-menu-logout');

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

// Logout
btnMenuLogout.addEventListener('click', async () => {
    const confirmacao = confirm("Deseja realmente sair do painel?");
    if (confirmacao) {
        await signOut(auth);
        window.location.href = "login.html";
    }
});

// Variáveis de Animação do Ranking
let posicoesAnteriores = new Map();
let indicesAnteriores = new Map();
let vendasAnteriores = new Map();
let primeiraRenderizacao = true;

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
        return {
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.35)'
        };
    }
    const progresso = index / (total - 1);
    const hue = 140 - (progresso * 140);
    return {
        background: `linear-gradient(90deg, hsla(${hue}, 65%, 45%, 0.15) 0%, var(--box-bg) 100%)`,
        border: `1px solid hsla(${hue}, 60%, 50%, 0.28)`
    };
}

// Escuta Firestore Unificada
function carregarDashboard() {
    const consultoresRef = collection(db, "consultores");

    onSnapshot(consultoresRef, (snapshot) => {
        const elementosExistentes = listaRanking.querySelectorAll('.card-consultor');
        elementosExistentes.forEach(el => {
            const id = el.getAttribute('data-id');
            if (id) posicoesAnteriores.set(id, el.getBoundingClientRect().top);
        });

        const consultores = [];
        snapshot.forEach((docSnap) => {
            consultores.push({ id: docSnap.id, ...docSnap.data() });
        });

        // 1. RENDERIZAR PAINEL ADMINISTRATIVO (Ordem Alfabética)
        const consultoresAdmin = [...consultores].sort((a, b) => 
            a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
        );

        listaAdmin.innerHTML = '';
        consultoresAdmin.forEach((consultor) => {
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
                    <button class="btn-menos" data-id="${id}" data-vendas="${vendas}" ${vendas === 0 ? 'disabled' : ''}>-</button>
                    <span class="contador-vendas">${vendas}</span>
                    <button class="btn-mais" data-id="${id}">+</button>
                </div>
            `;
            listaAdmin.appendChild(li);
        });

        document.querySelectorAll('.btn-mais').forEach(botao => {
            botao.addEventListener('click', function() {
                registrarVenda(this.getAttribute('data-id'), 1);
            });
        });

        document.querySelectorAll('.btn-menos').forEach(botao => {
            botao.addEventListener('click', function() {
                const idConsultor = this.getAttribute('data-id');
                const vendasAtuais = parseInt(this.getAttribute('data-vendas'));
                if (vendasAtuais > 0) registrarVenda(idConsultor, -1);
            });
        });

        // 2. RENDERIZAR RANKING
        const consultoresRanking = [...consultores].sort((a, b) => {
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
                <div class="vendas-destaque">
                    ${consultor.vendas || 0}
                </div>
            `;
            listaRanking.appendChild(li);

            // Animação de transição e pulsos
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

// Operações de Banco
async function registrarVenda(id, quantidade) {
    const consultorRef = doc(db, "consultores", id);
    const atualizacao = { vendas: increment(quantidade) };
    if (quantidade > 0) atualizacao.ultimaVenda = Date.now();
    await updateDoc(consultorRef, atualizacao);
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

btnAdicionar.addEventListener('click', async () => {
    const nome = inputNovoNome.value.trim();
    const arquivoFoto = document.getElementById('nova-foto').files[0];

    if (nome === "") {
        alert("Por favor, digite o nome do consultor.");
        return;
    }

    let fotoFinal = "default";
    if (arquivoFoto) {
        fotoFinal = await processarImagem(arquivoFoto);
    }

    await addDoc(collection(db, "consultores"), {
        nome: nome,
        vendas: 0,
        foto: fotoFinal,
        ultimaVenda: 0
    });

    inputNovoNome.value = "";
    document.getElementById('nova-foto').value = "";
    fecharSidebar();
});

document.getElementById('btn-zerar').addEventListener('click', async () => {
    const confirmacao = confirm("Tem certeza que deseja zerar as vendas de todos os consultores para iniciar um novo ciclo?");
    if (confirmacao) {
        const consultoresRef = collection(db, "consultores");
        const snapshot = await getDocs(consultoresRef);
        snapshot.forEach(async (documento) => {
            await updateDoc(doc(db, "consultores", documento.id), {
                vendas: 0,
                ultimaVenda: 0
            });
        });
        fecharSidebar();
    }
});

carregarDashboard();