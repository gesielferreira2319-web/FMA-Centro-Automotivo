const fs = require('fs');
let content = fs.readFileSync('c:/Users/pc/Documents/Sistemas Clientes/fma centro automotivo/sistema/FMA-Centro-Automotivo/pages/NewServiceOrder.tsx', 'utf-8');

// 1. Add states
content = content.replace(
  'const [vehiclePhotoFile, setVehiclePhotoFile] = useState<File | null>(null);',
  `const [vehiclePhotoFile, setVehiclePhotoFile] = useState<File | null>(null);
  const [additionalVehiclePhotos, setAdditionalVehiclePhotos] = useState<string[]>([]);
  const [additionalVehiclePhotosFiles, setAdditionalVehiclePhotosFiles] = useState<File[]>([]);
  const [partPhotos, setPartPhotos] = useState<string[]>([]);
  const [partPhotosFiles, setPartPhotosFiles] = useState<File[]>([]);`
);

// 2. Load existing data
content = content.replace(
  'if (editingOrder.vehicle_photo) {\n          setVehiclePhoto(editingOrder.vehicle_photo);\n        }',
  `if (editingOrder.vehicle_photo) {
          setVehiclePhoto(editingOrder.vehicle_photo);
        }
        if (editingOrder.additional_vehicle_photos) {
          setAdditionalVehiclePhotos(editingOrder.additional_vehicle_photos);
        }
        if (editingOrder.part_photos) {
          setPartPhotos(editingOrder.part_photos);
        }`
);

// 3. handleMultiplePhotoUpload
content = content.replace(
  'const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {',
  `const handleMultiplePhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    currentPhotos: string[],
    currentFiles: File[],
    setPhotos: (photos: string[]) => void,
    setFiles: (files: File[]) => void,
    maxPhotos: number
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const availableSlots = maxPhotos - currentPhotos.length;
    const filesToAdd = files.slice(0, availableSlots);

    const newFiles = [...currentFiles, ...filesToAdd];
    setFiles(newFiles);

    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (
    index: number,
    photos: string[],
    files: File[],
    setPhotos: (p: string[]) => void,
    setFiles: (f: File[]) => void
  ) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
    
    const urlCount = photos.length - files.length;
    if (index >= urlCount) {
      const newFiles = [...files];
      newFiles.splice(index - urlCount, 1);
      setFiles(newFiles);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {`
);

// 4. handleSubmit upload logic
content = content.replace(
  '// Combinar reclamação e diagnóstico no campo service',
  `// Função auxiliar para upload múltiplo
    const uploadMultiple = async (files: File[], prefix: string): Promise<string[]> => {
      const urls: string[] = [];
      const { supabase } = await import('../lib/supabase');
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = \`\${prefix}_\${Date.now()}_\${i}.jpg\`;
        const { data, error } = await supabase.storage
          .from('vehicle-photos')
          .upload(fileName, file, { contentType: file.type });
        
        if (!error && data) {
          const { data: publicUrl } = supabase.storage.from('vehicle-photos').getPublicUrl(data.path);
          urls.push(publicUrl.publicUrl);
        }
      }
      return urls;
    };

    let finalAdditionalPhotos = additionalVehiclePhotos.filter(p => p.startsWith('http'));
    if (additionalVehiclePhotosFiles.length > 0) {
      const newUrls = await uploadMultiple(additionalVehiclePhotosFiles, 'vehicle_add');
      finalAdditionalPhotos = [...finalAdditionalPhotos, ...newUrls];
    }

    let finalPartPhotos = partPhotos.filter(p => p.startsWith('http'));
    if (partPhotosFiles.length > 0) {
      const newUrls = await uploadMultiple(partPhotosFiles, 'part');
      finalPartPhotos = [...finalPartPhotos, ...newUrls];
    }

    // Combinar reclamação e diagnóstico no campo service`
);

// 5. Add to orderData
content = content.replace(
  'vehicle_photo: photoUrl,',
  `vehicle_photo: photoUrl,
      additional_vehicle_photos: finalAdditionalPhotos.length > 0 ? finalAdditionalPhotos : null,
      part_photos: finalPartPhotos.length > 0 ? finalPartPhotos : null,`
);

// 7. Render UI for additional vehicle photos
content = content.replace(
  '<div className="grid grid-cols-2 gap-4">\n                  <div className="space-y-1">\n                    <label className="text-xs font-bold text-slate-400 uppercase">Placa *</label>',
  `<div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Mais Fotos do Veículo (Máx. 4)</label>
                    <label className="text-primary text-xs font-bold cursor-pointer hover:underline">
                      + Adicionar Foto
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                        onChange={(e) => handleMultiplePhotoUpload(e, additionalVehiclePhotos, additionalVehiclePhotosFiles, setAdditionalVehiclePhotos, setAdditionalVehiclePhotosFiles, 4)}
                      />
                    </label>
                  </div>
                  {additionalVehiclePhotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {additionalVehiclePhotos.map((photo, i) => (
                        <div key={i} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                          <img src={photo} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i, additionalVehiclePhotos, additionalVehiclePhotosFiles, setAdditionalVehiclePhotos, setAdditionalVehiclePhotosFiles)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                          >
                            <span className="material-icons-round text-[10px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Placa *</label>`
);

// 8. Render UI for Part Photos
content = content.replace(
  '<button\n                  type="button"\n                  onClick={() => setShowAddItemModal(true)}\n                  className="text-primary dark:text-blue-400 font-bold flex items-center gap-1 hover:underline bg-primary/10 px-4 py-2 rounded-lg"\n                >\n                  <span className="material-icons-round text-sm">add</span> Adicionar Item\n                </button>',
  `<div className="flex gap-2">
                  <label className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-lg cursor-pointer">
                    <span className="material-icons-round text-sm">add_a_photo</span> Fotos de Peças
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                      onChange={(e) => handleMultiplePhotoUpload(e, partPhotos, partPhotosFiles, setPartPhotos, setPartPhotosFiles, 10)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddItemModal(true)}
                    className="text-primary dark:text-blue-400 font-bold flex items-center gap-1 hover:underline bg-primary/10 px-4 py-2 rounded-lg"
                  >
                    <span className="material-icons-round text-sm">add</span> Adicionar Item
                  </button>
                </div>`
);

// 9. Display Part Photos Below Items Table
content = content.replace(
  '</div>\n              )}\n            </section>\n\n            {/* Seção 4: Pagamento */}',
  `</div>
              )}
              {partPhotos.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Fotos de Peças Anexadas ({partPhotos.length})</h4>
                  <div className="flex flex-wrap gap-3">
                    {partPhotos.map((photo, i) => (
                      <div key={i} className="relative w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img src={photo} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i, partPhotos, partPhotosFiles, setPartPhotos, setPartPhotosFiles)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                        >
                          <span className="material-icons-round text-[10px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Seção 4: Pagamento */}`
);

fs.writeFileSync('c:/Users/pc/Documents/Sistemas Clientes/fma centro automotivo/sistema/FMA-Centro-Automotivo/pages/NewServiceOrder.tsx', content);
