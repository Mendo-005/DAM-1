// ------------------------- VARIABLES GLOBALES -------------------------
let currentImage = '';       
let labels = [];             
let deleteMode = false;      
let addMode = false;         
let canvas = document.getElementById("canvas");  
let ctx = canvas.getContext("2d");               
let imageFiles = [];         
let currentIndex = 0;        
let webcamStream = null;     // Para controlar el stream de la cámara
let webcamVideo = document.createElement('video'); // Elemento video para la cámara

// Configuración de etiquetas
const labelRadius = 45; // Radio base de las etiquetas
let SCALE_FACTOR = 1; // Factor de escala inicial
let CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR);

// Dimensiones base del canvas al iniciar la web
let IMAGE_WIDTH = 800; // Ancho inicial del canvas
let IMAGE_HEIGHT = 400; // Alto inicial del canvas
let CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
let CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);

// Configuración inicial del canvas
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let originalImage = new Image();  // Objeto Image para cargar las imágenes

// Función para actualizar las dimensiones del canvas según la imagen seleccionada
function updateCanvasDimensions(image) {
    IMAGE_WIDTH = image.naturalWidth; // Ancho real de la imagen
    IMAGE_HEIGHT = image.naturalHeight; // Alto real de la imagen
    CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
    CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);

    // Actualizar las dimensiones del canvas
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Recalcular el tamaño de las etiquetas en función del nuevo tamaño del canvas
    CANVAS_LABEL = Math.round(labelRadius * (CANVAS_WIDTH / IMAGE_WIDTH));
}

// ------------------------- FUNCIONES DE CÁMARA WEB -------------------------
async function toggleWebcam() {
    const webcamContainer = document.getElementById('webcam-container');
    const webcamButton = document.getElementById('webcam-button');
    
    if (webcamStream) {
        // Apagar la cámara
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
        webcamContainer.style.display = 'none';
        webcamVideo.srcObject = null;
    } else {
        // Encender la cámara
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
            webcamVideo.srcObject = webcamStream;
            webcamVideo.play();
            
            webcamContainer.style.display = 'block';
            
            // Ajustar el tamaño del video
            webcamVideo.onloadedmetadata = () => {
                const videoWidth = webcamVideo.videoWidth;
                const videoHeight = webcamVideo.videoHeight;
                const aspectRatio = videoWidth / videoHeight;
                
                // Ajustar para que se vea bien en el contenedor
                const container = document.getElementById('webcam-preview-container');
                if (container) {
                    container.style.width = '640px';
                    container.style.height = `${Math.round(640 / aspectRatio)}px`;
                    container.appendChild(webcamVideo); 
                } else {
                    console.warn("El contenedor 'webcam-preview-container' no existe.");
                }
            };
        } catch (err) {
            console.error("Error al acceder a la cámara:", err);
            alert("No se pudo acceder a la cámara. Asegúrate de permitir el acceso.");
        }
    }
}

