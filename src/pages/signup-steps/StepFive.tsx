import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../api/client';
import Button from '../../components/Button';

interface StepFiveProps {
  onPrev: () => void;
  tempToken: string | null;
}

export default function StepFive({ onPrev, tempToken }: StepFiveProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm();
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const onSubmit = async (data: any) => {
    if (!data.terms) {
      setError('root', { message: 'You must accept the terms and conditions' });
      return;
    }
    
    try {
      const response = await apiClient.post('/api/account/complete-signup', {}, {
        headers: { Authorization: `Bearer ${tempToken}` }
      });
      login(response.data.token);
      navigate('/');
    } catch (error: any) {
      setError('root', { message: 'Failed to complete signup' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white mb-4">Step 5: Complete</h2>
      
      <div className="bg-gray-700 p-4 rounded text-sm text-gray-300 mb-4">
        Please review your information. By clicking complete, you agree to our terms of service and privacy policy.
      </div>
      
      <div className="flex items-center gap-2">
        <input type="checkbox" id="terms" {...register('terms')} className="w-4 h-4" />
        <label htmlFor="terms" className="text-sm text-white">I accept the terms and conditions</label>
      </div>
      
      {errors.root && <div className="text-red-500 text-sm">{errors.root?.message?.toString()}</div>}
      
      <div className="flex gap-4 mt-4">
        <Button type="button" variant="secondary" onClick={onPrev} className="w-full">Back</Button>
        <Button type="submit" isLoading={isSubmitting} className="w-full">Complete Signup</Button>
      </div>
    </form>
  );
}