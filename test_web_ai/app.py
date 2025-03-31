from flask import Flask, render_template, request, jsonify, send_file
import cv2
import os
from werkzeug.utils import secure_filename
from ultralytics import YOLO
import json

# Configuración de Flask
app = Flask(__name__, static_folder='static', template_folder='templates')

UPLOAD_FOLDER = "uploads"
PROCESSED_FOLDER = "processed"
LABELS_FOLDER = "labels"
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
    img = cv2.imread(filepath)
    if img is None:
        return None, []

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = model(img_rgb, conf=0.01, max_det=1000)
    detections = []
    detected_centers = []

    for result in results:
        if result.boxes is not None:
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                center_x = (x1 + x2) // 2
                center_y = (y1 + y2) // 2
                width = (x2 - x1)
                height = (y2 - y1)

                # Verificar distancia mínima con otras detecciones
                if all(((center_x - cx)**2 + (center_y - cy)**2) >= MIN_DISTANCE**2 for cx, cy in detected_centers):
                    detections.append((center_x / img.shape[1], center_y / img.shape[0], width / img.shape[1], height / img.shape[0]))
                    detected_centers.append((center_x, center_y))

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

    return jsonify({"image_url": f"/static/{processed_path}", "labels": detections})

if __name__ == "__main__":
    app.run(debug=True)
