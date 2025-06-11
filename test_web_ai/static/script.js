// ------------ Pruebas botón Flask -------------------
document.addEventListener('DOMContentLoaded', function() {
    // Obtener referencia al botón
    const flaskButton = document.getElementById('flaskButton');
    
    // Añadir event listener
    flaskButton.addEventListener('click', llamarFlask);
});

async function llamarFlask() {
    try {
        console.log("Intentando llamar a Flask...");  // Debug
        const response = await fetch('api/saludar');
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        showErrorMessage(data.mensaje);
        console.log("La llamada ha sido un exito");  // Debug
    } catch (error) {
        console.error("Error en fetch:", error);
        showErrorMessage("Fallo al conectar con Flask. Abre la consola (F12) para más detalles.");
    }
}

// ------------------------- VARIABLES GLOBALES -------------------------
let currentImage = '';       
let labels = [];             
let deleteMode = false;      
let addMode = false;         
let canvas = document.getElementById("canvas");  
let ctx = canvas.getContext("2d");               
let imageFiles = [];         
let currentIndex = 0;        
let webcamStream = null;     
let webcamVideo = document.createElement('video'); 

function updateNavigationButtons(enabled) {
    const prevButton = document.querySelector("button[onclick='previousImage()']");
    const nextButton = document.querySelector("button[onclick='nextImage()']");
    if (prevButton) prevButton.disabled = !enabled;
    if (nextButton) nextButton.disabled = !enabled;
}

// Desactivar botones de navegación al inicio
updateNavigationButtons(false);

// Configuración de etiquetas
let labelRadius = 45; // Radius in pixels for the original image
let SCALE_FACTOR = 0.25;
let CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR); // Radius in pixels on canvas
let NORMALIZED_LABEL_SIZE; // Normalized width/height for YOLO format

// Dimensiones iniciales del canvas
let IMAGE_WIDTH = 1008;      
let IMAGE_HEIGHT = 756;      
let CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
let CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);

// Configuración inicial del canvas
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let originalImage = new Image();  

// Update canvas dimensions and label size
function updateCanvasDimensions(image) {
    IMAGE_WIDTH = image.naturalWidth;
    IMAGE_HEIGHT = image.naturalHeight;

    // Calcular el factor de escala manteniendo la proporción
    const scaleX = 1008 / IMAGE_WIDTH; // 1008 es el ancho objetivo
    const scaleY = 756 / IMAGE_HEIGHT; // 756 es el alto objetivo
    SCALE_FACTOR = Math.min(scaleX, scaleY);

    // Actualizar dimensiones del canvas
    CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
    CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Actualizar tamaño de la etiqueta
    CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR); // Radius in pixels
    NORMALIZED_LABEL_SIZE = (CANVAS_LABEL * 2) / CANVAS_WIDTH; // Normalized diameter (width/height)
    console.log("CANVAS_LABEL:", CANVAS_LABEL, "NORMALIZED_LABEL_SIZE:", NORMALIZED_LABEL_SIZE);
}

