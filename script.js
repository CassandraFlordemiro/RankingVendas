// Importações diretas do Firebase via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Função para buscar os consultores e montar o ranking
function carregarRanking() {
    const consultoresRef = collection(db, "consultores");
    const q = query(consultoresRef, orderBy("vendas", "desc"));

    onSnapshot(q, (snapshot) => {
        listaRanking.innerHTML = ''; 
        let posicao = 1;

        snapshot.forEach((doc) => {
            const consultor = doc.data();
            
            const li = document.createElement('li');
            li.className = 'consultor-item';
            
            // Lógica para mostrar a foto processada ou o círculo azul
            const estiloImagem = "width: 32px; height: 32px; border-radius: 50%; object-fit: cover;";
            const visualFoto = consultor.foto !== "default" 
                ? `<img src="${consultor.foto}" alt="${consultor.nome}" style="${estiloImagem}">` 
                : `<div class="foto-placeholder"></div>`;

            li.innerHTML = `
                <span class="posicao">${posicao}</span>
                <div class="perfil">
                    ${visualFoto}
                    <span class="nome">${consultor.nome}</span>
                </div>
                <span class="vendas-numero">${consultor.vendas}</span>
            `;
            
            listaRanking.appendChild(li);
            posicao++; 
        });
    });
}

carregarRanking();