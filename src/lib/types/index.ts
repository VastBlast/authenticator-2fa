import type { Component } from 'svelte';

export interface MenuItem {
  icon: Component<any>;
  label: string;
  action?: () => void;
}