// Helper function to parse barcode
function parseBarcode(barcode) {
    if (!barcode) return null;
    // Normalize barcode: trim whitespace and replace single quotes with dashes
    barcode = barcode.trim().replace(/'/g, '-');
    
    const parts = barcode.split('-');
    if (parts.length !== 4) return null;
    const [seccion, rolado, nr_unico, prev_count] = parts;
    if (!seccion || !rolado || !nr_unico || !prev_count || isNaN(nr_unico) || isNaN(prev_count)) return null;
    return { seccion, rolado, nr_unico, prev_count };
}

// Function to lookup section data from database (empty for now)
function lookupSectionData(seccion) {
    // TODO: Implement database lookup for section
    console.log('Looking up section data for:', seccion);
}

// Function to lookup rolado data from database (empty for now)
function lookupRoladoData(rolado) {
    // TODO: Implement database lookup for rolado
    console.log('Looking up rolado data for:', rolado);
}

// Function to update fields based on barcode input
function updateFields() {
    const barcodeInput = document.getElementById('barcodeInput');
    if (!barcodeInput) {
        console.error("barcodeInput element not found");
        return;
    }
    const barcodeData = parseBarcode(barcodeInput.value);
    
    if (barcodeData) {
        const seccionField = document.getElementById('seccion');
        const roladoField = document.getElementById('rolado');
        const nrUnicoField = document.getElementById('nr_unico');
        const detectedCountSpan = document.getElementById('detected_count');
        const previousCountSpan = document.getElementById('previous_count');
        
        if (seccionField && roladoField && nrUnicoField) {
            seccionField.value = barcodeData.seccion;
            roladoField.value = barcodeData.rolado;
            nrUnicoField.value = barcodeData.nr_unico;
            
            // Look up additional data
            lookupSectionData(barcodeData.seccion);
            lookupRoladoData(barcodeData.rolado);
        } else {
            console.error("One or more fields (seccion, rolado, nr_unico) not found");
        }

        // Update cigar counts
        if (detectedCountSpan && previousCountSpan) {
            detectedCountSpan.textContent = labels.length.toString();
            previousCountSpan.textContent = barcodeData.prev_count;
        }
        
        // Set current date for date fields if they are empty
        const dateFields = ['date_prod', 'date_control'];
        const today = new Date().toISOString().split('T')[0];
        
        dateFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && !field.value) {
                field.value = today;
            }
        });
    }
}

// ------------------------- FUNCIONES GENERALES -------------------------
function runPythonScript() {
    $("#settingsWindow").show("slow");  
}

function clearCanvas() {
    // Add debugging logs to verify currentImage and server response
    if (confirm("¿Estás seguro de que deseas limpiar el canvas por completo?")) {
        // Si hay una imagen actual, eliminarla de uploads/
        if (currentImage) {
            console.log("Intentando eliminar la imagen:", currentImage); // Debugging log
            // Update the URL to include the port number
            fetch('/delete_uploaded_image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uploads: true })
            })
            .then(response => {
                console.log("Respuesta del servidor:", response); // Debugging log
                return response.json();
            })

            .then(data => {
                console.log(data.message);
            })
            .catch(error => {
                console.error('Error eliminando imagen:', error);
            });
        }
        
        // Limpiar el canvas como antes
        labels = [];
        imageFiles = [];
        currentImage = '';
        originalImage = new Image();
        SCALE_FACTOR = 0.25; 
        IMAGE_WIDTH = 1008;
        IMAGE_HEIGHT = 756;
        CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
        CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        document.getElementById('imageInput').value = '';
        document.getElementById('folderInput').value = '';
        document.getElementById('processedImageInput').value = '';
        document.getElementById('current_image').innerHTML = "[Nombre de la Imagen]";
        document.getElementById('labelSize').value = 25; // Reset label size to default
        document.getElementById('labelSizeValue').textContent = '25 px'; // Update display
        deleteMode = false;
        addMode = false;
        updateLabelCounter();
        updateNavigationButtons(false);
    }
}

// ------------------------- CARGA DE IMÁGENES -------------------------
function selectImage() {
    if (currentImage !== '') {
        if (!confirm("Esto borrará la imagen actual y sus etiquetas. ¿Deseas continuar?")) {
            return;
        }
        clearCanvas();
    }
    const imageInput = document.getElementById('imageInput');
    imageInput.click();
    imageInput.addEventListener('change', function () {
        const file = imageInput.files[0];
        if (!file || !file.type.startsWith('image/')) {
            showErrorMessage("Por favor selecciona un archivo de imagen válido");
            return;
        }
        imageFiles = [file]; 
        currentIndex = 0;
        updateNavigationButtons(false);
        const reader = new FileReader();
        reader.onload = function (event) {
            originalImage.src = event.target.result;
            originalImage.onload = function() {
                updateCanvasDimensions(originalImage);
                ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                currentImage = file.name;
                labels = [];
                document.getElementById('current_image').innerHTML = "Imagen Seleccionada: " + file.name;
                drawLabels();
            };
        };
        reader.readAsDataURL(file);
    }, { once: true });
}

