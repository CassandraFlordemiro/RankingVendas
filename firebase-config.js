/**
 * Configuração e Inicialização do Firebase com Cache Persistente Local
 */

// Insira ou mantenha as credenciais do seu projeto Firebase abaixo
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "rankingvendas-d56da.firebaseapp.com",
  projectId: "rankingvendas-d56da",
  storageBucket: "rankingvendas-d56da.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa o Firebase apenas se não houver instância ativa
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Inicializa a instância do Firestore
const firestoreDb = firebase.firestore();

// Ativa o cache local persistente com sincronização entre múltiplas abas
firestoreDb.enablePersistence({ synchronizeTabs: true })
  .then(() => {
    console.log("Cache offline e persistência do Firestore ativados com sucesso.");
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // Múltiplas abas abertas simultaneamente durante a ativação inicial
      console.warn("Aviso: Múltiplas abas abertas. A persistência operará na aba principal.");
    } else if (err.code === 'unimplemented') {
      // Navegador sem suporte a IndexedDB
      console.warn("Aviso: O navegador atual não suporta armazenamento local persistente.");
    } else {
      console.error("Erro ao ativar persistência do Firestore:", err);
    }
  });