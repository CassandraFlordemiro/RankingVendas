const db = firebase.firestore();
let totalVendasAnterior = null;
let vendasCacheLocal = [];

// Metas salvas no localStorage com valores padrão
let metaMensalDinheiro = parseFloat(localStorage.getItem('ranking_meta_mensal')) || 70000.00;
let metaMensalQtd = parseInt(localStorage.getItem('ranking_meta_qtd'), 10) || 1000;

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
  inicializarFiltrosRetroativos();
  configurarModoTv();
  configurarEdicaoMetas();
  iniciarOuvinteRankings();
});

function inicializarFiltrosRetroativos() {
  const agora = new Date();
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const inputData = document.getElementById('filtroDataDiario');
  const diaFormatado = agora.toISOString().split('T')[0];
  inputData.value = diaFormatado;
  inputData.addEventListener('change', () => processarRankings(vendasCacheLocal));

  const selectMes = document.getElementById('filtroMesRanking');
  selectMes.value = agora.getMonth().toString();
  selectMes.addEventListener('change', () => {
    const nomeMes = meses[selectMes.value];
    document.getElementById('txtMesMetaDinheiro').textContent = nomeMes;
    document.getElementById('txtMesMetaQtd').textContent = nomeMes;
    processarRankings(vendasCacheLocal);
  });

  document.getElementById('txtMesMetaDinheiro').textContent = meses[agora.getMonth()];
  document.getElementById('txtMesMetaQtd').textContent = meses[agora.getMonth()];
}

function configurarEdicaoMetas() {
  // 1. Edição da Meta Financeira (R$)
  const btnEditarDinheiro = document.getElementById('btnEditarMeta');
  if (btnEditarDinheiro) {
    btnEditarDinheiro.onclick = () => {
      const valorDigitado = prompt('Informe a nova meta financeira em R$:', metaMensalDinheiro);
      if (valorDigitado !== null) {
        const valorNum = parseFloat(valorDigitado.replace(',', '.'));
        if (!isNaN(valorNum) && valorNum > 0) {
          metaMensalDinheiro = valorNum;
          localStorage.setItem('ranking_meta_mensal', valorNum);
          processarRankings(vendasCacheLocal);
        } else {
          alert('Por favor, informe um valor monetário válido.');
        }
      }
    };
  }

  // 2. Edição da Meta por Quantidade de Vendas
  const btnEditarQtd = document.getElementById('btnEditarMetaQtd');
  if (btnEditarQtd) {
    btnEditarQtd.onclick = () => {
      const valorDigitado = prompt('Informe a nova meta de contratos (número de vendas):', metaMensalQtd);
      if (valorDigitado !== null) {
        const valorNum = parseInt(valorDigitado, 10);
        if (!isNaN(valorNum) && valorNum > 0) {
          metaMensalQtd = valorNum;
          localStorage.setItem('ranking_meta_qtd', valorNum);
          processarRankings(vendasCacheLocal);
        } else {
          alert('Por favor, informe um número inteiro de vendas.');
        }
      }
    };
  }
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
    vendasCacheLocal = [];
    snapshot.forEach(doc => vendasCacheLocal.push({ id: doc.id, ...doc.data() }));

    if (totalVendasAnterior !== null && snapshot.size > totalVendasAnterior) {
      dispararEfeitoNovaVenda();
    }
    totalVendasAnterior = snapshot.size;

    processarRankings(vendasCacheLocal);
  }, (err) => {
    console.error('Erro ao processar rankings:', err);
  });
}

function dispararEfeitoNovaVenda() {
  const toast = document.getElementById('toastNovaVenda');
  if (toast) {
    toast.style.display = 'flex';
    toast.classList.add('animate-slide-down');
    setTimeout(() => {
      toast.classList.remove('animate-slide-down');
      toast.style.display = 'none';
    }, 5000);
  }

  if (typeof confetti === 'function') {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#bd93f9', '#50fa7b', '#f1fa8c', '#ff79c6', '#8be9fd']
    });
  }

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

