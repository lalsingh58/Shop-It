(function () {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const statusHint = document.getElementById("statusHint");

  let type = localStorage.getItem("productType") || "glasses";
  let src = localStorage.getItem("selectedProduct");

  const img = new Image();
  img.src = src;

  let userScale = 1;

  let prevX = 0,
    prevY = 0,
    prevAngle = 0;

  /* ===== CAMERA ===== */
  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });

    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  /* ===== FACEMESH ===== */
  const faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
  });

  faceMesh.onResults((results) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* draw camera */
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (!results.multiFaceLandmarks?.length) return;

    const lm = results.multiFaceLandmarks[0];

    let x,
      y,
      w,
      h,
      angle = 0;

    /* ===== GLASSES ===== */
    if (type === "glasses") {
      const l = lm[33],
        r = lm[263];

      const x1 = l.x * canvas.width;
      const y1 = l.y * canvas.height;
      const x2 = r.x * canvas.width;
      const y2 = r.y * canvas.height;

      const dist = Math.hypot(x2 - x1, y2 - y1);

      w = dist * 2.0 * userScale;
      h = w * (img.height / img.width);

      x = (x1 + x2) / 2;
      y = (y1 + y2) / 2;

      angle = Math.atan2(y2 - y1, x2 - x1);
    }

    /* ===== CAP ===== */
    if (type === "cap") {
      const f = lm[10];
      const c = lm[152];

      const faceH = (c.y - f.y) * canvas.height;

      w = faceH * 2.2 * userScale;
      h = w * (img.height / img.width);

      x = f.x * canvas.width;
      y = f.y * canvas.height - faceH * 0.5;
    }

    /* ===== WIG ===== */
    if (type === "wig") {
      const f = lm[10];
      const c = lm[152];

      const faceH = (c.y - f.y) * canvas.height;

      w = faceH * 1.6 * userScale;
      h = w * (img.height / img.width);

      x = f.x * canvas.width;
      y = f.y * canvas.height;
    }

    /* ===== EARRINGS ===== */
    if (type === "earring") {
      const l = lm[234];
      const r = lm[454];

      const size = 60 * userScale;

      ctx.drawImage(
        img,
        l.x * canvas.width - size / 2,
        l.y * canvas.height,
        size,
        size,
      );
      ctx.drawImage(
        img,
        r.x * canvas.width - size / 2,
        r.y * canvas.height,
        size,
        size,
      );
      return;
    }

    /* ===== SMOOTHING ===== */
    x = prevX * 0.7 + x * 0.3;
    y = prevY * 0.7 + y * 0.3;
    angle = prevAngle * 0.7 + angle * 0.3;

    prevX = x;
    prevY = y;
    prevAngle = angle;

    /* ===== DRAW ===== */
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    ctx.restore();
  });

  /* ===== CAMERA LOOP ===== */
  startCamera().then(() => {
    new Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
      },
    }).start();
  });

  /* ===== UI ===== */
  window.changeSize = (v) => {
    userScale += v;
    if (userScale < 0.5) userScale = 0.5;
    if (userScale > 2.5) userScale = 2.5;
    statusHint.innerText = `Size: ${Math.round(userScale * 100)}%`;
  };

  window.capturePhoto = () => {
    const link = document.createElement("a");
    link.download = "tryon.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  window.goBack = () => {
    window.history.back();
  };
})();
