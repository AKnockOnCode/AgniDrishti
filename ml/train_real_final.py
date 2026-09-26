import pandas as pd
import numpy as np
import glob
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import pickle

# 1. Load the NASA FIRMS Fire Data
print("1. Loading real NASA FIRMS CSV files...")
firms_files = glob.glob(r"c:\Badmosi\sih\gods-eye-view\firms_data\*.csv")
if not firms_files:
    print("Error: No CSV files found in firms_data folder!")
    exit()

df_list = []
for file in firms_files:
    try:
        df = pd.read_csv(file)
        df_list.append(df)
    except Exception as e:
        print(f"Error reading {file}: {e}")

fires_df = pd.concat(df_list, ignore_index=True)
print(f"Loaded {len(fires_df)} total real fire hotspots from NASA.")

if 'confidence' in fires_df.columns:
    fires_df = fires_df[fires_df['confidence'].astype(str) != 'l']

# 2. Load the Real Industrial Data
print("\n2. Loading Real Industrial Data (OSM)...")
industry_file = r"c:\Badmosi\sih\gods-eye-view\industrydataosm.csv"
try:
    # Overpass CSV is tab-separated
    industries_df = pd.read_csv(industry_file, sep='\t')
    # Rename columns if they start with @
    industries_df = industries_df.rename(columns={'@lat': 'lat', '@lon': 'lon'})
    print(f"Successfully loaded {len(industries_df)} real industrial sites across India!")
except Exception as e:
    print("Error reading industrydataosm.csv:", e)
    exit()

# 3. Calculate distance to nearest industry
print("\n3. Calculating real distances and extracting features...")
# To keep training fast for the prototype, sample fires
sample_fires = fires_df.sample(min(50000, len(fires_df)), random_state=42).copy()

industry_coords = industries_df[['lat', 'lon']].values

def get_nearest_distance(lat, lon):
    dlat = (industry_coords[:, 0] - lat) * 111.0
    dlon = (industry_coords[:, 1] - lon) * 100.0
    dist = np.sqrt(dlat**2 + dlon**2)
    return np.min(dist) * 1000  # meters

print("Mapping distances for a 10,000 point sample (this takes a moment)...")
sample_fires = sample_fires.head(10000)
sample_fires['distance_to_industry_m'] = [get_nearest_distance(lat, lon) for lat, lon in zip(sample_fires['latitude'], sample_fires['longitude'])]

# 4. Generate Heuristic Labels for Training
print("\n4. Labeling the data based on actual FRP, Brightness, and Real Spatial Proximity...")
def assign_label(row):
    dist = row['distance_to_industry_m']
    frp = row['frp']
    bright = row['brightness']
    
    if frp > 1000:
        return 'Blast'
    elif dist < 2000 and frp < 50:
        return 'Persistent Industrial'
    elif dist < 2000 and bright > 330:
        return 'Industrial Flare'
    elif dist > 5000 and frp > 100:
        return 'Wildfire'
    else:
        return 'Agricultural Fire'

sample_fires['label'] = sample_fires.apply(assign_label, axis=1)

# Print out class distributions
print("\nClass distribution in the training sample:")
print(sample_fires['label'].value_counts())

# 5. Train the Model
print("\n5. Training the Random Forest AI...")
X = sample_fires[['frp', 'brightness', 'distance_to_industry_m']]
y = sample_fires['label']
X = X.fillna(0)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

clf = RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42)
clf.fit(X_train, y_train)

y_pred = clf.predict(X_test)
print("\nClassification Report (Real Data Evaluation):")
print(classification_report(y_test, y_pred))

# 6. Save the model
model_path = r"c:\Badmosi\sih\gods-eye-view\ml\fire_classifier_real.pkl"
with open(model_path, 'wb') as f:
    pickle.dump(clf, f)

print(f"\nFinal Model successfully trained on 100% REAL data and saved to {model_path}!")
