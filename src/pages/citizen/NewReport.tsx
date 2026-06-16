import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import apiClient from '../../api/client';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { useNotificationStore } from '../../store/notificationStore';

export default function NewReport() {
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const navigate = useNavigate();
  const addToast = useNotificationStore((state) => state.addToast);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const nextStep = () => setStep((p) => p + 1);
  const prevStep = () => setStep((p) => p - 1);

  const onSubmit = async (data: any) => {
    if (!location) {
      addToast({ type: 'error', title: 'Location required', description: 'Please select a location on the map.' });
      return;
    }

    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('visibility', data.visibility);
    formData.append('subCategoryId', data.subCategoryId || '00000000-0000-0000-0000-000000000000'); // Assuming selected
    formData.append('latitude', location.lat.toString());
    formData.append('longitude', location.lng.toString());
    
    files.forEach((file) => formData.append('attachments', file));

    try {
      await apiClient.post('/api/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      addToast({ type: 'success', title: 'Report Submitted', description: 'Your report has been successfully submitted.' });
      navigate('/citizen/my-reports');
    } catch (error) {
      addToast({ type: 'error', title: 'Submission failed', description: 'Please try again later.' });
    }
  };

  function LocationPicker() {
    useMapEvents({
      click(e) {
        setLocation(e.latlng);
      },
    });
    return location ? <Marker position={location} /> : null;
  }

  const handleGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">Submit New Report</h1>
      
      <div className="flex mb-8 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-2 flex-1 rounded ${step >= i ? 'bg-blue-500' : 'bg-gray-700'}`} />
        ))}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-xl font-bold text-white">Step 1: Basic Info</h2>
              <Input label="Title" {...register('title', { required: true })} error={errors.title ? "Required" : ""} />
              
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-300">Description</label>
                <textarea 
                  {...register('description', { required: true })} 
                  className="bg-gray-900 border border-gray-700 rounded p-2 text-white h-32 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-300">Visibility</label>
                <select {...register('visibility')} className="bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none">
                  <option value="Public">Public</option>
                  <option value="Confidential">Confidential</option>
                  <option value="Anonymous">Anonymous</option>
                </select>
              </div>
              
              <Button type="button" onClick={nextStep} className="mt-4">Next: Location</Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Step 2: Location</h2>
                <Button type="button" variant="outline" size="sm" onClick={handleGeolocation}>Use My Location</Button>
              </div>
              <p className="text-sm text-gray-400">Click on the map to pin the exact location.</p>
              
              <div className="h-[400px] w-full rounded border border-gray-700 overflow-hidden">
                <MapContainer center={[30.0444, 31.2357]} zoom={12} className="h-full w-full z-0">
                  <TileLayer url={import.meta.env.VITE_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"} />
                  <LocationPicker />
                </MapContainer>
              </div>
              
              <div className="flex gap-4 mt-4">
                <Button type="button" variant="secondary" onClick={prevStep} className="w-full">Back</Button>
                <Button type="button" onClick={nextStep} className="w-full">Next: Attachments</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-xl font-bold text-white">Step 3: Attachments</h2>
              <p className="text-sm text-gray-400">Upload images or videos (max 10 files).</p>
              
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-10 text-center hover:border-blue-500 transition-colors">
                <input 
                  type="file" 
                  multiple 
                  onChange={(e) => setFiles(Array.from(e.target.files || []))} 
                  className="hidden" 
                  id="file-upload" 
                />
                <label htmlFor="file-upload" className="cursor-pointer text-blue-500 font-medium">
                  Click to browse files
                </label>
                <p className="text-gray-500 text-sm mt-2">
                  {files.length > 0 ? `${files.length} files selected` : "No files selected"}
                </p>
              </div>
              
              <div className="flex gap-4 mt-4">
                <Button type="button" variant="secondary" onClick={prevStep} className="w-full">Back</Button>
                <Button type="submit" isLoading={isSubmitting} className="w-full">Submit Report</Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}