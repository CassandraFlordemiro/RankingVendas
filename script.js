// Importações diretas do Firebase via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const db = getFirestore(app);
const listaRanking = document.getElementById('lista-ranking');

// Armazena posições e vendas anteriores para orquestrar as transições
let posicoesAnteriores = new Map();
let vendasAnteriores = new Map();
let primeiraRenderizacao = true;

// Define a medalha do Top 3 ou a numeração ordinal (ex: 4º)
function obterMedalhaOuPosicao(posicao) {
    if (posicao === 1) return `<img src="icones/Ouro.svg" alt="1º Lugar" style="width: 28px; height: 28px;">`;
    if (posicao === 2) return `<img src="icones/Prata.svg" alt="2º Lugar" style="width: 28px; height: 28px;">`;
    if (posicao === 3) return `<img src="icones/Bronze.svg" alt="3º Lugar" style="width: 28px; height: 28px;">`;
    return `<span>${posicao}º</span>`;
}

// Formata o horário da última venda
function formatarHora(timestamp) {
    if (!timestamp) return "Sem vendas hoje";
    const data = new Date(timestamp);
    return `Última: ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Função principal de escuta e montagem animada do ranking
function carregarRanking() {
    const consultoresRef = collection(db, "consultores");

    onSnapshot(consultoresRef, (snapshot) => {
        // Passo 1: Captura a posição geográfica de cada card antes da reordenação (First)
        const elementosExistentes = listaRanking.querySelectorAll('.card-consultor');
        elementosExistentes.forEach(el => {
            const id = el.getAttribute('data-id');
            if (id) {
                posicoesAnteriores.set(id, el.getBoundingClientRect().top);
            }
        });

        const consultores = [];
        snapshot.forEach((docSnap) => {
            consultores.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Ordenação com regras de desempate
        consultores.sort((a, b) => {
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

        // Passo 2: Renderiza os novos elementos no DOM
        listaRanking.innerHTML = '';

        consultores.forEach((consultor, index) => {
            const posicao = index + 1;
            const li = document.createElement('li');
            li.className = 'card-consultor';
            li.setAttribute('data-id', consultor.id);
            
            const visualFoto = consultor.foto && consultor.foto !== "default" 
                ? `<img src="${consultor.foto}" alt="${consultor.nome}" class="foto-consultor">` 
                : `<div class="foto-placeholder"></div>`;

            const horaVendaFormatada = formatarHora(consultor.ultimaVenda);

            li.innerHTML = `
                <div class="consultor-info">
                    <div class="posicao-box">
                        ${obterMedalhaOuPosicao(posicao)}
                    </div>
                    ${visualFoto}
                    <div class="consultor-detalhes">
                        <span class="nome">${consultor.nome}</span>
                        <span class="hora-ultima-venda">${horaVendaFormatada}</span>
                    </div>
                </div>
                <div class="vendas-destaque">
                    ${consultor.vendas || 0}
                </div>
            `;
            
            listaRanking.appendChild(li);

            // Passo 3: Executa a animação FLIP (Invert & Play)
            if (!primeiraRenderizacao) {
                const topoAnterior = posicoesAnteriores.get(consultor.id);
                const topoAtual = li.getBoundingClientRect().top;

                if (topoAnterior !== undefined) {
                    const deltaY = topoAnterior - topoAtual;
                    
                    // Se mudou de posição, desliza da posição antiga para a nova
                    if (deltaY !== 0) {
                        li.style.transform = `translateY(${deltaY}px)`;
                        li.style.transition = 'none';

                        requestAnimationFrame(() => {
                            li.style.transition = 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
                            li.style.transform = 'translateY(0)';
                        });
                    }
                }

                // Se recebeu uma nova venda, ativa o brilho verde de pulso
                const vendasPassadas = vendasAnteriores.get(consultor.id) || 0;
                if ((consultor.vendas || 0) > vendasPassadas) {
                    li.classList.add('card-animar-venda');
                }
            }

            // Atualiza histórico local
            vendasAnteriores.set(consultor.id, consultor.vendas || 0);
        });

        primeiraRenderizacao = false;
    });
}

carregarRanking();