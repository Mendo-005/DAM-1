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
const labelRadius = 45;      
let SCALE_FACTOR = 0.24;     
let CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR); // Radio escalado

// Dimensiones base de la imagen
const IMAGE_WIDTH = 4032;
const IMAGE_HEIGHT = 3024;
let CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
let CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);

// Configuración inicial del canvas
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
let originalImage = new Image();  // Objeto Image para cargar las imágenes

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
function drawLabels() {
    /* Dibuja todas las etiquetas en el canvas */
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Dibujar cada etiqueta
    labels.forEach((label, index) => {
        let [x_center, y_center] = label;
        let x = x_center * CANVAS_WIDTH;
        let y = y_center * CANVAS_HEIGHT;

        // Círculo de la etiqueta
        ctx.beginPath();
        ctx.arc(x, y, CANVAS_LABEL, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.fill();
        ctx.stroke();

        // Número de la etiqueta
        ctx.fillStyle = 'black';
        ctx.font = `${Math.round(CANVAS_LABEL / 2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(index + 1, x, y);
    });

    // Contador de etiquetas 
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(CANVAS_WIDTH - 300, 5, 300, 35);
    ctx.fillStyle = 'black';
    ctx.font = "bold 28px Arial";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`Total de etiquetas: ${labels.length}`, CANVAS_WIDTH - 10, 10);
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
    document.querySelectorAll("button").forEach(button => button.style.backgroundColor = "#e0b011");
    if (deleteMode) document.querySelector("button[onclick='toggleDeleteMode()']").style.backgroundColor = "#ff5050";
    if (addMode) document.querySelector("button[onclick='toggleAddMode()']").style.backgroundColor = "#50ff50";
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
    /* Limpia completamente el canvas y todas las variables */
    if (confirm("¿Estás seguro de que deseas limpiar el canvas por completo?")) { 
        labels = [];
        imageFiles = [];
        currentImage = '';
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Resetear inputs
        document.getElementById('imageInput').value = '';
        document.getElementById('folderInput').value = '';
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
    /* Guarda las etiquetas en el servidor */
    fetch(`/update_labels`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            file: currentImage,
            labels: labels
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert("Etiquetas guardadas correctamente");
        } else {
            alert("Error al guardar etiquetas: " + data.error);
        }
    })
    .catch(error => console.error("Error guardando etiquetas:", error));
}

// ------------------------- CONFIGURACIÓN -------------------------
function toggleSettings() {
    /* Muestra/oculta el panel de configuración */
    const settingsWindow = document.getElementById('settingsWindow');
    settingsWindow.style.display = settingsWindow.style.display === 'block' ? 'none' : 'block';
}

function closeSettings() {
    /* Cierra el panel de configuración */
    document.getElementById('settingsWindow').style.display = 'none';
}

function applySettings() {
    /* Aplica los cambios de configuración (tamaño de etiquetas) */
    SCALE_FACTOR = parseFloat(document.getElementById('labelSize').value) / 100;
    CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR);
    CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
    CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    drawLabels();
    closeSettings();
}

// Inicializar visualización del tamaño de etiqueta
document.getElementById('labelSize').addEventListener('input', function() {
    document.getElementById('labelSizeValue').textContent = this.value + ' px';
});