function selectFolder() {
    if (currentImage !== '') {
        if (!confirm("Esto borrará la imagen actual y sus etiquetas. ¿Deseas continuar?")) {
            return;
        }
        clearCanvas();
    }
    const folderInput = document.getElementById('folderInput');
    folderInput.click();
    folderInput.addEventListener('change', function () {
        const files = Array.from(folderInput.files);
        imageFiles = files.filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            showErrorMessage("No se encontraron imágenes en la carpeta seleccionada.");
            updateNavigationButtons(false);
            return;
        }
        currentIndex = 0;
        loadImage(imageFiles[currentIndex]);
        updateNavigationButtons(true);
        folderInput.value = '';
    }, { once: true });
}

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
        originalImage.src = event.target.result;
        originalImage.onload = function () {
            updateCanvasDimensions(originalImage);
            ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            currentImage = file.name;
            labels = [];
            document.getElementById('current_image').innerHTML = "Imagen Seleccionada: " + file.name;
            drawLabels();
        };
    };
    reader.readAsDataURL(file);
}

function loadProcessedImage() {
    if (currentImage !== '') {
        if (!confirm("Esto borrará la imagen actual y sus etiquetas. ¿Deseas continuar?")) {
            return;
        }
        clearCanvas();
    }
    const processedInput = document.getElementById('processedImageInput');
    processedInput.click();
    processedInput.addEventListener('change', function () {
        const file = processedInput.files[0];
        if (!file || !file.type.startsWith('image/')) {
            showErrorMessage("Por favor selecciona un archivo de imagen válido");
            return;
        }
        const fileName = file.name.split('.').slice(0, -1).join('.'); // Remove extension
        const reader = new FileReader();
        reader.onload = function (event) {
            originalImage.src = event.target.result;
            originalImage.onload = function() {
                updateCanvasDimensions(originalImage);
                ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                currentImage = file.name; 
                document.getElementById('current_image').innerHTML = "Imagen Seleccionada: " + file.name;
                
                // Fetch the associated label file from /labels/
                fetch(`labels/${fileName}.txt`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('No se encontró el archivo de etiquetas');
                        }
                        return response.text();
                    })
                    .then(text => {
                        // Parsear formato YOLO plano
                        labels = [];
                        const lines = text.split('\n');
                        for (let line of lines) {
                            line = line.trim();
                            if (!line || !line.startsWith('0 ')) continue;
                            const parts = line.split(/\s+/);
                            if (parts.length >= 3) {
                                const x = parseFloat(parts[1]);
                                const y = parseFloat(parts[2]);
                                if (!isNaN(x) && !isNaN(y)) {
                                    labels.push([x, y, NORMALIZED_LABEL_SIZE, NORMALIZED_LABEL_SIZE]);
                                }
                            }
                        }
                        drawLabels();
                    })
                    .catch(error => {
                        console.error("Error al cargar etiquetas:", error);
                        labels = [];
                        drawLabels();
                        showErrorMessage("No se pudo cargar el archivo de etiquetas. Se cargó la imagen sin etiquetas.");
                    });
            };
        };
        reader.readAsDataURL(file);
    }, { once: true });
}

function previousImage() {
    if (imageFiles.length === 0) {
        return;
    }
    if (currentIndex === 0) {
        return;
    }
    currentIndex = (currentIndex - 1 + imageFiles.length) % imageFiles.length;
    loadImage(imageFiles[currentIndex]);
}

function nextImage() {
    if (imageFiles.length === 0) {
        return;
    }
    currentIndex = (currentIndex + 1) % imageFiles.length;
    loadImage(imageFiles[currentIndex]);
}

