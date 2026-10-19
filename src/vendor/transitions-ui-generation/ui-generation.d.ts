export interface GenerationRun {
  finished: Promise<HTMLElement>;
  cancel(): void;
  element: HTMLElement;
}
export function generate(element: HTMLElement, options?: {
  mode?: 'skeleton' | 'skeleton-texts'; duration?: number; delay?: number;
  maxParts?: number; keys?: number; title?: string; onDone?: (element: HTMLElement) => void;
}): GenerationRun;
