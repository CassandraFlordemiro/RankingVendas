// Configuração Oficial do Firebase para o RankingVendas
const firebaseConfig = {
  apiKey: "AIzaSyDgtHlqlv4meTjW4VyJ8HrVCfUqMHaoUp0",
  authDomain: "rankingvendas-d56da.firebaseapp.com",
  projectId: "rankingvendas-d56da",
  storageBucket: "rankingvendas-d56da.firebasestorage.app",
  messagingSenderId: "55208086303",
  appId: "1:55208086303:web:fd78e3481750c04acf3e2a",
  measurementId: "G-N74FZT7QY2"
};

// Inicializa a aplicação se ainda não estiver ativa
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}