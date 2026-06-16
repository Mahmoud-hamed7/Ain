import { useForm } from 'react-hook-form';
import apiClient from '../../api/client';
import Button from '../../components/Button';

interface StepFourProps {
  onNext: () => void;
  onPrev: () => void;
  tempToken: string | null;
}

export default function StepFour({ onNext, onPrev, tempToken }: StepFourProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm();

  const onSubmit = async (data: any) => {
    if (!data.profilePhoto[0]) {
      setError('root', { message: 'Profile photo is required' });
      return;
    }
    
    const formData = new FormData();
    formData.append('photo', data.profilePhoto[0]);

    try {
      await apiClient.post('/api/account/upload-profile-photo', formData, {
        headers: {
          Authorization: `Bearer ${tempToken}`,
          'Content-Type': 'multipart/form-data',
        }
      });
      onNext();
    } catch (error: any) {
      setError('root', { message: 'Upload failed' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white mb-4">Step 4: Profile Photo</h2>
      
      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-300">Upload Avatar</label>
        <input type="file" accept="image/*" {...register('profilePhoto')} className="text-white" />
      </div>
      
      {errors.root && <div className="text-red-500 text-sm">{errors.root?.message?.toString()}</div>}
      
      <div className="flex gap-4 mt-4">
        <Button type="button" variant="secondary" onClick={onPrev} className="w-full">Back</Button>
        <Button type="submit" isLoading={isSubmitting} className="w-full">Upload & Next</Button>
      </div>
    </form>
  );
}