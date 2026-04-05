(function () {
  // ---------- DOM elements ----------
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const statusHint = document.getElementById("statusHint");

  // ---------- Product data from localStorage ----------
  let productType = localStorage.getItem("productType") || "glasses";
  let productImageSrc = localStorage.getItem("selectedProduct");

  // Robust fallback images (working HTTPS URLs)
  const fallbackImages = {
    glasses: "https://cdn-icons-png.flaticon.com/512/3486/3486923.png",
    cap: "https://cdn-icons-png.flaticon.com/512/3028/3028776.png",
    wig: "https://cdn-icons-png.flaticon.com/512/3043/3043779.png",
    earring: "https://cdn-icons-png.flaticon.com/512/5272/5272319.png",
  };

  if (
    !productImageSrc ||
    productImageSrc === "null" ||
    productImageSrc === "undefined"
  ) {
    productImageSrc = fallbackImages[productType] || fallbackImages.glasses;
    console.warn("Using fallback product image:", productImageSrc);
    statusHint.innerText = "Demo product loaded. Use +/− to resize.";
  } else {
    console.log("Product from localStorage:", productImageSrc);
    statusHint.innerText = "Product ready | +/− to resize";
  }

  // Load product image with error recovery
  const productImg = new Image();
  let productLoaded = false;
  productImg.crossOrigin = "Anonymous"; // avoid CORS issues if possible

  productImg.onload = () => {
    productLoaded = true;
    console.log(
      "✅ Product image loaded:",
      productImg.width,
      productImg.height,
    );
    statusHint.style.opacity = "0.5";
  };

  productImg.onerror = (err) => {
    console.error("❌ Failed to load product image:", productImageSrc, err);
    // Try fallback
    const fallbackSrc = fallbackImages[productType];
    if (fallbackSrc && productImageSrc !== fallbackSrc) {
      console.log("🔄 Retrying with fallback image:", fallbackSrc);
      productImageSrc = fallbackSrc;
      productImg.src = fallbackSrc;
    } else {
      statusHint.innerText = "Error: product image missing";
    }
  };

  productImg.src = productImageSrc;

  // ---------- Global variables ----------
  let userScale = 1.0;
  let lastVideoWidth = 0,
    lastVideoHeight = 0;

  // Smoothing for glasses, cap, wig
  let smoothX = 0,
    smoothY = 0;
  let smoothAngle = 0;
  let hasPrev = false;

  // Smoothing for earrings
  let leftEarX = 0,
    leftEarY = 0;
  let rightEarX = 0,
    rightEarY = 0;
  let earHasPrev = false;

  let faceMesh = null;
  let camera = null;

  // ---------- Resize canvas only when video dimensions change ----------
  function resizeCanvasIfNeeded() {
    if (video.videoWidth && video.videoHeight) {
      if (
        video.videoWidth !== lastVideoWidth ||
        video.videoHeight !== lastVideoHeight
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.style.width = `${video.videoWidth}px`;
        canvas.style.height = `${video.videoHeight}px`;
        video.style.width = `${video.videoWidth}px`;
        video.style.height = `${video.videoHeight}px`;
        lastVideoWidth = video.videoWidth;
        lastVideoHeight = video.videoHeight;
        console.log(`Canvas resized: ${canvas.width} x ${canvas.height}`);
      }
    }
  }

  // Draw video frame on canvas (background)
  function drawVideoOnCanvas() {
    if (
      video.videoWidth &&
      video.videoHeight &&
      canvas.width === video.videoWidth
    ) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  }

  // ---------- Drawing functions per product ----------
  function drawGlasses(landmarks) {
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    if (!leftEye || !rightEye) return;

    const x1 = leftEye.x * canvas.width;
    const y1 = leftEye.y * canvas.height;
    const x2 = rightEye.x * canvas.width;
    const y2 = rightEye.y * canvas.height;

    const eyeDist = Math.hypot(x2 - x1, y2 - y1);
    let baseWidth = eyeDist * 1.8 * userScale;
    let aspect = productImg.height / productImg.width;
    let height = baseWidth * aspect;
    let width = baseWidth;

    let centerX = (x1 + x2) / 2;
    let centerY = (y1 + y2) / 2;
    let angle = Math.atan2(y2 - y1, x2 - x1);

    if (!hasPrev) {
      smoothX = centerX;
      smoothY = centerY;
      smoothAngle = angle;
      hasPrev = true;
    } else {
      smoothX = smoothX * 0.7 + centerX * 0.3;
      smoothY = smoothY * 0.7 + centerY * 0.3;
      smoothAngle = smoothAngle * 0.7 + angle * 0.3;
    }

    ctx.save();
    ctx.translate(smoothX, smoothY);
    ctx.rotate(smoothAngle);
    ctx.drawImage(productImg, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  function drawCap(landmarks) {
    const forehead = landmarks[10];
    const chin = landmarks[152];
    if (!forehead || !chin) return;

    const faceHeight = (chin.y - forehead.y) * canvas.height;
    const leftTemple = landmarks[356];
    const rightTemple = landmarks[127];
    let faceWidth = 180;
    if (leftTemple && rightTemple) {
      faceWidth = (rightTemple.x - leftTemple.x) * canvas.width;
    }

    let capWidth = faceWidth * 1.2 * userScale;
    let capHeight = capWidth * (productImg.height / productImg.width);
    let x = forehead.x * canvas.width;
    let y = forehead.y * canvas.height - faceHeight * 0.35;

    if (!hasPrev) {
      smoothX = x;
      smoothY = y;
      hasPrev = true;
    } else {
      smoothX = smoothX * 0.7 + x * 0.3;
      smoothY = smoothY * 0.7 + y * 0.3;
    }

    ctx.save();
    ctx.translate(smoothX, smoothY);
    ctx.drawImage(
      productImg,
      -capWidth / 2,
      -capHeight / 2,
      capWidth,
      capHeight,
    );
    ctx.restore();
  }

  function drawWig(landmarks) {
    const forehead = landmarks[10];
    const chin = landmarks[152];
    if (!forehead || !chin) return;

    const faceHeight = (chin.y - forehead.y) * canvas.height;
    let wigWidth = faceHeight * 0.9 * userScale;
    let wigHeight = wigWidth * (productImg.height / productImg.width);
    let x = forehead.x * canvas.width;
    let y = forehead.y * canvas.height - faceHeight * 0.2;

    if (!hasPrev) {
      smoothX = x;
      smoothY = y;
      hasPrev = true;
    } else {
      smoothX = smoothX * 0.7 + x * 0.3;
      smoothY = smoothY * 0.7 + y * 0.3;
    }

    ctx.save();
    ctx.translate(smoothX, smoothY);
    ctx.drawImage(
      productImg,
      -wigWidth / 2,
      -wigHeight / 2,
      wigWidth,
      wigHeight,
    );
    ctx.restore();
  }

  function drawEarrings(landmarks) {
    const leftEarRaw = landmarks[234];
    const rightEarRaw = landmarks[454];
    if (!leftEarRaw || !rightEarRaw) return;

    let lx = leftEarRaw.x * canvas.width;
    let ly = leftEarRaw.y * canvas.height;
    let rx = rightEarRaw.x * canvas.width;
    let ry = rightEarRaw.y * canvas.height;

    if (!earHasPrev) {
      leftEarX = lx;
      leftEarY = ly;
      rightEarX = rx;
      rightEarY = ry;
      earHasPrev = true;
    } else {
      leftEarX = leftEarX * 0.7 + lx * 0.3;
      leftEarY = leftEarY * 0.7 + ly * 0.3;
      rightEarX = rightEarX * 0.7 + rx * 0.3;
      rightEarY = rightEarY * 0.7 + ry * 0.3;
    }

    let earSize = 50 * userScale;
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    if (leftEye && rightEye) {
      const eyeDist = Math.hypot(
        (rightEye.x - leftEye.x) * canvas.width,
        (rightEye.y - leftEye.y) * canvas.height,
      );
      earSize = eyeDist * 0.6 * userScale;
    }

    ctx.drawImage(
      productImg,
      leftEarX - earSize / 2,
      leftEarY - earSize / 2,
      earSize,
      earSize,
    );
    ctx.drawImage(
      productImg,
      rightEarX - earSize / 2,
      rightEarY - earSize / 2,
      earSize,
      earSize,
    );
  }

  // ---------- FaceMesh callback (main render) ----------
  function onFaceMeshResults(results) {
    // 1. Always draw video background first (stops blinking)
    drawVideoOnCanvas();

    // 2. If product not loaded, show message and exit
    if (!productLoaded) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "16px sans-serif";
      ctx.fillText("Loading product...", 20, 50);
      return;
    }

    // 3. Check for face
    const faces = results.multiFaceLandmarks;
    if (!faces || faces.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "14px sans-serif";
      ctx.fillText(
        "No face detected",
        canvas.width / 2 - 60,
        canvas.height - 30,
      );
      return;
    }

    const landmarks = faces[0];

    // 4. Draw product based on type
    switch (productType) {
      case "glasses":
        drawGlasses(landmarks);
        break;
      case "cap":
        drawCap(landmarks);
        break;
      case "wig":
        drawWig(landmarks);
        break;
      case "earring":
        drawEarrings(landmarks);
        break;
      default:
        ctx.fillStyle = "white";
        ctx.font = "16px sans-serif";
        ctx.fillText("Unknown product type", 20, 80);
    }
  }

  // ---------- Initialize MediaPipe and Camera ----------
  async function initFaceMesh() {
    faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(onFaceMeshResults);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      video.srcObject = stream;

      // Wait for video metadata to set initial size
      video.addEventListener("loadedmetadata", () => {
        video.play();
        resizeCanvasIfNeeded();

        // Start CameraUtils after video is ready
        camera = new Camera(video, {
          onFrame: async () => {
            // Only resize if needed (not every frame)
            resizeCanvasIfNeeded();
            if (faceMesh && video.videoWidth > 0) {
              await faceMesh.send({ image: video });
            }
          },
          width: video.videoWidth,
          height: video.videoHeight,
        });
        camera.start();
      });
    } catch (err) {
      console.error("Camera error:", err);
      statusHint.innerText = "❌ Camera access denied";
    }
  }

  // Also resize on window resize / orientation change
  window.addEventListener("resize", () => {
    if (video.videoWidth) resizeCanvasIfNeeded();
  });

  // ---------- Exposed UI functions ----------
  window.changeSize = function (delta) {
    let newScale = userScale + delta;
    if (newScale < 0.4) newScale = 0.4;
    if (newScale > 2.2) newScale = 2.2;
    userScale = newScale;
    statusHint.innerText = `Size: ${Math.round(userScale * 100)}%`;
    setTimeout(() => {
      if (statusHint.innerText.includes("Size"))
        statusHint.innerText = "Use +/− to adjust";
    }, 1200);
  };

  window.capturePhoto = function () {
    drawVideoOnCanvas(); // ensure latest frame
    setTimeout(() => {
      const link = document.createElement("a");
      link.download = `tryon_${productType}_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      statusHint.innerText = "📸 Screenshot saved!";
      setTimeout(() => {
        if (statusHint.innerText === "📸 Screenshot saved!")
          statusHint.innerText = "";
      }, 1500);
    }, 50);
  };

  window.goBack = function () {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
    }
    if (camera) camera.stop();
    window.history.back();
  };

  // Start everything
  initFaceMesh();
})();
