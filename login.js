document.addEventListener('DOMContentLoaded', () => {
  const temaSalvo = localStorage.getItem('ranking_theme_selected') || 'dracula';
  document.body.className = `theme-${temaSalvo} login-body`;
  
  const selectTema = document.getElementById('seletorTemaLogin');
  if (selectTema) selectTema.value = temaSalvo;

  const emailSalvo = localStorage.getItem('ranking_user_remembered');
  if (emailSalvo) {
    document.getElementById('loginEmail').value = emailSalvo;
    document.getElementById('checkLembrar').checked = true;
  }

  document.getElementById('formLogin').addEventListener('submit', executarLogin);
  document.getElementById('btnToggleSenha').addEventListener('click', toggleExibirSenha);
});

window.aplicarTema = function(tema) {
  document.body.className = `theme-${tema} login-body`;
  localStorage.setItem('ranking_theme_selected', tema);
};

function toggleExibirSenha() {
  const input = document.getElementById('loginSenha');
  const icon = document.getElementById('iconEye');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

async function executarLogin(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  const lembrar = document.getElementById('checkLembrar').checked;
  const btnSubmit = document.getElementById('btnLoginSubmit');
  const alertaErro = document.getElementById('loginErroMsg');
  const txtErro = document.getElementById('txtLoginErro');

  alertaErro.style.display = 'none';
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Autenticando...';

  try {
    if (lembrar) {
      localStorage.setItem('ranking_user_remembered', email);
    } else {
      localStorage.removeItem('ranking_user_remembered');
    }

    if (firebase.auth) {
      await firebase.auth().signInWithEmailAndPassword(email, senha);
    }

    window.location.href = 'index.html';
  } catch (err) {
    alertaErro.style.display = 'flex';
    txtErro.textContent = err.message || 'Falha na autenticação. Verifique os dados.';
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar no Sistema';
  }
}

window.recuperarSenha = function() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    alert('Digite seu e-mail no campo acima para recuperar a senha.');
    return;
  }
  if (firebase.auth) {
    firebase.auth().sendPasswordResetEmail(email)
      .then(() => alert('Instruções de redefinição enviadas para: ' + email))
      .catch(err => alert('Erro: ' + err.message));
  } else {
    alert('Recuperação de senha indisponível no momento.');
  }
};