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
    const toolbarHeight = document.querySelector(".toolbar").offsetHeight;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - toolbarHeight - 32; // 32 is status bar height
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function getRoomIdFromUrl() {
    const path = window.location.pathname;
    if (path.startsWith("/room/")) {
      return path.substring(6);
    }
    if (path.match(/^\/[A-Z]{6}$/)) {
      return path.substring(1);
    }
    return null;
  }

  function setRoomIdInUrl(id) {
    if (id) {
      history.replaceState(null, "", "/" + id);
    }
  }

  function connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}`;
    const urlRoomId = getRoomIdFromUrl();

    ws = new WebSocket(url + (urlRoomId ? `?room=${urlRoomId}` : ""));

    ws.onopen = () => {
      statusText.textContent = "已连接";
      statusText.className = "connected";
    };

    ws.onclose = () => {
      statusText.textContent = "连接已断开，正在重连...";
      statusText.className = "disconnected";
      setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      statusText.textContent = "连接错误";
      statusText.className = "disconnected";
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };
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
        data: { x0, y0, x1, y1, color, size, isEraser: isEraserMode },
      };
      ws.send(JSON.stringify(data));
    }
  }

  function sendClear() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "clear" }));
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
