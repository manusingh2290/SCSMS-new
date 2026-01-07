import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.metrics import classification_report, confusion_matrix
import numpy as np
import json

# ================= CONFIG =================
MODEL_PATH = "model/civic_efficientnet_3.h5"
DATASET_DIR = "dataset"
IMG_SIZE = (224, 224)
BATCH_SIZE = 16

# ================= LOAD MODEL =================
model = load_model(MODEL_PATH)
print("✅ Model loaded")

# ================= DATA (MATCH TRAINING SPLIT) =================
datagen = ImageDataGenerator(
    rescale=1./255,
    validation_split=0.2
)

val_gen = datagen.flow_from_directory(
    DATASET_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    subset="validation",     # ✅ CRITICAL
    class_mode="categorical",
    shuffle=False
)

# ================= PREDICT =================
preds = model.predict(val_gen)
y_pred = np.argmax(preds, axis=1)
y_true = val_gen.classes

# ================= METRICS =================
print("\n📊 Classification Report\n")
print(
    classification_report(
        y_true,
        y_pred,
        target_names=list(val_gen.class_indices.keys()),
        zero_division=0
    )
)

print("\n🧩 Confusion Matrix\n")
print(confusion_matrix(y_true, y_pred))

# ================= SAVE LABELS =================
with open("labels.json", "w") as f:
    json.dump(val_gen.class_indices, f, indent=4)

print("\n📁 labels.json saved")