// ------------------------- CÁMARA WEB -------------------------
async function toggleWebcam() {
    if (currentImage !== '') {
        if (!confirm("Esto borrará la imagen actual y sus etiquetas. ¿Deseas continuar?")) {
            return;
        }
        clearCanvas();
    }
    
    const webcamContainer = document.getElementById('webcam-container');
    
    // Si la cámara ya está activa, desactivarla
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
        webcamVideo.srcObject = null;
        $("#webcam-container").hide("slow");
        $("#canvas").show("slow");
        updateButtons4CameraStatus(false);
        return;
    }
    
    // Intentar activar la cámara
    try {
        // Primero verificar permisos
        const permissionStatus = await navigator.permissions.query({ name: 'camera' });
        
        if (permissionStatus.state === 'denied') {
            throw new Error('El acceso a la cámara fue bloqueado permanentemente. Por favor, habilítalo manualmente en la configuración del navegador.');
        }
        
        // Configuración mejorada de la cámara
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment' // Preferir cámara trasera en móviles
            }
        };
        
        webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        webcamVideo.srcObject = webcamStream;
        
        // Esperar a que el video esté listo
        await new Promise((resolve) => {
            webcamVideo.onloadedmetadata = resolve;
            webcamVideo.play().catch(e => console.error("Error al reproducir video:", e));
        });
        
        $("#canvas").hide("slow");
        $("#webcam-container").show("slow");
        
        // Ajustar contenedor de video
        const container = document.getElementById('webcam-preview-container');
        if (container) {
            const aspectRatio = webcamVideo.videoWidth / webcamVideo.videoHeight;
            container.style.width = '640px';
            container.style.height = `${Math.round(640 / aspectRatio)}px`;
            
            // Limpiar contenedor antes de agregar el video
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            container.appendChild(webcamVideo);
        }
        
        updateButtons4CameraStatus(true);
        
    } catch (err) {
        console.error("Error detallado de cámara:", err);
        
        let errorMessage = "No se pudo acceder a la cámara. ";
        
        switch(err.name) {
            case 'NotAllowedError':
                errorMessage += "Permiso denegado. Por favor, permite el acceso a la cámara en los ajustes de tu navegador.";
                break;
            case 'NotFoundError':
                errorMessage += "No se encontró ningún dispositivo de cámara disponible.";
                break;
            case 'NotReadableError':
                errorMessage += "La cámara está siendo usada por otra aplicación o no responde.";
                break;
            case 'OverconstrainedError':
                errorMessage += "No se puede cumplir con los requisitos de resolución solicitados.";
                break;
            case 'SecurityError':
                errorMessage += "El acceso a la cámara está bloqueado por configuración de seguridad. Prueba en localhost o con HTTPS.";
                break;
            default:
                errorMessage += `Error técnico: ${err.message}`;
        }
        
        // Mostrar mensaje detallado y opción para abrir configuración
        if (confirm(`${errorMessage}\n\n¿Quieres abrir la configuración de permisos?`)) {
            if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
                // Chrome extension
                chrome.runtime.openOptionsPage();
            } else {
                // Navegador normal
                window.open('chrome://settings/content/camera', '_blank');
            }
        }
        
        $("#canvas").show("slow");
        updateButtons4CameraStatus(false);
        webcamStream = null;
    }
}

function updateButtons4CameraStatus(bStatus) {
    document.querySelectorAll("button").forEach(button => {
        if (!button.id.startsWith("Webcam_")) {
            button.disabled = bStatus;
        } else {
            button.disabled = !bStatus;
        }
    });
}

