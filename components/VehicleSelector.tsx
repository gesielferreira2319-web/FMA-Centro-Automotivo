import React, { useState, useEffect } from 'react';
import { useVehicles, Vehicle } from '../hooks/useVehicles';

interface VehicleSelectorProps {
    clientId: string;
    onSelectVehicle: (plate: string, model: string, photo?: string) => void;
    currentPlate?: string;
}

export function VehicleSelector({ clientId, onSelectVehicle, currentPlate }: VehicleSelectorProps) {
    const { getClientVehicles, addVehicle, deleteVehicle, loading } = useVehicles();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [showForm, setShowForm] = useState(false);

    // New Vehicle Form State
    const [newVehicle, setNewVehicle] = useState({
        plate: '',
        model: '',
        color: '',
        year: '',
    });
    const [saving, setSaving] = useState(false);

    const [photoFile, setPhotoFile] = useState<File | null>(null);

    useEffect(() => {
        if (clientId) {
            loadVehicles();
        } else {
            setVehicles([]);
        }
    }, [clientId]);

    const loadVehicles = async () => {
        const data = await getClientVehicles(clientId);
        setVehicles(data);
    };

    const handleSelect = (v: Vehicle) => {
        onSelectVehicle(v.plate, v.model, (v as any).photo_url);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir este veículo?')) {
            const success = await deleteVehicle(id);
            if (success) {
                loadVehicles();
                // If the deleted vehicle was selected, user might want to clear selection, 
                // but for now we just remove it from the list.
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newVehicle.plate || !newVehicle.model) {
            alert('Placa e Modelo são obrigatórios!');
            return;
        }

        setSaving(true);
        const added = await addVehicle({
            ...newVehicle,
            client_id: clientId,
        }, photoFile); // Pass photo file
        setSaving(false);

        if (added) {
            await loadVehicles();
            onSelectVehicle(added.plate, added.model, (added as any).photo_url);
            setShowForm(false);
            setNewVehicle({ plate: '', model: '', color: '', year: '' });
            setPhotoFile(null); // Reset photo
        }
    };

    if (!clientId) return null;

    return (
        <div className="space-y-4">
            {/* List of existing vehicles */}
            {vehicles.length > 0 && (
                <div className="grid grid-cols-1 gap-2 mb-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {vehicles.map(v => (
                        <div
                            key={v.id}
                            onClick={() => handleSelect(v)}
                            className={`cursor-pointer border rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-between group ${currentPlate === v.plate
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                }`}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg text-slate-500 overflow-hidden w-12 h-12 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600">
                                    {(v as any).photo_url ? (
                                        <img src={(v as any).photo_url} alt={v.model} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-icons-round text-2xl">directions_car</span>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-800 dark:text-white truncate">{v.plate}</p>
                                    <p className="text-xs text-slate-500 truncate">{v.model} {v.color ? `• ${v.color}` : ''}</p>
                                </div>
                            </div>

                            <button
                                onClick={(e) => handleDelete(e, v.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                title="Excluir Veículo"
                            >
                                <span className="material-icons-round text-sm">delete</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Toggle Form Button */}
            {!showForm ? (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                >
                    <span className="material-icons-round">add</span>
                    Cadastrar Novo Veículo
                </button>
            ) : (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Novo Veículo</h4>
                        <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                            <span className="material-icons-round text-sm">close</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">Foto do Veículo</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                                className="w-full mt-1 text-sm text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-lg file:border-0
                                file:text-sm file:font-semibold
                                file:bg-primary file:text-white
                                hover:file:bg-primary/90 cursor-pointer"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">Placa *</label>
                            <input
                                value={newVehicle.plate}
                                onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })}
                                className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm uppercase text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                placeholder="ABC-1234"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">Modelo *</label>
                            <input
                                value={newVehicle.model}
                                onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
                                className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Ex: Fiat Uno"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">Cor</label>
                            <input
                                value={newVehicle.color}
                                onChange={e => setNewVehicle({ ...newVehicle, color: e.target.value })}
                                className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Ex: Prata"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">Ano</label>
                            <input
                                value={newVehicle.year}
                                onChange={e => setNewVehicle({ ...newVehicle, year: e.target.value })}
                                className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Ex: 2010/2011"
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="mt-4 w-full bg-primary text-white font-bold py-2 rounded-lg hover:brightness-110 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
                    >
                        {saving ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Salvando...</>
                        ) : (
                            <><span className="material-icons-round text-sm">save</span> Salvar Veículo</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
