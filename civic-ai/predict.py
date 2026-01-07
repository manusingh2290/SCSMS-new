import os
import sys
import json

# 🔕 MUST be set BEFORE importing tensorflow
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import tensorflow as tf
import numpy as np
from tensorflow.keras.preprocessing import image

tf.get_logger().setLevel("ERROR")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "civic_model.h5")

LABELS = [
    "pothole",
    "garbage",
    "street_light",
    "drainage",
    "water_leak",
    "fallen_tree",
    "illegal_dumping",
    "road_damage"
]

image_path = sys.argv[1]

# 🚀 Load model (NO compile, NO logs)
model = tf.keras.models.load_model(MODEL_PATH, compile=False)

img = image.load_img(image_path, target_size=(224, 224))
x = image.img_to_array(img)
x = np.expand_dims(x, axis=0) / 255.0

preds = model(x, training=False).numpy()[0]

idx = int(np.argmax(preds))
confidence = float(preds[idx])

print(json.dumps({
    "label": LABELS[idx],
    "confidence": round(confidence, 4)
}))