function capturePhoto() {
    if (!webcamStream) {
        showErrorMessage("La cámara no está activada");
        return;
    }
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Mantener la proporción 4:3 (1008:756)
    const targetWidth = 1008;
    const targetHeight = 756;
    
    // Calcular dimensiones manteniendo la proporción
    const videoRatio = webcamVideo.videoWidth / webcamVideo.videoHeight;
    const targetRatio = targetWidth / targetHeight;
    
    let finalWidth, finalHeight;
    if (videoRatio > targetRatio) {
        // El video es más ancho que lo deseado
        finalHeight = targetHeight;
        finalWidth = targetHeight * videoRatio;
    } else {
        // El video es más alto que lo deseado
        finalWidth = targetWidth;
        finalHeight = targetWidth / videoRatio;
    }
    
    tempCanvas.width = finalWidth;
    tempCanvas.height = finalHeight;
    tempCtx.drawImage(webcamVideo, 0, 0, finalWidth, finalHeight);
    tempCanvas.toBlob(async (blob) => {
        const file = new File([blob], `webcam_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('imageInput').files = dataTransfer.files;
        uploadImage();
        toggleWebcam();
    }, 'image/jpeg', 0.95);
}

// ------------------------- ETIQUETADO -------------------------
function updateLabelCounter() {
    const currentImageElement = document.getElementById('current_image');
    if (currentImageElement) {
        const baseText = currentImage ? `Imagen Seleccionada: ${currentImage}` : "[Nombre de la Imagen]";
        currentImageElement.textContent = `${baseText} (Cigarros: ${labels.length})`;
    }
}

function drawLabels() {
    // Update existing labels to use the new NORMALIZED_LABEL_SIZE
    labels = labels.map(label => {
        const [x, y, , ] = label;
        return [x, y, NORMALIZED_LABEL_SIZE, NORMALIZED_LABEL_SIZE];
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (originalImage && originalImage.complete) {
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = 'rgba(255, 238, 190, 0.842)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    labels.forEach((label, index) => {
        const [x_center, y_center, , ] = label; // Ignore stored width/height for drawing
        const x = x_center * canvas.width;
        const y = y_center * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, CANVAS_LABEL, 0, Math.PI * 2); // Use CANVAS_LABEL as radius
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = `${Math.round(CANVAS_LABEL / 2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((index + 1).toString(), x, y);
    });
    ctx.fillStyle = 'white';
    ctx.fillRect(10, 5, canvas.width - 20, 35);
    ctx.fillStyle = 'black';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const dt = new Date();
    const date = dt.toLocaleDateString("es-ES", {year: "numeric", month: "long", day: "numeric"});
    const time = dt.toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"});
    ctx.fillText(date + ' ' + time + ' - cantidad de cigarros ' + labels.length, 15, 25);
    updateLabelCounter();
}

function toggleDeleteMode() {
    if (currentImage.length !== 0) {
        deleteMode = !deleteMode;
        addMode = false;
        updateButtonStyles();
    }
}

function toggleAddMode() {
    if (currentImage.length !== 0 ) {
        addMode = !addMode;
        deleteMode = false;
        updateButtonStyles();
    }
}

function updateButtonStyles() {
    const deleteBtn = document.querySelector("button[onclick='toggleDeleteMode()']");
    const addBtn = document.querySelector("button[onclick='toggleAddMode()']");
    deleteBtn.style.backgroundColor = deleteMode ? "#ff5050" : "#909087";
    addBtn.style.backgroundColor = addMode ? "#50ff50" : "#909087";
}

function undoLastLabel() {
    if (labels.length > 0) {
        labels.pop();
        drawLabels();
    }
}

canvas.addEventListener('click', function(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width; // Normalized x
    const y = (event.clientY - rect.top) / rect.height; // Normalized y

    if (addMode) {
        labels.push([x, y, NORMALIZED_LABEL_SIZE, NORMALIZED_LABEL_SIZE]); // Use normalized size
        drawLabels();
    } else if (deleteMode) {
        labels = labels.filter(label => {
            const [labelX, labelY] = label;
            return Math.abs(labelX - x) > NORMALIZED_LABEL_SIZE || Math.abs(labelY - y) > NORMALIZED_LABEL_SIZE;
        });
        drawLabels();
    }
});

// ------------------------- COMUNICACIÓN CON EL SERVIDOR -------------------------
function uploadImage() {
    let file;
    if (imageFiles.length > 0 && currentIndex >= 0 && currentIndex < imageFiles.length) {
        file = imageFiles[currentIndex];
    } else {
        const imageInput = document.getElementById("imageInput");
        if (imageInput.files.length === 0) {
            showErrorMessage("¡Selecciona una imagen!");
            return;
        }
        file = imageInput.files[0];
    }
    const formData = new FormData();
    formData.append("file", file);
    fetch("upload", {
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
            showErrorMessage("Error al procesar la imagen: " + (data.error || "Error desconocido"));
        }
    })
    .catch(error => {
        console.error("Error:", error);
        showErrorMessage("Error al conectar con el servidor: " + error.message);
    });
}

// ------------------------- GUARDAR ETIQUETAS -------------------------
function saveCheck(printMode = false) {
    // Validar campos del formulario
    const fabricante = document.getElementById('fabricante').value.trim();
    const date_prod = document.getElementById('date_prod').value.trim().split('-').join('');
    const date_control = document.getElementById('date_control').value.trim().split('-').join('');
    const rolado = document.getElementById('rolado').value.trim();
    const seccion = document.getElementById('seccion').value.trim();
    const nr_unico = document.getElementById('nr_unico').value.trim();
    const torcedor = document.getElementById('torcedor').value.trim();

    if (!fabricante || !date_prod || !date_control || !rolado || !seccion || !nr_unico || !torcedor) {
        showErrorMessage("Por favor, completa todos los campos.");
        return null;
    }

    // Determinar sufijo según el modo (impresión o guardado)
    const suffix = printMode ? `-${labels.length}-P.jpg` : `-${labels.length}.jpg`;
    const newFileName = `${fabricante}-${date_prod}-${seccion}-${rolado}-${nr_unico}${suffix}`;
    return newFileName;
}

function saveLabels() {
    if (imageFiles.length === 0 && currentImage === '') {
        showErrorMessage("¡No hay imágenes para guardar etiquetas!");
        return;
    }

    // Inicializar campos del formulario
    const dt = new Date();
    const day = ("0" + dt.getDate()).slice(-2);
    const month = ("0" + (dt.getMonth() + 1)).slice(-2);
    const date = dt.getFullYear() + "-" + month + "-" + day;
    document.getElementById('date_prod').value = date;
    document.getElementById('date_control').value = date;
    document.getElementById('seccion').value = '';
    document.getElementById('rolado').value = '';
    document.getElementById('nr_unico').value = '';
    document.getElementById('barcodeInput').value = '';
    document.getElementById('torcedor').value = 'xxxxx';

    // Configurar botones
    $("#Save_Confirm").show();
    $("#Print_Confirm").hide();
    $("#Print_Save_Confirm").hide();
    
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) {
        barcodeInput.addEventListener('input', updateFields);
        $("#canvas").hide("slow");
        $("#save-container").show("slow", function() {
            barcodeInput.focus();
        });
    } else {
        console.error("barcodeInput element not found");
        $("#canvas").hide("slow");
        $("#save-container").show("slow");
    }
    
    updateButtons4Save(true);
}

function updateButtons4Save(bStatus) {
    document.querySelectorAll("button").forEach(button => {
        if (!button.id.startsWith("Save_")) {
            button.disabled = bStatus;
        } else {
            button.disabled = !bStatus;
        }
    });
}

function Save_Cancel() {
    $("#save-container").hide("slow");
    $("#canvas").show("slow");
    updateButtons4Save(false);
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) {
        barcodeInput.removeEventListener('input', updateFields);
    }
}

