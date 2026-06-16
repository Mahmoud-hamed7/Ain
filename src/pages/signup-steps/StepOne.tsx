import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import apiClient from '../../api/client';
import Input from '../../components/Input';
import Button from '../../components/Button';

const stepOneSchema = z.object({
  phoneNumber: z.string().regex(/^01[0125][0-9]{8}$/, 'Invalid Egyptian phone number'),
  displayName: z.string().min(3),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
  ssn: z.string().length(14, 'SSN must be exactly 14 digits'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type StepOneInputs = z.infer<typeof stepOneSchema>;

interface StepOneProps {
  onNext: () => void;
  setTempToken: (token: string) => void;
}

export default function StepOne({ onNext, setTempToken }: StepOneProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<StepOneInputs>({
    resolver: zodResolver(stepOneSchema),
  });

  const onSubmit = async (data: StepOneInputs) => {
    try {
      const response = await apiClient.post('/api/account/signup-stepOne', data);
      setTempToken(response.data.token);
      onNext();
    } catch (error: any) {
      setError('root', { message: 'Failed to complete step one. Please try again.' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white mb-4">Step 1: Basic Information</h2>
      
      <Input label="Display Name" {...register('displayName')} error={errors.displayName?.message} />
      <Input label="Phone Number" {...register('phoneNumber')} error={errors.phoneNumber?.message} />
      <Input label="National ID (14 digits)" {...register('ssn')} error={errors.ssn?.message} />
      <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />
      <Input label="Confirm Password" type="password" {...register('confirmPassword')} error={errors.confirmPassword?.message} />
      
      {errors.root && <div className="text-red-500 text-sm">{errors.root.message}</div>}
      
      <Button type="submit" isLoading={isSubmitting}>Next Step</Button>
    </form>
  );
}