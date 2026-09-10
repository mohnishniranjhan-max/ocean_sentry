import pandas as pd
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import json
import os

def main():
    print("=== Training Custom MLP for Web Export ===")
    
    csv_path = 'gesture_dataset.csv'
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return
        
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} samples from {csv_path}.")
    
    # Extract features (relative to wrist to make it translation invariant)
    feature_cols = [col for col in df.columns if col.startswith('x') or col.startswith('y') or col.startswith('z')]
    X = df[feature_cols].values
    
    # Extract labels
    labels = sorted(df['label'].unique().tolist())
    print(f"Detected gestures: {labels}")
    label_to_idx = {l: i for i, l in enumerate(labels)}
    y = np.array([label_to_idx[l] for l in df['label']])
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    best_mlp = None
    best_acc = 0.0
    
    print("Training MLP to find the best fit...")
    for i in range(1):
        # Train a 2-layer MLP (64 -> 32)
        mlp = MLPClassifier(hidden_layer_sizes=(64, 32), activation='relu', solver='adam', max_iter=400, random_state=i*42)
        print(f"Run {i+1}/1 - Training MLP...")
        mlp.fit(X_train, y_train)
        
        y_pred = mlp.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        print(f"Run {i+1}/5 Accuracy: {acc*100:.2f}%")
        
        if acc >= best_acc:
            best_acc = acc
            best_mlp = mlp

    print(f"\nBest Model Selected with Accuracy: {best_acc*100:.2f}%")
    
    # Export weights and biases of the BEST model to JSON
    model_data = {
        'classes': labels,
        'layers': []
    }
    
    for i in range(len(best_mlp.coefs_)):
        layer = {
            'weights': best_mlp.coefs_[i].tolist(),
            'biases': best_mlp.intercepts_[i].tolist()
        }
        model_data['layers'].append(layer)
        
    out_dir = 'public/model'
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'mlp_weights.json')
    
    with open(out_path, 'w') as f:
        json.dump(model_data, f)
        
    print(f"Model successfully exported to {out_path}!")
    
if __name__ == '__main__':
    main()