function Save_Confirm() {
    const newFileName = saveCheck(false);
    if (!newFileName) return;

    const nr_unico = document.getElementById('nr_unico').value.trim();

    fetch(`check_unique_number?nr_unico=${encodeURIComponent(nr_unico)}`)
        .then(response => response.json())
        .then(data => {
            if (data.exists) {
                showErrorMessage("El número único ya existe. Por favor, ingresa un número único diferente.");
                $("#save-container").hide("slow");
                $("#canvas").show("slow");
                updateButtons4Save(false);
                return;
            }

            fetch("save_update", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file: newFileName,
                    labels: labels,
                    originalImage: currentImage,
                    canvas_image: null,
                    label_file: `labels/${newFileName.split('.').slice(0, -1).join('.')}.txt`
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    currentImage = newFileName;
                    if (data.original_image_url) {
                        originalImage.src = data.original_image_url;
                    }
                    showErrorMessage("Datos y nombres de archivo guardados correctamente");
                } else {
                    showErrorMessage("Error al guardar etiquetas: " + (data.error || "Error desconocido"));
                }
            })
            .catch(error => {
                console.error("Error guardando etiquetas:", error);
                showErrorMessage("Error al guardar etiquetas: " + error.message);
            })
            .finally(() => {
                $("#save-container").hide("slow");
                $("#canvas").show("slow");
                updateButtons4Save(false);
                addMode = false;
                deleteMode = false;
                updateButtonStyles();

                const barcodeInput = document.getElementById('barcodeInput');
                if (barcodeInput) barcodeInput.removeEventListener('input', updateFields);
            });
        })
        .catch(error => {
            console.error("Error validando número único:", error);
            showErrorMessage("Error validando número único: " + error.message);
            $("#save-container").hide("slow");
            $("#canvas").show("slow");
            updateButtons4Save(false);
        });
}

