"""
PHASE 3: TRAIN ML MODEL FOR ETA PREDICTION
===========================================
İstanbul traffic-aware ETA prediction model

Input:  data/processed/istanbul_eta_training.csv
Output: models/eta_model_istanbul.pkl
        models/visualizations/*.png
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import os

def train_eta_model(
    training_csv='data/processed/istanbul_eta_training.csv',
    model_output='models/eta_model_istanbul.pkl'
):
    print("=" * 80)
    print("PHASE 3: TRAIN ML MODEL FOR ETA PREDICTION")
    print("=" * 80)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Create output directories
    os.makedirs('models', exist_ok=True)
    os.makedirs('models/visualizations', exist_ok=True)
    
    # Load training data
    print(f"\n📂 Loading training data...")
    try:
        df = pd.read_csv(training_csv)
        print(f"✓ Loaded {len(df)} samples")
    except Exception as e:
        print(f"❌ ERROR: {e}")
        print(f"   Lütfen önce 'python scripts/phase2_generate_training.py' çalıştırın!")
        return None
    
    print(f"\n📊 Dataset Info:")
    print(f"   Columns: {list(df.columns)}")
    print(f"   Shape: {df.shape}")
    print(f"   Memory: {df.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
    
    # Define features
    feature_columns = [
        'distance_km',
        'hour',
        'day_of_week',
        'is_weekend',
        'is_rush_hour',
        'ibb_avg_speed',
        'ibb_traffic_density',
        'ibb_speed_factor',
        'osrm_duration_sec'
    ]
    
    target_column = 'duration_min'
    
    print(f"\n🔧 Features ({len(feature_columns)}):")
    for i, feat in enumerate(feature_columns, 1):
        print(f"   {i}. {feat}")
    
    print(f"\n🎯 Target: {target_column}")
    
    # Prepare data
    X = df[feature_columns]
    y = df[target_column]
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"\n📈 Data Split:")
    print(f"   Train: {len(X_train)} samples ({100*len(X_train)/len(df):.1f}%)")
    print(f"   Test:  {len(X_test)} samples ({100*len(X_test)/len(df):.1f}%)")
    
    # Train model
    print(f"\n🤖 Training Gradient Boosting Regressor...")
    print(f"   Hyperparameters:")
    print(f"   • n_estimators: 200")
    print(f"   • learning_rate: 0.1")
    print(f"   • max_depth: 5")
    print(f"   • min_samples_split: 5")
    print(f"   • min_samples_leaf: 2")
    
    model = GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.1,
        max_depth=5,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        verbose=1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    print(f"\n📊 Model Evaluation...")
    
    # Train predictions
    y_train_pred = model.predict(X_train)
    train_mae = mean_absolute_error(y_train, y_train_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))
    train_r2 = r2_score(y_train, y_train_pred)
    
    # Test predictions
    y_test_pred = model.predict(X_test)
    test_mae = mean_absolute_error(y_test, y_test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
    test_r2 = r2_score(y_test, y_test_pred)
    
    print("\n" + "=" * 80)
    print("✓ MODEL TRAINING COMPLETED!")
    print("=" * 80)
    
    print(f"\n📈 TRAINING SET PERFORMANCE:")
    print(f"   • MAE:  {train_mae:.2f} minutes ({train_mae*60:.0f} seconds)")
    print(f"   • RMSE: {train_rmse:.2f} minutes")
    print(f"   • R²:   {train_r2:.4f}")
    
    print(f"\n📉 TEST SET PERFORMANCE:")
    print(f"   • MAE:  {test_mae:.2f} minutes ({test_mae*60:.0f} seconds)")
    print(f"   • RMSE: {test_rmse:.2f} minutes")
    print(f"   • R²:   {test_r2:.4f}")
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print(f"\n🔍 FEATURE IMPORTANCE:")
    for idx, row in feature_importance.iterrows():
        print(f"   • {row['feature']:25s} : {row['importance']:.4f}")
    
    # Error analysis
    print(f"\n📊 ERROR ANALYSIS (Test Set):")
    test_errors = np.abs(y_test - y_test_pred)
    print(f"   • Mean absolute error: {test_errors.mean():.2f} min")
    print(f"   • Median absolute error: {test_errors.median():.2f} min")
    print(f"   • 90th percentile error: {test_errors.quantile(0.9):.2f} min")
    print(f"   • 95th percentile error: {test_errors.quantile(0.95):.2f} min")
    print(f"   • Max error: {test_errors.max():.2f} min")
    
    # Accuracy within thresholds
    within_3min = (test_errors <= 3).sum() / len(test_errors) * 100
    within_5min = (test_errors <= 5).sum() / len(test_errors) * 100
    within_10min = (test_errors <= 10).sum() / len(test_errors) * 100
    
    print(f"\n🎯 ACCURACY WITHIN THRESHOLDS:")
    print(f"   • Within 3 minutes:  {within_3min:.1f}%")
    print(f"   • Within 5 minutes:  {within_5min:.1f}%")
    print(f"   • Within 10 minutes: {within_10min:.1f}%")
    
    # Save model
    model_data = {
        'model': model,
        'features': feature_columns,
        'target': target_column,
        'train_mae': train_mae,
        'test_mae': test_mae,
        'train_r2': train_r2,
        'test_r2': test_r2,
        'feature_importance': feature_importance.to_dict(),
        'training_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'training_samples': len(df)
    }
    
    joblib.dump(model_data, model_output)
    
    print(f"\n💾 Model saved: {model_output}")
    print(f"   Contains: model, features, metrics, metadata")
    
    # Visualizations
    print(f"\n📊 Creating visualizations...")
    
    try:
        # Set style
        sns.set_style("whitegrid")
        
        # 1. Actual vs Predicted
        plt.figure(figsize=(10, 6))
        plt.scatter(y_test, y_test_pred, alpha=0.5, s=20)
        plt.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2)
        plt.xlabel('Actual Duration (minutes)')
        plt.ylabel('Predicted Duration (minutes)')
        plt.title(f'ETA Prediction: Actual vs Predicted\nMAE: {test_mae:.2f} min, R²: {test_r2:.3f}')
        plt.tight_layout()
        plt.savefig('models/visualizations/model_actual_vs_predicted.png', dpi=150)
        print(f"   ✓ Saved: models/visualizations/model_actual_vs_predicted.png")
        plt.close()
        
        # 2. Feature Importance
        plt.figure(figsize=(10, 6))
        plt.barh(feature_importance['feature'], feature_importance['importance'])
        plt.xlabel('Importance')
        plt.title('Feature Importance')
        plt.tight_layout()
        plt.savefig('models/visualizations/model_feature_importance.png', dpi=150)
        print(f"   ✓ Saved: models/visualizations/model_feature_importance.png")
        plt.close()
        
        # 3. Error Distribution
        plt.figure(figsize=(10, 6))
        plt.hist(test_errors, bins=50, edgecolor='black')
        plt.xlabel('Absolute Error (minutes)')
        plt.ylabel('Frequency')
        plt.title(f'Prediction Error Distribution\nMean: {test_errors.mean():.2f} min, Median: {test_errors.median():.2f} min')
        plt.axvline(test_errors.mean(), color='r', linestyle='--', label=f'Mean: {test_errors.mean():.2f}')
        plt.axvline(test_errors.median(), color='g', linestyle='--', label=f'Median: {test_errors.median():.2f}')
        plt.legend()
        plt.tight_layout()
        plt.savefig('models/visualizations/model_error_distribution.png', dpi=150)
        print(f"   ✓ Saved: models/visualizations/model_error_distribution.png")
        plt.close()
        
    except Exception as e:
        print(f"   ⚠️  Warning: Visualization error: {e}")
    
    print("\n" + "=" * 80)
    print(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    return model_data

if __name__ == "__main__":
    model_data = train_eta_model(
        training_csv='data/processed/istanbul_eta_training.csv',
        model_output='models/eta_model_istanbul.pkl'
    )
    
    if model_data is not None:
        print("\n✅ SUCCESS! Phase 3 tamamlandı.")
        print("\n🔜 NEXT STEP: Phase 4 - Deploy ML API")
        print("   Komut: python scripts/phase4_ml_api.py")
    else:
        print("\n❌ FAILED! Lütfen hataları kontrol edin.")