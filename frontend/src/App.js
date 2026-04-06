import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Zap, Leaf, Scale, Award, Box, BookOpen, 
  CheckCircle, Info, Activity, AlertTriangle, Tag, Wand2, 
  Save, UploadCloud, Database, Calculator, LayoutGrid, List 
} from 'lucide-react';

import { Card, Title, DonutChart, BarChart } from '@tremor/react';
import axios from 'axios';

// Update this to your local or deployed backend URL as needed
// const API_BASE = 'http://127.0.0.1:8000';
// const API_BASE = 'https://envirozone-backend.onrender.com';
// const API_BASE = 'http://127.0.0.1:8000';
const API_BASE = 'https://envirozone-backend.onrender.com'; // Use your actual backend Render URL here

const App = () => {
  const [skus, setSkus] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); 
  
  // 1. Dashboard States (Portfolio & Data Management)
  const [addMethod, setAddMethod] = useState('single'); 
  const [portfolioView, setPortfolioView] = useState('cards'); 
  const [addFormData, setAddFormData] = useState({ 
    sku: '', 
    product_name: '', 
    category: 'Personal Care', 
    material: 'Virgin Plastic', 
    weight: '', 
    distance: '' 
  });
  const [addSuccess, setAddSuccess] = useState('');

  // 2. Simulator & Eco-Label States (Combined Screen)
  const [estFormData, setEstFormData] = useState({ 
    product_name: '', 
    material: 'Virgin Plastic', 
    weight: '', 
    distance: '' 
  });
  const [estimateResult, setEstimateResult] = useState(null);
  const [loadingEst, setLoadingEst] = useState(false);
  
  const [labelSku, setLabelSku] = useState('');
  const [labelData, setLabelData] = useState(null);
  const [loadingLabel, setLoadingLabel] = useState(false);
  
  // 3. Compare states
  const [selectedSkus, setSelectedSkus] = useState([]);
  const [compareResult, setCompareResult] = useState(null);
  const [loadingComp, setLoadingComp] = useState(false);
  
  // 4. Passport states
  const [passportSku, setPassportSku] = useState('');
  const [passportData, setPassportData] = useState(null);
  const [loadingPass, setLoadingPass] = useState(false);
  
  // 5. Anomalies states
  const [anomalyData, setAnomalyData] = useState(null);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);

  // 6. Data Extractor states
  const [messyText, setMessyText] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [saveExtractSuccess, setSaveExtractSuccess] = useState(false);

  // --- Initial Data Fetch ---
  const fetchProducts = () => {
    axios.get(`${API_BASE}/api/products`)
      .then(res => setSkus(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // --- Dynamically calculate data for our Charts based on Live Database ---
  const materialData = Object.entries(
    skus.reduce((acc, sku) => {
      acc[sku.material] = (acc[sku.material] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const uniqueCategories = [...new Set(skus.map(sku => sku.category))];
  const pivotedCategoryData = [{ name: "Averages" }];
  
  const categoryStats = skus.reduce((acc, sku) => {
    if (!acc[sku.category]) acc[sku.category] = { sum: 0, count: 0 };
    acc[sku.category].sum += sku.footprint;
    acc[sku.category].count += 1;
    return acc;
  }, {});

  Object.entries(categoryStats).forEach(([cat, stats]) => {
    pivotedCategoryData[0][cat] = parseFloat((stats.sum / stats.count).toFixed(2));
  });


  // --- Handlers: Dashboard (Data Management & Add to Portfolio) ---
  const handleAddInputChange = (e) => {
    setAddFormData({ ...addFormData, [e.target.name]: e.target.value });
  };

  const handleSaveSingleToPortfolio = async (e) => {
    e.preventDefault();
    setAddSuccess('');
    try {
      await axios.post(`${API_BASE}/api/products/add`, {
        sku: addFormData.sku || `SKU-${Math.floor(Math.random() * 9000)}`,
        name: addFormData.product_name || "Custom Product",
        category: addFormData.category,
        material: addFormData.material,
        weight_kg: parseFloat(addFormData.weight) || 0,
        distance_km: parseFloat(addFormData.distance) || 0
      });
      setAddSuccess("Successfully saved SKU to the Database!");
      setAddFormData({ 
        sku: '', 
        product_name: '', 
        category: 'Personal Care', 
        material: 'Virgin Plastic', 
        weight: '', 
        distance: '' 
      }); 
      fetchProducts(); 
    } catch(err) {
      setAddSuccess("Error: Failed to save. SKU ID might already exist.");
    }
  };

  const handleBulkCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAddSuccess('');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(l => l.trim() !== '');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const parsedProducts = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === headers.length) {
           const rowData = {};
           headers.forEach((h, idx) => { rowData[h] = values[idx]; });
           
           parsedProducts.push({
             sku: rowData.sku || `SKU-BLK-${Math.floor(Math.random()*10000)}`,
             name: rowData.name || 'Unknown Item',
             category: rowData.category || 'Other',
             material: rowData.material || 'Virgin Plastic',
             weight_kg: parseFloat(rowData.weight_kg) || 0,
             distance_km: parseFloat(rowData.distance_km) || 0
           });
        }
      }
      
      try {
         const res = await axios.post(`${API_BASE}/api/products/bulk-add`, { products: parsedProducts });
         setAddSuccess(res.data.message);
         fetchProducts(); 
      } catch (err) {
         setAddSuccess("Error sending bulk data to server. Check CSV format.");
      }
    };
    reader.readAsText(file);
  };

  // --- Handlers: AI Simulator & Eco-Label (Combined Screen) ---
  const handleEstInputChange = (e) => {
    setEstFormData({ ...estFormData, [e.target.name]: e.target.value });
  };
  
  const runAIEstimator = async (e) => { 
    e.preventDefault(); 
    setLoadingEst(true); 
    try { 
      const res = await axios.post(`${API_BASE}/ai/product-estimate`, { 
        ...estFormData, 
        weight: parseFloat(estFormData.weight) || 0, 
        distance: parseFloat(estFormData.distance) || 0 
      }); 
      setEstimateResult(res.data); 
    } finally { 
      setLoadingEst(false); 
    } 
  };

  const generateEcoLabel = async () => { 
    if (!labelSku) return; 
    setLoadingLabel(true); 
    setLabelData(null); 
    try { 
      const res = await axios.post(`${API_BASE}/ai/score-label`, { sku: labelSku }); 
      setLabelData(res.data); 
    } finally { 
      setLoadingLabel(false); 
    } 
  };
  
  // --- Handlers: Other Tools ---
  const toggleSkuSelection = (skuId) => {
    if (selectedSkus.includes(skuId)) {
      setSelectedSkus(selectedSkus.filter(id => id !== skuId));
    } else {
      setSelectedSkus([...selectedSkus, skuId]);
    }
  };

  const runAICompare = async () => { 
    if (selectedSkus.length < 2) return; 
    setLoadingComp(true); 
    try { 
      const res = await axios.post(`${API_BASE}/ai/compare-recommend`, { skus: selectedSkus }); 
      setCompareResult(res.data); 
    } finally { 
      setLoadingComp(false); 
    } 
  };

  const generatePassport = async () => { 
    if (!passportSku) return; 
    setLoadingPass(true); 
    setPassportData(null); 
    try { 
      const res = await axios.post(`${API_BASE}/ai/generate-passport`, { sku: passportSku }); 
      setPassportData(res.data); 
    } finally { 
      setLoadingPass(false); 
    } 
  };

  const runAnomalyAudit = async () => { 
    setLoadingAnomalies(true); 
    try { 
      const res = await axios.get(`${API_BASE}/ai/anomaly-detection`); 
      setAnomalyData(res.data); 
    } finally { 
      setLoadingAnomalies(false); 
    } 
  };

  const handleExtractData = async () => { 
    if (!messyText) return; 
    setLoadingExtract(true); 
    setExtractError(null); 
    setExtractedData(null); 
    setSaveExtractSuccess(false); 
    try { 
      const res = await axios.post(`${API_BASE}/ai/extract-data`, { text: messyText }); 
      setExtractedData({ ...res.data, sku: `SKU-${Math.floor(Math.random() * 1000)}` }); 
    } catch (err) { 
      setExtractError(err.response?.data?.detail || "Extraction Failed. Check Python Terminal."); 
    } finally { 
      setLoadingExtract(false); 
    } 
  };

  const handleSaveExtractedData = async () => { 
    try { 
      await axios.post(`${API_BASE}/api/products/add`, extractedData); 
      setSaveExtractSuccess(true); 
      fetchProducts(); 
    } catch (err) { 
      setExtractError("Failed to save to database. SKU might already exist."); 
    } 
  };

  return (
    <div className="flex h-screen bg-[#F7F7F5] text-slate-900 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-80 bg-slate-950 text-white p-8 shadow-2xl z-10 flex flex-col">
        
        {/* NEW CUSTOM BRANDING LOGO & TEXT */}
        <div className="flex items-center gap-4 mb-10 flex-shrink-0">
          <div className="relative flex items-center justify-center w-12 h-14">
            {/* Outer Blue Glow */}
            {/* <div className="absolute inset-0 bg-blue-600 blur-[12px] opacity-60 rounded-full"></div> */}
            
            {/* Shield Base */}
            {/* <svg viewBox="0 0 24 24" className="relative z-10 w-full h-full text-[#0a1930] fill-current drop-shadow-md">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg> */}
            
            {/* White Geometric Shape */}
            {/* <svg viewBox="0 0 24 24" className="absolute z-20 w-7 h-7 text-white opacity-90" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <line x1="12" y1="22" x2="12" y2="15.5" />
              <polyline points="22 8.5 12 15.5 2 8.5" />
              <polyline points="2 15.5 12 8.5 22 15.5" />
              <line x1="12" y1="2" x2="12" y2="8.5" />
            </svg> */}
          </div>
          {/* <div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-none">
              TCS Envirozone<sup className="text-[10px] font-black uppercase ml-0.5">AI</sup> 4.0
            </h1>
          </div> */}
        </div>
        
        <nav className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`w-full flex items-center p-4 rounded-xl gap-3 font-medium transition-all duration-200 ${activeTab === 'dashboard' ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Database size={18}/> 
            SKU Registry
          </button>
          
          <button 
            onClick={() => setActiveTab('simulator')} 
            className={`w-full flex items-center p-4 rounded-xl gap-3 font-medium transition-all duration-200 ${activeTab === 'simulator' ? 'bg-emerald-600 shadow-lg text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Calculator size={18}/> 
            AI Simulator and Eco-Label
          </button>

          <button 
            onClick={() => setActiveTab('compare')} 
            className={`w-full flex items-center p-4 rounded-xl gap-3 font-medium transition-all duration-200 ${activeTab === 'compare' ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Scale size={18}/> 
            Compare Products
          </button>
          
          <button 
            onClick={() => setActiveTab('passport')} 
            className={`w-full flex items-center p-4 rounded-xl gap-3 font-medium transition-all duration-200 ${activeTab === 'passport' ? 'bg-sky-600 shadow-lg text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <BookOpen size={18}/> 
            Digital Passport
          </button>
          
          <button 
            onClick={() => setActiveTab('insights')} 
            className={`w-full flex items-center p-4 rounded-xl gap-3 font-medium transition-all duration-200 ${activeTab === 'insights' ? 'bg-rose-600 shadow-lg text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Activity size={18}/> 
            AI Insights & Audit
          </button>
          
          <div className="my-6 border-t border-slate-800"></div>

          <button 
            onClick={() => setActiveTab('extractor')} 
            className={`w-full flex items-center p-4 rounded-xl gap-3 font-medium transition-all duration-200 ${activeTab === 'extractor' ? 'bg-violet-600 shadow-lg text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Wand2 size={18}/> 
            Data Extractor
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-12 overflow-y-auto relative">
        
        {/* ======================= SCREEN 1: DASHBOARD (Portfolio & Entry) ======================= */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <h2 className="text-3xl font-black tracking-tight">Portfolio & Data Management</h2>
              <p className="text-slate-500 mt-1">Manage your active SKUs and append new products to your sustainability database.</p>
            </header>
            
            <Card className="mb-12 p-10 rounded-[40px] border-none shadow-sm bg-white ring-1 ring-slate-100">
              <div className="flex justify-between items-center mb-8">
                <Title className="text-2xl font-black flex items-center gap-2">
                  <Database className="text-indigo-500"/> Append to Database
                </Title>
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                  <button 
                    onClick={() => {setAddMethod('single'); setAddSuccess('');}} 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${addMethod === 'single' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Single Manual Entry
                  </button>
                  <button 
                    onClick={() => {setAddMethod('bulk'); setAddSuccess('');}} 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${addMethod === 'bulk' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Bulk CSV Upload
                  </button>
                </div>
              </div>

              {addSuccess && (
                <div className={`p-4 mb-8 rounded-xl font-bold border ${addSuccess.includes('Error') ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {addSuccess}
                </div>
              )}

              {/* SINGLE MANUAL ENTRY WITH BLACK STYLING */}
              {addMethod === 'single' && (
                <div className="animate-in fade-in duration-300 max-w-4xl">
                  <form onSubmit={handleSaveSingleToPortfolio} className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 lg:col-span-1">
                      <label className="text-xs font-bold text-black uppercase tracking-widest mb-2 block">SKU Identifier</label>
                      <input 
                        name="sku" 
                        value={addFormData.sku} 
                        onChange={handleAddInputChange} 
                        placeholder="Leave blank to auto-generate" 
                        className="w-full p-4 bg-slate-50 rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                      />
                    </div>
                    <div className="col-span-2 lg:col-span-1">
                      <label className="text-xs font-bold text-black uppercase tracking-widest mb-2 block">Product Name</label>
                      <input 
                        name="product_name" 
                        value={addFormData.product_name} 
                        onChange={handleAddInputChange} 
                        placeholder="Product Name" 
                        required 
                        className="w-full p-4 bg-slate-50 rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                      />
                    </div>
                    
                    <div className="col-span-2 lg:col-span-1">
                      <label className="text-xs font-bold text-black uppercase tracking-widest mb-2 block">Category</label>
                      <select 
                        name="category" 
                        value={addFormData.category} 
                        onChange={handleAddInputChange} 
                        className="w-full p-4 bg-slate-50 rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option>Personal Care</option>
                        <option>Beverages</option>
                        <option>Food</option>
                        <option>Home Care</option>
                      </select>
                    </div>
                    <div className="col-span-2 lg:col-span-1">
                      <label className="text-xs font-bold text-black uppercase tracking-widest mb-2 block">Primary Material</label>
                      <select 
                        name="material" 
                        value={addFormData.material} 
                        onChange={handleAddInputChange} 
                        className="w-full p-4 bg-slate-50 rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option>Virgin Plastic</option>
                        <option>Recycled Paper</option>
                        <option>Aluminum</option>
                        <option>Glass</option>
                        <option>Bamboo</option>
                      </select>
                    </div>
                    
                    <div className="col-span-2 lg:col-span-1">
                      <label className="text-xs font-bold text-black uppercase tracking-widest mb-2 block">Weight (kg)</label>
                      <input 
                        name="weight" 
                        type="number" 
                        step="0.01" 
                        value={addFormData.weight} 
                        onChange={handleAddInputChange} 
                        placeholder="0.00" 
                        required 
                        className="w-full p-4 bg-slate-50 rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                      />
                    </div>
                    <div className="col-span-2 lg:col-span-1">
                      <label className="text-xs font-bold text-black uppercase tracking-widest mb-2 block">Supply Distance (km)</label>
                      <input 
                        name="distance" 
                        type="number" 
                        value={addFormData.distance} 
                        onChange={handleAddInputChange} 
                        placeholder="0.00" 
                        required 
                        className="w-full p-4 bg-slate-50 rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                      />
                    </div>
                    
                    <button 
                      type="submit" 
                      className="col-span-2 mt-4 bg-black text-white p-5 rounded-2xl font-bold hover:bg-slate-800 transition-colors shadow-xl flex justify-center items-center gap-2"
                    >
                      <Save size={20} /> Save New Product to Database
                    </button>
                  </form>
                </div>
              )}

              {/* BULK CSV UPLOAD WITH BLACK STYLING */}
              {addMethod === 'bulk' && (
                <div className="p-12 border-2 border-dashed border-slate-300 rounded-[32px] text-center bg-slate-50 hover:bg-slate-100 transition-colors animate-in fade-in duration-300">
                  <UploadCloud className="mx-auto text-indigo-500 w-16 h-16 mb-4" />
                  <h3 className="font-bold text-2xl mb-2 text-slate-800">Upload CSV File</h3>
                  <p className="text-slate-500 mb-8 max-w-md mx-auto">
                    Your CSV must contain the following exact column headers (lowercase): <br/><br/>
                    <code className="bg-white px-2 py-1 rounded-md shadow-sm text-black font-bold border border-slate-200">
                      sku, name, category, material, weight_kg, distance_km
                    </code>
                  </p>
                  <div className="flex justify-center">
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleBulkCSVUpload} 
                      className="block text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-black file:text-white hover:file:bg-slate-800 cursor-pointer transition-all shadow-md" 
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* The Live Portfolio Header with Toggle */}
            <div className="flex justify-between items-center mb-6">
              <Title className="text-lg font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Box size={20}/> Existing Portfolio ({skus.length} Items)
              </Title>
              <div className="bg-slate-200 p-1 rounded-xl flex gap-1">
                <button 
                  onClick={() => setPortfolioView('cards')} 
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${portfolioView === 'cards' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <LayoutGrid size={16}/> Cards
                </button>
                <button 
                  onClick={() => setPortfolioView('table')} 
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${portfolioView === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <List size={16}/> Table
                </button>
              </div>
            </div>
            
            {/* PORTFOLIO: CARD VIEW */}
            {portfolioView === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12 animate-in fade-in duration-300">
                {skus.map(s => (
                  <Card 
                    key={s.sku} 
                    className="p-7 rounded-[32px] border-none shadow-sm bg-white ring-1 ring-slate-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                        {s.sku}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${s.status.includes('Verified')?'bg-emerald-50 text-emerald-600': s.status.includes('Risk')?'bg-rose-50 text-rose-600':'bg-amber-50 text-amber-600'}`}>
                        {s.status}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-1">{s.name}</h3>
                    <p className="text-sm text-slate-400 mb-6">{s.material}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-slate-900">{s.footprint}</span>
                      <span className="text-xs font-bold text-slate-400">kg CO2e</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* PORTFOLIO: TABLE VIEW */}
            {portfolioView === 'table' && (
              <div className="bg-white ring-1 ring-slate-200 rounded-[32px] overflow-hidden mb-12 shadow-sm animate-in fade-in duration-300">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-widest text-slate-400">
                        <th className="p-5 font-bold">SKU ID</th>
                        <th className="p-5 font-bold">Product Name</th>
                        <th className="p-5 font-bold">Category</th>
                        <th className="p-5 font-bold">Material</th>
                        <th className="p-5 font-bold">Weight (kg)</th>
                        <th className="p-5 font-bold">Distance (km)</th>
                        <th className="p-5 font-bold">Footprint (CO2e)</th>
                        <th className="p-5 font-bold">Audit Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {skus.map(s => (
                        <tr key={s.sku} className="hover:bg-slate-50 transition-colors">
                          <td className="p-5 text-sm font-bold text-slate-900 whitespace-nowrap">{s.sku}</td>
                          <td className="p-5 text-sm font-bold text-slate-700 whitespace-nowrap">{s.name}</td>
                          <td className="p-5 text-sm text-slate-500 whitespace-nowrap">{s.category}</td>
                          <td className="p-5 text-sm text-slate-500 whitespace-nowrap">{s.material}</td>
                          <td className="p-5 text-sm text-slate-500 whitespace-nowrap">{s.weight_kg}</td>
                          <td className="p-5 text-sm text-slate-500 whitespace-nowrap">{s.distance_km}</td>
                          <td className="p-5 text-sm font-black text-slate-900 whitespace-nowrap">{s.footprint}</td>
                          <td className="p-5 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${s.status.includes('Verified')?'bg-emerald-50 text-emerald-600': s.status.includes('Risk')?'bg-rose-50 text-rose-600':'bg-amber-50 text-amber-600'}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= SCREEN 2: COMBINED SIMULATOR AND ECO-LABEL ======================= */}
        {activeTab === 'simulator' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <h2 className="text-3xl font-black tracking-tight">AI Footprint Simulator and Eco-Label</h2>
              <p className="text-slate-500 mt-1">Test hypothetical product parameters and generate official AI score badges.</p>
            </header>
            
            {/* PART A: SIMULATOR */}
            <Card className="p-10 rounded-[40px] border-none shadow-sm bg-emerald-50/30 ring-1 ring-emerald-100 mb-8">
              <Title className="text-2xl font-black mb-8 flex items-center gap-2">
                <Calculator className="text-emerald-500"/> AI Sandbox Estimator
              </Title>
              <div className="flex gap-10 items-start">
                <form onSubmit={runAIEstimator} className="flex-1 grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <input 
                      name="product_name" 
                      value={estFormData.product_name} 
                      onChange={handleEstInputChange} 
                      placeholder="Hypothetical Product Name" 
                      required 
                      className="w-full p-4 bg-white rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>
                  <select 
                    name="material" 
                    value={estFormData.material} 
                    onChange={handleEstInputChange} 
                    className="p-4 bg-white rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option>Virgin Plastic</option>
                    <option>Recycled Paper</option>
                    <option>Aluminum</option>
                    <option>Glass</option>
                    <option>Bamboo</option>
                  </select>
                  <input 
                    name="weight" 
                    type="number" 
                    step="0.01" 
                    value={estFormData.weight} 
                    onChange={handleEstInputChange} 
                    placeholder="Weight (kg)" 
                    required 
                    className="p-4 bg-white rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                  <input 
                    name="distance" 
                    type="number" 
                    value={estFormData.distance} 
                    onChange={handleEstInputChange} 
                    placeholder="Distance (km)" 
                    required 
                    className="p-4 bg-white rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                  
                  <button 
                    type="submit" 
                    disabled={loadingEst} 
                    className="col-span-2 mt-2 bg-slate-900 text-white p-5 rounded-2xl font-bold hover:bg-emerald-600 transition-colors shadow-xl disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    <Zap size={20} /> {loadingEst ? 'Running Simulation...' : 'Simulate AI Footprint'}
                  </button>
                </form>
                
                {estimateResult && (
                  <div className={`w-80 p-8 rounded-[32px] text-white shadow-2xl animate-in zoom-in-95 duration-300 ${estimateResult.carbon_score > 50 ? 'bg-emerald-600' : 'bg-rose-500'}`}>
                    <p className="text-xs font-bold uppercase opacity-80 mb-2">Simulated Score</p>
                    <div className="text-6xl font-black mb-6">
                      {estimateResult.carbon_score}<span className="text-2xl opacity-50">/100</span>
                    </div>
                    <div className="bg-white/20 px-4 py-2 rounded-full inline-block font-bold text-sm mb-4">
                      {estimateResult.category}
                    </div>
                    <div className="border-t border-white/20 pt-4 mt-2">
                      <p className="text-xs font-bold uppercase opacity-80">Predicted Footprint</p>
                      <p className="text-3xl font-black">
                        {estimateResult.estimated_emissions} <span className="text-sm opacity-80">kg</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* PART B: ECO-LABEL GENERATOR */}
            <Card className="p-10 rounded-[40px] border-none shadow-sm bg-amber-50/50 ring-1 ring-amber-100 transition-all duration-500 ease-in-out">
              <Title className="text-2xl font-black mb-8 flex items-center gap-2">
                <Tag className="text-amber-500"/> AI Eco-Label Badge
              </Title>
              <div className="flex gap-4 items-center mb-8">
                <select 
                  value={labelSku} 
                  onChange={(e) => setLabelSku(e.target.value)} 
                  className="p-4 bg-white rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-amber-500 min-w-[300px]"
                >
                  <option value="" disabled>Select a product from portfolio...</option>
                  {skus.map(s => <option key={s.sku} value={s.sku}>{s.name}</option>)}
                </select>
                <button 
                  onClick={generateEcoLabel} 
                  disabled={loadingLabel} 
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-amber-500 hover:text-slate-900 shadow-xl disabled:opacity-50 transition-all"
                >
                  {loadingLabel ? 'Grading...' : 'Generate Eco-Score Badge'}
                </button>
              </div>
              
              {labelData && (
                <div className="mt-12 flex items-center justify-center animate-in zoom-in-95 duration-500">
                  <div className="bg-white p-10 rounded-[40px] shadow-2xl ring-1 ring-slate-200 max-w-lg w-full text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-full h-4 ${labelData.color_theme === 'emerald' ? 'bg-emerald-500' : labelData.color_theme === 'sky' ? 'bg-sky-500' : labelData.color_theme === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                    
                    <div className="text-center mb-8">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Official AI Rating</p>
                      <h3 className="text-2xl font-black text-slate-900">{labelData.name}</h3>
                      <p className="text-sm text-slate-500">{labelData.sku}</p>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center mb-8">
                      <div className={`w-32 h-32 rounded-full flex items-center justify-center shadow-inner mb-4 border-4 ${labelData.color_theme === 'emerald' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : labelData.color_theme === 'sky' ? 'bg-sky-50 border-sky-500 text-sky-600' : labelData.color_theme === 'amber' ? 'bg-amber-50 border-amber-500 text-amber-600' : 'bg-rose-50 border-rose-500 text-rose-600'}`}>
                        <span className="text-7xl font-black">{labelData.grade}</span>
                      </div>
                      <div className={`px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest text-white shadow-md ${labelData.color_theme === 'emerald' ? 'bg-emerald-500' : labelData.color_theme === 'sky' ? 'bg-sky-500' : labelData.color_theme === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`}>
                        {labelData.eco_label}
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="w-4 h-4 text-slate-400" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Score Justification ({labelData.score_100}/100)</p>
                      </div>
                      <p className="text-slate-700 font-medium leading-relaxed">{labelData.explanation}</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ======================= SCREEN 3: COMPARE ======================= */}
        {activeTab === 'compare' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <h2 className="text-3xl font-black tracking-tight">AI Product Comparison</h2>
            </header>
            
            <Card className="p-10 rounded-[40px] border-none shadow-sm bg-indigo-50/50 ring-1 ring-indigo-100 transition-all duration-500 ease-in-out">
              <Title className="text-2xl font-black mb-6 flex items-center gap-2">
                <Scale className="text-indigo-500"/> Select SKUs to Compare
              </Title>
              
              <div className="flex flex-wrap gap-3 mb-8">
                {skus.map(s => (
                  <button 
                    key={s.sku} 
                    onClick={() => toggleSkuSelection(s.sku)} 
                    className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${selectedSkus.includes(s.sku) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={runAICompare} 
                disabled={loadingComp || selectedSkus.length < 2} 
                className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl disabled:opacity-50 transition-all"
              >
                {loadingComp ? 'Comparing Data...' : `Run AI Comparison on ${selectedSkus.length} Items`}
              </button>
              
              {compareResult && (
                <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="lg:col-span-1 bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[32px] text-white shadow-xl h-fit">
                    <div className="flex items-center gap-2 text-yellow-300 mb-4">
                      <Award size={24} /> 
                      <span className="font-bold uppercase tracking-widest text-xs">AI Top Pick</span>
                    </div>
                    <h3 className="text-3xl font-black mb-1">{compareResult.recommended.name}</h3>
                    <div className="bg-white/20 p-5 rounded-2xl mt-6">
                      <p className="text-sm uppercase opacity-80 font-bold">Lowest Footprint</p>
                      <p className="text-5xl font-black mt-1">
                        {compareResult.recommended.footprint} <span className="text-lg opacity-80">kg</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-sm ring-1 ring-slate-100">
                    <h4 className="text-lg font-bold text-slate-400 uppercase tracking-widest mb-6">Full Ranking</h4>
                    <div className="space-y-4">
                      {compareResult.ranked_list.map((item, idx) => (
                        <div key={item.sku} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${idx === 0 ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200' : 'bg-slate-200 text-slate-600'}`}>
                              #{idx + 1}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-lg">{item.name}</p>
                            </div>
                          </div>
                          <p className="font-black text-2xl text-slate-900">
                            {item.footprint} <span className="text-sm font-medium text-slate-500">kg</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ======================= SCREEN 4: PASSPORT ======================= */}
        {activeTab === 'passport' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <h2 className="text-3xl font-black tracking-tight">AI Digital Product Passport</h2>
            </header>
            
            <Card className="p-10 rounded-[40px] border-none shadow-sm bg-sky-50/50 ring-1 ring-sky-100 transition-all duration-500 ease-in-out">
              <div className="flex gap-4 items-center mb-8">
                <select 
                  value={passportSku} 
                  onChange={(e) => setPassportSku(e.target.value)} 
                  className="p-4 bg-white rounded-2xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-sky-500 min-w-[300px]"
                >
                  <option value="" disabled>Select a product...</option>
                  {skus.map(s => <option key={s.sku} value={s.sku}>{s.name}</option>)}
                </select>
                <button 
                  onClick={generatePassport} 
                  disabled={loadingPass} 
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-sky-600 shadow-xl disabled:opacity-50 transition-all"
                >
                  {loadingPass ? 'Enriching...' : 'Generate Official Passport'}
                </button>
              </div>
              
              {passportData && (
                <div className="mt-8 bg-white p-12 rounded-[32px] shadow-lg ring-1 ring-slate-200 border-t-8 border-t-sky-500 relative overflow-hidden">
                  <BookOpen className="absolute -bottom-10 -right-10 w-64 h-64 text-slate-50 opacity-50" />
                  
                  <div className="flex justify-between items-start mb-10 relative z-10">
                    <div>
                      <p className="text-sm font-bold text-sky-600 uppercase tracking-widest mb-1">Digital Product Passport</p>
                      <h3 className="text-4xl font-black text-slate-900">{passportData.name}</h3>
                    </div>
                    <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold ${passportData.ai_compliance_status.includes('Ready') ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {passportData.ai_compliance_status.includes('Ready') ? <CheckCircle size={20}/> : <Info size={20}/>}
                      {passportData.ai_compliance_status}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 relative z-10">
                    <div className="space-y-6">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Base Material Composition</p>
                        <p className="text-xl font-bold text-slate-800">{passportData.base_material}</p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">End-of-Life Instructions</p>
                        <p className="text-xl font-bold text-slate-800">{passportData.end_of_life_instructions}</p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="bg-sky-50 p-6 rounded-2xl border border-sky-100 h-full">
                        <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-4">AI Recyclability Score</p>
                        <div className="flex items-end gap-2 mb-2">
                          <span className="text-6xl font-black text-slate-900">{passportData.recyclability_score}</span>
                          <span className="text-xl font-bold text-slate-400 mb-1">/ 100</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ======================= SCREEN 5: INSIGHTS & CHARTS ======================= */}
        {activeTab === 'insights' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <h2 className="text-3xl font-black tracking-tight">AI Insights & Audit</h2>
              <p className="text-slate-500 mt-1">Visualize portfolio metrics and use AI to detect supply chain anomalies.</p>
            </header>

            {/* TREMOR CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <Card className="p-8 rounded-[32px] border-none shadow-sm bg-white ring-1 ring-slate-100">
                <Title className="text-xl font-bold text-slate-800 mb-6">Material Distribution</Title>
                <DonutChart
                  className="h-64 mt-4"
                  data={materialData}
                  category="value"
                  index="name"
                  colors={["indigo", "cyan", "emerald", "amber", "rose", "fuchsia"]}
                  valueFormatter={(number) => `${number} SKUs`}
                />
              </Card>

              <Card className="p-8 rounded-[32px] border-none shadow-sm bg-white ring-1 ring-slate-100">
                <Title className="text-xl font-bold text-slate-800 mb-6">Avg Footprint by Category</Title>
                <BarChart
                  className="h-64 mt-4"
                  data={pivotedCategoryData}
                  index="name"
                  categories={uniqueCategories}
                  colors={["indigo", "amber", "emerald", "rose", "cyan", "fuchsia"]}
                  valueFormatter={(number) => `${number} kg`}
                  yAxisWidth={48}
                  showLegend={true}
                />
              </Card>
            </div>
            
            {/* EXISTING AI AUDIT SECTION */}
            <Card className="p-10 rounded-[40px] border-none shadow-sm bg-rose-50/50 ring-1 ring-rose-100 transition-all duration-500 ease-in-out">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <Title className="text-2xl font-black flex items-center gap-2">
                    <Activity className="text-rose-500"/> AI Anomaly Scan
                  </Title>
                </div>
                <button 
                  onClick={runAnomalyAudit} 
                  disabled={loadingAnomalies} 
                  className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-rose-700 shadow-xl disabled:opacity-50 transition-all"
                >
                  {loadingAnomalies ? 'Scanning Database...' : 'Run Full AI Audit'}
                </button>
              </div>
              
              {anomalyData && (
                <div className="mt-10 animate-in zoom-in-95 duration-500">
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-3xl shadow-sm ring-1 ring-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Analyzed</p>
                      <p className="text-4xl font-black text-slate-900">{anomalyData.total_analyzed}</p>
                    </div>
                    <div className="bg-emerald-50 p-6 rounded-3xl shadow-sm ring-1 ring-emerald-100">
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Normal Products</p>
                      <p className="text-4xl font-black text-emerald-700">{anomalyData.normal_count}</p>
                    </div>
                    <div className="bg-rose-600 p-6 rounded-3xl shadow-lg text-white">
                      <p className="text-xs font-bold text-rose-200 uppercase tracking-widest mb-2">Anomalies Detected</p>
                      <p className="text-4xl font-black">{anomalyData.anomaly_count}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white p-8 rounded-[32px] shadow-sm ring-1 ring-slate-100">
                    <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <AlertTriangle className="text-amber-500"/> Flagged Items Requiring Review
                    </h4>
                    {anomalyData.anomalies.map((item, idx) => (
                      <div 
                        key={item.sku} 
                        className="flex flex-col lg:flex-row lg:items-center justify-between p-6 bg-rose-50/50 rounded-2xl border border-rose-100 mb-4 hover:bg-rose-50 transition-colors"
                      >
                        <div className="mb-4 lg:mb-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase">Anomaly #{idx + 1}</span>
                            <span className="text-slate-400 text-sm font-medium">{item.sku}</span>
                          </div>
                          <p className="font-black text-slate-900 text-xl">{item.name}</p>
                          <p className="text-sm text-slate-500 font-medium">Material: {item.material}</p>
                        </div>
                        <div className="flex flex-col lg:items-end gap-2">
                          <p className="font-black text-2xl text-rose-600">
                            {item.footprint} <span className="text-sm font-medium opacity-80">kg CO2e</span>
                          </p>
                          <div className="bg-white px-4 py-3 rounded-xl border border-rose-100 shadow-sm max-w-sm">
                            <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-1">AI Explanation</p>
                            <p className="text-sm text-slate-700 leading-tight">{item.explanation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ======================= SCREEN 6: EXTRACTOR ======================= */}
        {activeTab === 'extractor' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <Wand2 className="text-violet-500"/> AI Supplier Data Extractor
              </h2>
              <p className="text-slate-500 mt-1">Paste messy supplier emails below. Gemini will extract the data and format it perfectly.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <Card className="p-8 rounded-[40px] border-none shadow-sm bg-white ring-1 ring-slate-200">
                <Title className="text-xl font-bold mb-4 text-slate-800">1. Paste Raw Supplier Text</Title>
                <textarea 
                  value={messyText}
                  onChange={(e) => setMessyText(e.target.value)}
                  placeholder="e.g., 'Hey team, the new Summer Body Wash is shipping out today. It uses about 300g of Virgin Plastic per bottle. We are putting it on trucks from our factory which is roughly 450 miles away...'"
                  className="w-full h-64 p-5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-violet-500 resize-none text-slate-600"
                />
                
                <button 
                  onClick={handleExtractData} 
                  disabled={loadingExtract || !messyText} 
                  className="w-full mt-6 bg-violet-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-violet-700 shadow-xl disabled:opacity-50 transition-all"
                >
                  {loadingExtract ? 'Gemini is reading...' : 'Extract Clean Data'}
                </button>
                
                {extractError && (
                  <p className="mt-4 text-rose-500 font-bold">{extractError}</p>
                )}
              </Card>

              <Card className="p-8 rounded-[40px] border-none shadow-sm bg-violet-50/50 ring-1 ring-violet-200 relative">
                <Title className="text-xl font-bold mb-4 text-violet-900">2. Review & Save to Database</Title>
                
                {!extractedData ? (
                  <div className="h-64 flex items-center justify-center border-2 border-dashed border-violet-200 rounded-3xl">
                    <p className="text-violet-400 font-medium">Extracted JSON data will appear here...</p>
                  </div>
                ) : (
                  <div className="animate-in zoom-in-95 duration-300">
                    <div className="space-y-4 mb-8">
                      <div className="bg-white p-4 rounded-xl ring-1 ring-slate-100 shadow-sm flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">SKU ID</span>
                        <span className="font-black text-slate-800">{extractedData.sku}</span>
                      </div>
                      
                      <div className="bg-white p-4 rounded-xl ring-1 ring-slate-100 shadow-sm flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Product Name</span>
                        <input 
                          className="font-bold text-slate-800 text-right outline-none bg-transparent w-1/2" 
                          value={extractedData.name} 
                          onChange={(e) => setExtractedData({...extractedData, name: e.target.value})} 
                        />
                      </div>
                      
                      <div className="bg-white p-4 rounded-xl ring-1 ring-slate-100 shadow-sm flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category</span>
                        <span className="font-bold text-slate-800">{extractedData.category}</span>
                      </div>
                      
                      <div className="bg-white p-4 rounded-xl ring-1 ring-slate-100 shadow-sm flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Material Match</span>
                        <span className="font-bold text-violet-600">{extractedData.material}</span>
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="flex-1 bg-white p-4 rounded-xl ring-1 ring-slate-100 shadow-sm">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Weight</span>
                          <span className="font-black text-xl text-slate-800">{extractedData.weight_kg} <span className="text-sm font-medium text-slate-400">kg</span></span>
                        </div>
                        <div className="flex-1 bg-white p-4 rounded-xl ring-1 ring-slate-100 shadow-sm">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Distance</span>
                          <span className="font-black text-xl text-slate-800">{extractedData.distance_km} <span className="text-sm font-medium text-slate-400">km</span></span>
                        </div>
                      </div>
                    </div>

                    {!saveExtractSuccess ? (
                      <button 
                        onClick={handleSaveExtractedData} 
                        className="w-full bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-600 shadow-xl transition-all flex justify-center items-center gap-2"
                      >
                        <Save size={20} /> Append to Portfolio Dashboard
                      </button>
                    ) : (
                      <div className="w-full bg-emerald-100 text-emerald-700 px-8 py-4 rounded-2xl font-bold flex justify-center items-center gap-2">
                        <ShieldCheck size={20} /> Successfully Saved to Database!
                      </div>
                    )}
                  </div>
                )}
              </Card>

            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;