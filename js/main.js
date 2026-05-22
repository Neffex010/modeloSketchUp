import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const RUTA_MODELO = './assets/SALON.glb';

const contenedor = document.getElementById('contenedor3D');
const mensajeCarga = document.getElementById('mensajeCarga');
const btnModoMaqueta = document.getElementById('btnModoMaqueta');
const btnModoPC = document.getElementById('btnModoPC');
const textoAyudaMaqueta = document.getElementById('textoAyudaMaqueta');
const textoAyudaPC = document.getElementById('textoAyudaPC');
const btnGuia = document.getElementById('btnGuia');

let guiaVisible = true;
let modoActual = 'maqueta'; 
let tamanioModelo = 5;

// --- SISTEMA DE COLISIONES (NUEVO) ---
const raycaster = new THREE.Raycaster();
const objetosColisionables = []; // Aquí guardaremos las paredes y pupitres

const escena = new THREE.Scene();
escena.background = new THREE.Color(0x020617);
const reloj = new THREE.Clock();

const dolly = new THREE.Group();
escena.add(dolly);

const camara = new THREE.PerspectiveCamera(60, contenedor.clientWidth / contenedor.clientHeight, 0.05, 5000);
dolly.add(camara);

const renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderizador.outputColorSpace = THREE.SRGBColorSpace;
renderizador.shadowMap.enabled = true;
renderizador.shadowMap.type = THREE.PCFShadowMap; 
renderizador.xr.enabled = true;

contenedor.appendChild(renderizador.domElement);
document.body.appendChild(VRButton.createButton(renderizador));

// Luces
const luzAmbiente = new THREE.HemisphereLight(0xffffff, 0x334155, 2.2);
escena.add(luzAmbiente);

const luzDireccional = new THREE.DirectionalLight(0xffffff, 2.0); 
luzDireccional.position.set(8, 10, 8);
luzDireccional.castShadow = true;
luzDireccional.shadow.mapSize.width = 1024;
luzDireccional.shadow.mapSize.height = 1024;
luzDireccional.shadow.bias = -0.0005; 
escena.add(luzDireccional);

const luzExtra = new THREE.PointLight(0x38bdf8, 1.8, 100);
luzExtra.position.set(-5, 5, -5);
escena.add(luzExtra);

// Piso y Guía
const geometriesPiso = new THREE.CircleGeometry(15, 64);
const materialPiso = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.05 });
const piso = new THREE.Mesh(geometriesPiso, materialPiso);
piso.rotation.x = -Math.PI / 2;
piso.position.y = -0.05; 
piso.receiveShadow = true;
escena.add(piso);

const guia = new THREE.GridHelper(24, 48, 0x38bdf8, 0x1e293b);
guia.position.y = -0.04; 
escena.add(guia);

// Controles
const controlesOrbit = new OrbitControls(camara, renderizador.domElement);
controlesOrbit.enableDamping = true;
controlesOrbit.dampingFactor = 0.05;

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

let avanzarVR = false;
const controladorVR = renderizador.xr.getController(0);
controladorVR.addEventListener('selectstart', () => { avanzarVR = true; });
controladorVR.addEventListener('selectend', () => { avanzarVR = false; });
escena.add(controladorVR);

// Cambios de Modo
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
  const distancia = tamanioModelo * 0.8; 
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
  camara.position.set(0, 1.5, 0); 
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

