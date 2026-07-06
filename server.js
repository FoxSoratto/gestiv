const express = require("express");
const session = require("express-session");
const fs = require("fs/promises");
const path = require("path");
const ping = require("ping");

const app = express();
const PORT = 3000;

const DB_PATH = path.join(__dirname, "db.json");
const PUBLIC_PATH = path.join(__dirname, "public");

const LOGIN_USER = "admin";
const LOGIN_PASSWORD = "@Via@Tech37";

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "gerenciador-ips-motiva-troque-esta-chave",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

function isAuthenticated(req) {
  return req.session && req.session.authenticated === true;
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) {
    return next();
  }

  if (req.path.startsWith("/api")) {
    return res.status(401).json({
      message: "Acesso não autorizado. Faça login novamente."
    });
  }

  return res.redirect("/login");
}

app.get("/login", (req, res) => {
  if (isAuthenticated(req)) {
    return res.redirect("/");
  }

  res.sendFile(path.join(PUBLIC_PATH, "login.html"));
});

app.post("/login", (req, res) => {
  const usuario = String(req.body.usuario || "").trim();
  const senha = String(req.body.senha || "");

  if (usuario === LOGIN_USER && senha === LOGIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.user = usuario;

    return res.redirect("/");
  }

  return res.redirect("/login?erro=1");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

app.get("/api/auth/status", (req, res) => {
  res.json({
    authenticated: isAuthenticated(req),
    user: req.session ? req.session.user : null
  });
});

/**
 * A partir daqui, tudo exige login.
 */
app.use(requireAuth);

app.use(express.static(PUBLIC_PATH));

async function readDb() {
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    const parsed = JSON.parse(data);

    if (Array.isArray(parsed)) {
      return {
        equipamentos: parsed
      };
    }

    return {
      equipamentos: Array.isArray(parsed.equipamentos) ? parsed.equipamentos : []
    };
  } catch {
    return {
      equipamentos: []
    };
  }
}

async function writeDb(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getFirstValidIp(value) {
  const text = String(value || "");
  const match = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  return match ? match[0] : "";
}

async function pingIp(ipValue) {
  const target = getFirstValidIp(ipValue);

  if (!target) {
    return {
      online: false,
      time: "-",
      target: "",
      message: "IP inválido ou não encontrado."
    };
  }

  try {
    const result = await ping.promise.probe(target, {
      timeout: 2
    });

    return {
      online: result.alive,
      time: result.time,
      target,
      message: result.alive ? "Online" : "Offline"
    };
  } catch (error) {
    return {
      online: false,
      time: "-",
      target,
      message: error.message
    };
  }
}

app.get("/api/equipamentos", async (req, res) => {
  const db = await readDb();
  const search = normalizeText(req.query.search);

  let equipamentos = db.equipamentos;

  if (search) {
    equipamentos = equipamentos.filter((item) => {
      return (
        normalizeText(item.vlan).includes(search) ||
        normalizeText(item.nome).includes(search) ||
        normalizeText(item.ip).includes(search) ||
        normalizeText(item.area).includes(search) ||
        normalizeText(item.servicoModelo).includes(search) ||
        normalizeText(item.status).includes(search)
      );
    });
  }

  res.json(equipamentos);
});

app.post("/api/equipamentos", async (req, res) => {
  const db = await readDb();

  const novo = {
    id: Date.now(),
    vlan: String(req.body.vlan || "").trim(),
    nome: String(req.body.nome || "").trim(),
    ip: String(req.body.ip || "").trim(),
    area: String(req.body.area || "").trim(),
    servicoModelo: String(req.body.servicoModelo || "").trim(),
    status: "Não testado",
    ultimaVerificacao: "",
    tempoResposta: "",
    ipTestado: ""
  };

  if (!novo.nome || !novo.ip) {
    return res.status(400).json({
      message: "Nome e IP são obrigatórios."
    });
  }

  const ipDuplicado = db.equipamentos.some((item) => item.ip === novo.ip);

  if (ipDuplicado) {
    return res.status(409).json({
      message: "Já existe um equipamento cadastrado com este IP."
    });
  }

  db.equipamentos.push(novo);
  await writeDb(db);

  res.status(201).json(novo);
});

app.put("/api/equipamentos/:id", async (req, res) => {
  const db = await readDb();
  const id = Number(req.params.id);

  const index = db.equipamentos.findIndex((item) => Number(item.id) === id);

  if (index === -1) {
    return res.status(404).json({
      message: "Equipamento não encontrado."
    });
  }

  const nome = String(req.body.nome || "").trim();
  const ipNovo = String(req.body.ip || "").trim();

  if (!nome || !ipNovo) {
    return res.status(400).json({
      message: "Nome e IP são obrigatórios."
    });
  }

  const ipDuplicado = db.equipamentos.some((item) => {
    return item.ip === ipNovo && Number(item.id) !== id;
  });

  if (ipDuplicado) {
    return res.status(409).json({
      message: "Já existe outro equipamento cadastrado com este IP."
    });
  }

  db.equipamentos[index] = {
    ...db.equipamentos[index],
    vlan: String(req.body.vlan || "").trim(),
    nome,
    ip: ipNovo,
    area: String(req.body.area || "").trim(),
    servicoModelo: String(req.body.servicoModelo || "").trim()
  };

  await writeDb(db);

  res.json(db.equipamentos[index]);
});

app.post("/api/equipamentos/bulk-delete", async (req, res) => {
  const db = await readDb();

  const ids = Array.isArray(req.body.ids)
    ? req.body.ids.map((id) => Number(id))
    : [];

  if (!ids.length) {
    return res.status(400).json({
      message: "Nenhum equipamento selecionado para exclusão."
    });
  }

  const totalAntes = db.equipamentos.length;

  db.equipamentos = db.equipamentos.filter((item) => {
    return !ids.includes(Number(item.id));
  });

  const removidos = totalAntes - db.equipamentos.length;

  await writeDb(db);

  res.json({
    message: "Equipamentos excluídos com sucesso.",
    removidos
  });
});

app.post("/api/equipamentos/ping-batch", async (req, res) => {
  const db = await readDb();

  const ids = Array.isArray(req.body.ids)
    ? req.body.ids.map((id) => Number(id)).filter((id) => !Number.isNaN(id))
    : [];

  if (!ids.length) {
    return res.status(400).json({
      message: "Nenhum equipamento enviado para teste."
    });
  }

  const limitedIds = ids.slice(0, 5);

  const resultados = await Promise.all(
    limitedIds.map(async (id) => {
      const index = db.equipamentos.findIndex((item) => {
        return Number(item.id) === Number(id);
      });

      if (index === -1) {
        return {
          id,
          encontrado: false,
          message: "Equipamento não encontrado."
        };
      }

      const resultado = await pingIp(db.equipamentos[index].ip);

      db.equipamentos[index].status = resultado.online ? "Online" : "Offline";
      db.equipamentos[index].ultimaVerificacao = new Date().toISOString();
      db.equipamentos[index].tempoResposta = resultado.time;
      db.equipamentos[index].ipTestado = resultado.target;

      return {
        id,
        encontrado: true,
        equipamento: db.equipamentos[index],
        resultado
      };
    })
  );

  await writeDb(db);

  res.json({
    total: resultados.length,
    resultados
  });
});

app.delete("/api/equipamentos/:id", async (req, res) => {
  const db = await readDb();
  const id = Number(req.params.id);

  const existe = db.equipamentos.some((item) => Number(item.id) === id);

  if (!existe) {
    return res.status(404).json({
      message: "Equipamento não encontrado."
    });
  }

  db.equipamentos = db.equipamentos.filter((item) => Number(item.id) !== id);

  await writeDb(db);

  res.json({
    message: "Equipamento excluído com sucesso."
  });
});

app.post("/api/equipamentos/:id/ping", async (req, res) => {
  const db = await readDb();
  const id = Number(req.params.id);

  const index = db.equipamentos.findIndex((item) => Number(item.id) === id);

  if (index === -1) {
    return res.status(404).json({
      message: "Equipamento não encontrado."
    });
  }

  const resultado = await pingIp(db.equipamentos[index].ip);

  db.equipamentos[index].status = resultado.online ? "Online" : "Offline";
  db.equipamentos[index].ultimaVerificacao = new Date().toISOString();
  db.equipamentos[index].tempoResposta = resultado.time;
  db.equipamentos[index].ipTestado = resultado.target;

  await writeDb(db);

  res.json({
    equipamento: db.equipamentos[index],
    resultado
  });
});

app.post("/api/importar", async (req, res) => {
  const db = await readDb();

  const equipamentos = Array.isArray(req.body.equipamentos)
    ? req.body.equipamentos
    : [];

  let importados = 0;
  let atualizados = 0;
  let ignorados = 0;

  for (const equipamento of equipamentos) {
    const item = {
      vlan: String(equipamento.vlan || "").trim(),
      nome: String(equipamento.nome || "").trim(),
      ip: String(equipamento.ip || "").trim(),
      area: String(equipamento.area || "").trim(),
      servicoModelo: String(equipamento.servicoModelo || "").trim()
    };

    if (!item.nome || !item.ip) {
      ignorados++;
      continue;
    }

    const existenteIndex = db.equipamentos.findIndex((eq) => eq.ip === item.ip);

    if (existenteIndex >= 0) {
      db.equipamentos[existenteIndex] = {
        ...db.equipamentos[existenteIndex],
        ...item
      };

      atualizados++;
    } else {
      db.equipamentos.push({
        id: Date.now() + Math.floor(Math.random() * 100000),
        ...item,
        status: "Não testado",
        ultimaVerificacao: "",
        tempoResposta: "",
        ipTestado: ""
      });

      importados++;
    }
  }

  await writeDb(db);

  res.json({
    message: "Importação concluída.",
    importados,
    atualizados,
    ignorados,
    totalRecebido: equipamentos.length
  });
});

app.listen(PORT, () => {
  console.log(`Gerenciador de IPs rodando em http://localhost:${PORT}`);
  console.log(`Tela de login: http://localhost:${PORT}/login`);
});