from flask import Flask, render_template, request, jsonify, send_file, Response
from werkzeug.utils import secure_filename
from ultralytics import YOLO
import cv2
import os
import base64
import json
from io import BytesIO
from PIL import Image
from datetime import datetime
import logging
from typing import List, Tuple, Optional
import threading
import time

# Configuración inicial de Flask
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # Límite de 16MB para uploads

# Directorios para almacenamiento
UPLOAD_FOLDER = "uploads"  # Imágenes originales
PROCESSED_FOLDER = os.path.join("static", "processed")  # Imágenes procesadas
LABELS_FOLDER = "labels"  # Archivos de etiquetas YOLO

# Crear directorios si no existen
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(LABELS_FOLDER, exist_ok=True)

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Carga del modelo YOLO (ruta específica al archivo de pesos)
try:
    model = YOLO("../runs/train2/weights/best.pt")
    logger.info("Modelo YOLO cargado correctamente")
except Exception as e:
    logger.error(f"Error al cargar el modelo YOLO: {str(e)}")
    raise

# Constantes del sistema
MIN_DISTANCE = 50  # Distancia mínima entre detecciones (en píxeles) para evitar duplicados
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}  # Formatos de imagen permitidos

# Variables globales para la cámara
camera = None
camera_frame = None
camera_lock = threading.Lock()

