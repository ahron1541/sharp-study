import { useContext } from 'react';
import { AccessibilityContext } from './accessibility-context-core';

export function useAccessibility() {
  return useContext(AccessibilityContext);
}
