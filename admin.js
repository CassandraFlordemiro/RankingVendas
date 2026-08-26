// Importações diretas do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, increment, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Mapeando os elementos do HTML
const listaAdmin = document.getElementById('lista-admin');
const inputNovoNome = document.getElementById('novo-nome');
const btnAdicionar = document.getElementById('btn-adicionar');

// Função auxiliar para formatar a hora da última venda
function formatarHora(timestamp) {
    if (!timestamp) return "Sem vendas hoje";
    const data = new Date(timestamp);
    return `Última: ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// 1. Carregar lista em cards ordenados alfabeticamente
function carregarPainelAdmin() {
    const consultoresRef = collection(db, "consultores");
    const q = query(consultoresRef, orderBy("nome")); 

    onSnapshot(q, (snapshot) => {
        listaAdmin.innerHTML = ''; 
        
        snapshot.forEach((documento) => {
            const consultor = documento.data();
            const id = documento.id; 
            const vendas = consultor.vendas || 0;
            const horaVendaFormatada = formatarHora(consultor.ultimaVenda);

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
                        <span class="hora-ultima-venda">${horaVendaFormatada}</span>
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

        // Ação para adicionar venda (+1)
        document.querySelectorAll('.btn-mais').forEach(botao => {
            botao.addEventListener('click', function() {
                const idConsultor = this.getAttribute('data-id');
                registrarVenda(idConsultor, 1);
            });
        });

        // Ação para remover venda (-1)
        document.querySelectorAll('.btn-menos').forEach(botao => {
            botao.addEventListener('click', function() {
                const idConsultor = this.getAttribute('data-id');
                const vendasAtuais = parseInt(this.getAttribute('data-vendas'));
                
                if (vendasAtuais > 0) {
                    registrarVenda(idConsultor, -1);
                }
            });
        });
    });
}

// 2. Função unificada para registrar ou remover vendas
async function registrarVenda(id, quantidade) {
    const consultorRef = doc(db, "consultores", id);
    const atualizacao = {
        vendas: increment(quantidade)
    };
    
    if (quantidade > 0) {
        atualizacao.ultimaVenda = Date.now();
    }

    await updateDoc(consultorRef, atualizacao);
}

// Motor para encolher a foto e transformá-la em texto Base64
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

// 3. Cadastrar consultor
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
});

// 4. Encerrar ciclo
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
    }
});

// Inicia o painel
carregarPainelAdmin();