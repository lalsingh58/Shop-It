(function () {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const statusHint = document.getElementById("statusHint");

  let productType = localStorage.getItem("productType") || "glasses";
  let productImageSrc = localStorage.getItem("selectedProduct");

  const fallbackImages = {
    glasses: "https://cdn-icons-png.flaticon.com/512/3486/3486923.png",
    cap: "https://cdn-icons-png.flaticon.com/512/3028/3028776.png",
    wig: "https://cdn-icons-png.flaticon.com/512/3043/3043779.png",
    earring: "https://cdn-icons-png.flaticon.com/512/5272/5272319.png",
    necklace: "https://cdn-icons-png.flaticon.com/512/992/992700.png",
    mask: "https://cdn-icons-png.flaticon.com/512/4140/4140048.png",
  };

  if (!productImageSrc || productImageSrc === "null") {
    productImageSrc = fallbackImages[productType];
  }

  const productImg = new Image();
  let productLoaded = false;

  productImg.onload = () => (productLoaded = true);
  productImg.onerror = () => {
    productImg.src = fallbackImages[productType];
  };
  productImg.src = productImageSrc;

  let userScale = 1;

  // 🔥 Advanced smoothing system
  const smooth = {
    x: 0,
    y: 0,
    angle: 0,
    scale: 1,
    init: false,
  };

  function lerp(a, b, t = 0.25) {
    return a + (b - a) * t;
  }

  function resizeCanvas() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  // 🔥 Depth estimation using eye distance
  function getDepthScale(lm) {
    const l = lm[33];
    const r = lm[263];
    const dist = Math.hypot(
      (r.x - l.x) * canvas.width,
      (r.y - l.y) * canvas.height,
    );
    return dist / 150; // normalize
  }

  // 🎯 GLASSES (Premium alignment)
  function drawGlasses(lm) {
    const l = lm[33];
    const r = lm[263];

    let x1 = l.x * canvas.width;
    let y1 = l.y * canvas.height;
    let x2 = r.x * canvas.width;
    let y2 = r.y * canvas.height;

    let centerX = (x1 + x2) / 2;
    let centerY = (y1 + y2) / 2 - 12;

    let angle = Math.atan2(y2 - y1, x2 - x1);
    let depth = getDepthScale(lm);

    let width = Math.hypot(x2 - x1, y2 - y1) * 2.2 * depth * userScale;
    let height = width * (productImg.height / productImg.width);

    updateSmooth(centerX, centerY, angle, depth);

    ctx.save();
    ctx.translate(smooth.x, smooth.y);
    ctx.rotate(smooth.angle);
    ctx.drawImage(productImg, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  // 🎯 MASK
  function drawMask(lm) {
    const nose = lm[1];
    const chin = lm[152];

    let x = nose.x * canvas.width;
    let y = nose.y * canvas.height;

    let faceHeight = (chin.y - nose.y) * canvas.height;
    let width = faceHeight * 1.5 * userScale;
    let height = width * (productImg.height / productImg.width);

    ctx.drawImage(productImg, x - width / 2, y - height / 3, width, height);
  }

  // 🎯 NECKLACE
  function drawNecklace(lm) {
    const left = lm[234];
    const right = lm[454];
    const chin = lm[152];

    let centerX = ((left.x + right.x) / 2) * canvas.width;
    let centerY = chin.y * canvas.height + 30;

    let width = Math.abs((right.x - left.x) * canvas.width) * 1.8;
    let height = width * (productImg.height / productImg.width);

    ctx.drawImage(productImg, centerX - width / 2, centerY, width, height);
  }

  // 🎯 CAP
  function drawCap(lm) {
    const forehead = lm[10];
    const chin = lm[152];

    let faceHeight = (chin.y - forehead.y) * canvas.height;

    let x = forehead.x * canvas.width;
    let y = forehead.y * canvas.height - faceHeight * 0.6;

    let width = faceHeight * 1.6 * userScale;
    let height = width * (productImg.height / productImg.width);

    ctx.drawImage(productImg, x - width / 2, y - height / 2, width, height);
  }

  function updateSmooth(x, y, angle, scale) {
    if (!smooth.init) {
      smooth.x = x;
      smooth.y = y;
      smooth.angle = angle;
      smooth.scale = scale;
      smooth.init = true;
    } else {
      smooth.x = lerp(smooth.x, x);
      smooth.y = lerp(smooth.y, y);
      smooth.angle = lerp(smooth.angle, angle);
      smooth.scale = lerp(smooth.scale, scale);
    }
  }

  function render(results) {
    drawFrame();

    if (!productLoaded) return;

    const faces = results.multiFaceLandmarks;
    if (!faces || faces.length === 0) return;

    const lm = faces[0];

    switch (productType) {
      case "glasses":
        drawGlasses(lm);
        break;
      case "mask":
        drawMask(lm);
        break;
      case "necklace":
        drawNecklace(lm);
        break;
      case "cap":
        drawCap(lm);
        break;
    }
  }

  async function init() {
    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    faceMesh.onResults(render);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });

    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      resizeCanvas();

      const camera = new Camera(video, {
        onFrame: async () => {
          await faceMesh.send({ image: video });
        },
      });

      camera.start();
    };
  }

  // 📱 MOBILE RESPONSIVE FIX
  window.addEventListener("resize", resizeCanvas);

  // 🎛 UI Controls
  window.changeSize = function (d) {
    userScale = Math.min(2.5, Math.max(0.5, userScale + d));
  };

  window.capturePhoto = function () {
    const link = document.createElement("a");
    link.download = "tryon.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  init();
})();
