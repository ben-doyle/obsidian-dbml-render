// Placeholder for settings logic
export interface DbmlRenderSettings {
  theme: string;
  showGrid: boolean;
  font: string;
  headerColor: string;
  textColor: string;
  rowAltColor: string;
  strokeColor: string;
  initialZoom: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  enableWheelZoom: boolean;
  wheelZoomRequiresModifier: boolean;
  showZoomControls: boolean;
  fitToWidthOnLoad: boolean;
}

export const DEFAULT_SETTINGS: DbmlRenderSettings = {
  theme: "light",
  showGrid: true,
  font: 'var(--font-text)',
  headerColor: 'var(--background-modifier-active-hover)',
  textColor: 'var(--text-normal)',
  rowAltColor: 'var(--background-secondary)',
  strokeColor: 'var(--background-modifier-border)',
  initialZoom: 1,
  minZoom: 0.25,
  maxZoom: 3,
  zoomStep: 0.1,
  enableWheelZoom: true,
  wheelZoomRequiresModifier: true,
  showZoomControls: true,
  fitToWidthOnLoad: true,
}; 