
import React, { useState } from 'react';
import { UploadCloud, Smartphone, User, Wrench, FileText, CheckCircle, Loader2, Send, Undo2, AlertCircle, Search } from 'lucide-react';

export const OCRTool: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dataExtracted, setDataExtracted] = useState(false);

  // State for current form data (editable)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    device: '',
    repair: '',
    cost: ''
  });

  // State for original AI data (for undo/comparison)
  const [originalData, setOriginalData] = useState<typeof formData | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
      setFile(file);
      setProcessing(true);
      // Simulate AI Processing
      setTimeout(() => {
          const aiResult = {
              name: 'Alex Miller',
              phone: '+1 (555) 023-9482',
              device: 'Samsung Galaxy S23',
              repair: 'Screen Replacement + Battery',
              cost: '$249.99'
          };
          setProcessing(false);
          setDataExtracted(true);
          setFormData(aiResult);
          setOriginalData(aiResult);
      }, 2500);
  }

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetField = (field: keyof typeof formData) => {
      if (originalData) {
          setFormData(prev => ({ ...prev, [field]: originalData[field] }));
      }
  };

  const isDirty = (field: keyof typeof formData) => {
      return originalData && formData[field] !== originalData[field];
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">New Customer Onboarding</h1>
            <p className="text-slate-500">Upload a receipt to auto-fill details. Review and correct AI data before saving.</p>
        </div>
        {dataExtracted && (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium border border-yellow-100">
                <AlertCircle size={16} />
                <span>Please verify details below</span>
             </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Upload/Preview Area */}
        <div className="space-y-4">
            <div 
                className={`relative h-[500px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all overflow-hidden bg-slate-50
                ${dragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-300'}
                ${file && !processing ? 'border-none p-0' : ''}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                {processing ? (
                    <div className="text-center animate-pulse z-10 p-8">
                        <div className="w-20 h-20 bg-white text-brand-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <Loader2 size={40} className="animate-spin" />
                        </div>
                        <p className="text-slate-900 font-bold text-lg mb-1">Analyzing Receipt...</p>
                        <p className="text-slate-500 text-sm">GPT-4o Vision is extracting customer data</p>
                    </div>
                ) : file && dataExtracted ? (
                    <div className="relative w-full h-full group bg-slate-900">
                        {/* Simulated Receipt Preview */}
                        <img 
                            src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1000" 
                            alt="Receipt Preview" 
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-all duration-300"
                        />
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                            <div className="bg-green-500 text-white p-3 rounded-full mb-3 shadow-lg scale-90 group-hover:scale-100 transition-transform">
                                <CheckCircle size={28} />
                            </div>
                            <p className="text-white font-bold text-lg drop-shadow-md mb-4">Scan Complete</p>
                            <button 
                                onClick={() => { setFile(null); setDataExtracted(false); setOriginalData(null); }}
                                className="px-5 py-2.5 bg-white text-slate-900 rounded-lg text-sm font-semibold shadow-lg hover:bg-slate-100 transition-colors"
                            >
                                Scan New Receipt
                            </button>
                        </div>
                        
                        {/* Scan Lines Effect */}
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-brand-500/10 to-transparent translate-y-[-100%] animate-[scan_3s_ease-in-out_infinite]"></div>
                    </div>
                ) : (
                    <div className="text-center p-8">
                         <div className="w-16 h-16 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UploadCloud size={32} />
                        </div>
                        <p className="text-slate-900 font-semibold text-lg">Drag & Drop Receipt</p>
                        <p className="text-slate-500 text-sm mb-6">Supports JPG, HEIC, PNG</p>
                        <label className="cursor-pointer px-6 py-3 bg-white border border-slate-300 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors shadow-sm">
                            Browse Files
                            <input type="file" className="hidden" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
                        </label>
                    </div>
                )}
            </div>
            
            {!dataExtracted && (
                <div className="bg-blue-50 p-4 rounded-xl flex gap-3 text-blue-800 text-sm border border-blue-100">
                    <div className="shrink-0 pt-0.5"><FileText size={16}/></div>
                    <p><strong>Privacy First:</strong> Receipts are processed securely by OpenAI and are discarded immediately after extraction.</p>
                </div>
            )}
        </div>

        {/* Right: Extracted Data Form */}
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 transition-all duration-500 ${dataExtracted ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 pointer-events-none grayscale-[0.5]'}`}>
             <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-100">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dataExtracted ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Search size={20} />
                 </div>
                 <div>
                    <h2 className="text-lg font-bold text-slate-900">Customer Profile</h2>
                    <p className="text-xs text-slate-500">Editable • Review carefully</p>
                 </div>
                 {dataExtracted && <span className="ml-auto text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1"><CheckCircle size={12}/> 98% Match</span>}
             </div>

             <div className="space-y-6">
                 {/* Name Field */}
                 <div>
                     <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Customer Name</label>
                        {isDirty('name') && (
                            <button onClick={() => resetField('name')} className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1 font-medium transition-colors">
                                <Undo2 size={12} /> Reset
                            </button>
                        )}
                     </div>
                     <div className="relative group">
                        <User className={`absolute left-3 top-3 transition-colors ${isDirty('name') ? 'text-brand-500' : 'text-slate-400'}`} size={18} />
                        <input 
                            type="text" 
                            value={formData.name}
                            onChange={(e) => handleFieldChange('name', e.target.value)}
                            className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-lg outline-none transition-all text-slate-900
                                ${isDirty('name') 
                                    ? 'border-brand-300 ring-1 ring-brand-100 bg-brand-50/30' 
                                    : 'border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent group-hover:border-slate-300'
                                }`}
                            placeholder="Identify from receipt..."
                        />
                     </div>
                 </div>

                 {/* Phone Field */}
                 <div>
                     <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Phone Number</label>
                        {isDirty('phone') && (
                            <button onClick={() => resetField('phone')} className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1 font-medium transition-colors">
                                <Undo2 size={12} /> Reset
                            </button>
                        )}
                     </div>
                     <div className="relative group">
                        <Smartphone className={`absolute left-3 top-3 transition-colors ${isDirty('phone') ? 'text-brand-500' : 'text-slate-400'}`} size={18} />
                        <input 
                            type="text" 
                            value={formData.phone}
                            onChange={(e) => handleFieldChange('phone', e.target.value)}
                            className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-lg outline-none transition-all text-slate-900
                                ${isDirty('phone') 
                                    ? 'border-brand-300 ring-1 ring-brand-100 bg-brand-50/30' 
                                    : 'border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent group-hover:border-slate-300'
                                }`}
                            placeholder="+1..."
                        />
                     </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                     {/* Device Field */}
                     <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Device</label>
                            {isDirty('device') && (
                                <button onClick={() => resetField('device')} className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1 font-medium transition-colors">
                                    <Undo2 size={12} />
                                </button>
                            )}
                        </div>
                        <input 
                            type="text" 
                            value={formData.device}
                            onChange={(e) => handleFieldChange('device', e.target.value)}
                            className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg outline-none transition-all text-slate-900
                                ${isDirty('device') 
                                    ? 'border-brand-300 ring-1 ring-brand-100 bg-brand-50/30' 
                                    : 'border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent'
                                }`}
                            placeholder="Device Model"
                        />
                     </div>

                     {/* Cost Field */}
                     <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Cost</label>
                            {isDirty('cost') && (
                                <button onClick={() => resetField('cost')} className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1 font-medium transition-colors">
                                    <Undo2 size={12} />
                                </button>
                            )}
                        </div>
                        <input 
                            type="text" 
                            value={formData.cost}
                            onChange={(e) => handleFieldChange('cost', e.target.value)}
                            className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg outline-none transition-all text-slate-900
                                ${isDirty('cost') 
                                    ? 'border-brand-300 ring-1 ring-brand-100 bg-brand-50/30' 
                                    : 'border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent'
                                }`}
                            placeholder="$0.00"
                        />
                     </div>
                 </div>

                 {/* Repair Type Field */}
                 <div>
                     <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Repair Type</label>
                        {isDirty('repair') && (
                            <button onClick={() => resetField('repair')} className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1 font-medium transition-colors">
                                <Undo2 size={12} /> Reset
                            </button>
                        )}
                     </div>
                     <div className="relative group">
                        <Wrench className={`absolute left-3 top-3 transition-colors ${isDirty('repair') ? 'text-brand-500' : 'text-slate-400'}`} size={18} />
                        <input 
                            type="text" 
                            value={formData.repair}
                            onChange={(e) => handleFieldChange('repair', e.target.value)}
                            className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-lg outline-none transition-all text-slate-900
                                ${isDirty('repair') 
                                    ? 'border-brand-300 ring-1 ring-brand-100 bg-brand-50/30' 
                                    : 'border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent group-hover:border-slate-300'
                                }`}
                            placeholder="Service description..."
                        />
                     </div>
                 </div>
             </div>

             <button 
                disabled={!dataExtracted}
                className="w-full mt-8 bg-slate-900 text-white py-3.5 rounded-xl font-semibold hover:bg-brand-600 transition-all shadow-lg shadow-slate-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
             >
                 <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                 Save & Send Welcome SMS
             </button>
        </div>
      </div>
    </div>
  );
};
