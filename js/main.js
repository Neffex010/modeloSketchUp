import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Ruta del modelo
const RUTA_MODELO = 'assets/Salon.glb';

// Elementos HTML
const contenedor = document.getElementById('contenedor3D');
const mensajeCarga = document.getElementById('mensajeCarga');
const btnRecentrar = document.getElementById('btnRecentrar');
const btnGuia = document.getElementById('btnGuia');

// Variables globales
let modelo = null;
let controles = null;
let guiaVisible = true;
let tamanioModelo = 5;

// Escena
const escena = new THREE.Scene();
escena.background = new THREE.Color(0x020617);

// Cámara
const camara = new THREE.PerspectiveCamera(
  60,
  contenedor.clientWidth / contenedor.clientHeight,
  0.01,
  5000
);

camara.position.set(6, 4, 8);

// Renderizador
const renderizador = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
});

renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderizador.outputColorSpace = THREE.SRGBColorSpace;
renderizador.shadowMap.enabled = true;

// Usando PCFShadowMap para evitar warnings
renderizador.shadowMap.type = THREE.PCFShadowMap;

// Activar WebXR / VR
renderizador.xr.enabled = true;

// Agregar canvas al contenedor
contenedor.appendChild(renderizador.domElement);

// Botón VR
document.body.appendChild(VRButton.createButton(renderizador));

// Controles de cámara
controles = new OrbitControls(camara, renderizador.domElement);
controles.enableDamping = true;
controles.dampingFactor = 0.05;
controles.target.set(0, 1, 0);

// Luces
const luzAmbiente = new THREE.HemisphereLight(0xffffff, 0x334155, 2.2);
escena.add(luzAmbiente);

// LUZ DIRECCIONAL AJUSTADA (Menos intensa y con corrección de Acné de Sombra)
const luzDireccional = new THREE.DirectionalLight(0xffffff, 2.0); 
luzDireccional.position.set(8, 10, 8);
luzDireccional.castShadow = true;
luzDireccional.shadow.mapSize.width = 2048;
luzDireccional.shadow.mapSize.height = 2048;
luzDireccional.shadow.bias = -0.0005; // Corrección para las manchas en las paredes
escena.add(luzDireccional);

const luzExtra = new THREE.PointLight(0x38bdf8, 1.8, 100);
luzExtra.position.set(-5, 5, -5);
escena.add(luzExtra);

// Piso
const geometriaPiso = new THREE.CircleGeometry(12, 96);
const materialPiso = new THREE.MeshStandardMaterial({
  color: 0x0f172a,
  roughness: 0.85,
  metalness: 0.05
});

const piso = new THREE.Mesh(geometriaPiso, materialPiso);
piso.rotation.x = -Math.PI / 2;
piso.receiveShadow = true;
escena.add(piso);

// Guía
const guia = new THREE.GridHelper(24, 48, 0x38bdf8, 0x1e293b);
guia.position.y = 0.01;
escena.add(guia);

// FUNCIÓN DE PREPARACIÓN DE MATERIALES MEJORADA
function prepararModelo(objeto) {
  objeto.traverse((hijo) => {
    if (hijo.isMesh) {
      hijo.castShadow = true;
      hijo.receiveShadow = true;

      if (hijo.material) {
        hijo.material.side = THREE.DoubleSide;
        
        // Forzar a que los materiales de SketchUp no sean metálicos y sean mates
        hijo.material.roughness = 0.9; 
        hijo.material.metalness = 0.0;
        
        // Si el material exportó completamente negro por error, lo hacemos blanco/grisáceo
        if (hijo.material.color && hijo.material.color.getHex() === 0x000000) {
            hijo.material.color.setHex(0xe2e8f0);
        }
      }
    }
  });
}

// Función para centrar el modelo
function centrarModelo(objeto) {
  const caja = new THREE.Box3().setFromObject(objeto);
  const centro = new THREE.Vector3();
  const tamanio = new THREE.Vector3();

  caja.getCenter(centro);
  caja.getSize(tamanio);

  tamanioModelo = Math.max(tamanio.x, tamanio.y, tamanio.z, 1);

  // Centrar en X y Z
  objeto.position.x -= centro.x;
  objeto.position.z -= centro.z;

  // Colocar sobre el piso
  objeto.position.y -= caja.min.y;

  // Ajustar cámara según tamaño
  const distancia = tamanioModelo * 1.8;

  camara.position.set(distancia, distancia * 0.75, distancia);
  camara.near = Math.max(tamanioModelo / 1000, 0.01);
  camara.far = tamanioModelo * 100;
  camara.updateProjectionMatrix();

  controles.target.set(0, tamanio.y * 0.4, 0);
  controles.update();
}

// Función para recentrar cámara
function recentrarCamara() {
  const distancia = tamanioModelo * 1.8;

  camara.position.set(distancia, distancia * 0.75, distancia);
  controles.target.set(0, tamanioModelo * 0.25, 0);
  controles.update();
}

// Cargar modelo GLB
const loader = new GLTFLoader();

loader.load(
  RUTA_MODELO,

  function (gltf) {
    modelo = gltf.scene;

    prepararModelo(modelo);
    escena.add(modelo);
    centrarModelo(modelo);

    mensajeCarga.classList.add('oculto');

    console.log('Modelo cargado correctamente');
  },

  function (progreso) {
    if (progreso.total > 0) {
      const porcentaje = Math.round((progreso.loaded / progreso.total) * 100);
      console.log(`Cargando modelo: ${porcentaje}%`);
    }
  },

  function (error) {
    console.error('Error al cargar el modelo:', error);

    mensajeCarga.innerHTML = `
      <h5 class="fw-bold mb-1 text-danger">Error al cargar el modelo</h5>
      <p class="small text-secondary mb-0">Revisa que exista el archivo: <code>assets/Salon.glb</code></p>
    `;
  }
);

// Botón para recentrar cámara
btnRecentrar.addEventListener('click', () => {
  recentrarCamara();
});

// Botón para mostrar u ocultar guía
btnGuia.addEventListener('click', () => {
  guiaVisible = !guiaVisible;
  guia.visible = guiaVisible;
  piso.visible = guiaVisible;
});

// Ajustar tamaño al cambiar ventana
function redimensionar() {
  const ancho = contenedor.clientWidth;
  const alto = contenedor.clientHeight;

  camara.aspect = ancho / alto;
  camara.updateProjectionMatrix();

  renderizador.setSize(ancho, alto);
}

window.addEventListener('resize', redimensionar);

// Bucle de animación compatible con VR
renderizador.setAnimationLoop(() => {
  controles.update();
  renderizador.render(escena, camara);
});