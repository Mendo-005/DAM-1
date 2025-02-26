// Crear un nuevo renderer para las etiquetas
const container = document.getElementById('scene-container');
container.appendChild(labelRenderer.domElement);


// Inicializar la simulación
init();
animate();
