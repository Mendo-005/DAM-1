import tensorflow as tf
import numpy as np
import matplotlib.pyplot as plt

celsius = np.array([-40,-10, 0, 10, 23, 30, 48, 55], dtype=float)
fahrenheit = np.array([-40, 14, 32, 50, 73.4, 86, 118.4, 131], dtype=float)

# Capas
capa = tf.keras.layers.Dense(units=1, input_shape=[1])
modelo = tf.keras.Sequential([capa])

modelo.compile(
    optimizer=tf.keras.optimizers.Adam(0.1),
    loss='mean_squared_error'
)

# Entrenamiento
print("Comenzando entrenamiento...")
historial = modelo.fit(celsius, fahrenheit, epochs=1000, verbose=False)
print("Modelo entrenado")

#Grafica
plt.xlabel("# Epoca")
plt.ylabel("Magnitud de error")
plt.plot(historial.history["loss"])
plt.show()

print("Hagamos una predicción!")
# Convert the input to a NumPy array
resultado = modelo.predict(np.array([100.0]))  
print("El resultado es " + str(resultado) + " fahrenheit!")

print("Variables internas del modelo")
print(capa.get_weights())
