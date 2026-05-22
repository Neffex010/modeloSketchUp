import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Ruta del modelo (Usamos ./ para asegurar la compatibilidad estricta con servidores Linux de GitHub Pages)
const RUTA_MODELO = './assets/Salon.glb';

// Elementos HTML
const contenedor = document.getElementById('contenedor3D');
const mensajeCarga = document.getElementById('mensajeCarga');
const btnModoMaqueta = document.getElementById('btnModoMaqueta');
const btnModoPC = document.getElementById('btnModoPC');
const textoAyudaMaqueta = document.getElementById('textoAyudaMaqueta');
const textoAyudaPC = document.getElementById('textoAyudaPC');
const btnGuia = document.getElementById('btnGuia');

// Variables de Estado
let guiaVisible = true;
let modoActual = 'maqueta'; 
let tamanioModelo = 5;

// Escena
const escena = new THREE.Scene();
escena.background = new THREE.Color(0x020617);
const reloj = new THREE.Clock();

// --- SISTEMA DE CÁMARA Y DOLLY (Contenedor esencial para traslación en VR) ---
const dolly = new THREE.Group();
escena.add(dolly);

const camara = new THREE.PerspectiveCamera(60, contenedor.clientWidth / contenedor.clientHeight, 0.05, 5000);
dolly.add(camara);

// Renderizador
const renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);

// OPTIMIZACIÓN 1: Limitamos el pixelRatio máximo a 1.5 en lugar de 2. 
// Esto reduce drásticamente la carga de píxeles en pantallas móviles de alta densidad sin perder calidad visible.
renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

renderizador.outputColorSpace = THREE.SRGBColorSpace;
renderizador.shadowMap.enabled = true;
renderizador.shadowMap.type = THREE.PCFShadowMap; // Resuelve la advertencia amarilla en consola
renderizador.xr.enabled = true;

contenedor.appendChild(renderizador.domElement);
document.body.appendChild(VRButton.createButton(renderizador));

// --- ILUMINACIÓN ENTORNO ---
const luzAmbiente = new THREE.HemisphereLight(0xffffff, 0x334155, 2.2);
escena.add(luzAmbiente);

const luzDireccional = new THREE.DirectionalLight(0xffffff, 2.0); 
luzDireccional.position.set(8, 10, 8);
luzDireccional.castShadow = true;

// OPTIMIZACIÓN 2: Reducimos la resolución del mapa de sombras de 2048 a 1024.
// Menos memoria consumida por la GPU, acelerando el renderizado en tiempo real.
luzDireccional.shadow.mapSize.width = 1024;
luzDireccional.shadow.mapSize.height = 1024;
luzDireccional.shadow.bias = -0.0005; // Elimina el acné de sombra (ruido/manchas de las paredes)
escena.add(luzDireccional);

const luzExtra = new THREE.PointLight(0x38bdf8, 1.8, 100);
luzExtra.position.set(-5, 5, -5);
escena.add(luzExtra);

// --- ESCENARIO VIRTUAL (PISO Y GUÍA CON PREVENCIÓN DE Z-FIGHTING) ---
const geometriesPiso = new THREE.CircleGeometry(15, 64);
const materialPiso = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.05 });
const piso = new THREE.Mesh(geometriesPiso, materialPiso);
piso.rotation.x = -Math.PI / 2;
piso.position.y = -0.05; // Bajado sutilmente para que no intercepte el suelo plano del salón de SketchUp
piso.receiveShadow = true;
escena.add(piso);

const guia = new THREE.GridHelper(24, 48, 0x38bdf8, 0x1e293b);
guia.position.y = -0.04; // Posicionado entre el piso del mundo y el suelo del modelo
escena.add(guia);


// ==========================================
// CONFIGURACIÓN DE CONTROLES HÍBRIDOS
// ==========================================

// 1. Controles de Órbita (Modo Maqueta)
const controlesOrbit = new OrbitControls(camara, renderizador.domElement);
controlesOrbit.enableDamping = true;
controlesOrbit.dampingFactor = 0.05;

// 2. Controles de Bloqueo de Puntero (Modo Primera Persona PC)
const controlesPC = new PointerLockControls(camara, document.body);
const teclas = { adelante: false, atras: false, izquierda: false, derecha: false };
const velocidadActual = new THREE.Vector3();
const vectorDireccion = new THREE.Vector3();

