const http = require("http");
const WebSocket = require("ws");
const PORT = process.env.PORT || 10000;
const usuarios = new Map();
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify({
    status: "online",
    sistema: "Whmer Chat",
    usuarios: usuarios.size
  }));
});
const wss = new WebSocket.Server({ server });
function obterIP(req) {
  // Cabeçalho fornecido pelo proxy confiável do Render.
  if (process.env.RENDER && req.headers["true-client-ip"]) {
    return req.headers["true-client-ip"].trim();
  }
  // Fallback para ambientes com proxy configurado.
  if (process.env.RENDER && req.headers["x-forwarded-for"]) {
    return req.headers["x-forwarded-for"]
      .split(",")[0]
      .trim();
  }
  let ip = req.socket.remoteAddress || "Não identificado";
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }
  return ip;
}
function transmitirUsuarios() {
  // Não incluir o IP completo na lista pública.
  const listaPublica = Array.from(usuarios.values()).map(usuario => ({
    nome: usuario.nome,
    cidade: usuario.cidade,
    regiao: usuario.regiao,
    pais: usuario.pais
  }));
  const mensagem = JSON.stringify({
    tipo: "listaUsuarios",
    usuarios: listaPublica
  });
  for (const cliente of wss.clients) {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(mensagem);
    }
  }
}
wss.on("connection", (socket, req) => {
  // O IP é obtido da conexão, não do valor enviado pelo navegador.
  const ipReal = obterIP(req);
  console.log("Nova conexão:", ipReal);
  socket.on("message", mensagem => {
    try {
      const dados = JSON.parse(mensagem.toString());
      if (dados.tipo !== "usuario") return;
      const nome = String(dados.nome || "Anônimo")
        .trim()
        .slice(0, 40);
      if (!nome) return;
      const usuario = {
        nome,
        cidade: String(dados.cidade || "Não identificada").slice(0, 100),
        regiao: String(dados.regiao || "Não identificada").slice(0, 100),
        pais: String(dados.pais || "Não identificado").slice(0, 100),
        // Uso interno do servidor; não é transmitido aos demais.
        ip: ipReal
      };
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
  socket.on("error", erro => {
    console.error("Erro WebSocket:", erro.message);
  });
});
server.listen(PORT, () => {
  console.log("Whmer online na porta " + PORT);
});
