from flask import Flask, request, jsonify, send_from_directory, render_template_string, Response, send_file
from flask_cors import CORS  # <-- Importa el módulo
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
PROCESSED_FOLDER = os.path.join(FOTO_FOLDER, "processed") # Imágenes procesadas
LABELED_FOLDER =  os.path.join(FOTO_FOLDER, "labeled")  # Imágenes con etiquetas

# Constantes del sistema
MIN_DISTANCE = 50  # Distancia mínima entre detecciones (en píxeles) para evitar duplicados
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}  # Formatos de imagen permitidos


# Global Variable declaration
# Variables globales para la cámara
camera = None
camera_frame = None
camera_lock = threading.Lock()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def ensure_folders_exist():
    """Create all required directories if they don't exist"""
    folders = [
        FOTO_FOLDER,
        UPLOAD_FOLDER,
        PROCESSED_FOLDER,
        LABELED_FOLDER,
        os.path.join(FOTO_FOLDER, "labeled"),
        os.path.join(FOTO_FOLDER, "processed")
    ]
    for folder in folders:
        try:
            if not os.path.exists(folder):
                os.makedirs(folder)
                logger.info(f"Created directory: {folder}")
            # Test write permissions by creating and removing a test file
            test_file = os.path.join(folder, '.test')
            try:
                with open(test_file, 'w') as f:
                    f.write('test')
                os.remove(test_file)
            except (IOError, OSError) as e:
                logger.error(f"Directory {folder} is not writable: {e}")
                raise
        except Exception as e:
            logger.error(f"Error creating/checking directory {folder}: {e}")
            raise

# Create directories at startup
try:
    ensure_folders_exist()
    logger.info("All required directories are ready")
except Exception as e:
    logger.error(f"Failed to create required directories: {e}")

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
    return jsonify({"mensaje": "¡Hola Wagner WASAAAAAAAAAAAAAAAAA!!"})

# Endpoint para subir una imagen
class DetectionUtils:
    """Clase utilitaria para operaciones de detección"""
    
    @staticmethod
    def save_yolo_labels(image_name: str, detections: List[Tuple[float]]) -> str:
        """Guarda detecciones en formato YOLO (.txt)"""
        try:
            base_name = os.path.splitext(image_name)[0]
            label_path = os.path.join(FOTO_FOLDER, "labeled", f"{base_name}.txt")

            with open(label_path, 'w') as f:
                for detection in detections:
                    if len(detection) == 4:  # Validar que la detección tenga 4 valores
                        x_center, y_center, width, height = detection
                        f.write(f"0 {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}\n")  # Formato YOLO
                    else:
                        logger.warning(f"Detección inválida: {detection}")

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
                        #Anton 20250609: x_radio = (x2 - x1) / 2 

                        # Filtrar detecciones muy cercanas
                        if any(abs(center_x - cx) < MIN_DISTANCE/img.shape[1] and 
                              abs(center_y - cy) < MIN_DISTANCE/img.shape[0] 
                              for cx, cy in detected_centers):
                            continue

                        detected_centers.append((center_x, center_y))
                        detections.append((center_x, center_y, norm_width, norm_height))

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
    return send_file(os.path.join(UPLOAD_FOLDER, filename))

@app.route('/labels/<path:filename>')
def serve_label_file(filename):
    """Sirve archivos de etiquetas desde la carpeta labels/"""
    return send_file(os.path.join(FOTO_FOLDER, "labeled", filename))

