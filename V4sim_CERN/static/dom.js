// Agregar event listeners a los botones
document.getElementById('startBtn').addEventListener('click', startSimulation);
document.getElementById('pauseBtn').addEventListener('click', pauseSimulation);
document.getElementById('restartBtn').addEventListener('click', restartSimulation);

// Listener para el botón de "Aplicar configuración"
document.getElementById('applyConfig').addEventListener('click', function() {
    const inputVelocity = parseFloat(document.getElementById('protonVelocity').value);
    velocity1.set(inputVelocity / 1, 0, 0);
    velocity2.set(inputVelocity / -1, 0, 0);
    
    // Calcular la magnitud de la velocidad después de la configuración
    protonVelocity = calcularMagnitud(velocity1)*c;
    console.log("Velocidad del protón:", protonVelocity);
});

// Listener para el botón de "Aplicar configuración"
document.getElementById('applyConfig').addEventListener('click', function() {
    const inputMass = parseFloat(document.getElementById('protonMass').value);
    
    if (isNaN(inputMass) || inputMass <= 0) {
        console.warn("Por favor, introduce una masa válida y positiva.");
        return;
    }
    
    mass = inputMass;
    console.log("Masa del protón:", mass);
});


// Listener para el botón de "Reiniciar configuración"
document.getElementById('resetConfig').addEventListener('click', resetProtonConfig);

// Función para reiniciar la configuración de los protones
function resetProtonConfig() {
    document.getElementById('protonMass').value = 0.938;
    document.getElementById('protonVelocity').value = 0.99;
    document.getElementById('protonCharge').value = 1;
}



// Agregar un listener para el botón de reiniciar configuración
document.getElementById('resetConfig').addEventListener('click', resetProtonConfig);

// Variables de control

let collisionOccurred = false; // Nueva variable para evitar colisiones en bucle

// Esperar a que el DOM esté listo
window.onload = function() {
    document.getElementById('startBtn').addEventListener('click', startSimulation);
    document.getElementById('pauseBtn').addEventListener('click', pauseSimulation);
    document.getElementById('restartBtn').addEventListener('click', restartSimulation);
    init(); // Asegurar que la escena se inicializa correctamente
};

// Modificar la función animate para que pueda pausarse
function animate() {
    if (!isRunning) return;
    
    animationId = requestAnimationFrame(animate);

    // Mover las partículas solo si no ha ocurrido una colisión
    if (!collisionOccurred) {
        particle1.position.add(velocity1);
        particle2.position.add(velocity2);
    }

    // Comprobar colisión
    if (!collisionOccurred && particle1.position.distanceTo(particle2.position) < 2) {
        collisionOccurred = true;
        createSubparticles(particle1.position);
        createSubparticles(particle2.position);
    }
    
    renderer.render(scene, camera);
}
