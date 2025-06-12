// Placeholder for settings logic
export interface DbmlRenderSettings {
  theme: string;
  showGrid: boolean;
  font: string;
  headerColor: string;
  textColor: string;
  rowAltColor: string;
  strokeColor: string;
}

export const DEFAULT_SETTINGS: DbmlRenderSettings = {
  theme: "light",
  showGrid: true,
  font: 'var(--font-text)',
  headerColor: 'var(--background-modifier-active-hover)',
  textColor: 'var(--text-normal)',
  rowAltColor: 'var(--background-secondary)',
  strokeColor: 'var(--background-modifier-border)',
}; 