export default function LoadingSkeleton() {
  return (
    <div className="mt-6 bg-white rounded-lg shadow-md p-6 border border-gray-100 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
          <div className="h-3 bg-gray-100 rounded w-28"></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="h-3 bg-gray-100 rounded w-24 mb-2"></div>
          <div className="h-7 bg-gray-200 rounded w-32"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-100 rounded w-24 mb-2"></div>
          <div className="h-7 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
      <div className="h-3 bg-gray-100 rounded w-48 mt-4"></div>
    </div>
  );
}