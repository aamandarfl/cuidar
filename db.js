const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('data.db');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, pass TEXT,
  role TEXT, phone TEXT, city TEXT, contrib TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY, category TEXT, title TEXT, description TEXT,
  points INTEGER, minutes INTEGER, needs_proof INTEGER DEFAULT 0, mission_date TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY, user_id INTEGER, task_id INTEGER, text TEXT,
  image TEXT, status TEXT DEFAULT 'Pendente', note TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, user_id INTEGER, delta INTEGER, reason TEXT,
  ref TEXT, by_admin INTEGER, created TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, ref));
CREATE TABLE IF NOT EXISTS rewards(id INTEGER PRIMARY KEY, category TEXT, name TEXT, description TEXT,
  points INTEGER, stock INTEGER, surprise INTEGER DEFAULT 0, expires TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS redemptions(id INTEGER PRIMARY KEY, user_id INTEGER, reward_id INTEGER, points INTEGER,
  status TEXT DEFAULT 'Solicitação realizada', note TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS campaigns(id INTEGER PRIMARY KEY, name TEXT, goal TEXT, description TEXT,
  needed INTEGER, collected INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS sponsors(id INTEGER PRIMARY KEY, user_id INTEGER, campaign_id INTEGER, offer TEXT,
  status TEXT DEFAULT 'Recebida', public_ok INTEGER DEFAULT 0, created TEXT DEFAULT CURRENT_TIMESTAMP);
`);
if (!db.prepare('SELECT 1 FROM users').get()) {
  db.prepare('INSERT INTO users(name,email,pass,role) VALUES(?,?,?,?)')
    .run('Administração', 'admin@cuidar.local', bcrypt.hashSync('admin123', 10), 'admin');
  const t = db.prepare('INSERT INTO tasks(category,title,description,points,minutes,needs_proof) VALUES(?,?,?,?,?,?)');
  t.run('Leitura e conhecimento', 'Ler um capítulo de um livro', 'Leia um capítulo e envie uma foto do livro.', 15, 15, 1);
  t.run('Escrita e criatividade', 'Escrever uma carta para si mesma', 'Escreva livremente aqui.', 10, 10, 0);
  t.run('Autocuidado e autoestima', 'Reservar 10 minutos para si', 'Descanse e conte como foi.', 5, 10, 0);
  t.run('Maternidade e conexão familiar', 'Contar uma história para a criança', 'Envie uma foto, sem rostos.', 10, 15, 1);
  const r = db.prepare('INSERT INTO rewards(category,name,description,points,stock) VALUES(?,?,?,?,?)');
  r.run('Beleza e autocuidado', 'Vale manicure', 'Vale de manicure em salão parceiro.', 80, 5);
  r.run('Lazer e experiências', 'Ingresso de cinema', 'Um ingresso para o cinema.', 60, 10);
  r.run('Educação', 'Livro à escolha', 'Um livro da lista de títulos.', 70, 8);
  db.prepare('INSERT INTO campaigns(name,goal,description,needed) VALUES(?,?,?,?)')
    .run('Vales de manicure', 'Arrecadar vales', 'Ajude a presentear mães com autocuidado.', 30);
}
module.exports = db;