document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': teclas.adelante = true; break;
    case 'KeyA': case 'ArrowLeft': teclas.izquierda = true; break;
    case 'KeyS': case 'ArrowDown': teclas.atras = true; break;
    case 'KeyD': case 'ArrowRight': teclas.derecha = true; break;
  }
});
document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': teclas.adelante = false; break;
    case 'KeyA': case 'ArrowLeft': teclas.izquierda = false; break;
    case 'KeyS': case 'ArrowDown': teclas.atras = false; break;
    case 'KeyD': case 'ArrowRight': teclas.derecha = false; break;
  }
});

// 3. Entrada táctil/gatillo básica para Cardboard en VR
let avanzarVR = false;
const controladorVR = renderizador.xr.getController(0);
controladorVR.addEventListener('selectstart', () => { avanzarVR = true; });
controladorVR.addEventListener('selectend', () => { avanzarVR = false; });
escena.add(controladorVR);


// ==========================================
// CONTROLADORES DE INTERFAZ Y MODOS
// ==========================================

function activarModoMaqueta() {
  modoActual = 'maqueta';
  controlesOrbit.enabled = true;
  
  if (btnModoMaqueta && btnModoPC) {
    btnModoMaqueta.classList.replace('btn-outline-info', 'btn-info');
    btnModoPC.classList.replace('btn-success', 'btn-outline-success');
  }
  if (textoAyudaMaqueta && textoAyudaPC) {
    textoAyudaMaqueta.style.display = 'block';
    textoAyudaPC.style.display = 'none';
  }

  dolly.position.set(0, 0, 0); 
  const distancia = tamanioModelo * 0.8; // Proporción matemática de encuadre cercana
  camara.position.set(distancia, distancia * 0.5, distancia);
  controlesOrbit.target.set(0, tamanioModelo * 0.2, 0);
  controlesOrbit.update();
}

function activarModoFPS() {
  modoActual = 'fps';
  controlesOrbit.enabled = false;
  
  if (btnModoPC && btnModoMaqueta) {
    btnModoPC.classList.replace('btn-outline-success', 'btn-success');
    btnModoMaqueta.classList.replace('btn-info', 'btn-outline-info');
  }
  if (textoAyudaPC && textoAyudaMaqueta) {
    textoAyudaPC.style.display = 'block';
    textoAyudaMaqueta.style.display = 'none';
  }

  dolly.position.set(0, 0, 0);
  camara.position.set(0, 1.5, 0); // Altura estándar de la vista
  camara.lookAt(0, 1.5, -1);
  controlesPC.lock();
}

if (btnModoMaqueta) btnModoMaqueta.addEventListener('click', activarModoMaqueta);
if (btnModoPC) btnModoPC.addEventListener('click', activarModoFPS);

controlesPC.addEventListener('unlock', () => {
  if (modoActual === 'fps') activarModoMaqueta();
});

renderizador.xr.addEventListener('sessionstart', () => {
  modoActual = 'vr';
  controlesOrbit.enabled = false;
  dolly.position.set(0, 0, 0); 
});


// ==========================================
// GESTIÓN DE RECURSOS 3D (LOADER)
// ==========================================

function prepararModelo(objeto) {
  objeto.traverse((hijo) => {
    if (hijo.isMesh) {
      hijo.castShadow = true;
      hijo.receiveShadow = true;

      if (hijo.material) {
        // OPTIMIZACIÓN 3: Cambiado de DoubleSide a FrontSide.
        // Al procesar sólo la cara frontal de los polígonos correctos de SketchUp, la GPU renderiza la mitad de geometría por cuadro.
        hijo.material.side = THREE.FrontSide; 
        
        // Configuración uniforme mate para mitigar brillos plásticos por defecto
        hijo.material.roughness = 0.9; 
        hijo.material.metalness = 0.0;
        
        if (hijo.material.color && hijo.material.color.getHex() === 0x000000) {
            hijo.material.color.setHex(0xe2e8f0);
        }
      }
    }
  });
}

function iniciarModelo(objeto) {
  const caja = new THREE.Box3().setFromObject(objeto);
  const centro = new THREE.Vector3();
  const tamanio = new THREE.Vector3();
  
  caja.getCenter(centro);
  caja.getSize(tamanio);
  tamanioModelo = Math.max(tamanio.x, tamanio.y, tamanio.z, 1);

  // Alineación precisa del centro geométrico en los ejes del escenario
  objeto.position.x -= centro.x;
  objeto.position.z -= centro.z;
  objeto.position.y -= caja.min.y;

  activarModoMaqueta();
}

