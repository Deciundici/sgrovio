const SUPABASE_URL='https://nijsfyysxvqogjjfawrc.supabase.co';
const SUPABASE_KEY='sb_publishable_YBMEKwWJCtTZsiRBS45hGQ_sDogz1SE';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const loginView=document.getElementById('loginView');
const accountView=document.getElementById('accountView');
const emailInput=document.getElementById('email');
const passwordInput=document.getElementById('password');
const message=document.getElementById('message');
const accountEmail=document.getElementById('accountEmail');

document.getElementById('loginBtn').addEventListener('click',login);
document.getElementById('logoutBtn').addEventListener('click',logout);
passwordInput.addEventListener('keydown',e=>{if(e.key==='Enter')login();});

async function login(){
  message.textContent='';
  const email=emailInput.value.trim();
  const password=passwordInput.value;
  if(!email||!password){message.textContent='Inserisci email e password.';return;}
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){message.textContent='Accesso non riuscito: '+error.message;return;}
  showAccount(data.user);
}

function showAccount(user){
  loginView.style.display='none';
  accountView.style.display='block';
  accountEmail.textContent='Account: '+(user?.email||'');
}

function showLogin(){
  accountView.style.display='none';
  loginView.style.display='block';
  passwordInput.value='';
}

async function logout(){
  await sb.auth.signOut();
  showLogin();
}

(async()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(session?.user) showAccount(session.user);
})();