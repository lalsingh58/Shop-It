(function () {
  console.log("JS Loaded ✅");

  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const statusHint = document.getElementById("statusHint");

  // Mirror effect
  video.style.transform = "scaleX(-1)";
  canvas.style.transform = "scaleX(-1)";

  let type = localStorage.getItem("productType") || "glasses";
  let src = localStorage.getItem("selectedProduct");

  // fallback image (IMPORTANT)
  if (!src) {
    src = "https://cdn-icons-png.flaticon.com/512/3486/3486923.png";
  }

  const img = new Image();
  img.src = src;

  let userScale = 1;
  let prevX = 0,
    prevY = 0,
    prevAngle = 0;

  /* ===== CAMERA START ===== */
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      video.srcObject = stream;

      video.onloadedmetadata = () => {
        video.play();

        setTimeout(() => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          startFaceMesh();
        }, 300);
      };
    } catch (err) {
      console.error("Camera error:", err);
      statusHint.innerText = "❌ Camera blocked / not allowed";
    }
  }

  /* ===== FACEMESH ===== */
  function startFaceMesh() {
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
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (!results.multiFaceLandmarks?.length) {
        statusHint.innerText = "No face detected";
        return;
      }

      statusHint.innerText = "Face detected";

      const lm = results.multiFaceLandmarks[0];

      const l = lm[33];
      const r = lm[263];

      const x1 = l.x * canvas.width;
      const y1 = l.y * canvas.height;
      const x2 = r.x * canvas.width;
      const y2 = r.y * canvas.height;

      const dist = Math.hypot(x2 - x1, y2 - y1);

      let w = dist * 2 * userScale;
      let h = w * (img.height / img.width);

      let x = (x1 + x2) / 2;
      let y = (y1 + y2) / 2;

      let angle = Math.atan2(y2 - y1, x2 - x1);

      // smoothing
      x = prevX * 0.7 + x * 0.3;
      y = prevY * 0.7 + y * 0.3;
      angle = prevAngle * 0.7 + angle * 0.3;

      prevX = x;
      prevY = y;
      prevAngle = angle;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
      },
      width: 640,
      height: 480,
    });

    camera.start();
  }

  /* ===== UI ===== */
  window.changeSize = (v) => {
    userScale += v;
    if (userScale < 0.5) userScale = 0.5;
    if (userScale > 2.5) userScale = 2.5;
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

  // START
  startCamera();
})();