# Funciones para gestionar archivos
def move_file_to_save_folder(original_path, new_filename):
    """Mueve un archivo a la carpeta save/ y devuelve la nueva ruta"""
    try:
        save_path = os.path.join(FOTO_FOLDER, "labeled", new_filename)
        
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
    """Actualiza etiquetas manualmente desde frontend, renombra archivos y guarda el canvas modificado en labeled."""
    try:
        # Ensure directories exist
        ensure_folders_exist()
        
        data = request.get_json()
        if not data or 'file' not in data or 'labels' not in data or 'originalImage' not in data or 'canvas_image' not in data:
            return jsonify({"error": "Datos inválidos"}), 400

        # Datos recibidos
        new_filename = secure_filename(data['file'])
        labels = data['labels']
        original_image = secure_filename(data['originalImage'])
        canvas_image = data['canvas_image']

        # First try uploads folder, then try labeled folder
        original_path = os.path.join(UPLOAD_FOLDER, original_image)
        if not os.path.exists(original_path):
            original_path = os.path.join(LABELED_FOLDER, original_image)
            if not os.path.exists(original_path):
                logger.error(f"Original file not found in either uploads or labeled folders: {original_image}")
                return jsonify({"error": f"No se encuentra el archivo original: {original_image}"}), 404
        
        labeled_image_path = os.path.join(LABELED_FOLDER, new_filename)
        logger.info(f"Found original file at: {original_path}")
        logger.info(f"Will save labeled file to: {labeled_image_path}")

        try:
            # 1. Copy the image to labeled
            shutil.copy2(original_path, labeled_image_path)
            logger.info(f"Copied {original_path} to {labeled_image_path}")
            
            # 2. Guardar etiquetas
            label_path = os.path.join(LABELED_FOLDER, f"{os.path.splitext(new_filename)[0]}.txt")
            with open(label_path, 'w') as f:
                for label in labels:
                    f.write(f"0 {label[0]} {label[1]} {label[2]} {label[3]}\n")
            logger.info(f"Saved labels to {label_path}")

            # 3. Guardar la imagen procesada si está presente
            if canvas_image and canvas_image.startswith('data:image'):
                try:
                    header, image_data = canvas_image.split(',', 1)
                    image_bytes = base64.b64decode(image_data)
                    processed_path = os.path.join(PROCESSED_FOLDER, new_filename)
                    with open(processed_path, 'wb') as f:
                        f.write(image_bytes)
                    logger.info(f"Saved processed image to {processed_path}")
                except Exception as img_error:
                    logger.error(f"Error saving processed image: {str(img_error)}")
                    # Continue execution even if image processing fails

            return jsonify({
                "message": "Etiquetas, archivos y canvas guardados correctamente",
                "labeled_image_url": f"/fotos_gavetas/labeled/{new_filename}",
                "labeled_label_url": f"/fotos_gavetas/labeled/{os.path.splitext(new_filename)[0]}.txt",
                "count": len(labels)
            })

        except IOError as e:
            logger.error(f"IO Error in update_labels: {str(e)}")
            return jsonify({"error": f"Error de archivo: {str(e)}"}), 500
        except Exception as e:
            logger.error(f"Error in update_labels: {str(e)}")
            return jsonify({"error": str(e)}), 500

    except Exception as e:
        logger.error(f"Error in update_labels: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Nueva ruta para servir imágenes desde la carpeta save/
@app.route('/save/<filename>')
def save_file(filename):
    """Sirve archivos guardados desde la carpeta save/"""
    return send_file(os.path.join(FOTO_FOLDER, "labeled", filename))

# Nueva ruta para eliminar imágenes de uploads/
@app.route('/delete_uploaded_image', methods=['POST'])
def delete_uploaded_image():
    """Elimina archivos de la carpeta uploads/"""
    data = request.get_json()
    # Si se indica uploads, borrar todos los archivos
    if data and data.get('uploads'):
        errors = []
        for file in os.listdir(UPLOAD_FOLDER):
            file_path = os.path.join(UPLOAD_FOLDER, file)
            try:
                os.remove(file_path)
            except Exception as e:
                errors.append(f"{file}: {str(e)}")
        if errors:
            return jsonify({"error": "Errores eliminando archivos: " + ", ".join(errors)}), 500
        return jsonify({"message": "Todos los archivos de uploads eliminados"})
    
    # Sino, borrar un archivo individual
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
    for fname in os.listdir(FOTO_FOLDER):
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

@app.route("/save_update", methods=["POST"])
def save_update():
    """Actualiza etiquetas (Save Confirm): copia la imagen original, guarda el fichero de etiquetas y almacena la imagen procesada en processed."""
    try:
        ensure_folders_exist()
        data = request.get_json()
        if not data or 'file' not in data or 'labels' not in data or 'originalImage' not in data or 'canvas_image' not in data:
            return jsonify({"error": "Datos inválidos"}), 400

        # Datos recibidos
        new_filename = secure_filename(data['file'])
        labels = data['labels']
        original_image = secure_filename(data['originalImage'])
        canvas_image = data['canvas_image']

        # Buscar la imagen original en UPLOAD_FOLDER o LABELED_FOLDER
        original_path = os.path.join(UPLOAD_FOLDER, original_image)
        if not os.path.exists(original_path):
            original_path = os.path.join(LABELED_FOLDER, original_image)
            if not os.path.exists(original_path):
                logger.error(f"Original file not found: {original_image}")
                return jsonify({"error": f"No se encuentra el archivo original: {original_image}"}), 404

        # Copiar la imagen original a LABELED_FOLDER
        labeled_image_path = os.path.join(LABELED_FOLDER, new_filename)
        shutil.copy2(original_path, labeled_image_path)
        logger.info(f"Copied {original_path} to {labeled_image_path}")

        # Guardar etiquetas en un archivo de texto
        label_path = os.path.join(LABELED_FOLDER, f"{os.path.splitext(new_filename)[0]}.txt")
        with open(label_path, 'w') as f:
            for label in labels:
                f.write(f"0 {label[0]} {label[1]} {label[2]} {label[3]}\n")
        logger.info(f"Saved labels to {label_path}")

        # Guardar la imagen procesada en PROCESSED_FOLDER si se proporcionó el canvas
        if canvas_image and canvas_image.startswith('data:image'):
            try:
                header, image_data = canvas_image.split(',', 1)
                image_bytes = base64.b64decode(image_data)
                processed_path = os.path.join(PROCESSED_FOLDER, new_filename)
                with open(processed_path, 'wb') as f:
                    f.write(image_bytes)
                logger.info(f"Saved processed image to {processed_path}")
            except Exception as img_error:
                logger.error(f"Error saving processed image: {str(img_error)}")
                # Se continúa la ejecución aun si falla el guardado de la imagen procesada

        return jsonify({
            "message": "Etiquetas, archivos y canvas guardados correctamente",
            "labeled_image_url": f"/fotos_gavetas/labeled/{new_filename}",
            "labeled_label_url": f"/fotos_gavetas/labeled/{os.path.splitext(new_filename)[0]}.txt",
            "count": len(labels)
        })

    except Exception as e:
        logger.error(f"Error in save_update: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/print_update", methods=["POST"])
def print_update():
    """Operación de impresión (Print Confirm): guarda únicamente el canvas en processed sin guardar en labeled ni generar archivo de etiquetas."""
    try:
        ensure_folders_exist()
        data = request.get_json()
        if not data or 'file' not in data or 'canvas_image' not in data:
            return jsonify({"error": "Datos inválidos"}), 400

        new_filename = secure_filename(data['file'])
        canvas_image = data['canvas_image']

        if canvas_image and canvas_image.startswith('data:image'):
            try:
                header, image_data = canvas_image.split(',', 1)
                image_bytes = base64.b64decode(image_data)
                processed_path = os.path.join(PROCESSED_FOLDER, new_filename)
                with open(processed_path, 'wb') as f:
                    f.write(image_bytes)
                logger.info(f"Saved processed image to {processed_path} (print mode)")
            except Exception as img_error:
                logger.error(f"Error saving processed image in print mode: {str(img_error)}")
                return jsonify({"error": f"Error al guardar imagen procesada: {str(img_error)}"}), 500

            return jsonify({
                "message": "Operación de impresión completada correctamente",
                "processed_image_url": f"/fotos_gavetas/processed/{new_filename}"
            })
        else:
            return jsonify({"error": "Canvas inválido"}), 400

    except Exception as e:
        logger.error(f"Error in print_update: {str(e)}")
        return jsonify({"error": str(e)}), 500
# Alwys the last line in the app.py
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
