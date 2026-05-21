import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

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
let modoActual = 'maqueta'; // 'maqueta' o 'fps'
let tamanioModelo = 5;

// Escena
const escena = new THREE.Scene();
escena.background = new THREE.Color(0x020617);
const reloj = new THREE.Clock();

// --- SISTEMA DE CÁMARA Y DOLLY ---
const dolly = new THREE.Group();
escena.add(dolly);

const camara = new THREE.PerspectiveCamera(60, contenedor.clientWidth / contenedor.clientHeight, 0.05, 5000);
dolly.add(camara);

// Renderizador
const renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderizador.outputColorSpace = THREE.SRGBColorSpace;
renderizador.shadowMap.enabled = true;
renderizador.shadowMap.type = THREE.PCFShadowMap;
renderizador.xr.enabled = true;
contenedor.appendChild(renderizador.domElement);
document.body.appendChild(VRButton.createButton(renderizador));

// --- LUCES ---
const luzAmbiente = new THREE.HemisphereLight(0xffffff, 0x334155, 2.2);
escena.add(luzAmbiente);

const luzDireccional = new THREE.DirectionalLight(0xffffff, 2.0); 
luzDireccional.position.set(8, 10, 8);
luzDireccional.castShadow = true;
luzDireccional.shadow.mapSize.width = 2048;
luzDireccional.shadow.mapSize.height = 2048;
luzDireccional.shadow.bias = -0.0005;
escena.add(luzDireccional);

const luzExtra = new THREE.PointLight(0x38bdf8, 1.8, 100);
luzExtra.position.set(-5, 5, -5);
escena.add(luzExtra);

// --- ENTORNO (PISO Y GUÍA) ---
const geometriaPiso = new THREE.CircleGeometry(15, 64);
const materialPiso = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.05 });
const piso = new THREE.Mesh(geometriaPiso, materialPiso);
piso.rotation.x = -Math.PI / 2;
piso.position.y = -0.05;
piso.receiveShadow = true;
escena.add(piso);

const guia = new THREE.GridHelper(24, 48, 0x38bdf8, 0x1e293b);
guia.position.y = -0.04;
escena.add(guia);


// ==========================================
// CONFIGURACIÓN DE CONTROLES HÍBRIDOS
// ==========================================

// 1. Controles Maqueta (Orbit)
const controlesOrbit = new OrbitControls(camara, renderizador.domElement);
controlesOrbit.enableDamping = true;
controlesOrbit.dampingFactor = 0.05;

// 2. Controles Primera Persona PC (PointerLock)
const controlesPC = new PointerLockControls(camara, document.body);
const teclas = { adelante: false, atras: false, izquierda: false, derecha: false };
const velocidadActual = new THREE.Vector3();
const vectorDireccion = new THREE.Vector3();

// Escuchar teclado para caminar
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

// 3. Controles VR (Caminar con pantalla/gatillo)
let avanzarVR = false;
const controladorVR = renderizador.xr.getController(0);
controladorVR.addEventListener('selectstart', () => { avanzarVR = true; });
controladorVR.addEventListener('selectend', () => { avanzarVR = false; });
escena.add(controladorVR);


// ==========================================
// FUNCIONES DE CAMBIO DE MODO
// ==========================================

function activarModoMaqueta() {
  modoActual = 'maqueta';
  controlesOrbit.enabled = true;
  
  // Ajustes de UI
  btnModoMaqueta.classList.replace('btn-outline-info', 'btn-info');
  btnModoPC.classList.replace('btn-success', 'btn-outline-success');
  textoAyudaMaqueta.style.display = 'block';
  textoAyudaPC.style.display = 'none';

  // Reposicionar cámara afuera
  dolly.position.set(0, 0, 0); // Reiniciamos el carrito
  const distancia = tamanioModelo * 0.8; 
  camara.position.set(distancia, distancia * 0.5, distancia);
  controlesOrbit.target.set(0, tamanioModelo * 0.2, 0);
  controlesOrbit.update();
}

function activarModoFPS() {
  modoActual = 'fps';
  controlesOrbit.enabled = false;
  
  // Ajustes de UI
  btnModoPC.classList.replace('btn-outline-success', 'btn-success');
  btnModoMaqueta.classList.replace('btn-info', 'btn-outline-info');
  textoAyudaPC.style.display = 'block';
  textoAyudaMaqueta.style.display = 'none';

  // Meter la cámara al centro a la altura de los ojos (1.5m)
  dolly.position.set(0, 0, 0);
  camara.position.set(0, 1.5, 0);
  camara.lookAt(0, 1.5, -1);
  
  // Bloquear el ratón para girar la cabeza
  controlesPC.lock();
}