const loader = new GLTFLoader();
loader.load(
  RUTA_MODELO,
  function (gltf) {
    prepararModelo(gltf.scene);
    escena.add(gltf.scene);
    iniciarModelo(gltf.scene);
    if (mensajeCarga) mensajeCarga.classList.add('oculto');
  },
  undefined,
  function (error) {
    console.error("Detalles del error de carga:", error);
    if (mensajeCarga) {
      mensajeCarga.innerHTML = `<h5 class="fw-bold mb-1 text-danger">Error al cargar</h5><p class="small">Verifica assets/Salon.glb</p>`;
    }
  }
);

if (btnGuia) {
  btnGuia.addEventListener('click', () => {
    guiaVisible = !guiaVisible;
    guia.visible = guiaVisible;
    piso.visible = guiaVisible;
  });
}

window.addEventListener('resize', () => {
  camara.aspect = contenedor.clientWidth / contenedor.clientHeight;
  camara.updateProjectionMatrix();
  renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
});


// ==========================================
// BUCLE PRINCIPAL DE RENDERIZADO (LOOP DE ANIMACIÓN)
// ==========================================

renderizador.setAnimationLoop(() => {
  const delta = Math.min(reloj.getDelta(), 0.1); // Evita saltos bruscos si cae el framerate

  // PROCESAMIENTO MODO MAQUETA
  if (modoActual === 'maqueta') {
    controlesOrbit.update();
  }

  // PROCESAMIENTO MODO PC DESKTOP (Mecánicas FPS)
  if (modoActual === 'fps' && controlesPC.isLocked) {
    velocidadActual.x -= velocidadActual.x * 10.0 * delta;
    velocidadActual.z -= velocidadActual.z * 10.0 * delta;

    vectorDireccion.z = Number(teclas.adelante) - Number(teclas.atras);
    vectorDireccion.x = Number(teclas.derecha) - Number(teclas.izquierda);
    vectorDireccion.normalize();

    if (teclas.adelante || teclas.atras) velocidadActual.z -= vectorDireccion.z * 30.0 * delta;
    if (teclas.izquierda || teclas.derecha) velocidadActual.x -= vectorDireccion.x * 30.0 * delta;

    controlesPC.moveRight(-velocidadActual.x * delta);
    controlesPC.moveForward(-velocidadActual.z * delta);
    camara.position.y = 1.5; // Mantiene la línea del horizonte fija al suelo
  }

  // PROCESAMIENTO MODO INMERSIVO VR (Entorno Mobile / Sensor Bluetooth)
  if (renderizador.xr.isPresenting || modoActual === 'vr') {
    
    // Entrada por pulsación táctil (Avanzar rectilíneo hacia la mirada)
    if (avanzarVR) {
      camara.getWorldDirection(vectorDireccion);
      vectorDireccion.y = 0; 
      vectorDireccion.normalize();
      dolly.position.addScaledVector(vectorDireccion, 2.5 * delta); 
    }

    // Entrada por Hardware Externo (Gamepad API para Control Bluetooth)
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        gp = gamepads[i];
        break;
      }
    }

    if (gp) {
      const deadzone = 0.15; // Margen para evitar drifting involuntario
      const velCaminar = 3.5;
      const velGirar = 2.0;

      const ejeAdelante = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0; // Stick Izq (V)
      const ejeLado = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;     // Stick Izq (H)
      const ejeRotacion = Math.abs(gp.axes[2]) > deadzone ? gp.axes[2] : 0; // Stick Der (H)

      if (ejeAdelante !== 0 || ejeLado !== 0) {
        camara.getWorldDirection(vectorDireccion);
        vectorDireccion.y = 0;
        vectorDireccion.normalize();

        // Traslación frontal/dorsal del dolly
        dolly.position.addScaledVector(vectorDireccion, -ejeAdelante * velCaminar * delta);

        // Traslación lateral conjugada (Strafe)
        const vectorDerecha = new THREE.Vector3().crossVectors(vectorDireccion, new THREE.Vector3(0, 1, 0)).normalize();
        dolly.position.addScaledVector(vectorDerecha, ejeLado * velCaminar * delta);
      }

      // Rotación angular sobre el eje Y
      if (ejeRotacion !== 0) {
        dolly.rotation.y -= ejeRotacion * velGirar * delta;
      }
    }
  }

  renderizador.render(escena, camara);
});