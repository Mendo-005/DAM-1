let scene, camera, renderer;
let particle1, particle2;
let velocity1 = new THREE.Vector3(0.99, 0, 0); // Movimiento V1
let velocity2 = new THREE.Vector3(-0.99, 0, 0); // Movimiento V2
// Constantes físicas
let c = 299792458; // Velocidad de la luz en m/s
let mass = 0.938; // Masa en GeV/c^2

// Función para actualizar la velocidad desde el DOM
function updateVelocity(newVelocity1, newVelocity2) {
    velocity1.set(newVelocity1.x, newVelocity1.y, newVelocity1.z);
    velocity2.set(newVelocity2.x, newVelocity2.y, newVelocity2.z);
    // Llamar a la función para recalcular la energía
    recalculateEnergy();
}

// Función para recalcular la energía
function recalculateEnergy() {
    const totalEnergy = ColisionEnergy(mass, velocity1);
    console.log("Energía total recalculada:", totalEnergy);
}

// Cargar la textura
const textureLoader = new THREE.TextureLoader();
const particleTexture = textureLoader.load('/static/particle_texture.png');

// Crear la escena, cámara y renderizador
function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 1000 / 800, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(1100, 600); // Reducir tamaño del canvas
    document.getElementById('visualization').appendChild(renderer.domElement);

    // Ajustar la relación de aspecto correctamente
    camera.aspect = 1000 / 400;
    camera.updateProjectionMatrix();

    // Crear las partículas con material que tenga textura
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material1 = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        map: particleTexture, // Asignar la textura
        opacity: 1         // Ajustar la opacidad
    });
    const material2 = new THREE.MeshStandardMaterial({
        color: 0x0000ff,
        map: particleTexture,
        opacity: 1
    });

    particle1 = new THREE.Mesh(geometry, material1);
    particle2 = new THREE.Mesh(geometry, material2);

    // Posicionarlas en direcciones contrarias
    particle1.position.x = -5;
    particle2.position.x = 5;

    // Añadir las partículas a la escena
    scene.add(particle1);
    scene.add(particle2);

    // Crear una luz para iluminar las partículas
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(10, 10, 10);
    scene.add(light);

    camera.position.z = 15;
}