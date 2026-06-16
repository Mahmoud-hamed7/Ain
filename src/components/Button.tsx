import type { ButtonHTMLAttributes, ReactNode } from 'react';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

import { Loader2 } from "lucide-react"; // استيراد أيقونة اللودينج من لوكيد

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  children: React.ReactNode;
}

export default function Button({ isLoading, children, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      // قفل الزرار تلقائياً وقت اللودينج لمنع الضغط المتكرر
      disabled={disabled || isLoading} 
      className={`flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {/* إذا كان isLoading بـ true، اعرض الأيقونة وخليها تلف بكلاس animate-spin */}
      {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
      
      {children}
    </button>
  );
}