function capturePhoto() {
    if (!webcamStream) {
        alert("La cámara no está activada");
        return;
    }

    // Crear un canvas temporal para capturar la foto
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Establecer el tamaño del canvas temporal
    tempCanvas.width = webcamVideo.videoWidth;
    tempCanvas.height = webcamVideo.videoHeight;
    
    // Dibujar el frame actual del video en el canvas
    tempCtx.drawImage(webcamVideo, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Convertir a blob y procesar como una imagen normal
    tempCanvas.toBlob(async (blob) => {
        const file = new File([blob], `webcam_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        // Simular un input file para usar la función existente
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('imageInput').files = dataTransfer.files;
        
        // Procesar como una imagen subida normalmente
        uploadImage();
        
        // Apagar la cámara después de capturar
        toggleWebcam();
    }, 'image/jpeg', 0.95);
}

// ------------------------- FUNCIONES DE CARGA DE IMÁGENES -------------------------
function selectImage() {
    /* Abre el selector de archivos para elegir una imagen individual */
    const imageInput = document.getElementById('imageInput');
    imageInput.click();

    imageInput.addEventListener('change', function () {
        const file = imageInput.files[0];
        if (!file || !file.type.startsWith('image/')) {
            alert("Por favor selecciona un archivo de imagen válido.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            originalImage.src = event.target.result;
            originalImage.onload = function () {
                updateCanvasDimensions(originalImage);
                ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                currentImage = file.name;
                labels = [];
                drawLabels();
            };
        };
        reader.readAsDataURL(file);
    }, { once: true });
}

function selectFolder() {
    /* Abre el selector de carpetas para cargar múltiples imágenes */
    const folderInput = document.getElementById('folderInput');
    folderInput.click();

    folderInput.addEventListener('change', function () {
        const files = Array.from(folderInput.files);
        imageFiles = files.filter(file => file.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            alert("No se encontraron imágenes en la carpeta seleccionada.");
            return;
        }

        currentIndex = 0;
        loadImage(imageFiles[currentIndex]);
        folderInput.value = '';
    }, { once: true });
}

function loadImage(file) {
    /* Carga una imagen en el canvas */
    const reader = new FileReader();
    reader.onload = function (event) {
        originalImage.src = event.target.result;
        originalImage.onload = function () {
            updateCanvasDimensions(originalImage);
            ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            currentImage = file.name;
            labels = [];
            drawLabels();
        };
    };
    reader.readAsDataURL(file);
}

// ------------------------- NAVEGACIÓN ENTRE IMÁGENES -------------------------
function previousImage() {
    /* Muestra la imagen anterior en imageFiles */
    if (imageFiles.length === 0) {
        alert("No hay imágenes cargadas.");
        return;
    }
    currentIndex = (currentIndex - 1 + imageFiles.length) % imageFiles.length;
    loadImage(imageFiles[currentIndex]);
}

function nextImage() {
    /* Muestra la siguiente imagen en imageFiles */
    if (imageFiles.length === 0) {
        alert("No hay imágenes cargadas.");
        return;
    }
    currentIndex = (currentIndex + 1) % imageFiles.length;
    loadImage(imageFiles[currentIndex]);
}

// ------------------------- FUNCIONES DE ETIQUETADO -------------------------
function updateLabelCounter() {
    const labelCounter = document.getElementById('label-counter');
    labelCounter.textContent = `Total de etiquetas: ${labels.length}`;
}

function drawLabels() {
    // Limpiar completamente el canvas primero
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redibujar la imagen de fondo si existe
    if (originalImage && originalImage.complete) {
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    } else {
        // Si no hay imagen, dibujar fondo amarillo
        ctx.fillStyle = 'rgba(255, 238, 190, 0.842)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Dibujar todas las etiquetas
    labels.forEach((label, index) => {
        const [x_center, y_center] = label;
        const x = x_center * canvas.width;
        const y = y_center * canvas.height;
        
        // Dibujar círculo
        ctx.beginPath();
        ctx.arc(x, y, CANVAS_LABEL, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
        
        // Dibujar número
        ctx.fillStyle = '#000';
        ctx.font = `${Math.round(CANVAS_LABEL / 2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((index + 1).toString(), x, y);
    });
    updateLabelCounter(); // Actualizar el contador de etiquetas
}

// ------------------------- MANEJO DE MODOS (AÑADIR/ELIMINAR) -------------------------
function toggleDeleteMode() {
    /* Alterna el modo de eliminación */
    deleteMode = !deleteMode;
    addMode = false;
    updateButtonStyles();
}

function toggleAddMode() {
    /* Alterna el modo de adición */
    addMode = !addMode;
    deleteMode = false;
    updateButtonStyles();
}

function updateButtonStyles() {
    /* Actualiza los estilos visuales de los botones según el modo activo */
    const deleteBtn = document.querySelector("button[onclick='toggleDeleteMode()']");
    const addBtn = document.querySelector("button[onclick='toggleAddMode()']");
    
    // Resetear colores
    deleteBtn.style.backgroundColor = "#3a3a3a";
    addBtn.style.backgroundColor = "#3a3a3a";
    
    // Aplicar colores según el modo activo
    if (deleteMode) {
        deleteBtn.style.backgroundColor = "#ff5050"; // Rojo para borrar
    } 
    if (addMode) {
        addBtn.style.backgroundColor = "#50ff50"; // Verde para añadir
    }
}

// ------------------------- EVENTOS DEL CANVAS -------------------------
canvas.addEventListener('click', function(event) {
    /* Maneja los clicks en el canvas según el modo activo */
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    if (addMode) {
        // Modo añadir: agrega nueva etiqueta
        labels.push([x, y]);
        drawLabels();
    } else if (deleteMode) {
        // Modo eliminar: quita etiquetas cercanas al click
        labels = labels.filter(label => {
            const [x_center, y_center] = label;
            const distance = Math.sqrt((x - x_center) ** 2 + (y - y_center) ** 2);
            return distance > CANVAS_LABEL / CANVAS_WIDTH;
        });
        drawLabels();
    }
});

// ------------------------- FUNCIONES DE UTILIDAD -------------------------
function clearCanvas() {
    if (confirm("¿Estás seguro de que deseas limpiar el canvas por completo?")) { 
        labels = [];
        imageFiles = [];
        currentImage = '';
        originalImage = new Image(); // <-- ¡IMPORTANTE! Resetear la imagen
        
        // Restablecer dimensiones iniciales
        IMAGE_WIDTH = 800;
        IMAGE_HEIGHT = 400;
        CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
        CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        
        
        // Resetear inputs
        document.getElementById('imageInput').value = '';
        document.getElementById('folderInput').value = '';
        updateLabelCounter();
    }

}

function undoLastLabel() {
    /* Elimina la última etiqueta añadida */
    if (labels.length > 0) {
        labels.pop();
        drawLabels();
    }
}

// ------------------------- COMUNICACIÓN CON EL SERVIDOR -------------------------
function uploadImage() {
    /* Envía la imagen al servidor para procesamiento con YOLO */
    let file;

    // Si hay imágenes cargadas desde una carpeta, usa la actual
    if (imageFiles.length > 0 && currentIndex >= 0 && currentIndex < imageFiles.length) {
        file = imageFiles[currentIndex];
    } else {
        // Si no, usa la imagen seleccionada individualmente
        const imageInput = document.getElementById("imageInput");
        if (imageInput.files.length === 0) {
            alert("Selecciona una imagen");
            return;
        }
        file = imageInput.files[0];
    }

    const formData = new FormData();
    formData.append("file", file);

    fetch("/upload", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.image_url) {
            originalImage.src = data.image_url;
            originalImage.onload = function () {
                updateCanvasDimensions(originalImage);
                ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                currentImage = file.name;
                labels = data.labels || [];
                drawLabels();
            };
        } else {
            alert("Error al procesar la imagen: " + (data.error || "Error desconocido"));
        }
    })
    .catch(error => console.error("Error:", error));
}

function saveLabels() {
    /* Muestra el cuadro de diálogo para introducir datos antes de guardar */
    document.getElementById('saveDialog').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
}

function clearDialog() {
    /* Limpia los campos del cuadro de diálogo */
    if (confirm("¿Estás seguro de que deseas limpiar el cuadro por completo?")) { 
    document.getElementById('drawerNumber').value = '';
    document.getElementById('date').value = '';
    document.getElementById('cepo').value = '';
    document.getElementById('drawerNumber').focus();
    }
}

function closeSaveDialog() {
    /* Cierra el cuadro de diálogo sin guardar */
    document.getElementById('saveDialog').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
}

function confirmSave() {
    /* Guarda las etiquetas con el nuevo nombre de archivo */
    const drawerNumber = document.getElementById('drawerNumber').value.trim();
    const date = document.getElementById('date').value.trim();
    const cepo = document.getElementById('cepo').value.trim();

    if (!drawerNumber || !date || !cepo) {
        alert("Por favor, completa todos los campos.");
        return;
    }

    // Convertir la fecha al formato ddmmaa
    const formattedDate = date.split('-').reverse().join('').slice(0, 6);

    // Generar el nuevo nombre de archivo
    const newFileName = `${drawerNumber}_${formattedDate}_${cepo}.jpg`;

    // Cerrar el cuadro de diálogo
    closeSaveDialog();

    // Enviar los datos al servidor para guardar etiquetas y renombrar imágenes
    fetch(`/update_labels`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            file: newFileName,          // Nuevo nombre del archivo
            labels: labels,             // Etiquetas
            originalImage: currentImage // Nombre de la imagen original
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            // Actualizar el nombre de la imagen actual y procesada
            currentImage = newFileName;
            originalImage.src = `/static/images/${newFileName}`; // Ruta de la imagen renombrada
            alert("Etiquetas y nombres de archivo guardados correctamente");
        } else {
            alert("Error al guardar etiquetas: " + data.error);
        }
    })
    .catch(error => console.error("Error guardando etiquetas:", error));
}

