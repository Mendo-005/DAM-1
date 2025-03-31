from flask import Flask, render_template, request, jsonify, send_file
import cv2
import os
from werkzeug.utils import secure_filename
from ultralytics import YOLO
import json

# Configuración de Flask
app = Flask(__name__, static_folder='static', template_folder='templates')

# Rutas
UPLOAD_FOLDER = "uploads"
PROCESSED_FOLDER = os.path.join("static", "processed")  # Asegúrate de que está en "static/processed/"
LABELS_FOLDER = "labels"

# Crear las carpetas si no existen
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(LABELS_FOLDER, exist_ok=True)

# Cargar el modelo YOLOv12-L
model_path = "I:/AI/data/runs/train2/weights/best.pt"
model = YOLO(model_path)

# Distancia mínima entre detecciones
MIN_DISTANCE = 50

def save_yolo_labels(image_name, detections):
    label_file = os.path.join(LABELS_FOLDER, f"{os.path.splitext(image_name)[0]}.txt")
    with open(label_file, 'w') as f:
        for detection in detections:
            x_center, y_center, width, height = detection
            f.write(f"0 {x_center} {y_center} {width} {height}\n")

def process_image(filepath):
    # Cargar imagen con OpenCV
    img = cv2.imread(filepath)
    
    if img is None:
        return None, []

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)  # Convertir a RGB

    # Realizar inferencia con YOLO
    results = model(img_rgb, conf=0.01, max_det=1000)

    detections = []
    detected_centers = []
    min_distance = 50  # Distancia mínima entre detecciones

    for result in results:
        if result.boxes is not None:
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])  # Bounding box en píxeles
                
                # Calcular el centro de la detección
                center_x = (x1 + x2) // 2
                center_y = (y1 + y2) // 2
                width = x2 - x1
                height = y2 - y1

                # Evitar solapamiento
                too_close = any(
                    abs(center_x - cx) < min_distance and abs(center_y - cy) < min_distance
                    for cx, cy in detected_centers
                )
                if too_close:
                    continue

                detected_centers.append((center_x, center_y))
                
                # Normalizar coordenadas para YOLO
                detections.append((center_x / img.shape[1], center_y / img.shape[0], width / img.shape[1], height / img.shape[0]))

                # Dibujar bounding box
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

                # Agregar texto con el índice de la detección
                label = f"ID {len(detected_centers)}"
                cv2.putText(img, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    return img, detections

@app.route('/')
def index():
    return render_template('index.html')

@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["file"]
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    img, detections = process_image(filepath)
    if img is None:
        return jsonify({"error": "Error al cargar la imagen"}), 400

    processed_path = os.path.join(PROCESSED_FOLDER, filename)
    cv2.imwrite(processed_path, img)
    save_yolo_labels(filename, detections)

    # Devolver la URL de la imagen original (no procesada)
    return jsonify({"image_url": f"/uploads/{filename}", "labels": detections})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_file(os.path.join(UPLOAD_FOLDER, filename))

@app.route("/update_labels", methods=["POST"])
def update_labels():
    data = request.get_json()

    if not data or "file" not in data or "labels" not in data:
        return jsonify({"error": "Datos inválidos"}), 400

    image_name = data["file"]
    labels = data["labels"]
    
    label_file_path = os.path.join(LABELS_FOLDER, f"{os.path.splitext(image_name)[0]}.txt")

    try:
        with open(label_file_path, "w") as f:
            for label in labels:
                x_center, y_center, width, height = label
                f.write(f"0 {x_center} {y_center} {width} {height}\n")

        return jsonify({"message": "Etiquetas actualizadas con éxito"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
