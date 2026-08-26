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

// Inicializando
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const listaRanking = document.getElementById('lista-ranking');

// Função auxiliar para definir a medalha do Top 3
function obterMedalhaOuPosicao(posicao) {
    if (posicao === 1) {
        return `<img src="icones/Ouro.svg" alt="1º Lugar" style="width: 26px; height: 26px; justify-self: center;">`;
    }
    if (posicao === 2) {
        return `<img src="icones/Prata.svg" alt="2º Lugar" style="width: 26px; height: 26px; justify-self: center;">`;
    }
    if (posicao === 3) {
        return `<img src="icones/Bronze.svg" alt="3º Lugar" style="width: 26px; height: 26px; justify-self: center;">`;
    }
    return `<span class="posicao">${posicao}</span>`;
}

// Função para buscar os consultores e montar o ranking
function carregarRanking() {
    const consultoresRef = collection(db, "consultores");

    onSnapshot(consultoresRef, (snapshot) => {
        listaRanking.innerHTML = ''; 
        
        const consultores = [];
        snapshot.forEach((docSnap) => {
            consultores.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Ordenação com regras de desempate
        consultores.sort((a, b) => {
            const vendasA = a.vendas || 0;
            const vendasB = b.vendas || 0;

            // 1. Diferença de vendas
            if (vendasB !== vendasA) {
                return vendasB - vendasA;
            }

            // 2. Empate com vendas > 0: quem vendeu mais recente fica acima
            if (vendasA > 0) {
                const tempoA = a.ultimaVenda || 0;
                const tempoB = b.ultimaVenda || 0;
                if (tempoB !== tempoA) {
                    return tempoB - tempoA;
                }
            }

            // 3. Empate com 0 vendas (ou mesmo timestamp): ordem alfabética
            return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
        });

        consultores.forEach((consultor, index) => {
            const posicao = index + 1;
            const li = document.createElement('li');
            li.className = 'consultor-item';
            
            const estiloImagem = "width: 32px; height: 32px; border-radius: 50%; object-fit: cover;";
            const visualFoto = consultor.foto && consultor.foto !== "default" 
                ? `<img src="${consultor.foto}" alt="${consultor.nome}" style="${estiloImagem}">` 
                : `<div class="foto-placeholder"></div>`;

            li.innerHTML = `
                ${obterMedalhaOuPosicao(posicao)}
                <div class="perfil">
                    ${visualFoto}
                    <span class="nome">${consultor.nome}</span>
                </div>
                <span class="vendas-numero">${consultor.vendas || 0}</span>
            `;
            
            listaRanking.appendChild(li);
        });
    });
}

carregarRanking();