function processarRankings(vendas) {
  const inputData = document.getElementById('filtroDataDiario').value;
  let dataFiltroDiario = new Date();
  if (inputData) {
    const [anoD, mesD, diaD] = inputData.split('-').map(Number);
    dataFiltroDiario = new Date(anoD, mesD - 1, diaD);
  }

  const mesFiltroIndex = parseInt(document.getElementById('filtroMesRanking').value, 10);
  const anoFiltro = dataFiltroDiario.getFullYear();

  const mapaDiario = {};
  const mapaMensal = {};

  let totalHojeVendas = 0;
  let totalHojeValor = 0;
  let totalMensalVendas = 0;
  let totalMensalValor = 0;

  vendas.forEach(v => {
    const dataObj = parseDataFlexivel(v.dataVenda || v.DATA_VENDA || v.data);
    const consultor = extrairConsultor(v);
    const status = extrairStatus(v);
    const valor = extrairValor(v);

    const matchDia = dataObj.getDate() === dataFiltroDiario.getDate() &&
                     dataObj.getMonth() === dataFiltroDiario.getMonth() &&
                     dataObj.getFullYear() === dataFiltroDiario.getFullYear();

    const matchMes = dataObj.getMonth() === mesFiltroIndex &&
                     dataObj.getFullYear() === anoFiltro;

    const ehRecusado = status.includes('NÃO') || status.includes('NAO') || status.includes('RECUS') || status.includes('CANCEL');
    const ehEfetivada = (status.includes('CONCLU') || status === 'OK') && !ehRecusado;

    // Diário
    if (matchDia) {
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

    // Mensal
    if (matchMes) {
      if (!mapaMensal[consultor]) {
        mapaMensal[consultor] = { consultor, lancadas: 0, efetivadas: 0, valorTotal: 0 };
      }
      mapaMensal[consultor].lancadas++;
      if (ehEfetivada) {
        mapaMensal[consultor].efetivadas++;
        mapaMensal[consultor].valorTotal += valor;
        totalMensalVendas++;
        totalMensalValor += valor;
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

  // Atualiza Ambos os Termômetros
  atualizarTermometrosDuplos(totalMensalValor, totalMensalVendas);

  // Renderiza Pódios e Tabelas
  atualizarPodioVisual('Diario', arrayDiario);
  atualizarPodioVisual('Mensal', arrayMensal);

  renderizarTabelaRanking('corpoRankingDiario', arrayDiario);
  renderizarTabelaRanking('corpoRankingMensal', arrayMensal);
}

function atualizarTermometrosDuplos(valorAcumulado, qtdAcumulada) {
  // 1. Termômetro Financeiro (R$)
  const pctDinheiro = Math.min(100, Math.round((valorAcumulado / metaMensalDinheiro) * 100));
  const barraDinheiro = document.getElementById('barraProgressoMeta');
  
  barraDinheiro.style.width = `${pctDinheiro}%`;
  document.getElementById('txtValorAtualMeta').textContent = `R$ ${valorAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('txtValorObjetivoMeta').textContent = `R$ ${metaMensalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('txtPercentualMeta').textContent = `${pctDinheiro}% Concluído`;

  const restanteDinheiro = metaMensalDinheiro - valorAcumulado;
  if (restanteDinheiro > 0) {
    document.getElementById('txtSubMetaDinheiro').textContent = `Faltam R$ ${restanteDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para a meta`;
  } else {
    document.getElementById('txtSubMetaDinheiro').textContent = `🚀 META BATIDA!`;
  }

  // 2. Termômetro em Quantidade de Contratos
  const pctQtd = Math.min(100, Math.round((qtdAcumulada / metaMensalQtd) * 100));
  const barraQtd = document.getElementById('barraProgressoMetaQtd');

  barraQtd.style.width = `${pctQtd}%`;
  document.getElementById('txtQtdAtualMeta').textContent = `${qtdAcumulada} vendas`;
  document.getElementById('txtQtdObjetivoMeta').textContent = `${metaMensalQtd} vendas`;
  document.getElementById('txtPercentualMetaQtd').textContent = `${pctQtd}% Concluído`;

  const restanteQtd = metaMensalQtd - qtdAcumulada;
  if (restanteQtd > 0) {
    document.getElementById('txtSubMetaQtd').textContent = `Faltam ${restanteQtd} contratos para a meta`;
  } else {
    document.getElementById('txtSubMetaQtd').textContent = `🎯 META DE VOLUME BATIDA!`;
  }
}

function atualizarPodioVisual(tipo, lista) {
  const c1 = lista[0];
  const c2 = lista[1];
  const c3 = lista[2];

  if (c1 && c1.efetivadas > 0) {
    const nome1 = formatarNomeCurto(c1.consultor);
    document.getElementById(`nome${tipo}1`).textContent = nome1;
    document.getElementById(`score${tipo}1`).textContent = `${c1.efetivadas} vendas (R$ ${c1.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
    document.getElementById(`avatar${tipo}1`).textContent = nome1.split(' ').map(p => p[0]).slice(0, 2).join('');
  } else {
    document.getElementById(`nome${tipo}1`).textContent = 'Em disputa...';
    document.getElementById(`score${tipo}1`).textContent = '0 vendas';
    document.getElementById(`avatar${tipo}1`).textContent = '--';
  }

  if (c2 && c2.efetivadas > 0) {
    const nome2 = formatarNomeCurto(c2.consultor);
    document.getElementById(`nome${tipo}2`).textContent = nome2;
    document.getElementById(`score${tipo}2`).textContent = `${c2.efetivadas} vendas`;
    document.getElementById(`avatar${tipo}2`).textContent = nome2.split(' ').map(p => p[0]).slice(0, 2).join('');
  } else {
    document.getElementById(`nome${tipo}2`).textContent = 'Em disputa...';
    document.getElementById(`score${tipo}2`).textContent = '0 vendas';
    document.getElementById(`avatar${tipo}2`).textContent = '--';
  }

  if (c3 && c3.efetivadas > 0) {
    const nome3 = formatarNomeCurto(c3.consultor);
    document.getElementById(`nome${tipo}3`).textContent = nome3;
    document.getElementById(`score${tipo}3`).textContent = `${c3.efetivadas} vendas`;
    document.getElementById(`avatar${tipo}3`).textContent = nome3.split(' ').map(p => p[0]).slice(0, 2).join('');
  } else {
    document.getElementById(`nome${tipo}3`).textContent = 'Em disputa...';
    document.getElementById(`score${tipo}3`).textContent = '0 vendas';
    document.getElementById(`avatar${tipo}3`).textContent = '--';
  }
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 36px 12px;">Nenhuma venda confirmada neste período.</td></tr>`;
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

function configurarModoTv() {
  const btn = document.getElementById('btnModoTv');
  if (!btn) return;

  btn.onclick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => alert('Erro: ' + err.message));
      btn.innerHTML = '<i class="fa-solid fa-compress"></i> Sair do Modo TV';
    } else {
      document.exitFullscreen();
      btn.innerHTML = '<i class="fa-solid fa-tv"></i> Modo TV';
    }
  };
}