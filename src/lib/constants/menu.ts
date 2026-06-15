import type { MenuItem } from '../types';
import { Home, Settings, HelpCircle, Layers } from '../icons';
import { navigateTo } from '../stores/navigation';

export const MENU_ITEMS: MenuItem[] = [
  { icon: Home, label: 'Home', action: () => navigateTo('home') },
  { icon: Layers, label: 'Components', action: () => navigateTo('components') },
  { icon: Settings, label: 'Settings', action: () => navigateTo('settings') },
  { icon: HelpCircle, label: 'Help', action: () => navigateTo('help') },
];