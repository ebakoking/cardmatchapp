declare module '@expo/vector-icons' {
  import { Component } from 'react';
  export const Ionicons: React.ComponentType<{
    name: string;
    size?: number;
    color?: string;
    style?: object;
  }>;
  export const MaterialIcons: React.ComponentType<{ name: string; size?: number; color?: string; style?: object }>;
  export const FontAwesome: React.ComponentType<{ name: string; size?: number; color?: string; style?: object }>;
  export const MaterialCommunityIcons: React.ComponentType<{ name: string; size?: number; color?: string; style?: object }>;
  // Diğer ikon setleri gerekirse eklenebilir
}
