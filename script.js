// Importações diretas do Firebase via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Suas credenciais
const firebaseConfig = {
  apiKey: "AIzaSyDgtHlqlv4meTjW4VyJ8HrVCfUqMHaoUp0",
  authDomain: "rankingvendas-d56da.firebaseapp.com",
  projectId: "rankingvendas-d56da",
  storageBucket: "rankingvendas-d56da.firebasestorage.app",
  messagingSenderId: "55208086303",
  appId: "1:55208086303:web:fd78e3481750c04acf3e2a",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const listaRanking = document.getElementById("lista-ranking");

let posicoesAnteriores = new Map();
let indicesAnteriores = new Map();
let vendasAnteriores = new Map();
let primeiraRenderizacao = true;

// Define a medalha do Top 3 ou a numeração ordinal
function obterMedalhaOuPosicao(posicao) {
  if (posicao === 1)
    return `<img src="icones/Ouro.svg" alt="1º Lugar" style="width: 28px; height: 28px;">`;
  if (posicao === 2)
    return `<img src="icones/Prata.svg" alt="2º Lugar" style="width: 28px; height: 28px;">`;
  if (posicao === 3)
    return `<img src="icones/Bronze.svg" alt="3º Lugar" style="width: 28px; height: 28px;">`;
  return `<span>${posicao}º</span>`;
}

// Formata o horário da última venda
function formatarHora(timestamp) {
  if (!timestamp) return "Sem vendas hoje";
  const data = new Date(timestamp);
  return `Última: ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

// Calcula cor suave translúcida (Verde no topo -> Vermelho na base)
function calcularEstiloGradiente(index, total) {
  if (total <= 1) {
    return {
      background: "rgba(34, 197, 94, 0.12)",
      border: "1px solid rgba(34, 197, 94, 0.35)",
    };
  }

  // Interpola a matiz: 140° (Verde esmeralda) até 0° (Vermelho)
  const progresso = index / (total - 1);
  const hue = 140 - progresso * 140;

  return {
    background: `linear-gradient(90deg, hsla(${hue}, 65%, 45%, 0.15) 0%, rgba(30, 41, 59, 0.75) 100%)`,
    border: `1px solid hsla(${hue}, 60%, 50%, 0.28)`,
  };
}

// Função principal de montagem do ranking
function carregarRanking() {
  const consultoresRef = collection(db, "consultores");

  onSnapshot(consultoresRef, (snapshot) => {
    // 1. Captura posição vertical dos cards antes do reordenamento
    const elementosExistentes =
      listaRanking.querySelectorAll(".card-consultor");
    elementosExistentes.forEach((el) => {
      const id = el.getAttribute("data-id");
      if (id) {
        posicoesAnteriores.set(id, el.getBoundingClientRect().top);
      }
    });

    const consultores = [];
    snapshot.forEach((docSnap) => {
      consultores.push({ id: docSnap.id, ...docSnap.data() });
    });

    // 2. Ordenação com desempate
    consultores.sort((a, b) => {
      const vendasA = a.vendas || 0;
      const vendasB = b.vendas || 0;

      if (vendasB !== vendasA) return vendasB - vendasA;

      if (vendasA > 0) {
        const tempoA = a.ultimaVenda || 0;
        const tempoB = b.ultimaVenda || 0;
        if (tempoB !== tempoA) return tempoB - tempoA;
      }

      return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    });

    // 3. Renderização com o gradiente adaptativo
    listaRanking.innerHTML = "";
    const totalConsultores = consultores.length;

    consultores.forEach((consultor, index) => {
      const posicao = index + 1;
      const li = document.createElement("li");
      li.className = "card-consultor";
      li.setAttribute("data-id", consultor.id);

      // Aplica o gradiente translúcido
      const estiloCor = calcularEstiloGradiente(index, totalConsultores);
      li.style.background = estiloCor.background;
      li.style.border = estiloCor.border;

      const visualFoto =
        consultor.foto && consultor.foto !== "default"
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

      // 4. Animação suave e pulsos
      if (!primeiraRenderizacao) {
        const topoAnterior = posicoesAnteriores.get(consultor.id);
        const topoAtual = li.getBoundingClientRect().top;
        const indexPassado = indicesAnteriores.get(consultor.id);
        const vendasPassadas = vendasAnteriores.get(consultor.id) || 0;

        if (topoAnterior !== undefined) {
          const deltaY = topoAnterior - topoAtual;

          if (deltaY !== 0) {
            li.style.transform = `translateY(${deltaY}px)`;
            li.style.transition = "none";

            requestAnimationFrame(() => {
              li.style.transition =
                "transform 1s cubic-bezier(0.16, 1, 0.3, 1)";
              li.style.transform = "translateY(0)";
            });
          }
        }

        if ((consultor.vendas || 0) > vendasPassadas) {
          li.classList.add("card-animar-venda");
        } else if (indexPassado !== undefined && index > indexPassado) {
          li.classList.add("card-animar-queda");
        }
      }

      indicesAnteriores.set(consultor.id, index);
      vendasAnteriores.set(consultor.id, consultor.vendas || 0);
    });

    primeiraRenderizacao = false;
  });
}

carregarRanking();
