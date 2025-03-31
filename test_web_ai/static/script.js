let currentImage = '';
let labels = [];
let deleteMode = false;
let addMode = false;
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

const labelRadius = 45;  // Tamaño de las etiquetas (radio fijo)

let originalImage = new Image();

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
                canvas.width = originalImage.width;
                canvas.height = originalImage.height;
                ctx.drawImage(originalImage, 0, 0);
                currentImage = input.files[0].name;
                labels = data.labels || [];
                drawLabels();
            };
        }
    })
    .catch(error => console.error("Error:", error));
}

function drawLabels() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0);  // Redibujar la imagen original

    labels.forEach((label, index) => {
        let [x_center, y_center] = label;
        let x = x_center * canvas.width;
        let y = y_center * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, labelRadius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'black';
        ctx.font = '20px Arial';
        ctx.fillText(index + 1, x - 10, y - 10);
    });
}



function toggleDeleteMode() {
    deleteMode = !deleteMode;
    addMode = false;
    alert(deleteMode ? "Modo borrar activado" : "Modo borrar desactivado");
}

function toggleAddMode() {
    addMode = !addMode;
    deleteMode = false;
    alert(addMode ? "Modo añadir activado" : "Modo añadir desactivado");
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
    const x = (event.clientX - rect.left) / canvas.width;
    const y = (event.clientY - rect.top) / canvas.height;

    if (addMode) {
        // Añadir una nueva etiqueta con tamaño fijo (35px de radio)
        labels.push([x, y, 0.1, 0.1]);  // Coordenadas normalizadas y tamaño por defecto
        drawLabels();
    } else if (deleteMode) {
        // Eliminar etiquetas cercanas
        labels = labels.filter(label => {
            const [x_center, y_center] = label;
            const distance = Math.sqrt((x - x_center) ** 2 + (y - y_center) ** 2);
            return distance > labelRadius / canvas.width;  // Ajustar según el radio de la etiqueta
        });
        drawLabels();
    }
});
