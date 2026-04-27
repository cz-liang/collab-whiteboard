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

  function initCanvas() {
    const toolbarHeight = 60; // 固定工具栏高度
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - toolbarHeight - 32; // 32 is status bar height
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function getRoomIdFromUrl() {
    // 首先尝试从查询参数获取房间号
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");
    if (roomParam && roomParam.match(/^[A-Z]{6}$/)) {
      return roomParam;
    }

    // 然后尝试从路径获取房间号（用于本地开发）
    const path = window.location.pathname;
    const match = path.match(/^\/collab-whiteboard\/([A-Z]{6})$/);
    if (match) {
      return match[1];
    }

    return null;
  }

  function setRoomIdInUrl(id) {
    if (id) {
      // 使用查询参数格式，避免 GitHub Pages 404
      history.replaceState(null, "", "/collab-whiteboard?room=" + id);
    }
  }

  function connect() {
    // const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // const url = `${protocol}//${window.location.host}`;
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
        roomId = message.roomId;
        roomIdEl.textContent = message.roomId;
        userCountEl.textContent = message.userCount;
        setRoomIdInUrl(message.isNewRoom ? message.roomId : null);

        if (message.drawings && message.drawings.length > 0) {
          drawings = message.drawings;
          redrawCanvas();
        }
        break;

      case "user_joined":
        userCountEl.textContent = message.userCount;
        break;

      case "user_left":
        userCountEl.textContent = message.userCount;
        break;

      case "draw":
        drawings.push(message.data);
        drawLine(
          message.data.x0,
          message.data.y0,
          message.data.x1,
          message.data.y1,
          message.data.color,
          message.data.size,
          message.data.isEraser,
        );
        break;

      case "clear":
        drawings = [];
        clearCanvas();
        break;

      case "cursor":
        break;
    }
  }

  function sendDraw(x0, y0, x1, y1, color, size, isEraserMode) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const data = {
        type: "draw",
        roomId: roomId,
        data: { x0, y0, x1, y1, color, size, isEraser: isEraserMode },
      };
      console.log("Sending draw message:", data);
      ws.send(JSON.stringify(data));
    } else {
      console.log("WebSocket not open, cannot send draw message");
    }
  }

  function sendClear() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const data = {
        type: "clear",
        roomId: roomId,
      };
      console.log("Sending clear message:", data);
      ws.send(JSON.stringify(data));
    } else {
      console.log("WebSocket not open, cannot send clear message");
    }
  }

  function drawLine(x0, y0, x1, y1, color, size, isEraserMode) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    if (isEraserMode) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = size;
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function clearCanvas() {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function redrawCanvas() {
    clearCanvas();
    for (const draw of drawings) {
      drawLine(
        draw.x0,
        draw.y0,
        draw.x1,
        draw.y1,
        draw.color,
        draw.size,
        draw.isEraser,
      );
    }
  }

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    const pos = getMousePos(e);
    lastX = pos.x;
    lastY = pos.y;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    drawLine(lastX, lastY, pos.x, pos.y, currentColor, currentSize, isEraser);
    sendDraw(lastX, lastY, pos.x, pos.y, currentColor, currentSize, isEraser);
    drawings.push({
      x0: lastX,
      y0: lastY,
      x1: pos.x,
      y1: pos.y,
      color: currentColor,
      size: currentSize,
      isEraser: isEraser,
    });
    lastX = pos.x;
    lastY = pos.y;
  });

  canvas.addEventListener("mouseup", () => {
    isDrawing = false;
  });

  canvas.addEventListener("mouseout", () => {
    isDrawing = false;
  });

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    isDrawing = true;
    const pos = getTouchPos(e);
    lastX = pos.x;
    lastY = pos.y;
  });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getTouchPos(e);
    drawLine(lastX, lastY, pos.x, pos.y, currentColor, currentSize, isEraser);
    sendDraw(lastX, lastY, pos.x, pos.y, currentColor, currentSize, isEraser);
    drawings.push({
      x0: lastX,
      y0: lastY,
      x1: pos.x,
      y1: pos.y,
      color: currentColor,
      size: currentSize,
      isEraser: isEraser,
    });
    lastX = pos.x;
    lastY = pos.y;
  });

  canvas.addEventListener("touchend", () => {
    isDrawing = false;
  });

  colorBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      colorBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentColor = btn.dataset.color;
      isEraser = false;
      eraserBtn.classList.remove("active");
      canvas.classList.remove("eraser");
    });
  });

  brushSizeSelect.addEventListener("input", (e) => {
    currentSize = parseInt(e.target.value);
    sizeValueEl.textContent = currentSize + "px";
  });

  eraserBtn.addEventListener("click", () => {
    isEraser = !isEraser;
    eraserBtn.classList.toggle("active", isEraser);
    canvas.classList.toggle("eraser", isEraser);
    if (isEraser) {
      colorBtns.forEach((b) => b.classList.remove("active"));
    }
  });

  clearBtn.addEventListener("click", () => {
    clearCanvas();
    sendClear();
  });

  window.addEventListener("resize", () => {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0);

    initCanvas();
    tempCtx.drawImage(tempCanvas, 0, 0);
  });

  initCanvas();
  connect();
})();
