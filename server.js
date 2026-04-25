const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 3001;

const rooms = new Map();

function generateRoomId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let roomId = "";
  for (let i = 0; i < 6; i++) {
    roomId += letters[Math.floor(Math.random() * letters.length)];
  }
  return roomId;
}

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;

  if (pathname === "/" || pathname === "/index.html") {
    const filePath = path.join(__dirname, "public", "index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading index.html");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  } else if (pathname.match(/^\/[A-Z]{6}$/)) {
    const roomId = pathname.substring(1);
    const filePath = path.join(__dirname, "public", "index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading index.html");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  } else if (pathname === "/style.css") {
    const filePath = path.join(__dirname, "public", "style.css");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading style.css");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/css" });
      res.end(data);
    });
  } else if (pathname === "/app.js") {
    const filePath = path.join(__dirname, "public", "app.js");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading app.js");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(data);
    });
  } else if (pathname.startsWith("/room/")) {
    const filePath = path.join(__dirname, "public", "index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading index.html");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  const queryParams = url.parse(req.url, true).query;
  let roomId = queryParams.room;
  const isNewRoom = !roomId;

  if (!roomId) {
    roomId = generateRoomId();
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      clients: new Set(),
      drawings: [],
    });
  }

  const room = rooms.get(roomId);
  room.clients.add(ws);
  ws.roomId = roomId;
  ws.isAlive = true;

  ws.send(
    JSON.stringify({
      type: "init",
      roomId: roomId,
      isNewRoom: isNewRoom,
      drawings: room.drawings,
      userCount: room.clients.size,
    }),
  );

  broadcastToRoom(
    roomId,
    {
      type: "user_joined",
      userCount: room.clients.size,
    },
    ws,
  );

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "draw":
          if (room.drawings.length > 1000) {
            room.drawings = room.drawings.slice(-500);
          }
          room.drawings.push(message.data);
          broadcastToRoom(
            roomId,
            {
              type: "draw",
              data: message.data,
            },
            ws,
          );
          break;

        case "clear":
          room.drawings = [];
          broadcastToRoom(
            roomId,
            {
              type: "clear",
            },
            ws,
          );
          break;

        case "cursor":
          broadcastToRoom(
            roomId,
            {
              type: "cursor",
              userId: ws.userId,
              x: message.x,
              y: message.y,
            },
            ws,
          );
          break;
      }
    } catch (e) {
      console.error("Error parsing message:", e);
    }
  });

  ws.on("close", () => {
    if (room) {
      room.clients.delete(ws);
      broadcastToRoom(
        roomId,
        {
          type: "user_left",
          userCount: room.clients.size,
        },
        ws,
      );

      if (room.clients.size === 0) {
        setTimeout(() => {
          if (room.clients.size === 0) {
            rooms.delete(roomId);
          }
        }, 60000);
      }
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

function broadcastToRoom(roomId, message, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = JSON.stringify(message);
  room.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

server.listen(PORT, () => {
  console.log(
    `Collaborative Whiteboard server running at http://localhost:${PORT}`,
  );
});
