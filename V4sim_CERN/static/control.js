// Variables de control
let isRunning = false;
let animationId;

// Modificar la función animate para que pueda pausarse
function animate() {
    if (!isRunning) return;
    
    animationId = requestAnimationFrame(animate);

    // Mover las partículas
    particle1.position.add(velocity1);
    particle2.position.add(velocity2);

    // Comprobar colisión
    if (particle1.position.distanceTo(particle2.position) < 2) {
        createSubparticles(particle1.position);
        createSubparticles(particle2.position);
        particle1.position.x = -5;
        particle2.position.x = 5;
    }
    
    renderer.render(scene, camera);
}


// Funciones para los botones
function startSimulation() {
    if (!isRunning) {
        isRunning = true;
        animate();
    }
}

function pauseSimulation() {
    isRunning = false;
    cancelAnimationFrame(animationId);
}

function restartSimulation() {
    pauseSimulation();
    particle1.position.set(-5, 0, 0);
    particle2.position.set(5, 0, 0);
    collisionOccurred = false; // Permitir nueva colisión
    subparticles = []; // Limpiar las partículas
    upQuarks = 0;
    downQuarks = 0;
    bosonZ = 0;
;

     // Limpiar la lista de partículas en el HTML
     const particleList = document.getElementById('particleList');
     particleList.innerHTML = '';

    // Eliminar partículas visuales de Three.js
    for (let i = scene.children.length - 1; i >= 0; i--) {
        if (scene.children[i] instanceof THREE.Mesh && scene.children[i] !== particle1 && scene.children[i] !== particle2) {
            scene.remove(scene.children[i]);
        }
    }
}