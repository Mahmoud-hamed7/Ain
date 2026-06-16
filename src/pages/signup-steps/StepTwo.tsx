import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import apiClient from '../../api/client';
import Input from '../../components/Input';
import Button from '../../components/Button';

const stepTwoSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

type StepTwoInputs = z.infer<typeof stepTwoSchema>;

interface StepTwoProps {
  onNext: () => void;
  onPrev: () => void;
  tempToken: string | null;
}

export default function StepTwo({ onNext, onPrev, tempToken }: StepTwoProps) {
  const [timeLeft, setTimeLeft] = useState(60);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<StepTwoInputs>({
    resolver: zodResolver(stepTwoSchema),
  });

  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft]);

  const onSubmit = async (data: StepTwoInputs) => {
    try {
      await apiClient.post('/api/account/verify-otp', data, {
        headers: { Authorization: `Bearer ${tempToken}` }
      });
      onNext();
    } catch (error: any) {
      setError('root', { message: 'Invalid OTP' });
    }
  };

  const handleResend = async () => {
    try {
      await apiClient.post('/api/account/resend-otp', {}, {
        headers: { Authorization: `Bearer ${tempToken}` }
      });
      setTimeLeft(60);
    } catch (error: any) {
      setError('root', { message: 'Failed to resend OTP' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white mb-4">Step 2: Verification</h2>
      
      <Input label="6-Digit OTP" {...register('otp')} error={errors.otp?.message} maxLength={6} />
      
      {errors.root && <div className="text-red-500 text-sm">{errors.root.message}</div>}
      
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-400">Time left: {timeLeft}s</span>
        <button type="button" onClick={handleResend} disabled={timeLeft > 0} className="text-blue-500 disabled:text-gray-500">
          Resend OTP
        </button>
      </div>
      
      <div className="flex gap-4 mt-4">
        <Button type="button" variant="secondary" onClick={onPrev} className="w-full">Back</Button>
        <Button type="submit" isLoading={isSubmitting} className="w-full">Verify</Button>
      </div>
    </form>
  );
}