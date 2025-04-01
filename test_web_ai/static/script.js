let currentImage = '';
let labels = [];
let deleteMode = false;
let addMode = false;
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

const labelRadius = 45;  // Radio de la etiqueta en píxeles
let SCALE_FACTOR = 0.24; // Escala de la imagen (24% del tamaño original)
let CANVAS_LABEL = Math.round(labelRadius * SCALE_FACTOR); // Tamaño de las etiquetas basado en SCALE_FACTOR

const IMAGE_WIDTH = 4032;
const IMAGE_HEIGHT = 3024;
const CANVAS_WIDTH = Math.round(IMAGE_WIDTH * SCALE_FACTOR);
const CANVAS_HEIGHT = Math.round(IMAGE_HEIGHT * SCALE_FACTOR);

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let originalImage = new Image();

function selectImage() {
    document.getElementById('imageInput').click();
}

function startWebcam() {
    alert("Función de webcam aún no implementada.");  // Puedes reemplazar esto con la lógica real
}

function selectFolder() {
    alert("Función de selección de carpeta aún no implementada.");  // Puedes reemplazar esto con la lógica real
}

function uploadImage() {
    let input = document.getElementById("imageInput");
    if (input.files.length === 0) {
        alert("Selecciona una imagen");
        return;
    }

    let formData = new FormData();
    formData.append("file", input.files[0]);

    fetch("/upload", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.image_url) {
            originalImage.src = data.image_url;
            originalImage.onload = function() {
                ctx.drawImage(originalImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                currentImage = input.files[0].name;
                labels = data.labels || [];
                drawLabels();
            };
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

    ctx.fillStyle = 'black';
    ctx.font = "bold 26px Arial";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`Total de puros: ${labels.length}`, CANVAS_WIDTH - 10, 10);
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
    const x = (event.clientX - rect.left) / CANVAS_WIDTH;
    const y = (event.clientY - rect.top) / CANVAS_HEIGHT;

    if (addMode) {
        labels.push([x, y, 0.1, 0.1]);
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
