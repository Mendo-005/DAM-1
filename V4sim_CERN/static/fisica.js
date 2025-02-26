let subparticles = []; // Global para almacenar las partículas

// Contadores de quarks up y down y bosón Z
let upQuarks = 0;
let downQuarks = 0;
let bosonZ = 0;
// Función para calcular la magnitud de un vector
function calcularMagnitud(velocity1) {
    return Math.sqrt(
        velocity1.x ** 2 +
        velocity1.y ** 2 +
        velocity1.z ** 2
    );
}

// Calcular la velocidad de los protones
let protonVelocity = calcularMagnitud(velocity1) * c;

// Función para calcular la energía total de una partícula
function ColisionEnergy(mass) {
    console.log(protonVelocity)
    const gamma = 1 / Math.sqrt(1 - Math.pow(protonVelocity / c, 2)); // Factor de Lorentz
    const Energy = (gamma * mass * Math.pow(c, 2))/10**12; // E = γmc^2
    return Energy;
}


// Función para crear subpartículas
function createSubparticles(position) {
    const totalEnergy = ColisionEnergy(mass, protonVelocity); // Energía relativista total
    const possibleParticles = [
        { name: "Quark Up", color: 0xff8c00, minEnergy: 0.1*1000 },
        { name: "Quark Down", color: 0x00cc99, minEnergy: 0.1*1000 },
        { name: "Gluon", color: 0xcccccc, minEnergy: 2*1000 },
        { name: "Fotón", color: 0xffdd44, minEnergy: 5*1000 },
        { name: "Bosón Z", color: 0xcc00cc, minEnergy: 91*1000 }
    ];
    console.log(totalEnergy)
    
    let subparticlesCreated = [];
    let remainingEnergy = totalEnergy;
    let numSubparticles = Math.floor(Math.random() * 4) + 2; // Entre 2 y 5 subpartículas

    for (let i = 0; i < numSubparticles; i++) {
        let particleData = possibleParticles[Math.floor(Math.random() * possibleParticles.length)];

        // Limitar la cantidad de quarks up y down
        if (particleData.name === "Quark Up" && upQuarks >= 2) {
            continue; // Si ya hay 2 quarks up, no generamos más
        }
        if (particleData.name === "Quark Down" && downQuarks >= 1) {
            continue; // Si ya hay 1 quark down, no generamos más
        }
        if (particleData.name === "Bosón Z" && bosonZ >= 1) {
            continue; // Si ya hay 1 bosón Z, no generamos más
        }

        // Asegurar que la partícula tenga al menos su energía mínima
        let maxPossibleEnergy = remainingEnergy / (numSubparticles - i); // Corregido el cálculo
        let energy = Math.max(Math.random() * maxPossibleEnergy, particleData.minEnergy); // Energía mínima corregida
        
        // Evitar que la energía restante sea negativa
        remainingEnergy -= energy;
        if (remainingEnergy < 0) break;

        // Incrementar el contador de quarks y bosones Z
        if (particleData.name === "Quark Up") upQuarks++;
        if (particleData.name === "Quark Down") downQuarks++;
        if (particleData.name === "Bosón Z") bosonZ++; // Aseguramos que solo haya 1 bosón Z
        console.log("upQuarks:",upQuarks)
        console.log("downQuarks:",downQuarks)
        console.log("bosonZ:",bosonZ)

        // Crear subpartícula con energía formateada
        const subparticle = {
            name: particleData.name,
            color: particleData.color,
            energy: parseFloat(energy.toFixed(2)) // Redondear a 2 decimales
        };

        // Crear representación visual en Three.js
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: particleData.color, opacity: 0.8 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        scene.add(mesh);
        
        // Asignar velocidad aleatoria
        const randomVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
        );
        animateSubparticle(mesh, randomVelocity);

        subparticlesCreated.push(subparticle);
    }

    // Asegurar que se actualiza el array global correctamente
    if (subparticlesCreated.length > 0) {
        subparticles.push(...subparticlesCreated); // En lugar de concat
        console.log("Subpartículas generadas:", subparticles);
        updateParticleInfo(subparticles); // Asegurar que la función está recibiendo los datos correctos
    } else {
        console.warn("No se generaron subpartículas.");
    }
}

// Función para agregar información de partículas al HTML
function updateParticleInfo(subparticles) {
    const particleList = document.getElementById('particleList');
    particleList.innerHTML = '';
    
    subparticles.forEach(particle => {
        const listItem = document.createElement('li');
        // Corregir la interpolación de cadena usando backticks
        listItem.textContent = `${particle.name} - Energia: ${particle.energy.toFixed(2)} GeV`;
        listItem.style.backgroundColor = `#${particle.color.toString(16).padStart(6, '0')}`; // Aplicar color de fondo
        listItem.style.color = '#000'; // Texto oscuro para mejorar contraste
        listItem.style.padding = '5px';
        listItem.style.borderRadius = '5px';
        particleList.appendChild(listItem);
    });
}

// Función para animar las subpartículas
function animateSubparticle(subparticle, velocity) {
    function move() {
        subparticle.position.add(velocity);
        requestAnimationFrame(move);
    }
    move();
}
