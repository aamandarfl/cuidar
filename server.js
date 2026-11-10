const express = require('express'), session = require('express-session'), bcrypt = require('bcryptjs');
const multer = require('multer'), path = require('path'), crypto = require('crypto'), db = require('./db');
const app = express();
const upload = multer({
  storage: multer.diskStorage({ destination: 'uploads',
    filename: (q, f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(f.originalname).toLowerCase()) }),
  limits: { fileSize: 5e6 },
  fileFilter: (q, f, cb) => cb(null, /image\/(jpeg|png|webp)/.test(f.mimetype)) });
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SECRET || 'troque-este-segredo', resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' } }));

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const balance = id => db.prepare('SELECT COALESCE(SUM(delta),0) b FROM ledger WHERE user_id=?').get(id).b;
const level = b => b >= 500 ? 'Jardim' : b >= 100 ? 'Florescer' : 'Semente';
const need = role => (q, r, n) => q.session.u && (q.session.u.role === role || q.session.u.role === 'admin' && role !== 'mae')
  ? n() : r.redirect('/login');
const mae = need('mae'), admin = need('admin');

const page = (q, title, body) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Cuidar ✿</title><style>
:root{--r:#f8dfe8;--l:#e6dcf5;--v:#d5efe8;--t:#4a3b57}
*{box-sizing:border-box}body{margin:0;font:18px/1.6 system-ui,sans-serif;color:var(--t);background:#fffafc}
header{background:linear-gradient(90deg,var(--r),var(--l),var(--v));padding:12px 20px;display:flex;flex-wrap:wrap;gap:14px;align-items:center}
header a{color:var(--t);text-decoration:none;font-weight:600}header .logo{font-size:1.4em}main{max-width:1000px;margin:auto;padding:20px}
.card{background:#fff;border:1px solid var(--l);border-radius:16px;padding:16px;margin:12px 0;box-shadow:0 2px 8px #0001}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
button,.btn{background:#b78fd6;color:#fff;border:0;border-radius:12px;padding:10px 18px;font-size:1em;cursor:pointer;text-decoration:none;display:inline-block}
.btn2{background:#7cc4b0}input,select,textarea{width:100%;padding:10px;margin:4px 0 10px;border:1px solid #cbb8e0;border-radius:10px;font:inherit}
.bar{background:var(--l);border-radius:10px;overflow:hidden}.bar i{display:block;background:#7cc4b0;height:14px}
table{width:100%;border-collapse:collapse;font-size:.9em}td,th{padding:6px;border-bottom:1px solid var(--l);text-align:left}.pts{font-size:2em}
</style></head><body><header><a class="logo" href="/">✿ Cuidar</a><a href="/tarefas">Tarefas</a><a href="/recompensas">Recompensas</a>
<a href="/campanhas">Ajude a realizar sonhos</a>${q.session.u ? `${q.session.u.role === 'mae' ? '<a href="/perfil">Meu perfil</a>' : ''}
${q.session.u.role === 'admin' ? '<a href="/admin">Painel</a>' : ''}<a href="/sair">Sair</a>` : '<a href="/login">Entrar</a>'}</header>
<main>${body}</main></body></html>`;

app.get('/', (q, r) => r.send(page(q, 'Início', `<div class="card" style="text-align:center">
<h1>✿ Cuidar — um espaço de acolhimento</h1>
<!-- Troque pela foto do Hospital da Criança: coloque o arquivo em uploads/hospital.jpg e use <img src="/uploads/hospital.jpg"> -->
<p>Mãe, você não está sozinha. Aqui cada pequena conquista vira <b>Pontos de Cuidado ✿</b> que podem ser trocados por experiências e recompensas.</p>
<p><a class="btn" href="/cadastro/mae">Sou uma mãe oncológica</a> <a class="btn btn2" href="/cadastro/doador">Quero ser um doador</a></p></div>`)));

// ---------- autenticação ----------
app.get('/login', (q, r) => r.send(page(q, 'Entrar', `<div class="card"><h2>Entrar</h2><form method="post">
E-mail<input name="email" type="email" required>Senha<input name="pass" type="password" required><button>Entrar</button></form>
<p><small>Recuperação de senha: na etapa 2. Por enquanto, peça à administração para redefinir.</small></p></div>`)));
app.post('/login', (q, r) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(q.body.email).toLowerCase().trim());
  if (!u || !bcrypt.compareSync(q.body.pass, u.pass)) return r.send(page(q, 'Erro', '<div class="card">E-mail ou senha incorretos. <a href="/login">Tentar de novo</a></div>'));
  q.session.u = { id: u.id, name: u.name, role: u.role };
  r.redirect(u.role === 'admin' ? '/admin' : u.role === 'mae' ? '/perfil' : '/campanhas');
});
app.get('/sair', (q, r) => q.session.destroy(() => r.redirect('/')));
app.get('/cadastro/:tipo', (q, r) => {
  const m = q.params.tipo === 'mae';
  r.send(page(q, 'Cadastro', `<div class="card"><h2>${m ? 'Cadastro de mãe' : 'Cadastro de doador'}</h2><form method="post">
Nome<input name="name" required>E-mail<input name="email" type="email" required>Senha (mín. 8 caracteres)<input name="pass" type="password" minlength="8" required>
${m ? 'Telefone<input name="phone">Cidade e estado<input name="city">' : `Tipo de contribuição<select name="contrib"><option>Financeira</option><option>Produtos</option><option>Serviços</option><option>Experiências</option></select>`}
<label><input type="checkbox" required style="width:auto"> Li e aceito a Política de Privacidade (LGPD) e os Termos de Uso.</label><br><br><button>Criar conta</button></form></div>`));
});
app.post('/cadastro/:tipo', (q, r) => {
  const b = q.body, role = q.params.tipo === 'mae' ? 'mae' : 'doador';
  if (!b.pass || b.pass.length < 8) return r.send(page(q, 'Erro', '<div class="card">Senha muito curta.</div>'));
  try {
    const i = db.prepare('INSERT INTO users(name,email,pass,role,phone,city,contrib) VALUES(?,?,?,?,?,?,?)')
      .run(b.name, b.email.toLowerCase().trim(), bcrypt.hashSync(b.pass, 10), role, b.phone || null, b.city || null, b.contrib || null);
    q.session.u = { id: i.lastInsertRowid, name: b.name, role };
    r.redirect(role === 'mae' ? '/perfil' : '/campanhas');
  } catch { r.send(page(q, 'Erro', '<div class="card">Este e-mail já está cadastrado.</div>')); }
});

// ---------- tarefas ----------
app.get('/tarefas', (q, r) => {
  const f = q.query.min, rng = { 5: [0, 5], 10: [6, 10], 15: [11, 15], 99: [16, 999] }[f];
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`SELECT * FROM tasks WHERE active=1 AND (mission_date IS NULL OR mission_date=?) ${rng ? 'AND minutes BETWEEN ? AND ?' : ''} ORDER BY mission_date DESC, category`)
    .all(...(rng ? [today, ...rng] : [today]));
  r.send(page(q, 'Tarefas', `<h2>Tarefas</h2><p>Cada pequena conquista merece ser celebrada! Realize atividades, envie comprovações quando necessário e acumule <b>Pontos de Cuidado ✿</b>.</p>
<div class="card" style="background:var(--v)"><i>Você não precisa fazer tudo, nem estar presente todos os dias. Aqui, você escolhe seu ritmo e celebra suas próprias conquistas.</i></div>
<p>Tempo disponível: <a href="/tarefas?min=5">até 5 min</a> · <a href="/tarefas?min=10">5–10 min</a> · <a href="/tarefas?min=15">10–15 min</a> · <a href="/tarefas?min=99">mais de 15</a> · <a href="/tarefas">todas</a></p>
<div class="grid">${rows.map(t => `<div class="card"><small>${t.mission_date ? '🌷 Missão do Dia (opcional) · ' : ''}${esc(t.category)} · ~${t.minutes} min</small>
<h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><b>${t.points} ✿</b>
${q.session.u?.role === 'mae' ? `<form method="post" action="/tarefas/${t.id}/enviar" enctype="multipart/form-data"><textarea name="text" placeholder="Escreva aqui sua resposta"></textarea>
${t.needs_proof ? 'Foto ou captura de tela:<input type="file" name="img" accept="image/*" required>' : ''}<button>Enviar</button></form>` : '<a href="/login">Entre para participar</a>'}</div>`).join('')}</div>`));
});
app.post('/tarefas/:id/enviar', mae, upload.single('img'), (q, r) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id=? AND active=1').get(q.params.id);
  if (!t) return r.redirect('/tarefas');
  const dup = db.prepare("SELECT 1 FROM submissions WHERE user_id=? AND task_id=? AND status IN('Pendente','Aprovada') AND date(created)=date('now')").get(q.session.u.id, t.id);
  if (!dup) db.prepare('INSERT INTO submissions(user_id,task_id,text,image) VALUES(?,?,?,?)').run(q.session.u.id, t.id, q.body.text, q.file?.filename || null);
  r.redirect('/perfil');
});

// ---------- perfil ----------
app.get('/perfil', mae, (q, r) => {
  const id = q.session.u.id, b = balance(id);
  const L = db.prepare('SELECT * FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 30').all(id);
  const S = db.prepare('SELECT s.*,t.title FROM submissions s JOIN tasks t ON t.id=s.task_id WHERE user_id=? ORDER BY s.id DESC').all(id);
  const R = db.prepare('SELECT d.*,w.name FROM redemptions d JOIN rewards w ON w.id=d.reward_id WHERE user_id=? ORDER BY d.id DESC').all(id);
  r.send(page(q, 'Meu perfil', `<div class="card"><div class="pts">${b.toLocaleString('pt-BR')} ✿</div><b>Pontos de Cuidado</b> · Nível: ${level(b)}
<p><i>Seu esforço, suas conquistas e seus momentos de autocuidado.</i></p></div>
<h3>Minhas atividades</h3><div class="card"><table>${S.map(s => `<tr><td>${esc(s.title)}</td><td>${s.status}</td><td>${esc(s.note || '')}</td></tr>`).join('') || '<tr><td>Nada ainda — sem pressa 💗</td></tr>'}</table></div>
<h3>Minhas recompensas</h3><div class="card"><table>${R.map(d => `<tr><td>${esc(d.name)}</td><td><b>${d.status}</b></td><td>${esc(d.note || '')}</td></tr>`).join('') || '<tr><td>Nenhum resgate ainda.</td></tr>'}</table></div>
<h3>Histórico de pontos</h3><div class="card"><table>${L.map(l => `<tr><td>${l.created.slice(0, 10)}</td><td>${l.delta > 0 ? '+' : ''}${l.delta} ✿</td><td>${esc(l.reason)}</td></tr>`).join('')}</table></div>`));
});

// ---------- recompensas ----------
app.get('/recompensas', (q, r) => {
  const rows = db.prepare("SELECT * FROM rewards WHERE active=1 AND (expires IS NULL OR expires='' OR expires>=date('now')) ORDER BY surprise DESC, category").all();
  const b = q.session.u?.role === 'mae' ? balance(q.session.u.id) : null;
  r.send(page(q, 'Recompensas', `<h2>Recompensas</h2>${b !== null ? `<p>Seu saldo: <b>${b} ✿</b></p>` : ''}<div class="grid">${rows.map(w => `<div class="card">
<small>${w.surprise ? '🎁 Surpresa · ' : ''}${esc(w.category)}${w.expires ? ' · até ' + esc(w.expires) : ''}</small><h3>${esc(w.name)}</h3><p>${esc(w.description)}</p>
<b>${w.points ? w.points + ' ✿' : 'Gratuita'}</b> · ${w.stock > 0 ? w.stock + ' disponíveis' : 'Esgotada'}
${q.session.u?.role === 'mae' && w.stock > 0 ? `<form method="post" action="/recompensas/${w.id}/resgatar"><button>Resgatar</button></form>` : ''}</div>`).join('')}</div>`));
});
app.post('/recompensas/:id/resgatar', mae, (q, r) => {
  const uid = q.session.u.id;
  db.transaction(() => {
    const w = db.prepare("SELECT * FROM rewards WHERE id=? AND active=1 AND stock>0 AND (expires IS NULL OR expires='' OR expires>=date('now'))").get(q.params.id);
    if (!w || balance(uid) < w.points) return;
    const d = db.prepare('INSERT INTO redemptions(user_id,reward_id,points) VALUES(?,?,?)').run(uid, w.id, w.points);
    db.prepare('UPDATE rewards SET stock=stock-1 WHERE id=?').run(w.id);
    if (w.points) db.prepare('INSERT INTO ledger(user_id,delta,reason,ref) VALUES(?,?,?,?)').run(uid, -w.points, 'Resgate: ' + w.name, 'red:' + d.lastInsertRowid);
  })();
  r.redirect('/perfil');
});

// ---------- campanhas e doadores ----------
app.get('/campanhas', (q, r) => {
  const rows = db.prepare('SELECT * FROM campaigns WHERE active=1').all();
  r.send(page(q, 'Campanhas', `<h2>Ajude a realizar sonhos</h2><div class="grid">${rows.map(c => `<div class="card"><h3>${esc(c.name)}</h3>
<p><b>Objetivo:</b> ${esc(c.goal)}</p><p>${esc(c.description)}</p><div class="bar"><i style="width:${Math.min(100, c.collected / c.needed * 100)}%"></i></div>
${c.collected} de ${c.needed} itens
${q.session.u?.role === 'doador' ? `<form method="post" action="/campanhas/${c.id}/apoiar">O que você quer oferecer?<input name="offer" required><button>Quero apoiar esta campanha</button></form>` : '<p><a href="/cadastro/doador">Cadastre-se como doador</a></p>'}</div>`).join('')}</div>`));
});
app.post('/campanhas/:id/apoiar', need('doador'), (q, r) => {
  db.prepare('INSERT INTO sponsors(user_id,campaign_id,offer) VALUES(?,?,?)').run(q.session.u.id, q.params.id, q.body.offer);
  r.send(page(q, 'Obrigada', '<div class="card"><h2>Obrigada! 💗</h2>A administração entrará em contato.</div>'));
});

// ---------- painel administrativo ----------
const A = express.Router(); A.use(admin);
const sel = (n, opts, v) => `<select name="${n}">${opts.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
const STATUS = ['Solicitação realizada', 'Em análise', 'Aprovada', 'Disponível para retirada ou agendamento', 'Entregue', 'Recusada'];
A.get('/', (q, r) => {
  const S = db.prepare("SELECT s.*,t.title,t.points,u.name FROM submissions s JOIN tasks t ON t.id=s.task_id JOIN users u ON u.id=s.user_id WHERE s.status='Pendente'").all();
  const D = db.prepare('SELECT d.*,w.name rname,u.name FROM redemptions d JOIN rewards w ON w.id=d.reward_id JOIN users u ON u.id=d.user_id ORDER BY d.id DESC LIMIT 50').all();
  const W = db.prepare('SELECT * FROM rewards').all(), T = db.prepare('SELECT * FROM tasks').all(), C = db.prepare('SELECT * FROM campaigns').all();
  const P = db.prepare('SELECT s.*,u.name,u.email,c.name camp FROM sponsors s JOIN users u ON u.id=s.user_id LEFT JOIN campaigns c ON c.id=s.campaign_id ORDER BY s.id DESC').all();
  const U = db.prepare("SELECT id,name,email,role,city FROM users WHERE role!='admin'").all();
  r.send(page(q, 'Painel', `<h2>Painel administrativo</h2>
<h3>Atividades pendentes</h3>${S.map(s => `<div class="card"><b>${esc(s.name)}</b> — ${esc(s.title)} (${s.points} ✿)<p>${esc(s.text)}</p>
${s.image ? `<a href="/admin/img/${s.image}" target="_blank"><img src="/admin/img/${s.image}" width="160"></a>` : ''}
<form method="post" action="/admin/sub/${s.id}">Observação<input name="note"><button name="a" value="ok">Aprovar</button> <button name="a" value="no" style="background:#c77">Recusar</button></form></div>`).join('') || '<p>Nada pendente.</p>'}
<h3>Entregas de recompensas</h3>${D.map(d => `<form class="card" method="post" action="/admin/red/${d.id}"><b>${esc(d.name)}</b> — ${esc(d.rname)} (${d.points} ✿)
${sel('status', STATUS, d.status)}<input name="note" placeholder="Observação (retirada, entrega, agendamento)" value="${esc(d.note || '')}"><button>Atualizar</button></form>`).join('')}
<h3>Tarefas e Missões do Dia</h3><form class="card" method="post" action="/admin/task">Categoria<input name="category" required>Título<input name="title" required>Descrição<textarea name="description"></textarea>
Pontos<input name="points" type="number" required>Minutos<input name="minutes" type="number" value="10">${sel('needs_proof', ['0', '1'], '0')} (1 = exige foto)
Data da missão do dia (vazio = tarefa comum)<input name="mission_date" type="date"><button>Cadastrar</button></form>
<div class="card"><table>${T.map(t => `<tr><td>${esc(t.title)}</td><td>${t.points} ✿</td><td>${t.mission_date || ''}</td><td>${t.active ? 'ativa' : 'inativa'}</td><td><form method="post" action="/admin/task/${t.id}/toggle"><button>Ativar/Desativar</button></form></td></tr>`).join('')}</table></div>
<h3>Recompensas e estoque</h3><form class="card" method="post" action="/admin/reward">Categoria<input name="category" required>Nome<input name="name" required>Descrição<textarea name="description"></textarea>
Pontos (0 = gratuita)<input name="points" type="number" required>Estoque<input name="stock" type="number" required>Surpresa? ${sel('surprise', ['0', '1'], '0')} Válida até<input name="expires" type="date"><button>Cadastrar</button></form>
<div class="card"><table>${W.map(w => `<tr><form method="post" action="/admin/reward/${w.id}"><td>${esc(w.name)}</td><td><input name="points" type="number" value="${w.points}"></td><td><input name="stock" type="number" value="${w.stock}"></td><td>${sel('active', ['1', '0'], String(w.active))}</td><td><button>Salvar</button></td></form></tr>`).join('')}</table></div>
<h3>Campanhas</h3><form class="card" method="post" action="/admin/campaign">Nome<input name="name" required>Objetivo<input name="goal">Descrição<textarea name="description"></textarea>Itens necessários<input name="needed" type="number" required><button>Criar campanha</button></form>
<div class="card"><table>${C.map(c => `<tr><form method="post" action="/admin/campaign/${c.id}"><td>${esc(c.name)}</td><td>/${c.needed}</td><td><input name="collected" type="number" value="${c.collected}"></td><td>${sel('active', ['1', '0'], String(c.active))}</td><td><button>Salvar</button></td></form></tr>`).join('')}</table></div>
<h3>Patrocinadores e doações</h3><div class="card"><table>${P.map(p => `<tr><form method="post" action="/admin/sponsor/${p.id}"><td>${esc(p.name)} (${esc(p.email)})</td><td>${esc(p.camp || '')}: ${esc(p.offer)}</td><td>${sel('status', ['Recebida', 'Confirmada', 'Entregue'], p.status)}</td><td>${sel('public_ok', ['0', '1'], String(p.public_ok))} exibir?</td><td><button>Salvar</button></td></form></tr>`).join('')}</table></div>
<h3>Participantes e ajuste de pontos</h3><div class="card"><table>${U.map(u => `<tr><td>${esc(u.name)} (${u.role})</td><td>${u.role === 'mae' ? balance(u.id) + ' ✿' : ''}</td><td>${u.role === 'mae' ? `<form method="post" action="/admin/points/${u.id}"><input name="delta" type="number" placeholder="+/-"><input name="reason" placeholder="Motivo" required><button>Ajustar</button></form>` : ''}</td></tr>`).join('')}</table></div>`));
});
A.get('/img/:f', (q, r) => r.sendFile(path.join(__dirname, 'uploads', path.basename(q.params.f))));
A.post('/sub/:id', (q, r) => {
  db.transaction(() => {
    const s = db.prepare("SELECT s.*,t.points,t.title FROM submissions s JOIN tasks t ON t.id=s.task_id WHERE s.id=? AND s.status='Pendente'").get(q.params.id);
    if (!s) return;
    const ok = q.body.a === 'ok';
    db.prepare('UPDATE submissions SET status=?,note=? WHERE id=?').run(ok ? 'Aprovada' : 'Recusada', q.body.note, s.id);
    if (ok) db.prepare('INSERT OR IGNORE INTO ledger(user_id,delta,reason,ref) VALUES(?,?,?,?)').run(s.user_id, s.points, 'Atividade: ' + s.title, 'sub:' + s.id);
  })();
  r.redirect('/admin');
});
A.post('/red/:id', (q, r) => {
  db.transaction(() => {
    const d = db.prepare('SELECT * FROM redemptions WHERE id=?').get(q.params.id);
    if (!d) return;
    if (q.body.status === 'Recusada' && d.status !== 'Recusada') {
      db.prepare('UPDATE rewards SET stock=stock+1 WHERE id=?').run(d.reward_id);
      if (d.points) db.prepare('INSERT OR IGNORE INTO ledger(user_id,delta,reason,ref) VALUES(?,?,?,?)').run(d.user_id, d.points, 'Estorno de resgate', 'ref:' + d.id);
    }
    db.prepare('UPDATE redemptions SET status=?,note=? WHERE id=?').run(q.body.status, q.body.note, d.id);
  })();
  r.redirect('/admin');
});
A.post('/task', (q, r) => { const b = q.body;
  db.prepare('INSERT INTO tasks(category,title,description,points,minutes,needs_proof,mission_date) VALUES(?,?,?,?,?,?,?)')
    .run(b.category, b.title, b.description, +b.points, +b.minutes, +b.needs_proof, b.mission_date || null); r.redirect('/admin'); });
A.post('/task/:id/toggle', (q, r) => { db.prepare('UPDATE tasks SET active=1-active WHERE id=?').run(q.params.id); r.redirect('/admin'); });
A.post('/reward', (q, r) => { const b = q.body;
  db.prepare('INSERT INTO rewards(category,name,description,points,stock,surprise,expires) VALUES(?,?,?,?,?,?,?)')
    .run(b.category, b.name, b.description, +b.points, +b.stock, +b.surprise, b.expires || null); r.redirect('/admin'); });
A.post('/reward/:id', (q, r) => { db.prepare('UPDATE rewards SET points=?,stock=?,active=? WHERE id=?').run(+q.body.points, +q.body.stock, +q.body.active, q.params.id); r.redirect('/admin'); });
A.post('/campaign', (q, r) => { const b = q.body;
  db.prepare('INSERT INTO campaigns(name,goal,description,needed) VALUES(?,?,?,?)').run(b.name, b.goal, b.description, +b.needed); r.redirect('/admin'); });
A.post('/campaign/:id', (q, r) => { db.prepare('UPDATE campaigns SET collected=?,active=? WHERE id=?').run(+q.body.collected, +q.body.active, q.params.id); r.redirect('/admin'); });
A.post('/sponsor/:id', (q, r) => { db.prepare('UPDATE sponsors SET status=?,public_ok=? WHERE id=?').run(q.body.status, +q.body.public_ok, q.params.id); r.redirect('/admin'); });
A.post('/points/:id', (q, r) => {
  const d = parseInt(q.body.delta, 10);
  if (d) db.prepare('INSERT INTO ledger(user_id,delta,reason,ref,by_admin) VALUES(?,?,?,?,1)').run(q.params.id, d, 'Ajuste: ' + q.body.reason, 'adm:' + Date.now() + ':' + q.params.id);
  r.redirect('/admin');
});
app.use('/admin', A);
app.listen(3000, () => console.log('Site no ar: http://localhost:3000'));
