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
LABELS_FOLDER = "labels"  # Carpeta para almacenar los archivos de etiquetas (en formato YOLO)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(LABELS_FOLDER, exist_ok=True)

# Cargar el modelo YOLOv12-L
model_path = "I:/AI/data/runs/train2/weights/best.pt"  # Ruta real del modelo
model = YOLO(model_path)

# Función para guardar las etiquetas en formato YOLO
def save_yolo_labels(image_name, detections):
    label_file = os.path.join(LABELS_FOLDER, f"{os.path.splitext(image_name)[0]}.txt")
    with open(label_file, 'w') as f:
        for detection in detections:
            # Formato YOLO: <class> <x_center> <y_center> <width> <height>
            x_center, y_center, width, height = detection
            f.write(f"0 {x_center} {y_center} {width} {height}\n")

# Función para procesar imagen y obtener las detecciones
def process_image(filepath):
    # Cargar imagen con OpenCV
    img = cv2.imread(filepath)
    
    if img is None:
        return None, []

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)  # Convertir a RGB

    # Realizar inferencia con un umbral bajo y número de detecciones alto
    results = model(img_rgb, conf=0.01, max_det=1000)  # Ajuste según necesidad

    detections = []

    # Dibujar los resultados en la imagen (Eliminado)
    for result in results:
        if result.boxes is not None:
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])  # Coordenadas del bounding box
                
                # Coordenadas del centro de detección
                center_x = (x1 + x2) // 2
                center_y = (y1 + y2) // 2
                width = (x2 - x1)
                height = (y2 - y1)

                # Normalizar las coordenadas para el formato YOLO
                detections.append((center_x / img.shape[1], center_y / img.shape[0], width / img.shape[1], height / img.shape[0]))

    return img, detections

@app.route('/')
def index():
    return render_template('index.html')  # Cargar HTML desde /templates

@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["file"]
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    # Procesar imagen y obtener detecciones
    img, detections = process_image(filepath)

    if img is None:
        return jsonify({"error": "Error al cargar la imagen"}), 400

    # Guardar la imagen procesada sin etiquetas
    processed_path = os.path.join(PROCESSED_FOLDER, filename)
    cv2.imwrite(processed_path, img)

    # Guardar las etiquetas en formato YOLO
    save_yolo_labels(filename, detections)

    # Retornar las coordenadas de las etiquetas junto con la imagen procesada
    return jsonify({"image_url": f"/static/{processed_path}", "labels": detections})

@app.route("/delete_labels", methods=["POST"])
def delete_labels():
    if "file" not in request.form:
        return jsonify({"error": "No file uploaded"}), 400
    
    filename = request.form["file"]
    filepath = os.path.join(PROCESSED_FOLDER, filename)

    # Reprocesar la imagen sin las etiquetas
    img, _ = process_image(filepath)

    if img is None:
        return jsonify({"error": "Error al cargar la imagen"}), 400

    # Guardar la imagen sin las etiquetas
    processed_path = os.path.join(PROCESSED_FOLDER, f"no_labels_{filename}")
    cv2.imwrite(processed_path, img)

    # Retornar la nueva imagen sin etiquetas
    return send_file(processed_path, mimetype="image/jpeg")

@app.route("/add_label", methods=["POST"])
def add_label():
    if "file" not in request.form:
        return jsonify({"error": "No file uploaded"}), 400
    
    filename = request.form["file"]
    new_x_center = float(request.form["x_center"])
    new_y_center = float(request.form["y_center"])
    new_width = float(request.form["width"])
    new_height = float(request.form["height"])

    filepath = os.path.join(PROCESSED_FOLDER, filename)
    img, detections = process_image(filepath)

    if img is None:
        return jsonify({"error": "Error al cargar la imagen"}), 400

    # Agregar la nueva detección
    detections.append((new_x_center, new_y_center, new_width, new_height))

    # Guardar la imagen con la nueva etiqueta
    save_yolo_labels(filename, detections)
    processed_path = os.path.join(PROCESSED_FOLDER, filename)
    cv2.imwrite(processed_path, img)

    return send_file(processed_path, mimetype="image/jpeg")

@app.route("/delete_label_from_file", methods=["POST"])
def delete_label_from_file():
    data = request.get_json()
    image_name = data["image_name"]
    label_index = data["label_index"]

    # Ruta al archivo de etiquetas YOLO
    label_file_path = os.path.join(LABELS_FOLDER, f"{os.path.splitext(image_name)[0]}.txt")
    
    # Leer el archivo de etiquetas
    with open(label_file_path, 'r') as file:
        labels = file.readlines()

    # Eliminar la línea correspondiente a la etiqueta eliminada
    if 0 <= label_index < len(labels):
        labels.pop(label_index)

    # Guardar el archivo de etiquetas actualizado
    with open(label_file_path, 'w') as file:
        file.writelines(labels)

    return jsonify({"message": "Etiqueta eliminada correctamente"})

# Ejecutar la app
if __name__ == "__main__":
    app.run(debug=True)
