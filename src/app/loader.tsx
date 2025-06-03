  // Beautiful loading component
  const BeautifulLoader = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="relative">
        {/* Outer spinning ring */}
        <div className="w-20 h-20 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
        
        {/* Inner pulsing circle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-black-600 rounded-full animate-pulse flex items-center justify-center">
            {/* <Shield className="w-6 h-6 text-white" /> */}
            <img src="/logo.png" alt="Authenpush Logo" className="w-10 h-10" /> 
          </div>
        </div>
        
        {/* Decorative dots */}
        <div className="absolute -inset-4">
          <div className="w-2 h-2 bg-blue-400 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full absolute bottom-0 left-1/2 transform -translate-x-1/2 animate-bounce" style={{animationDelay: '0.5s'}}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full absolute left-0 top-1/2 transform -translate-y-1/2 animate-bounce" style={{animationDelay: '1s'}}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full absolute right-0 top-1/2 transform -translate-y-1/2 animate-bounce" style={{animationDelay: '1.5s'}}></div>
        </div>
      </div>
      
      {/* Loading text with gradient */}
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Loading Verification System
        </h3>
        <p className="text-muted-foreground max-w-md">
          Initializing secure authentication and preparing your dashboard...
        </p>
        
        {/* Progress dots */}
        <div className="flex justify-center space-x-1 pt-2">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  );

  // MFA Configuration Loader
  const MfaConfigLoader = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="relative">
        {/* Main loader */}
        <div className="w-16 h-16 border-4 border-green-200 rounded-full animate-spin border-t-green-600"></div>
        
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 bg-black-600 rounded-full flex items-center justify-center animate-pulse">
            {/* <Shield className="w-5 h-5 text-white" /> */}
            <img src="/logo.png" alt="Authenpush Logo" className="w-10 h-10" /> 
          </div>
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          Configuring Secure Access
        </h3>
        <p className="text-muted-foreground text-center max-w-md">
          We're setting up secure access for your account. This may take a few moments...
        </p>
        
        {/* Animated progress bar */}
        <div className="w-64 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );


  // Exported components
  export { BeautifulLoader, MfaConfigLoader };