// Escuchadores de los botones de modo
btnModoMaqueta.addEventListener('click', activarModoMaqueta);
btnModoPC.addEventListener('click', activarModoFPS);

// Si el usuario aprieta la tecla ESC, sale del modo FPS y regresa a la maqueta automáticamente
controlesPC.addEventListener('unlock', () => {
  if(modoActual === 'fps') activarModoMaqueta();
});

// Forzar entrada al salón al iniciar VR
renderizador.xr.addEventListener('sessionstart', () => {
  modoActual = 'vr';
  controlesOrbit.enabled = false;
  dolly.position.set(0, 0, 0); 
  // WebXR se encarga de la altura de la cámara automáticamente basándose en tu altura real
});


// ==========================================
// CARGA Y PREPARACIÓN DEL MODELO
// ==========================================

function prepararModelo(objeto) {
  objeto.traverse((hijo) => {
    if (hijo.isMesh) {
      hijo.castShadow = true;
      hijo.receiveShadow = true;
      if (hijo.material) {
        hijo.material.side = THREE.DoubleSide;
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

  // Centrar el modelo en el universo
  objeto.position.x -= centro.x;
  objeto.position.z -= centro.z;
  objeto.position.y -= caja.min.y;

  // Por defecto, iniciamos en Modo Maqueta
  activarModoMaqueta();
}

const loader = new GLTFLoader();
loader.load(
  RUTA_MODELO,
  function (gltf) {
    prepararModelo(gltf.scene);
    escena.add(gltf.scene);
    iniciarModelo(gltf.scene);
    mensajeCarga.classList.add('oculto');
  },
  undefined,
  function (error) {
    mensajeCarga.innerHTML = `<h5 class="fw-bold mb-1 text-danger">Error al cargar</h5><p class="small">Verifica assets/Salon.glb</p>`;
  }
);

btnGuia.addEventListener('click', () => {
  guiaVisible = !guiaVisible;
  guia.visible = guiaVisible;
  piso.visible = guiaVisible;
});

window.addEventListener('resize', () => {
  camara.aspect = contenedor.clientWidth / contenedor.clientHeight;
  camara.updateProjectionMatrix();
  renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
});

// ==========================================
// BUCLE DE ANIMACIÓN
// ==========================================

renderizador.setAnimationLoop(() => {
  const delta = Math.min(reloj.getDelta(), 0.1);

  // FÍSICAS MODO MAQUETA
  if (modoActual === 'maqueta') {
    controlesOrbit.update();
  }

  // FÍSICAS MODO PC (WASD)
  if (modoActual === 'fps' && controlesPC.isLocked) {
    // Fricción
    velocidadActual.x -= velocidadActual.x * 10.0 * delta;
    velocidadActual.z -= velocidadActual.z * 10.0 * delta;

    // Detectar teclas
    vectorDireccion.z = Number(teclas.adelante) - Number(teclas.atras);
    vectorDireccion.x = Number(teclas.derecha) - Number(teclas.izquierda);
    vectorDireccion.normalize();

    // Acelerar
    if (teclas.adelante || teclas.atras) velocidadActual.z -= vectorDireccion.z * 30.0 * delta;
    if (teclas.izquierda || teclas.derecha) velocidadActual.x -= vectorDireccion.x * 30.0 * delta;

    // Mover
    controlesPC.moveRight(-velocidadActual.x * delta);
    controlesPC.moveForward(-velocidadActual.z * delta);
    
    // Forzar la cámara para que no vuele ni se hunda (Altura de 1.5 metros)
    camara.position.y = 1.5; 
  }

  // FÍSICAS MODO VR (Caminar hacia donde miras)
  if (renderizador.xr.isPresenting && avanzarVR) {
    camara.getWorldDirection(vectorDireccion);
    vectorDireccion.y = 0; // Evitar que el usuario vuele al mirar al techo
    vectorDireccion.normalize();
    dolly.position.addScaledVector(vectorDireccion, 2.5 * delta); // Velocidad al caminar en VR
  }

  renderizador.render(escena, camara);
});