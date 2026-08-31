const db = firebase.firestore();
let totalVendasAnterior = null;

function formatarNomeCurto(nome) {
  if (!nome || typeof nome !== 'string') return 'NÃO INFORMADO';
  const limpo = nome.trim().replace(/\s+/g, ' ');
  
  if (
    limpo.startsWith('VENDA EXTERNA') ||
    limpo.includes('SITE') ||
    limpo === 'NÃO INFORMADO' ||
    limpo === 'S/N' ||
    limpo === 'Geral da Equipe' ||
    limpo === 'Visão Geral da Equipe'
  ) {
    return limpo;
  }

  const partes = limpo.split(' ');
  if (partes.length <= 2) return limpo;

  const conectores = ['DE', 'DA', 'DO', 'DOS', 'DAS', 'E'];
  if (conectores.includes(partes[1].toUpperCase()) && partes[2]) {
    return `${partes[0]} ${partes[1]} ${partes[2]}`;
  }

  return `${partes[0]} ${partes[1]}`;
}

document.addEventListener('DOMContentLoaded', () => {
  atualizarCabecalhosData();
  iniciarOuvinteRankings();
});

function atualizarCabecalhosData() {
  const agora = new Date();
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  
  document.getElementById('labelDataHoje').textContent = agora.toLocaleDateString('pt-BR');
  document.getElementById('labelMesAtual').textContent = `${meses[agora.getMonth()]} / ${agora.getFullYear()}`;
}

