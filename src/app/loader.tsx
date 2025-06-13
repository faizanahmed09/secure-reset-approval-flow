import Loader from "@/components/common/Loader";

const BeautifulLoader = () => (
  <Loader text="Loading Verification System" subtext="Initializing secure authentication and preparing your dashboard..." />
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

export { BeautifulLoader, MfaConfigLoader };
export default Loader;