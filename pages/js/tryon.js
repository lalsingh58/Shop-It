import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ================= PRODUCT =================
let selectedModel = localStorage.getItem("selectedModel");
let productType = localStorage.getItem("productType");

if (!selectedModel) {
  selectedModel = "../assets/models/glasses/g1.glb";
  productType = "glasses";
}

// ================= THREE + JEELIZ =================
let THREECAMERA, THREESCENE, THREERENDERER;
let FACEOBJ = null;
let MODEL = null;

// ================= INIT =================
function init() {
  JEEFACEFILTERAPI.init({
    canvasId: "jeeFaceFilterCanvas",
    NNCPath: "https://appstatic.jeeliz.com/faceFilter/",

    callbackReady: function (errCode, spec) {
      if (errCode) {
        console.error("❌ Jeeliz error:", errCode);
        return;
      }

      document.getElementById("status").innerText = "✅ Camera Ready";
      initThree(spec);
    },

    callbackTrack: function (detectState) {
      JeelizThreeHelper.render(detectState, THREECAMERA);
    },
  });
}

// ================= INIT THREE =================
function initThree(spec) {
  THREERENDERER = JeelizThreeHelper.createRenderer(spec);
  THREESCENE = JeelizThreeHelper.createScene(spec);
  THREECAMERA = JeelizThreeHelper.createCamera(spec);

  FACEOBJ = JeelizThreeHelper.getFaceObject();

  // 🔥 LIGHT
  const light = new THREE.AmbientLight(0xffffff, 1.5);
  THREESCENE.add(light);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(0, 1, 2);
  THREESCENE.add(dirLight);

  loadModel(selectedModel);
}

// ================= LOAD MODEL =================
function loadModel(path) {
  const loader = new GLTFLoader();

  loader.load(
    path,
    (gltf) => {
      MODEL = gltf.scene;

      // 🔥 AUTO CENTER
      const box = new THREE.Box3().setFromObject(MODEL);
      const center = box.getCenter(new THREE.Vector3());
      MODEL.position.sub(center);

      // ================= POSITION BASED ON TYPE =================
      if (productType === "glasses") {
        MODEL.scale.set(0.6, 0.6, 0.6);
        MODEL.position.set(0, -0.05, 0.2);
      } else if (productType === "cap") {
        MODEL.scale.set(0.9, 0.9, 0.9);
        MODEL.position.set(0, 0.4, 0.1);
      } else if (productType === "wig") {
        MODEL.scale.set(1.1, 1.1, 1.1);
        MODEL.position.set(0, 0.3, 0);
      } else if (productType === "earring") {
        MODEL.scale.set(0.4, 0.4, 0.4);
        MODEL.position.set(0.3, -0.2, 0);

        // 🔥 clone for second ear
        const clone = MODEL.clone();
        clone.position.set(-0.3, -0.2, 0);

        FACEOBJ.add(clone);
      }

      FACEOBJ.add(MODEL);

      console.log("✅ Model loaded:", path);
    },

    undefined,

    (err) => {
      console.error("❌ Model load error:", err);
    },
  );
}

// ================= BACK =================
window.goBack = () => history.back();

// ================= START =================
init();