function parseDataFlexivel(valorData) {
  if (!valorData) return new Date();
  if (valorData.toDate && typeof valorData.toDate === 'function') return valorData.toDate();
  if (valorData instanceof Date) return valorData;
  if (typeof valorData === 'string') {
    const limpo = valorData.trim();
    if (limpo.includes('/')) {
      const partes = limpo.split(' ')[0].split('/');
      if (partes.length === 3) {
        return new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
      }
    }
    const parsed = new Date(valorData);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function extrairConsultor(obj) {
  const prioridades = ['consultor', 'NOME CONSULTOR', 'NOME_CONSULTOR', 'Nome Consultor', 'nomeConsultor', 'vendedor'];
  for (const p of prioridades) {
    if (obj[p] && String(obj[p]).trim() !== '') return String(obj[p]).trim().toUpperCase();
  }
  return 'NÃO INFORMADO';
}

function extrairStatus(obj) {
  if (!obj || typeof obj !== 'object') return 'PENDENTE';
  const chaves = ['status', 'STATUS_VENDA', 'STATUS VENDA', 'STATUS', 'statusVenda'];
  for (const c of chaves) {
    if (obj[c]) return String(obj[c]).toUpperCase().trim();
  }
  return 'CONCLUÍDO';
}

function extrairValor(obj) {
  if (!obj || typeof obj !== 'object') return 66.80;
  const chaves = ['valor', 'VALOR', 'valorVenda', 'VALOR VENDA', 'total'];
  for (const c of chaves) {
    if (obj[c] !== undefined && obj[c] !== null && obj[c] !== '') {
      const val = obj[c];
      return typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.')) || 66.80;
    }
  }
  return 66.80;
}

function iniciarOuvinteRankings() {
  db.collection('vendas').onSnapshot((snapshot) => {
    const vendas = [];
    snapshot.forEach(doc => vendas.push({ id: doc.id, ...doc.data() }));

    if (totalVendasAnterior !== null && snapshot.size > totalVendasAnterior) {
      dispararEfeitoNovaVenda();
    }
    totalVendasAnterior = snapshot.size;

    processarRankings(vendas);
  }, (err) => {
    console.error('Erro ao processar rankings:', err);
  });
}

function dispararEfeitoNovaVenda() {
  const toast = document.getElementById('toastNovaVenda');
  if (!toast) return;

  toast.style.display = 'flex';
  toast.classList.add('animate-slide-down');

  setTimeout(() => {
    toast.classList.remove('animate-slide-down');
    toast.style.display = 'none';
  }, 4500);
}

function processarRankings(vendas) {
  const hoje = new Date();
  const diaHoje = hoje.getDate();
  const mesHoje = hoje.getMonth();
  const anoHoje = hoje.getFullYear();

  const mapaDiario = {};
  const mapaMensal = {};

  let totalHojeVendas = 0;
  let totalHojeValor = 0;
  let totalMensalVendas = 0;

  vendas.forEach(v => {
    const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
    const consultor = extrairConsultor(v);
    const status = extrairStatus(v);
    const valor = extrairValor(v);

    const ehHoje = dataObj.getDate() === diaHoje && dataObj.getMonth() === mesHoje && dataObj.getFullYear() === anoHoje;
    const ehMesAtual = dataObj.getMonth() === mesHoje && dataObj.getFullYear() === anoHoje;

    const ehRecusado = status.includes('NÃO') || status.includes('NAO') || status.includes('RECUS') || status.includes('CANCEL');
    const ehEfetivada = (status.includes('CONCLU') || status === 'OK') && !ehRecusado;

    // 1. Processamento Diário
    if (ehHoje) {
      if (!mapaDiario[consultor]) {
        mapaDiario[consultor] = { consultor, lancadas: 0, efetivadas: 0, valorTotal: 0 };
      }
      mapaDiario[consultor].lancadas++;
      if (ehEfetivada) {
        mapaDiario[consultor].efetivadas++;
        mapaDiario[consultor].valorTotal += valor;
        totalHojeVendas++;
        totalHojeValor += valor;
      }
    }

    // 2. Processamento Mensal
    if (ehMesAtual) {
      if (!mapaMensal[consultor]) {
        mapaMensal[consultor] = { consultor, lancadas: 0, efetivadas: 0, valorTotal: 0 };
      }
      mapaMensal[consultor].lancadas++;
      if (ehEfetivada) {
        mapaMensal[consultor].efetivadas++;
        mapaMensal[consultor].valorTotal += valor;
        totalMensalVendas++;
      }
    }
  });

  const arrayDiario = Object.values(mapaDiario).sort((a, b) => b.efetivadas - a.efetivadas || b.lancadas - a.lancadas);
  const arrayMensal = Object.values(mapaMensal).sort((a, b) => b.efetivadas - a.efetivadas || b.lancadas - a.lancadas);

  // Atualiza Hero
  document.getElementById('heroTotalHoje').textContent = `${totalHojeVendas} vendas`;
  document.getElementById('heroValorHoje').textContent = `R$ ${totalHojeValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('heroLiderHoje').textContent = arrayDiario.length > 0 && arrayDiario[0].efetivadas > 0 ? formatarNomeCurto(arrayDiario[0].consultor) : 'Em disputa...';

  document.getElementById('badgeTotalDiario').textContent = `${totalHojeVendas} Confirmadas`;
  document.getElementById('badgeTotalMensal').textContent = `${totalMensalVendas} Confirmadas`;

  renderizarTabelaRanking('corpoRankingDiario', arrayDiario);
  renderizarTabelaRanking('corpoRankingMensal', arrayMensal);
}

function renderizarIconePosicao(posicao) {
  if (posicao === 1) {
    return `<div class="medal-wrapper medal-gold" title="1º Lugar"><img src="icones/Ouro.svg" alt="1º Lugar" class="medal-svg" onerror="this.onerror=null; this.parentElement.innerHTML='🥇 1º';" /></div>`;
  }
  if (posicao === 2) {
    return `<div class="medal-wrapper medal-silver" title="2º Lugar"><img src="icones/Prata.svg" alt="2º Lugar" class="medal-svg" onerror="this.onerror=null; this.parentElement.innerHTML='🥈 2º';" /></div>`;
  }
  if (posicao === 3) {
    return `<div class="medal-wrapper medal-bronze" title="3º Lugar"><img src="icones/Bronze.svg" alt="3º Lugar" class="medal-svg" onerror="this.onerror=null; this.parentElement.innerHTML='🥉 3º';" /></div>`;
  }
  return `<span class="pill pill-data pill-pos-num">${posicao}º</span>`;
}

function renderizarAvatarConsultor(nome) {
  const limpo = formatarNomeCurto(nome);
  const iniciais = limpo.split(' ').map(p => p[0]).slice(0, 2).join('');
  return `
    <div class="consultor-avatar-pill">
      <div class="mini-avatar">${iniciais}</div>
      <span class="consultor-name-text" title="${nome}">${limpo}</span>
    </div>
  `;
}

function renderizarTabelaRanking(elementoId, lista) {
  const tbody = document.getElementById(elementoId);
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 36px 12px;">Nenhuma venda confirmada registrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((item, idx) => {
    const posicao = idx + 1;
    const isTop1 = posicao === 1;

    return `
      <tr class="ranking-row ${isTop1 ? 'row-leader' : ''}">
        <td class="text-center">${renderizarIconePosicao(posicao)}</td>
        <td>${renderizarAvatarConsultor(item.consultor)}</td>
        <td class="text-center"><span class="pill pill-matricula">${item.lancadas}</span></td>
        <td class="text-center"><span class="pill pill-status-concluido">${item.efetivadas}</span></td>
        <td class="text-right"><span class="pill pill-valor">R$ ${item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></td>
      </tr>
    `;
  }).join('');
}