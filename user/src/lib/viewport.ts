export type ViewportType = 'mobile' | 'tablet' | 'desktop';

export function getViewportType(width: number): ViewportType {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}
