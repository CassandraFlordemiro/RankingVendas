import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgtHlqlv4meTjW4VyJ8HrVCfUqMHaoUp0",
  authDomain: "rankingvendas-d56da.firebaseapp.com",
  projectId: "rankingvendas-d56da",
  storageBucket: "rankingvendas-d56da.firebasestorage.app",
  messagingSenderId: "55208086303",
  appId: "1:55208086303:web:fd78e3481750c04acf3e2a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const formLogin = document.getElementById('form-login');
const inputEmail = document.getElementById('email');
const inputSenha = document.getElementById('senha');
const msgErro = document.getElementById('msg-erro');
const btnEntrar = document.getElementById('btn-entrar');

// Se já estiver logado, redireciona direto para o painel
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "admin.html";
    }
});

// Evento de Login
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgErro.style.display = 'none';
    btnEntrar.textContent = "Verificando...";
    btnEntrar.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, inputEmail.value.trim(), inputSenha.value);
        window.location.href = "admin.html";
    } catch (erro) {
        btnEntrar.textContent = "Entrar no Painel";
        btnEntrar.disabled = false;
        msgErro.style.display = 'block';
        msgErro.textContent = "E-mail ou senha incorretos.";
    }
});