function printLabel() {
    if (imageFiles.length === 0 && currentImage === '') {
        showErrorMessage("¡No hay imágenes para guardar etiquetas!");
        return;
    }

    // Inicializar campos del formulario
    const dt = new Date();
    const day = ("0" + dt.getDate()).slice(-2);
    const month = ("0" + (dt.getMonth() + 1)).slice(-2);
    const date = dt.getFullYear() + "-" + month + "-" + day;
    document.getElementById('date_prod').value = date;
    document.getElementById('date_control').value = date;
    document.getElementById('seccion').value = '';
    document.getElementById('rolado').value = '';
    document.getElementById('nr_unico').value = '';
    document.getElementById('barcodeInput').value = '';
    document.getElementById('torcedor').value = 'xxxxx';
    
    // Mostrar los botones relevantes
    $("#Save_Confirm").css('display', 'inline-block');
    $("#Print_Confirm").css('display', 'inline-block');
    $("#Print_Save_Confirm").css('display', 'inline-block');
    $("#Save_Cancel").css('display', 'inline-block');
    
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) {
        barcodeInput.addEventListener('input', updateFields);
        $("#canvas").hide("slow");
        $("#save-container").show("slow", function() {
            barcodeInput.focus();
        });
    } else {
        console.error("barcodeInput element not found");
        $("#canvas").hide("slow");
        $("#save-container").show("slow");
    }
    
    updateButtons4Print(true);
}

function updateButtons4Print(bStatus) {
    // Activar/desactivar botones según el estado
    document.querySelectorAll("button").forEach(button => {
        if (button.id === "Save_Confirm" || 
            button.id === "Print_Confirm" || 
            button.id === "Print_Save_Confirm" || 
            button.id === "Save_Cancel") {
            button.disabled = !bStatus;
        } else {
            button.disabled = bStatus;
        }
    });
}

function Print_Cancel() {
    $("#save-container").hide("slow");
    $("#canvas").show("slow");
    updateButtons4Print(false);
    
    // Limpiar el listener del código de barras
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) {
        barcodeInput.removeEventListener('input', updateFields);
    }
}

