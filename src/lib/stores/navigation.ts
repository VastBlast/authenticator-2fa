import { writable } from 'svelte/store';

export type PageType = 'home' | 'settings' | 'help' | 'components';

export const currentPage = writable<PageType>('home');

export function navigateTo(page: PageType) {
  currentPage.set(page);
  console.log('Navigated to:', page);
}
