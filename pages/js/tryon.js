const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

/* ===== CAMERA ===== */
navigator.mediaDevices
  .getUserMedia({
    video: { facingMode: "user" },
  })
  .then((stream) => (video.srcObject = stream));

/* ===== CANVAS FIX ===== */
function resizeCanvas() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}
video.addEventListener("loadedmetadata", resizeCanvas);

/* ===== FACE MESH ===== */
const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
});

/* ===== PRODUCT ===== */
const img = new Image();
const type = localStorage.getItem("productType") || "glasses";
img.src = localStorage.getItem("selectedProduct");

/* ===== SIZE CONTROL ===== */
let userScale = 1;

/* ===== SMOOTHING ===== */
let prevX = 0,
  prevY = 0;

/* ===== MAIN ENGINE ===== */
faceMesh.onResults((results) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!results.multiFaceLandmarks?.length) return;

  const lm = results.multiFaceLandmarks[0];

  let x,
    y,
    width,
    height,
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

    width = dist * 1.8 * userScale;
    height = width * 0.55;

    x = (x1 + x2) / 2;
    y = (y1 + y2) / 2;

    angle = Math.atan2(y2 - y1, x2 - x1);
  }

  /* ===== CAP ===== */
  if (type === "cap") {
    const f = lm[10];
    x = f.x * canvas.width;
    y = f.y * canvas.height - 60;

    width = 300 * userScale;
    height = 200 * userScale;
  }

  /* ===== EARRINGS ===== */
  if (type === "earring") {
    const l = lm[234];
    const r = lm[454];

    const size = 40 * userScale;

    ctx.drawImage(img, l.x * canvas.width, l.y * canvas.height, size, size);
    ctx.drawImage(img, r.x * canvas.width, r.y * canvas.height, size, size);
    return;
  }

  /* ===== WIG ===== */
  if (type === "wig") {
    const f = lm[10];
    const c = lm[152];

    const h = (c.y - f.y) * canvas.height * 2;

    width = h * 0.8 * userScale;
    height = h * 1.2 * userScale;

    x = f.x * canvas.width;
    y = f.y * canvas.height;
  }

  /* ===== SMOOTH ===== */
  x = prevX * 0.7 + x * 0.3;
  y = prevY * 0.7 + y * 0.3;

  prevX = x;
  prevY = y;

  /* ===== DRAW ===== */
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  ctx.restore();
});

/* ===== CAMERA LOOP ===== */
new Camera(video, {
  onFrame: async () => await faceMesh.send({ image: video }),
}).start();

/* ===== UI FUNCTIONS ===== */
function changeSize(val) {
  userScale += val;
}

function capture() {
  const link = document.createElement("a");
  link.download = "tryon.png";
  link.href = canvas.toDataURL();
  link.click();
}

function goBack() {
  history.back();
}
