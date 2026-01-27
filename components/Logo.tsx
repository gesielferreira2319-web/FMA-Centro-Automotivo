import React from 'react';
import logoFma from '../assets/logo-fma.jpg';

export const Logo = ({ className = "" }: { className?: string }) => (
  <img
    src={logoFma}
    alt="FMA Centro Automotivo Logo"
    className={`object-contain ${className}`}
  />
);