// Preparación del Modelo
function prepararModelo(objeto) {
  objeto.traverse((hijo) => {
    if (hijo.isMesh) {
      hijo.castShadow = true;
      hijo.receiveShadow = true;
      
      // REGISTRAR COLISIÓN: Agregamos las mallas al arreglo de obstáculos
      objetosColisionables.push(hijo);

      if (hijo.material) {
        hijo.material.side = THREE.FrontSide; 
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
    if (mensajeCarga) mensajeCarga.innerHTML = `<h5 class="fw-bold mb-1 text-danger">Error al cargar</h5><p class="small">Verifica assets/SALON.glb</p>`;
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
// BUCLE DE ANIMACIÓN Y FÍSICAS DE COLISIÓN
// ==========================================

renderizador.setAnimationLoop(() => {
  const delta = Math.min(reloj.getDelta(), 0.1); 
  
  // Obtenemos la posición exacta en el mundo para el Raycaster
  const posCamaraMundo = new THREE.Vector3();
  camara.getWorldPosition(posCamaraMundo);

  // 1. MODO MAQUETA
  if (modoActual === 'maqueta') {
    controlesOrbit.update();
  }

  // 2. MODO PC (FPS)
  if (modoActual === 'fps' && controlesPC.isLocked) {
    velocidadActual.x -= velocidadActual.x * 10.0 * delta;
    velocidadActual.z -= velocidadActual.z * 10.0 * delta;

    vectorDireccion.z = Number(teclas.adelante) - Number(teclas.atras);
    vectorDireccion.x = Number(teclas.derecha) - Number(teclas.izquierda);
    vectorDireccion.normalize();

    if (teclas.adelante || teclas.atras) velocidadActual.z -= vectorDireccion.z * 30.0 * delta;
    if (teclas.izquierda || teclas.derecha) velocidadActual.x -= vectorDireccion.x * 30.0 * delta;

    // --- DETECCIÓN DE COLISIÓN PC ---
    const dirMovimientoLocal = new THREE.Vector3(velocidadActual.x, 0, velocidadActual.z);
    
    // Solo disparamos el rayo si nos estamos moviendo
    if (dirMovimientoLocal.lengthSq() > 0.001) {
        // Convertimos la dirección local a la dirección real hacia donde mira la cámara
        const dirMovimientoMundo = dirMovimientoLocal.clone().applyQuaternion(camara.quaternion).normalize();
        dirMovimientoMundo.y = 0; 
        
        raycaster.set(posCamaraMundo, dirMovimientoMundo);
        const colisiones = raycaster.intersectObjects(objetosColisionables);
        
        // Si hay una pared o pupitre a menos de 0.6 unidades (metros), frenamos
        if (colisiones.length > 0 && colisiones[0].distance < 0.6) {
            velocidadActual.x = 0;
            velocidadActual.z = 0;
        }
    }

    controlesPC.moveRight(-velocidadActual.x * delta);
    controlesPC.moveForward(-velocidadActual.z * delta);
    camara.position.y = 1.5; 
  }

  // 3. MODO VR (Pantalla Táctil y Mando)
  if (renderizador.xr.isPresenting || modoActual === 'vr') {
    
    // VR: Táctil / Gatillo
    if (avanzarVR) {
      camara.getWorldDirection(vectorDireccion);
      vectorDireccion.y = 0; 
      vectorDireccion.normalize();
      
      // --- DETECCIÓN DE COLISIÓN VR (Táctil) ---
      raycaster.set(posCamaraMundo, vectorDireccion);
      const colisiones = raycaster.intersectObjects(objetosColisionables);
      
      // Solo avanzamos si NO hay nada chocando en los próximos 0.6 metros
      if (colisiones.length === 0 || colisiones[0].distance > 0.6) {
        dolly.position.addScaledVector(vectorDireccion, 2.5 * delta); 
      }
    }

    // VR: Mando Bluetooth
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        gp = gamepads[i];
        break;
      }
    }

    if (gp) {
      const deadzone = 0.15; 
      const velCaminar = 3.5;
      const velGirar = 2.0;

      const ejeAdelante = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0; 
      const ejeLado = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;     
      const ejeRotacion = Math.abs(gp.axes[2]) > deadzone ? gp.axes[2] : 0; 

      if (ejeAdelante !== 0 || ejeLado !== 0) {
        // --- DETECCIÓN DE COLISIÓN VR (Gamepad) ---
        const dirGamepadLocal = new THREE.Vector3(ejeLado, 0, -ejeAdelante); 
        const dirGamepadMundo = dirGamepadLocal.clone().applyQuaternion(camara.quaternion).normalize();
        dirGamepadMundo.y = 0;

        raycaster.set(posCamaraMundo, dirGamepadMundo);
        const colisiones = raycaster.intersectObjects(objetosColisionables);

        // Solo procesamos el empuje del joystick si el camino está libre
        if (colisiones.length === 0 || colisiones[0].distance > 0.6) {
            camara.getWorldDirection(vectorDireccion);
            vectorDireccion.y = 0;
            vectorDireccion.normalize();

            dolly.position.addScaledVector(vectorDireccion, -ejeAdelante * velCaminar * delta);
            const vectorDerecha = new THREE.Vector3().crossVectors(vectorDireccion, new THREE.Vector3(0, 1, 0)).normalize();
            dolly.position.addScaledVector(vectorDerecha, ejeLado * velCaminar * delta);
        }
      }

      if (ejeRotacion !== 0) {
        dolly.rotation.y -= ejeRotacion * velGirar * delta;
      }
    }
  }

  renderizador.render(escena, camara);
});