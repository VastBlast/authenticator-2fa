import { writable, get } from 'svelte/store';

// DaisyUI theme options
export type Theme =
  | 'light'
  | 'dark'
  | 'cupcake'
  | 'bumblebee'
  | 'emerald'
  | 'corporate'
  | 'synthwave'
  | 'retro'
  | 'cyberpunk'
  | 'valentine'
  | 'halloween'
  | 'garden'
  | 'forest'
  | 'aqua'
  | 'lofi'
  | 'pastel'
  | 'fantasy'
  | 'wireframe'
  | 'black'
  | 'luxury'
  | 'dracula'
  | 'cmyk'
  | 'autumn'
  | 'business'
  | 'acid'
  | 'lemonade'
  | 'night'
  | 'coffee'
  | 'winter'
  | 'dim'
  | 'nord'
  | 'sunset';

export const AVAILABLE_THEMES: Theme[] = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
];

const STORAGE_KEY = 'svelte5-extension-theme';

// Initialize from localStorage or default to 'light'
const storedTheme = (localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
export const theme = writable<Theme>(storedTheme);

// Subscribe to save theme changes to localStorage
theme.subscribe((value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, value);
  }
});

export function initializeTheme(): void {
  const currentTheme = get(theme);
  const root = document.querySelector('div[data-theme]');
  if (root) {
    root.setAttribute('data-theme', currentTheme);
  }
}

export function setTheme(newTheme: Theme): void {
  theme.set(newTheme);
  const root = document.querySelector('div[data-theme]');
  if (root) {
    root.setAttribute('data-theme', newTheme);
  }
}

export function toggleTheme(): void {
  theme.update((current) => {
    const newTheme: Theme = current === 'light' ? 'dark' : 'light';
    const root = document.querySelector('div[data-theme]');
    if (root) {
      root.setAttribute('data-theme', newTheme);
    }
    return newTheme;
  });
}