class DetectionUtils:
    """Clase utilitaria para operaciones de detección"""
    
    @staticmethod
    def save_yolo_labels(image_name: str, detections: List[Tuple[float]]) -> str:
        """Guarda detecciones en formato YOLO (.txt)"""
        try:
            base_name = os.path.splitext(image_name)[0]
            label_path = os.path.join(LABELS_FOLDER, f"{base_name}.txt")
            
            with open(label_path, 'w') as f:
                for detection in detections:
                    x_center, y_center, width, height = detection
                    f.write(f"0 {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}\n")  # Formato YOLO
            
            return label_path
        except Exception as e:
            logger.error(f"Error guardando etiquetas: {str(e)}")
            raise

    @staticmethod
    def process_image(filepath: str) -> Tuple[Optional[Image.Image], List[Tuple[float]]]:
        """Procesa imagen con YOLO y devuelve imagen anotada + detecciones"""
        try:
            img = cv2.imread(filepath)
            if img is None:
                raise ValueError("No se pudo leer la imagen")

            # Conversión a RGB (requerido por YOLO)
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            results = model(img_rgb, conf=0.01, max_det=1000)  # Bajo threshold para maximizar detecciones
            
            detections = []
            detected_centers = []

            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        width = x2 - x1
                        height = y2 - y1
                        
                        # Normalizar coordenadas (requerido por YOLO)
                        center_x = (x1 + x2) / 2 / img.shape[1]
                        center_y = (y1 + y2) / 2 / img.shape[0]
                        norm_width = width / img.shape[1]
                        norm_height = height / img.shape[0]

                        # Filtrar detecciones muy cercanas
                        if any(abs(center_x - cx) < MIN_DISTANCE/img.shape[1] and 
                              abs(center_y - cy) < MIN_DISTANCE/img.shape[0] 
                              for cx, cy in detected_centers):
                            continue

                        detected_centers.append((center_x, center_y))
                        detections.append((center_x, center_y, norm_width, norm_height))
                        
                        # Dibujar bounding box y número
                        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(img, f"{len(detections)}", (x1, y1 - 5), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

            return img, detections
        except Exception as e:
            logger.error(f"Error procesando imagen: {str(e)}")
            return None, []

# ------------------------- FUNCIONES DE CÁMARA -------------------------
def init_camera():
    """Inicializa la cámara web"""
    global camera
    camera = cv2.VideoCapture(0)
    time.sleep(2)  # Tiempo para inicializar la cámara
    logger.info("Cámara web inicializada")

def generate_frames():
    """Genera frames para el streaming de video"""
    global camera_frame
    while True:
        with camera_lock:
            if camera_frame is None:
                continue
            ret, buffer = cv2.imencode('.jpg', camera_frame)
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

def capture_frame():
    """Captura un frame de la cámara"""
    global camera_frame
    ret, frame = camera.read()
    if ret:
        with camera_lock:
            camera_frame = frame
        return frame
    return None

# ------------------------- RUTAS FLASK -------------------------
@app.route('/')
def index():
    """Ruta principal: sirve la página HTML"""
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    """Streaming de video desde la cámara web"""
    return Response(generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/capture_webcam', methods=['POST'])
def capture_webcam():
    """Captura una foto desde la cámara web y la procesa"""
    frame = capture_frame()
    if frame is None:
        return jsonify({"error": "No se pudo capturar la imagen"}), 400

    try:
        # Guardar la imagen capturada
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"webcam_capture_{timestamp}.jpg"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        cv2.imwrite(filepath, frame)

        # Procesar la imagen
        img, detections = DetectionUtils.process_image(filepath)
        if img is None:
            return jsonify({"error": "Error al procesar la imagen"}), 400

        processed_path = os.path.join(PROCESSED_FOLDER, filename)
        cv2.imwrite(processed_path, img)
        DetectionUtils.save_yolo_labels(filename, detections)

        return jsonify({
            "image_url": f"/static/processed/{filename}",
            "labels": detections,
            "count": len(detections)
        })
    except Exception as e:
        logger.error(f"Error en capture_webcam: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/upload", methods=["POST"])
def upload_file():
    """Endpoint para subir y procesar imágenes desde archivo"""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["file"]
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    # Procesamiento con YOLO
    img, detections = DetectionUtils.process_image(filepath)
    if img is None:
        return jsonify({"error": "Error al cargar la imagen"}), 400

    # Guardar resultados
    processed_path = os.path.join(PROCESSED_FOLDER, filename)
    cv2.imwrite(processed_path, img)
    DetectionUtils.save_yolo_labels(filename, detections)

    return jsonify({"image_url": f"/uploads/{filename}", "labels": detections})


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Sirve archivos subidos directamente"""
    return send_file(os.path.join(UPLOAD_FOLDER, filename))

@app.route("/update_labels", methods=["POST"])
def update_labels():
    """Actualiza etiquetas manualmente desde frontend y renombra archivos"""
    data = request.get_json()
    if not data or 'file' not in data or 'labels' not in data or 'originalImage' not in data:
        return jsonify({"error": "Datos inválidos"}), 400

    try:
        # Datos recibidos
        new_filename = secure_filename(data['file'])  # Nuevo nombre del archivo
        labels = data['labels']
        original_image = secure_filename(data['originalImage'])  # Nombre original del archivo

        # Rutas de los archivos
        original_path = os.path.join(UPLOAD_FOLDER, original_image)
        new_original_path = os.path.join(UPLOAD_FOLDER, new_filename)
        processed_path = os.path.join(PROCESSED_FOLDER, original_image)
        new_processed_path = os.path.join(PROCESSED_FOLDER, new_filename)

        # Renombrar la imagen original
        if os.path.exists(original_path):
            os.rename(original_path, new_original_path)
        else:
            return jsonify({"error": f"Archivo original no encontrado: {original_image}"}), 404

        # Renombrar la imagen procesada
        if os.path.exists(processed_path):
            os.rename(processed_path, new_processed_path)
        else:
            return jsonify({"error": f"Archivo procesado no encontrado: {original_image}"}), 404

        # Validar formato de las etiquetas
        formatted_labels = []
        for label in labels:
            if len(label) == 2:
                # Si faltan width y height, agregar valores predeterminados
                formatted_labels.append([label[0], label[1], 0.1, 0.1])
            elif len(label) == 4:
                formatted_labels.append(label)
            else:
                return jsonify({"error": "Formato de etiquetas inválido"}), 400

        # Guardar etiquetas en el nuevo archivo
        label_path = DetectionUtils.save_yolo_labels(new_filename, formatted_labels)
         
        return jsonify({
            "message": "Etiquetas y archivos renombrados correctamente",
            "new_image_url": f"/static/processed/{new_filename}",
            "label_path": label_path,
            "count": len(labels)
        })
    except Exception as e:
        logger.error(f"Error en update_labels: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
# ------------------------- RUTAS PARA GUARDAR IMÁGENES DESDE EL CANVAS -------------------------
#@app.route('/save_canvas', methods=['POST'])
#def save_canvas():
#    """Guarda una imagen enviada desde el canvas (base64) en static/processed"""
#    data = request.get_json()
#    if not data or 'image' not in data:
#        return jsonify({"error": "No se recibió la imagen"}), 400
#
#    image_data = data['image']
#    filename = data.get('filename')
#    try:
#        # Extraer base64 puro si viene como data URL
#        if image_data.startswith('data:image'):
#            header, image_data = image_data.split(',', 1)
#            ext = header.split('/')[1].split(';')[0]
#        else:
#            ext = 'png'
#        if not filename:
#            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
#            filename = f"canvas_{timestamp}.{ext}"
#        else:
#            filename = secure_filename(filename)
#            if not filename.lower().endswith(f'.{ext}'):
#                filename += f'.{ext}'
#        processed_path = os.path.join(PROCESSED_FOLDER, filename)
#        # Decodificar y guardar
#        image_bytes = base64.b64decode(image_data)
#        with open(processed_path, 'wb') as f:
#            f.write(image_bytes)
#        return jsonify({
#            "message": "Imagen guardada correctamente",
#            "image_url": f"/static/processed/{filename}"
#        })
#    
#    except Exception as e:
#        logger.error(f"Error guardando imagen de canvas: {str(e)}")
#        return jsonify({"error": str(e)}), 500
    

if __name__ == "__main__":
    init_camera()  # Inicializar la cámara al iniciar el servidor
    app.run(host='0.0.0.0', port=5000, debug=True)
