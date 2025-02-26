// Función para actualizar la simulación y detectar colisiones
function animate() {
    requestAnimationFrame(animate);

    // Mover las partículas
    particle1.position.add(velocity1);
    particle2.position.add(velocity2);

    // Comprobar si las partículas colisionan
    if (particle1.position.distanceTo(particle2.position) < 1) {
        // Simular la división en partículas constituyentes
        createSubparticles(particle1.position);
        createSubparticles(particle2.position);
        
        // Reiniciar las posiciones de las partículas
        particle1.position.x = -5;
        particle2.position.x = 5;
    }

    renderer.render(scene, camera);
}