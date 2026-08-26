// Importações diretas do Firebase (incluindo funções de adicionar e atualizar dados)
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

// 1. Função para carregar a lista de consultores para a supervisora
function carregarPainelAdmin() {
    const consultoresRef = collection(db, "consultores");
    const q = query(consultoresRef, orderBy("nome")); 

    onSnapshot(q, (snapshot) => {
        listaAdmin.innerHTML = ''; 
        
        snapshot.forEach((documento) => {
            const consultor = documento.data();
            const id = documento.id; 
            
            const li = document.createElement('li');
            li.style.display = "flex";
            li.style.justifyContent = "space-between";
            li.style.alignItems = "center";
            li.style.padding = "10px 0";
            li.style.borderBottom = "1px solid rgba(255,255,255,0.05)";

            // Adicionamos os botões de -1 (vermelho) e +1 (verde)
            li.innerHTML = `
                <span style="font-weight: bold; color: #f8fafc;">${consultor.nome} (Vendas: ${consultor.vendas})</span>
                <div>
                    <button class="btn-menos" data-id="${id}" data-vendas="${consultor.vendas}" style="padding: 5px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 5px;">-1</button>
                    <button class="btn-mais" data-id="${id}" style="padding: 5px 12px; background: #22c55e; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">+1</button>
                </div>
            `;
            
            listaAdmin.appendChild(li);
        });

        // Ação para o botão de Adicionar Venda (+1)
        document.querySelectorAll('.btn-mais').forEach(botao => {
            botao.addEventListener('click', function() {
                const idConsultor = this.getAttribute('data-id');
                registrarVenda(idConsultor, 1);
            });
        });

        // Ação para o botão de Remover Venda (-1)
        document.querySelectorAll('.btn-menos').forEach(botao => {
            botao.addEventListener('click', function() {
                const idConsultor = this.getAttribute('data-id');
                const vendasAtuais = parseInt(this.getAttribute('data-vendas'));
                
                // Trava: Só diminui se for maior que zero
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
    
    // Se for acréscimo (+1), atualiza a data/hora da última venda
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
                const tamanhoMaximo = 150; // Resolução ideal para o círculo do ranking
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

// 3. Cadastrar consultor com envio de arquivo direto do PC
btnAdicionar.addEventListener('click', async () => {
    const nome = inputNovoNome.value.trim();
    const arquivoFoto = document.getElementById('nova-foto').files[0];
    
    if (nome === "") {
        alert("Por favor, digite o nome do consultor.");
        return;
    }

    let fotoFinal = "default";
    
    // Se a supervisora enviou um arquivo, passamos pelo motor de compressão
    if (arquivoFoto) {
        fotoFinal = await processarImagem(arquivoFoto);
    }

    await addDoc(collection(db, "consultores"), {
        nome: nome,
        vendas: 0,
        foto: fotoFinal,
        ultimaVenda: 0
    });

    // Limpa os campos após o cadastro
    inputNovoNome.value = ""; 
    document.getElementById('nova-foto').value = ""; 
});

// 4. Função para zerar o ranking no final do dia
document.getElementById('btn-zerar').addEventListener('click', async () => {
    // Cria um alerta de segurança para evitar cliques acidentais
    const confirmacao = confirm("Tem certeza que deseja zerar as vendas de todos os consultores para iniciar um novo ciclo?");
    
    if (confirmacao) {
        const consultoresRef = collection(db, "consultores");
        const snapshot = await getDocs(consultoresRef); // Lê todos os cadastros
        
        // Atualiza a venda de cada um para zero
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