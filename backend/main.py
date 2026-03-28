import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import IsolationForest
from typing import List
import google.generativeai as genai
from dotenv import load_dotenv

# Load your environment variables (.env)
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash") 
DB_PATH = os.getenv("SQLITE_DB_PATH", "sustainability.db") 

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. Database Setup ---
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cpg_skus (
            sku TEXT PRIMARY KEY, name TEXT, category TEXT,
            material TEXT, weight_kg REAL, distance_km REAL,
            footprint REAL, status TEXT
        )
    ''')
    mock_data = [
        ("SKU-901", "Eco-Pack Coffee", "Beverages", "Recycled Paper", 0.5, 300, 1.2, "Verified"),
        ("SKU-402", "Standard Water Bottle", "Beverages", "Virgin Plastic", 1.2, 800, 4.5, "Pending"),
        ("SKU-115", "Premium Shampoo", "Personal Care", "Virgin Plastic", 0.8, 1500, 6.8, "High Risk"), 
        ("SKU-882", "Organic Soap Bar", "Personal Care", "Cardboard", 0.2, 150, 0.4, "Verified"),
        ("SKU-551", "Bamboo Toothbrush", "Personal Care", "Bamboo", 0.05, 1200, 0.1, "Verified"),
        ("SKU-774", "Bulk Detergent Jug", "Home Care", "Virgin Plastic", 2.5, 400, 8.9, "High Risk"), 
        ("SKU-309", "Glass Jar Sauce", "Food", "Glass", 0.6, 600, 3.2, "Pending"),
        ("SKU-218", "Morning Cereal Box", "Food", "Recycled Paper", 0.4, 250, 0.8, "Verified"),
        ("SKU-603", "Aluminum Soda Can", "Beverages", "Aluminum", 0.02, 800, 0.3, "Verified")
    ]
    cursor.executemany("INSERT OR IGNORE INTO cpg_skus VALUES (?,?,?,?,?,?,?,?)", mock_data)
    conn.commit()
    conn.close()

init_db()

# --- 2. Local AI Model Training ---
X_train = np.array([[0.5, 1, 100], [2.0, 5, 500], [1.2, 3, 1000], [5.0, 5, 50]])
y_train = np.array([1.2, 8.5, 5.1, 12.0])
pcf_model = LinearRegression().fit(X_train, y_train)

# --- 3. Request Formats ---
class EstimateInput(BaseModel):
    product_name: str
    material: str
    weight: float
    distance: float

class CompareInput(BaseModel):
    skus: List[str]

class PassportInput(BaseModel):
    sku: str

class ScoreLabelInput(BaseModel):
    sku: str

class ExtractInput(BaseModel): 
    text: str

class AddProductInput(BaseModel): 
    sku: str
    name: str
    category: str
    material: str
    weight_kg: float
    distance_km: float

class BulkAddInput(BaseModel):
    products: List[AddProductInput]


# --- 4. API Endpoints ---

@app.get("/api/products")
async def get_products():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM cpg_skus").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# Function: Save Single Product to DB
@app.post("/api/products/add")
async def add_product(data: AddProductInput):
    mat_idx = 5 if 'Plastic' in data.material else (1 if 'Recycled' in data.material else 3)
    ai_prediction = pcf_model.predict([[data.weight_kg, mat_idx, data.distance_km]])[0]
    footprint = round(float(ai_prediction), 2)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO cpg_skus VALUES (?,?,?,?,?,?,?,?)", 
            (data.sku, data.name, data.category, data.material, data.weight_kg, data.distance_km, footprint, "Pending AI Audit")
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="SKU already exists.")
    finally:
        conn.close()
    return {"message": "Product successfully added to database!"}


# Function: Save Bulk Products to DB from CSV
@app.post("/api/products/bulk-add")
async def bulk_add_products(data: BulkAddInput):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    added_count = 0
    
    for p in data.products:
        mat_idx = 5 if 'Plastic' in p.material else (1 if 'Recycled' in p.material else 3)
        ai_prediction = pcf_model.predict([[p.weight_kg, mat_idx, p.distance_km]])[0]
        footprint = round(float(ai_prediction), 2)
        
        try:
            cursor.execute(
                "INSERT OR IGNORE INTO cpg_skus VALUES (?,?,?,?,?,?,?,?)", 
                (p.sku, p.name, p.category, p.material, p.weight_kg, p.distance_km, footprint, "Bulk Imported")
            )
            if cursor.rowcount > 0:
                added_count += 1
        except Exception:
            pass 
            
    conn.commit()
    conn.close()
    return {"message": f"Successfully imported {added_count} new products into the database!"}


# Function: Sandbox Estimator (Does NOT save to DB)
@app.post("/ai/product-estimate")
async def ai_product_estimate(data: EstimateInput):
    mat_idx = 5 if 'Plastic' in data.material else (1 if 'Recycled' in data.material else 3)
    ai_prediction = pcf_model.predict([[data.weight, mat_idx, data.distance]])[0]
    emissions = round(float(ai_prediction), 2)
    score = max(0, min(100, int(100 - (emissions * 8))))
    cat = "Low Carbon Champion" if score > 80 else ("Eco-Conscious" if score > 50 else "High Impact Alert")
    
    return {
        "product_name": data.product_name, 
        "estimated_emissions": emissions, 
        "carbon_score": score, 
        "category": cat
    }


# Function: Product Comparison
@app.post("/ai/compare-recommend")
async def ai_compare_recommend(data: CompareInput):
    if len(data.skus) < 2: 
        raise HTTPException(status_code=400, detail="Select at least 2 SKUs.")
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    placeholders = ','.join('?' for _ in data.skus)
    rows = conn.execute(f"SELECT * FROM cpg_skus WHERE sku IN ({placeholders})", data.skus).fetchall()
    conn.close()
    
    if not rows: 
        raise HTTPException(status_code=404, detail="SKUs not found.")
    
    products = [dict(r) for r in rows]
    for p in products: 
        p['ai_score'] = max(0, min(100, int(100 - (p['footprint'] * 8))))
        
    ranked = sorted(products, key=lambda x: x['footprint'])
    
    return {
        "recommended": ranked[0], 
        "ranked_list": ranked
    }


# Function: Digital Product Passport
@app.post("/ai/generate-passport")
async def generate_passport(data: PassportInput):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM cpg_skus WHERE sku = ?", (data.sku,)).fetchone()
    conn.close()
    
    if not row: 
        raise HTTPException(status_code=404, detail="SKU not found.")
    
    product = dict(row)
    material = product['material'].lower()
    score = 10 if "plastic" in material else (95 if "paper" in material or "cardboard" in material else 80)
    
    certs = ["ISO 14040 Lifecycle Assessed"]
    if product['footprint'] < 1.0: 
        certs.append("Carbon Neutral Eligible")
    if "recycled" in material: 
        certs.append("100% Recycled Content")
    
    return { 
        "sku": product['sku'], 
        "name": product['name'], 
        "category": product['category'], 
        "base_material": product['material'], 
        "carbon_footprint": f"{product['footprint']} kg CO2e", 
        "recyclability_score": score, 
        "end_of_life_instructions": "Industrial Composting" if score > 80 else "Specialized Recycling", 
        "certifications": certs, 
        "ai_compliance_status": "Ready for EU Market" if score > 70 else "Action Required: Low Recyclability"
    }


# Function: Anomaly Detection
@app.get("/ai/anomaly-detection")
async def ai_anomaly_detection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM cpg_skus").fetchall()
    conn.close()
    
    products = [dict(r) for r in rows]
    X = [[p['weight_kg'], p['distance_km'], p['footprint']] for p in products]
    clf = IsolationForest(contamination=0.25, random_state=42)
    predictions = clf.fit_predict(X)
    
    anomalies = []
    normal_count = 0
    
    for i, pred in enumerate(predictions):
        p = products[i]
        if pred == -1: 
            if p['footprint'] > 5.0 and p['weight_kg'] < 1.0:
                reason = "Critical: Extreme carbon footprint relative to low product weight."
            elif p['distance_km'] > 1000:
                reason = "Supply Chain Alert: Excessive travel distance is inflating emissions."
            else:
                reason = "Atypical material-to-emissions ratio compared to portfolio average."
            
            anomalies.append({
                "sku": p['sku'], 
                "name": p['name'], 
                "footprint": p['footprint'], 
                "material": p['material'], 
                "explanation": reason
            })
        else: 
            normal_count += 1
            
    anomalies = sorted(anomalies, key=lambda x: x['footprint'], reverse=True)
    return {
        "total_analyzed": len(products), 
        "normal_count": normal_count, 
        "anomaly_count": len(anomalies), 
        "anomalies": anomalies
    }


# Function: AI Eco-Label 
@app.post("/ai/score-label")
async def ai_score_label(data: ScoreLabelInput):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM cpg_skus WHERE sku = ?", (data.sku,)).fetchone()
    conn.close()
    
    if not row: 
        raise HTTPException(status_code=404, detail="SKU not found.")
    
    product = dict(row)
    base_score = max(0, min(100, int(100 - (product['footprint'] * 8))))
    
    if base_score >= 90:
        grade = "A+"
        label = "Eco-Champion"
        color = "emerald"
        explanation = f"Outstanding! The use of {product['material']} combined with an ultra-low footprint ({product['footprint']}kg) makes this a market leader."
    elif base_score >= 75:
        grade = "B"
        label = "Sustainable Choice"
        color = "sky"
        explanation = f"Solid performance. This {product['category']} item has a manageable impact, but could improve by optimizing its {product['distance_km']}km route."
    elif base_score >= 50:
        grade = "C"
        label = "Average Impact"
        color = "amber"
        explanation = f"This product meets basic standards. The {product['material']} construction carries a moderate carbon cost."
    else:
        grade = "F"
        label = "Heavy Emitter"
        color = "rose"
        explanation = f"Warning: High environmental cost. The footprint of {product['footprint']}kg is excessive."
        
    return { 
        "sku": product['sku'], 
        "name": product['name'], 
        "score_100": base_score, 
        "grade": grade, 
        "eco_label": label, 
        "color_theme": color, 
        "explanation": explanation 
    }


# Function: Gemini Supplier Data Extractor
@app.post("/ai/extract-data")
async def ai_extract_data(data: ExtractInput):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key is missing. Check your .env file!")
    try:
        model = genai.GenerativeModel(GEMINI_MODEL, generation_config={"response_mime_type": "application/json"})
        prompt = f"""
        You are a strict data extraction AI. Read the messy supplier email below.
        Extract the product details and return them as a strict JSON object with these exact keys:
        - "name" (string)
        - "category" (string, e.g., 'Food', 'Beverages', 'Personal Care', 'Home Care')
        - "material" (string, must be closest match to: 'Virgin Plastic', 'Recycled Paper', 'Aluminum', 'Glass', 'Bamboo', 'Cardboard')
        - "weight_kg" (float)
        - "distance_km" (float)

        Messy Email Text:
        {data.text}
        """
        response = model.generate_content(prompt)
        return json.loads(response.text)
    except Exception as e:
        print("\n=== GEMINI ERROR DETAILS ===")
        print(str(e))
        print("============================\n")
        raise HTTPException(status_code=500, detail="Gemini Extraction Error: Check Python Terminal")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)