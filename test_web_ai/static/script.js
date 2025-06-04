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
const labelRadius = 45;      
let SCALE_FACTOR = 0.25;     
let CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR);

// Dimensiones iniciales del canvas
let IMAGE_WIDTH = 1008;      
let IMAGE_HEIGHT = 756;      
let CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
let CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);

// Configuración inicial del canvas
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let originalImage = new Image();  

// Función para actualizar las dimensiones del canvas según la imagen
function updateCanvasDimensions(image) {
    IMAGE_WIDTH = image.naturalWidth; 
    IMAGE_HEIGHT = image.naturalHeight; 
    
    // Calcular el factor de escala manteniendo la proporción
    const scaleX = 1008 / IMAGE_WIDTH;  // 1008 es el ancho objetivo
    const scaleY = 756 / IMAGE_HEIGHT;  // 756 es el alto objetivo
    SCALE_FACTOR = Math.min(scaleX, scaleY);  // Usar el menor para no distorsionar
    
    // Actualizar dimensiones del canvas
    CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
    CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Mantener el tamaño de las etiquetas proporcional
    CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR);
}

// Helper function to parse barcode
function parseBarcode(barcode) {
    if (!barcode) return null;
    // Normalize barcode: trim whitespace and replace single quotes with dashes
    barcode = barcode.trim().replace(/'/g, '-');
    
    const parts = barcode.split('-');
    if (parts.length !== 3) return null;
    const [seccion, rolado, nr_unico] = parts;
    if (!seccion || !rolado || !nr_unico || isNaN(nr_unico)) return null;
    return { seccion, rolado, nr_unico };
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
        
        if (seccionField && roladoField && nrUnicoField) {
            seccionField.value = barcodeData.seccion;
            roladoField.value = barcodeData.rolado;
            nrUnicoField.value = barcodeData.nr_unico;
        } else {
            console.error("One or more fields (seccion, rolado, nr_unico) not found");
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
    if (confirm("¿Estás seguro de que deseas limpiar el canvas por completo?")) { 
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
            alert("Por favor selecciona un archivo de imagen válido");
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
            alert("No se encontraron imágenes en la carpeta seleccionada.");
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
            alert("Por favor selecciona un archivo de imagen válido");
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
                fetch(`/labels/${fileName}.txt`)
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
                                    labels.push([x, y]);
                                }
                            }
                        }
                        drawLabels();
                    })
                    .catch(error => {
                        console.error("Error al cargar etiquetas:", error);
                        labels = [];
                        drawLabels();
                        alert("No se pudo cargar el archivo de etiquetas. Se cargó la imagen sin etiquetas.");
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
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
        webcamVideo.srcObject = null;
        $("#webcam-container").hide("slow");
        $("#canvas").show("slow");
        updateButtons4CameraStatus(false);
    } else {
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
            webcamVideo.srcObject = webcamStream;
            webcamVideo.play();
            $("#canvas").hide("slow");
            $("#webcam-container").show("slow");
            webcamVideo.onloadedmetadata = () => {
                const videoWidth = webcamVideo.videoWidth;
                const videoHeight = webcamVideo.videoHeight;
                const aspectRatio = videoWidth / videoHeight;
                const container = document.getElementById('webcam-preview-container');
                if (container) {
                    container.style.width = '640px';
                    container.style.height = `${Math.round(640 / aspectRatio)}px`;
                    container.appendChild(webcamVideo); 
                } else {
                    console.warn("El contenedor 'webcam-preview-container' no existe.");
                }
            };
            updateButtons4CameraStatus(true);
        } catch (err) {
            console.error("Error al acceder a la cámara:", err);
            alert("No se pudo acceder a la cámara. Asegúrate de permitir el acceso.");
            $("#canvas").show("slow");
            updateButtons4CameraStatus(false);
        }
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
        alert("La cámara no está activada");
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (originalImage && originalImage.complete) {
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = 'rgba(255, 238, 190, 0.842)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    labels.forEach((label, index) => {
        const [x_center, y_center] = label;
        const x = x_center * canvas.width;
        const y = y_center * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, CANVAS_LABEL, 0, Math.PI * 2);
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
    ctx.fillRect(10, 5, canvas.width - 20, 35);    ctx.fillStyle = 'black';
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
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (addMode) {
        labels.push([x, y]);
        drawLabels();
    } else if (deleteMode) {
        labels = labels.filter(label => {
            const [x_center, y_center] = label;
            const distance = Math.sqrt((x - x_center) ** 2 + (y - y_center) ** 2);
            return distance > CANVAS_LABEL / CANVAS_WIDTH;
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
            alert("¡Selecciona una imagen!");
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

// ------------------------- GUARDAR ETIQUETAS -------------------------
function saveLabels() {
    if (currentImage.length === 0) {
        alert("¡Selecciona una imagen!");
        return;
    }
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
    document.getElementById('torcedor').value = 'xxxxx'; // Valor por defecto para torcedor    // Attach input event listener to barcodeInput
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
    // Remove event listener to prevent memory leaks
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) {
        barcodeInput.removeEventListener('input', updateFields);
    }
}

function Save_Confirm() {
    const date_prod = document.getElementById('date_prod').value.trim().split('-').join('');
    const date_control = document.getElementById('date_control').value.trim().split('-').join('');
    const rolado = document.getElementById('rolado').value.trim();
    const seccion = document.getElementById('seccion').value.trim();
    const nr_unico = document.getElementById('nr_unico').value.trim();
    const torcedor = document.getElementById('torcedor').value.trim();
      if (!date_prod || !date_control || !rolado || !seccion || !nr_unico || !torcedor) {
        alert("Por favor, completa todos los campos.");
        $("#save-container").hide("slow");
        $("#canvas").show("slow");
        updateButtons4Save(false);
        return;
    }

    const newFileName = `${date_prod}-${seccion}-${rolado}-${nr_unico}-${labels.length}.jpg`;

    // Validar número único
    fetch(`/check_unique_number?nr_unico=${encodeURIComponent(nr_unico)}`)
        .then(response => response.json())
        .then(data => {
            if (data.exists) {
                alert("El número único ya existe. Por favor, ingresa un número único diferente.");
                $("#save-container").hide("slow");
                $("#canvas").show("slow");
                updateButtons4Save(false);
                return;
            }

            const canvasImage = canvas.toDataURL('image/jpeg');

            fetch('/update_labels', {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file: newFileName,
                    labels: labels,
                    originalImage: currentImage,
                    canvas_image: canvasImage,
                    label_file: `labels/${newFileName.split('.').slice(0, -1).join('.')}.txt`
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    currentImage = newFileName;
                    originalImage.src = data.original_image_url || `/Uploads/${newFileName}`;
                    originalImage.onload = function () {
                        updateCanvasDimensions(originalImage);
                        ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                        drawLabels();
                    };
                    alert("Datos y nombres de archivo guardados correctamente");
                } else {
                    alert("Error al guardar etiquetas: " + (data.error || "Error desconocido"));
                }
            })
            .catch(error => {
                console.error("Error guardando etiquetas:", error);
                alert("Error al guardar etiquetas: " + error.message);
            })
            .finally(() => {
                $("#save-container").hide("slow");
                $("#canvas").show("slow");
                updateButtons4Save(false);
                addMode = false;
                deleteMode = false;
                updateButtonStyles();
                // Remove event listener
                const barcodeInput = document.getElementById('barcodeInput');
                if (barcodeInput) {
                    barcodeInput.removeEventListener('input', updateFields);
                }
            });
        })
        .catch(error => {
            console.error("Error validando número único:", error);
            alert("Error validando número único: " + error.message);
            $("#save-container").hide("slow");
            $("#canvas").show("slow");
            updateButtons4Save(false);
        });
}

// ------------------------- IMPRESIÓN -------------------------
function printLabel() {
    if (currentImage.length === 0) {
        alert("¡Selecciona una imagen!");
        return;}

    $("#print-container").show("slow");
    $("#canvas").hide("slow");
    updateButtons4Print(true);
}

function updateButtons4Print(bStatus) {
    document.querySelectorAll("button").forEach(button => {
        if (!button.id.startsWith("Print_")) {
            button.disabled = bStatus;
        } else {
            button.disabled = !bStatus;
        }
    });
}

function Print_Confirm() {
    $("#print-container").hide("slow");
    $("#canvas").show("slow");
    updateButtons4Print(false);
}

function Print_Cancel() {
    $("#print-container").hide("slow");
    $("#canvas").show("slow");
    updateButtons4Print(false);
}

// ------------------------- CONFIGURACIÓN -------------------------
function toggleSettings() {
    if (labels == null || labels.length === 0) {
        alert("!No hay etiquetas para configurar. Por favor, añade etiquetas primero.");
        return;}

        $("#overlay").show();
    $("#settingsWindow").show("slow");
}

function closeSettings() {
    $("#settingsWindow").hide("slow");
    $("#overlay").hide();
}

function applySettings() {
    const newScaleFactor = parseFloat(document.getElementById('labelSize').value) / 100;
    if (isNaN(newScaleFactor) || newScaleFactor <= 0) {
        alert("Por favor, selecciona un valor válido para el tamaño de las etiquetas.");
        return;
    }
    SCALE_FACTOR = newScaleFactor;
    CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR);
    drawLabels();
    closeSettings();
}

// Inicializar visualización del tamaño de etiqueta
document.getElementById('labelSize').addEventListener('input', function() {
    document.getElementById('labelSizeValue').textContent = this.value + ' px';
});
