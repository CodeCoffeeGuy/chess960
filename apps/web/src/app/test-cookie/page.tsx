'use client';

import { useEffect, useState } from 'react';

export default function TestCookiePage() {
  const [result, setResult] = useState<any>(null);
  const [cookies, setCookies] = useState<string>('');

  useEffect(() => {
    const testCookieFlow = async () => {
      try {
        // First, make a request to the API endpoint to set cookies
        console.log('Making request to /api/auth/guest-simple...');
        const response = await fetch('/api/auth/guest-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json();
        console.log('API response:', data);
        
        // Check cookies after the API call
        const allCookies = document.cookie;
        console.log('All cookies after API call:', allCookies);
        setCookies(allCookies);
        
        // Extract auth token
        const token = allCookies.split('; ').find(row => row.startsWith('auth-token='))?.split('=')[1];
        console.log('Extracted auth token:', token);
        
        // Test token validation
        let validationResult = null;
        if (token) {
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              validationResult = {
                success: true,
                payload,
                hasUserId: !!payload.userId,
                hasType: !!payload.type,
                typeValue: payload.type
              };
            } else {
              validationResult = {
                success: false,
                error: 'Invalid JWT format',
                partsCount: parts.length
              };
            }
          } catch (error) {
            validationResult = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        } else {
          validationResult = {
            success: false,
            error: 'No token found'
          };
        }
        
        setResult({
          apiResponse: data,
          cookies: allCookies,
          token,
          validation: validationResult
        });
        
      } catch (error) {
        console.error('Error in test:', error);
        setResult({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    testCookieFlow();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Cookie Test Page</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Test Result:</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">All Cookies:</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
            {cookies || 'No cookies found'}
          </pre>
        </div>
        
        <div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}



