'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the component, preventing Server-Side Rendering (SSR)
// This ensures p5.js (which relies on 'window') only runs in the browser.
const DynamicPlexusBackground = dynamic(
  () => import('./PlexusBackground'), // Adjust path as necessary
  { 
    ssr: false,
    // Add a simple dark fallback while the component loads on the client
    loading: () => <div className="absolute inset-0 bg-black z-0" />,
  }
);

// This component acts as a clean wrapper for use in your Home page.
const PlexusWrapper: React.FC = (props) => {
  return (
    <DynamicPlexusBackground {...props} />
  );
};

export default PlexusWrapper;