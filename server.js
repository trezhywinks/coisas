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

function transmitirUsuarios() {
  const lista = JSON.stringify({
    tipo: "listaUsuarios",
    usuarios: Array.from(usuarios.values())
  });

  wss.clients.forEach(cliente => {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(lista);
    }
  });
}

wss.on("connection", socket => {
  socket.on("message", mensagem => {
    try {
      const dados = JSON.parse(mensagem.toString());

      if (dados.tipo !== "usuario") return;

      // O cliente precisa aceitar o compartilhamento.
      if (dados.consentimento !== true) return;

      const nome = String(dados.nome || "Anônimo")
        .trim()
        .slice(0, 40);

      if (!nome) return;

      const usuario = {
        nome,
        ip: String(dados.ip || "Não identificado").slice(0, 64),
        cidade: String(dados.cidade || "Não identificada").slice(0, 100),
        regiao: String(dados.regiao || "Não identificada").slice(0, 100),
        pais: String(dados.pais || "Não identificado").slice(0, 100)
      };

      // Uma entrada por conexão.
      usuarios.set(socket, usuario);

      transmitirUsuarios();

    } catch (erro) {
      console.error("Erro ao processar mensagem:", erro.message);
    }
  });

  socket.on("close", () => {
    usuarios.delete(socket);
    transmitirUsuarios();
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("Whmer online na porta " + PORT);
});
