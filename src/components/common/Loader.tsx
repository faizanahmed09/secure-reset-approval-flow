import React from 'react';

interface LoaderProps {
  text?: string;
  subtext?: string;
}

const Loader: React.FC<LoaderProps> = ({
  text,
  subtext,
}) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      <div className="relative">
        {/* Outer spinning ring */}
        <div className="w-20 h-20 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
        
        {/* Inner pulsing circle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-black-600 rounded-full animate-pulse flex items-center justify-center">
            <img src="/logo.png" alt="Authenpush Logo" className="w-10 h-10" /> 
          </div>
        </div>
        
        {/* Decorative dots */}
        {/* <div className="absolute -inset-4">
          <div className="w-2 h-2 bg-blue-400 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full absolute bottom-0 left-1/2 transform -translate-x-1/2 animate-bounce" style={{animationDelay: '0.5s'}}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full absolute left-0 top-1/2 transform -translate-y-1/2 animate-bounce" style={{animationDelay: '1s'}}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full absolute right-0 top-1/2 transform -translate-y-1/2 animate-bounce" style={{animationDelay: '1.5s'}}></div>
        </div> */}
      </div>
      
      {/* Text content centered below the loader */}
      {(text || subtext) && (
        <div className="text-center space-y-2">
          {text && <h2 className="text-xl font-semibold">{text}</h2>}
          {subtext && <p className="text-gray-600">{subtext}</p>}
        </div>
      )}
    </div>
  );
};

export default Loader; 