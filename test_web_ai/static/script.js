let currentImage = '';
let labels = [];
let deleteMode = false;
let addMode = false;
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let imageFiles = []; // Lista de imágenes cargadas
let currentIndex = 0; // Índice de la imagen actual

const labelRadius = 45; // Radio de la etiqueta en píxeles
let SCALE_FACTOR = 0.24; // Escala de la imagen (24% del tamaño original)
let CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR); // Tamaño de las etiquetas basado en SCALE_FACTOR

const IMAGE_WIDTH = 4032;
const IMAGE_HEIGHT = 3024;
let CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
let CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let originalImage = new Image();

function selectImage() {
    const imageInput = document.getElementById('imageInput');
    imageInput.click();

    imageInput.addEventListener('change', function () {
        const file = imageInput.files[0]; // Seleccionar el primer archivo
        if (!file || !file.type.startsWith('image/')) {
            alert("Por favor selecciona un archivo de imagen válido.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            originalImage.src = event.target.result; // Cargar la imagen en el objeto Image
            originalImage.onload = function () {
                // Dibujar la imagen en el canvas
                ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Limpiar el canvas
                ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

                // Actualizar variables globales
                currentImage = file.name; // Guardar el nombre de la imagen actual
                labels = []; // Reiniciar etiquetas
                drawLabels();
            };
        };

        reader.readAsDataURL(file); // Leer el archivo como una URL de datos
    }, { once: true }); // Usar { once: true } para evitar múltiples listeners
}

function selectFolder() {
    const folderInput = document.getElementById('folderInput');
    folderInput.click();

    folderInput.addEventListener('change', function () {
        const files = Array.from(folderInput.files);
        imageFiles = files.filter(file => file.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            alert("No se encontraron imágenes en la carpeta seleccionada.");
            return;
        }

        currentIndex = 0; // Reiniciar al primer índice
        loadImage(imageFiles[currentIndex]); // Cargar la primera imagen

        // Restablecer el valor del input para permitir cargar la misma carpeta nuevamente
        folderInput.value = '';
    }, { once: true });
}

function previousImage() {
    if (imageFiles.length === 0) {
        alert("No hay imágenes cargadas.");
        return;
    }

    currentIndex = (currentIndex - 1 + imageFiles.length) % imageFiles.length; // Navegación circular
    loadImage(imageFiles[currentIndex]);
}

function nextImage() {
    if (imageFiles.length === 0) {
        alert("No hay imágenes cargadas.");
        return;
    }

    currentIndex = (currentIndex + 1) % imageFiles.length; // Navegación circular
    loadImage(imageFiles[currentIndex]);
}

function loadImage(file) {
    const reader = new FileReader();

    reader.onload = function (event) {
        originalImage.src = event.target.result;
        originalImage.onload = function () {
            ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            currentImage = file.name;
            labels = []; // Reiniciar etiquetas
            drawLabels();
        };
    };

    reader.readAsDataURL(file);
}

function startWebcam() {
    alert("Función de selección de carpeta aún no implementada.");  // Puedes reemplazar esto con la lógica real
}

function uploadImage() {
    const imageInput = document.getElementById("imageInput");
    if (imageInput.files.length === 0) {
        alert("Selecciona una imagen");
        return;
    }

    const file = imageInput.files[0]; // Obtener el archivo seleccionado
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

function drawLabels() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    labels.forEach((label, index) => {
        let [x_center, y_center] = label;
        let x = x_center * CANVAS_WIDTH;
        let y = y_center * CANVAS_HEIGHT;

        ctx.beginPath();
        ctx.arc(x, y, CANVAS_LABEL, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'black';
        ctx.font = `${Math.round(CANVAS_LABEL / 2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(index + 1, x, y);
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Fondo semitransparente
    ctx.fillRect(CANVAS_WIDTH - 300, 5, 300, 35); // Rectángulo más largo detrás del texto

    ctx.fillStyle = 'black'; // Color del texto
    ctx.font = "bold 28px Arial"; // Tamaño y estilo de la fuente
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`Total de etiquetas: ${labels.length}`, CANVAS_WIDTH - 10, 10);
}

function toggleDeleteMode() {
    deleteMode = !deleteMode;
    addMode = false;
    updateButtonStyles();
}

function toggleAddMode() {
    addMode = !addMode;
    deleteMode = false;
    updateButtonStyles();
}

function updateButtonStyles() {
    document.querySelectorAll("button").forEach(button => button.style.backgroundColor = "#e0b011");
    if (deleteMode) document.querySelector("button[onclick='toggleDeleteMode()']").style.backgroundColor = "#ff5050";
    if (addMode) document.querySelector("button[onclick='toggleAddMode()']").style.backgroundColor = "#50ff50";
}

function clearCanvas() {
    if (confirm("¿Estás seguro de que deseas limpiar el canvas por completo?")) { 
        labels = []; // Eliminar todas las etiquetas
        imageFiles = []; // Limpiar la lista global de imágenes
        currentImage = ''; // Eliminar la referencia a la imagen actual
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Limpiar el canvas completamente

        // Restablecer el valor de los inputs para permitir cargar la misma imagen o carpeta nuevamente
        const imageInput = document.getElementById('imageInput');
        const folderInput = document.getElementById('folderInput');
        imageInput.value = '';
        folderInput.value = '';
    }
}

function undoLastLabel() {
    if (labels.length > 0) {
        labels.pop();
        drawLabels();
    }
}

function saveLabels() {
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

function toggleSettings() {
    const settingsWindow = document.getElementById('settingsWindow');
    settingsWindow.style.display = settingsWindow.style.display === 'block' ? 'none' : 'block';
}

function closeSettings() {
    const settingsWindow = document.getElementById('settingsWindow');
    settingsWindow.style.display = 'none';
}

function applySettings() {
    SCALE_FACTOR = parseFloat(document.getElementById('labelSize').value) / 100;
    CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR);
    CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
    CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    drawLabels();
    closeSettings();
}

document.getElementById('labelSize').addEventListener('input', function() {
    document.getElementById('labelSizeValue').textContent = this.value + ' px';
});
