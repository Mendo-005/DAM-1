from flask import Flask, request, jsonify, send_from_directory, render_template_string, Response
from flask_cors import CORS  # <-- Importa el módulo
 #--------
#from flask import Flask, render_template, request, jsonify, send_file, Response
#from flask_cors import CORS  # <-- Importa el módulo para CORS
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
import shutil
 #--------

# Start Flask
app = Flask(__name__)
CORS(app)  # <-- Habilita CORS para todas las rutas y orígenes

# Start custom code for the python app

# Constant declaration
# Directorios para almacenamiento
FOTO_FOLDER = "fotos_gavetas"  # Imágenes cargadas
UPLOAD_FOLDER = "uploads"  # Imágenes cargadas
PROCESSED_FOLDER = "processed"  # Imágenes procesadas
LABELS_FOLDER = "labels"  # Archivos de etiquetas YOLO
SAVE_FOLDER = "save"  # Carpeta para guardar imágenes desde el canvas

# Constantes del sistema
MIN_DISTANCE = 50  # Distancia mínima entre detecciones (en píxeles) para evitar duplicados
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}  # Formatos de imagen permitidos


# Global Variable declaration
# Variables globales para la cámara
camera = None
camera_frame = None
camera_lock = threading.Lock()


# Crear directorios si no existen
os.makedirs(FOTO_FOLDER, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(LABELS_FOLDER, exist_ok=True)
os.makedirs(SAVE_FOLDER, exist_ok=True)

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Carga del modelo YOLO (ruta específica al archivo de pesos)
try:
    model = YOLO("I:/AI/data/test_web_ai/py/yolo_model/best.pt")  # Asegúrate de que la ruta sea correcta
    logger.info("Modelo YOLO cargado correctamente")
except Exception as e:
    logger.error(f"Error al cargar el modelo YOLO: {str(e)}")
    raise

# End  custom code for the python app


# post / get requests from the HTML/Javscript 
@app.route('/api/saludar', methods=['GET'])
def saludar():
    return jsonify({"mensaje": "¡Hola Wagner ftb FLASK-CORS!"})

# Endpoint para subir una imagen
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
    with open("index.html") as f:
        return render_template_string(f.read())

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

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

        # Guardar solo etiquetas, NO la imagen procesada
        DetectionUtils.save_yolo_labels(filename, detections)

        return jsonify({
            "image_url": f"/uploads/{filename}",
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

    # No guardar etiquetas generadas automáticamente
    return jsonify({"image_url": f"/uploads/{filename}", "labels": detections})


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Sirve archivos subidos directamente"""
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/labels/<path:filename>')
def serve_label_file(filename):
    """Sirve archivos de etiquetas desde la carpeta labels/"""
    return send_from_directory(LABELS_FOLDER, filename)

# Funciones para gestionar archivos
def move_file_to_save_folder(original_path, new_filename):
    """Mueve un archivo a la carpeta save/ y devuelve la nueva ruta"""
    try:
        save_path = os.path.join(SAVE_FOLDER, new_filename)
        
        # Si el archivo ya existe en save/, agregar sufijo numérico
        counter = 1
        base, ext = os.path.splitext(save_path)
        while os.path.exists(save_path):
            save_path = f"{base}_{counter}{ext}"
            counter += 1
        
        shutil.move(original_path, save_path)
        return save_path
    except Exception as e:
        logger.error(f"Error moviendo archivo a save/: {str(e)}")
        return None

def delete_file_from_uploads(filename):
    """Elimina un archivo de la carpeta uploads/"""
    try:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except Exception as e:
        logger.error(f"Error eliminando archivo de uploads/: {str(e)}")
        return False

@app.route("/update_labels", methods=["POST"])
def update_labels():
    """Actualiza etiquetas manualmente desde frontend, renombra archivos y guarda el canvas modificado en processed"""
    data = request.get_json()
    if not data or 'file' not in data or 'labels' not in data or 'originalImage' not in data or 'canvas_image' not in data:
        return jsonify({"error": "Datos inválidos"}), 400

    try:
        # Datos recibidos
        new_filename = secure_filename(data['file'])  # Nuevo nombre del archivo
        labels = data['labels']
        original_image = secure_filename(data['originalImage'])  # Nombre original del archivo
        canvas_image = data['canvas_image']  # Imagen del canvas en base64

        # Rutas de los archivos
        original_path = os.path.join(UPLOAD_FOLDER, original_image)
        
        # 1. Mover la imagen original a la carpeta save/
        save_path = move_file_to_save_folder(original_path, new_filename)
        if not save_path:
            return jsonify({"error": "No se pudo mover la imagen a la carpeta save"}), 500
        
        # 2. Guardar la imagen procesada en processed/
        if canvas_image.startswith('data:image'):
            header, image_data = canvas_image.split(',', 1)
        else:
            image_data = canvas_image
        image_bytes = base64.b64decode(image_data)
        processed_path = os.path.join(PROCESSED_FOLDER, new_filename)
        with open(processed_path, 'wb') as f:
            f.write(image_bytes)

        # 3. Guardar etiquetas en el nuevo archivo
        label_path = DetectionUtils.save_yolo_labels(new_filename, labels)

        return jsonify({
            "message": "Etiquetas, archivos y canvas guardados correctamente",
            "new_image_url": f"/static/processed/{new_filename}",
            "label_path": label_path,
            "count": len(labels),
            "original_image_url": f"/save/{os.path.basename(save_path)}"  # Nueva URL para la imagen original
        })
    except Exception as e:
        logger.error(f"Error en update_labels: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Nueva ruta para servir imágenes desde la carpeta save/
@app.route('/save/<filename>')
def save_file(filename):
    """Sirve archivos guardados desde la carpeta save/"""
    return send_from_directory(SAVE_FOLDER, filename)

# Nueva ruta para eliminar imágenes de uploads/
@app.route('/delete_uploaded_image', methods=['POST'])
def delete_uploaded_image():
    """Elimina una imagen de la carpeta uploads/"""
    data = request.get_json()
    if not data or 'filename' not in data:
        return jsonify({"error": "Nombre de archivo no proporcionado"}), 400
    
    filename = secure_filename(data['filename'])
    if delete_file_from_uploads(filename):
        return jsonify({"message": f"Imagen {filename} eliminada de uploads"})
    return jsonify({"error": f"No se pudo eliminar {filename} de uploads"}), 404

@app.route('/check_unique_number')
def check_unique_number():
    """Verifica si el número único ya existe."""
    nr_unico = request.args.get('nr_unico', '').strip()
    if not nr_unico:
        return jsonify({'error': 'Número único no proporcionado'}), 400

    # Buscar archivos en la carpeta labels que contengan el nr_unico
    for fname in os.listdir(LABELS_FOLDER):
        if not fname.endswith('.txt'):
            continue
        # Extraer partes del nombre: fecha-seccion-rolado-nr_unico-cantidad.txt
        parts = fname.split('-')
        if len(parts) < 5:
            continue
        file_nr_unico = parts[-2]
        if file_nr_unico == nr_unico:
            # Si encontramos el mismo número único en otro archivo
            return jsonify({'exists': True})
    return jsonify({'exists': False})

# Alwys the last line in the app.py
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
