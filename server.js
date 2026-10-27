const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json"
  });

  res.end(JSON.stringify({
    status: "online",
    sistema: "Whmer"
  }));
});

const wss = new WebSocket.Server({ server });

const usuarios = new Map();

function obterIP(req) {
  const ipRender = req.headers["true-client-ip"];
  if (process.env.RENDER && ipRender) {
    return ipRender.trim();
  }

  const encaminhado = req.headers["x-forwarded-for"];
  if (encaminhado) {
    return encaminhado.split(",")[0].trim();
  }

  let ip = req.socket.remoteAddress || "";
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  return ip;
}

async function obterCidade(ip) { 
  //async function  (ip) {
  try {
    if (
      ip === "::1" ||
      ip === "127.0.0.1" ||
      ip.startsWith("192.168.") ||
      ip.startsWith("10.")
    ) {
      return {
        cidade: "Local desconhecido",
        regiao: "Local desconhecido",
        pais: "Local desconhecido"
      };
    }
    const resposta = await fetch(
      "https://ipapi.co/" + encodeURIComponent(ip) + "/json/"
    );
    if (!resposta.ok) {
      throw new Error("Falha na consulta de localização");
    }
    const dados = await resposta.json();
    return {
      cidade: dados.city || "Não identificada",
      regiao: dados.region || "Não identificada",
      pais: dados.country_name || "Não identificado"
    };
  } catch (erro) {
    console.error("Erro ao obter localização:", erro.message);
    return {
      cidade: "Não identificada",
      regiao: "Não identificada",
      pais: "Não identificado"
    };
  }
}
function transmitirUsuarios() {
  const dados = JSON.stringify({
    tipo: "listaUsuarios",
    usuarios: Array.from(usuarios.values())
  });

  wss.clients.forEach(cliente => {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(dados);
    }
  });
}

wss.on("connection", (socket, req) => {
  const ip = obterIP(req);

  socket.on("message", async mensagem => {
    try {
      const dados = JSON.parse(mensagem.toString());

      if (dados.tipo !== "usuario") return;

      const nome = String(dados.nome || "Anônimo")
        .trim()
        .slice(0, 40);

      if (!nome) return;

      const id = socket;

      // Não permitir que a mesma conexão crie vários usuários.
      if (socket.usuarioId) {
        const usuarioExistente = usuarios.get(socket.usuarioId);

        if (usuarioExistente) {
          usuarioExistente.nome = nome;
          transmitirUsuarios();
        }

        return;
      }

      const cidade = await obterCidade(ip);

      const usuario = {

  nome,

  ip,

  cidade: cidade.cidade,

  regiao: cidade.regiao,

  pais: cidade.pais

};
      
      usuarios.set(id, usuario);
      socket.usuarioId = id;

      transmitirUsuarios();

    } catch (erro) {
      console.error("Erro:", erro.message);
    }
  });

  socket.on("close", () => {
    if (socket.usuarioId) {
      usuarios.delete(socket.usuarioId);
      transmitirUsuarios();
    }
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("Servidor online na porta " + PORT);
});
