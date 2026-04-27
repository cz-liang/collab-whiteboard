(function () {
  const canvas = document.getElementById("whiteboard");
  const ctx = canvas.getContext("2d");
  const roomIdEl = document.getElementById("roomId");
  const userCountEl = document.getElementById("userCount");
  const statusText = document.getElementById("statusText");
  const colorBtns = document.querySelectorAll(".color-btn");
  const brushSizeSelect = document.getElementById("brushSize");
  const sizeValueEl = document.getElementById("sizeValue");
  const eraserBtn = document.getElementById("eraserBtn");
  const clearBtn = document.getElementById("clearBtn");

  let ws = null;
  let roomId = null;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentColor = "#000000";
  let currentSize = 5;
  let isEraser = false;
  let drawings = [];

  // 获取基础路径（用于GitHub Pages）
  function getBasePath() {
    const path = window.location.pathname;
    // 如果是GitHub Pages，路径会是 /collab-whiteboard/ 或 /collab-whiteboard/XXXXXX
    const match = path.match(/^(\/[^\/]+)/);
    return match ? match[1] : "";
  }

  function initCanvas() {
    const toolbarHeight = document.querySelector(".toolbar").offsetHeight;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - toolbarHeight - 32;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function getRoomIdFromUrl() {
    const path = window.location.pathname;
    const basePath = getBasePath();

    // 支持 /collab-whiteboard/XXXXXX 格式
    const roomMatch = path.match(new RegExp(`^${basePath}/([A-Z]{6})$`));
    if (roomMatch) {
      return roomMatch[1];
    }

    // 支持 /XXXXXX 格式（本地开发）
    if (path.match(/^\/[A-Z]{6}$/)) {
      return path.substring(1);
    }

    return null;
  }

  function setRoomIdInUrl(id) {
    if (id) {
      const basePath = getBasePath();
      history.replaceState(null, "", basePath + "/" + id);
    }
  }

  function connect() {
    const url = "wss://api.oneuser.cn/wss";
    const urlRoomId = getRoomIdFromUrl();
    const wsUrl = url + (urlRoomId ? `?room=${urlRoomId}` : "");

    console.log("Connecting to WebSocket:", wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      statusText.textContent = "已连接";
      statusText.className = "connected";

      // 如果是新房间，生成房间号
      if (!urlRoomId) {
        roomId = generateRoomId();
        roomIdEl.textContent = roomId;
        userCountEl.textContent = "1";
        setRoomIdInUrl(roomId);
        // 发送加入房间消息
        const joinMessage = {
          type: "join",
          roomId: roomId,
        };
        console.log("Sending join message:", joinMessage);
        ws.send(JSON.stringify(joinMessage));
      } else {
        roomId = urlRoomId;
        roomIdEl.textContent = roomId;
        userCountEl.textContent = "1";
        // 发送加入房间消息
        const joinMessage = {
          type: "join",
          roomId: roomId,
        };
        console.log("Sending join message:", joinMessage);
        ws.send(JSON.stringify(joinMessage));
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      statusText.textContent = "连接已断开，正在重连...";
      statusText.className = "disconnected";
      setTimeout(connect, 2000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      statusText.textContent = "连接错误";
      statusText.className = "disconnected";
    };

    ws.onmessage = (event) => {
      console.log("Received WebSocket message:", event.data);
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (e) {
        console.error("Error parsing WebSocket message:", e);
      }
    };
  }

  function generateRoomId() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let roomId = "";
    for (let i = 0; i < 6; i++) {
      roomId += letters[Math.floor(Math.random() * letters.length)];
    }
    return roomId;
  }

  function handleMessage(message) {
    switch (message.type) {
      case "init":
        roomId = message.room;