// ------------------------- CONFIGURACIÓN -------------------------

//20250409 Mario: Function not implemented yet
function toggleSettings() {
    alert("Función aún no implementada.");  // Puedes reemplazar esto con la lógica real
    /* Muestra/oculta el panel de configuración */
    //const settingsWindow = document.getElementById('settingsWindow');*\
    //settingsWindow.style.display = settingsWindow.style.display === 'block' ? 'none' : 'block';*\
}


//function closeSettings() {
//    /* Cierra el panel de configuración */
//    document.getElementById('settingsWindow').style.display = 'none';
//}
//
//function applySettings() {
//    /* Aplica los cambios de configuración (tamaño de etiquetas) */
//    const newScaleFactor = parseFloat(document.getElementById('labelSize').value) / 100;
//
//    if (isNaN(newScaleFactor) || newScaleFactor <= 0) {
//        alert("Por favor, introduce un valor válido para el tamaño de las etiquetas.");
//        return;
//    }
//
//    // Actualizar únicamente el radio de las etiquetas
//    SCALE_FACTOR = newScaleFactor;
//    CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR);
//
//    // Redibujar las etiquetas con el nuevo tamaño
//    drawLabels();
//
//    // Cerrar la ventana de configuración
//    closeSettings();
//}

// Inicializar visualización del tamaño de etiqueta
document.getElementById('labelSize').addEventListener('input', function() {
    document.getElementById('labelSizeValue').textContent = this.value + ' px';
});
