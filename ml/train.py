import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import pickle
import os

print("Generating synthetic data for the 5 categories...")

# Heuristics for synthetic data generation:
# 1. Agricultural Fire: Dist > 2000m, Low/Med FRP, Med Brightness
# 2. Wildfire: Dist > 5000m, Med/High FRP, High Brightness
# 3. Industrial Flare: Dist < 1000m, Med FRP, Very High Brightness
# 4. Persistent Industrial: Dist < 500m, Low FRP, Med/High Brightness
# 5. Blast: Dist < 2000m (usually), Extremely High FRP, Extremely High Brightness

np.random.seed(42)
n_samples_per_class = 1000

data = []

# 1. Agricultural Fire
agri_frp = np.random.uniform(5, 40, n_samples_per_class)
agri_bright = np.random.uniform(300, 320, n_samples_per_class)
agri_dist = np.random.uniform(2000, 15000, n_samples_per_class)
for i in range(n_samples_per_class):
    data.append([agri_frp[i], agri_bright[i], agri_dist[i], 'Agricultural Fire'])

# 2. Wildfire
wild_frp = np.random.uniform(50, 800, n_samples_per_class)
wild_bright = np.random.uniform(315, 380, n_samples_per_class)
wild_dist = np.random.uniform(5000, 50000, n_samples_per_class)
for i in range(n_samples_per_class):
    data.append([wild_frp[i], wild_bright[i], wild_dist[i], 'Wildfire'])

# 3. Industrial Flare
flare_frp = np.random.uniform(20, 150, n_samples_per_class)
flare_bright = np.random.uniform(330, 450, n_samples_per_class)
flare_dist = np.random.uniform(0, 1000, n_samples_per_class)
for i in range(n_samples_per_class):
    data.append([flare_frp[i], flare_bright[i], flare_dist[i], 'Industrial Flare'])

# 4. Persistent Industrial (e.g. steel mills, power plants)
pers_frp = np.random.uniform(5, 30, n_samples_per_class)
pers_bright = np.random.uniform(310, 340, n_samples_per_class)
pers_dist = np.random.uniform(0, 500, n_samples_per_class)
for i in range(n_samples_per_class):
    data.append([pers_frp[i], pers_bright[i], pers_dist[i], 'Persistent Industrial'])

# 5. Blast/Explosion (Massive sudden energy)
blast_frp = np.random.uniform(1000, 5000, n_samples_per_class)
blast_bright = np.random.uniform(350, 500, n_samples_per_class)
blast_dist = np.random.uniform(0, 5000, n_samples_per_class)
for i in range(n_samples_per_class):
    data.append([blast_frp[i], blast_bright[i], blast_dist[i], 'Blast'])

df = pd.DataFrame(data, columns=['frp', 'brightness', 'distance_to_industry_m', 'label'])

X = df[['frp', 'brightness', 'distance_to_industry_m']]
y = df['label']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("Training Random Forest Classifier...")
clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
clf.fit(X_train, y_train)

y_pred = clf.predict(X_test)
print("\nClassification Report:")
print(classification_report(y_test, y_pred))

# Save the model
model_path = os.path.join(os.path.dirname(__file__), 'fire_classifier.pkl')
with open(model_path, 'wb') as f:
    pickle.dump(clf, f)

print(f"Model saved successfully to {model_path}!")
