interface SkeletonProps {
  type?: 'card' | 'table-row' | 'map' | 'chart';
  className?: string;
}

export default function Skeleton({ type = 'card', className = '' }: SkeletonProps) {
  const baseClasses = "animate-pulse bg-gray-700 rounded";

  if (type === 'table-row') {
    return (
      <div className={`flex gap-4 p-4 border-b border-gray-800 ${className}`}>
        <div className={`${baseClasses} h-6 w-1/4`}></div>
        <div className={`${baseClasses} h-6 w-1/4`}></div>
        <div className={`${baseClasses} h-6 w-1/4`}></div>
        <div className={`${baseClasses} h-6 w-1/4`}></div>
      </div>
    );
  }

  if (type === 'map') {
    return (
      <div className={`${baseClasses} w-full h-[350px] flex items-center justify-center ${className}`}>
        <span className="text-gray-500">Loading map...</span>
      </div>
    );
  }
  
  if (type === 'chart') {
    return <div className={`${baseClasses} w-full h-[300px] ${className}`}></div>;
  }

  // Default 'card' skeleton
  return (
    <div className={`p-4 border border-gray-800 bg-gray-800/50 rounded-lg ${className}`}>
      <div className={`${baseClasses} h-6 w-3/4 mb-4`}></div>
      <div className={`${baseClasses} h-4 w-full mb-2`}></div>
      <div className={`${baseClasses} h-4 w-5/6 mb-4`}></div>
      <div className="flex justify-between mt-4">
         <div className={`${baseClasses} h-8 w-20`}></div>
         <div className={`${baseClasses} h-8 w-20`}></div>
      </div>
    </div>
  );
}