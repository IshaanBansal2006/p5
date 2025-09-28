'use client';

import { useState, useEffect } from 'react';

export default function SimpleTest() {
  const [result, setResult] = useState('Loading...');

  useEffect(() => {
    const test = async () => {
      try {
        console.log('Starting simple test...');
        const response = await fetch('/api/test-redis');
        console.log('Got response:', response.status);
        const data = await response.json();
        console.log('Got data:', data);
        setResult(JSON.stringify(data, null, 2));
      } catch (error) {
        console.error('Error:', error);
        setResult('Error: ' + error.message);
      }
    };

    test();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Simple Test</h1>
      <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
        {result}
      </pre>
    </div>
  );
}