function Print_Confirm() {
    const newFileName = saveCheck(true);
    if (!newFileName) return;

    const canvasImage = canvas.toDataURL('image/jpeg');
    const nr_unico = document.getElementById('nr_unico').value.trim();

    fetch(`check_unique_number?nr_unico=${encodeURIComponent(nr_unico)}`)
        .then(response => response.json())
        .then(data => {
            if (data.exists) {
                showErrorMessage("El número único ya existe. Por favor, ingresa un número único diferente.");
                $("#save-container").hide("slow");
                $("#canvas").show("slow");
                updateButtons4Save(false);
                return;
            }

            fetch("print_update", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file: newFileName,
                    canvas_image: canvasImage
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    currentImage = newFileName;
                    if (data.original_image_url) {
                        originalImage.src = data.original_image_url;
                    }
                    showErrorMessage("Datos y nombres de archivo guardados correctamente");
                } else {
                    showErrorMessage("Error al guardar etiquetas: " + (data.error || "Error desconocido"));
                }
            })
            .catch(error => {
                console.error("Error guardando etiquetas:", error);
                showErrorMessage("Error al guardar etiquetas: " + error.message);
            })
            .finally(() => {
                $("#save-container").hide("slow");
                $("#canvas").show("slow");
                updateButtons4Save(false);
                addMode = false;
                deleteMode = false;
                updateButtonStyles();

                const barcodeInput = document.getElementById('barcodeInput');
                if (barcodeInput) barcodeInput.removeEventListener('input', updateFields);
            });
        })
        .catch(error => {
            console.error("Error validando número único:", error);
            showErrorMessage("Error validando número único: " + error.message);
            $("#save-container").hide("slow");
            $("#canvas").show("slow");
            updateButtons4Save(false);
        });
}

function Print_Save_Confirm() {
    // First save data and wait for it to complete
    Save_Confirm();
    
    // Esperar 1 segundo antes de ejecutar Print_Confirm
    setTimeout(() => {
        Print_Confirm();
    }, 1000);
}

// ------------------------- CONFIGURACIÓN -------------------------
function toggleSettings() {
    if (labels == null || labels.length === 0) {
        showErrorMessage("¡No hay etiquetas para configurar!. Por favor, añade etiquetas primero.");
        return;
    }

    $("#overlay").show();
    $("#settingsWindow").show("slow");
}

function closeSettings() {
    $("#settingsWindow").hide("slow");
    $("#overlay").hide();
}

function applySettings() {
    const newLabelRadius = parseFloat(document.getElementById('labelSize').value); // Use pixel radius directly
    if (isNaN(newLabelRadius) || newLabelRadius <= 0) {
        showErrorMessage("Por favor, selecciona un valor válido para el tamaño de las etiquetas.");
        return;
    }
    labelRadius = newLabelRadius; // Update global labelRadius
    CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR); // Update canvas label size
    NORMALIZED_LABEL_SIZE = (CANVAS_LABEL * 2) / CANVAS_WIDTH; // Update normalized size
    // Update existing labels to use the new NORMALIZED_LABEL_SIZE
    labels = labels.map(label => {
        const [x, y, , ] = label;
        return [x, y, NORMALIZED_LABEL_SIZE, NORMALIZED_LABEL_SIZE];
    });
    drawLabels();
    closeSettings();
    console.log("labelRadius:", labelRadius, "CANVAS_LABEL:", CANVAS_LABEL, "NORMALIZED_LABEL_SIZE:", NORMALIZED_LABEL_SIZE);
}

// Inicializar visualización del tamaño de etiqueta
document.getElementById('labelSize').addEventListener('input', function() {
    document.getElementById('labelSizeValue').textContent = this.value + ' px';
});

function showErrorMessage(message) {
    const errorMessageDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    errorText.textContent = message;
    errorMessageDiv.style.display = 'block';
}

function closeErrorMessage() {
    const errorMessageDiv = document.getElementById('error-message');
    errorMessageDiv.style.display = 'none';
}

