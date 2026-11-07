import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { detectPopupWindow } from './lib/extension/appWindow'

const target = document.getElementById('app')
if (!target) {
  throw new Error('Could not find app container')
}

// A desktop toolbar popup takes its window size from the page. Everywhere
// else the browser sizes the page, and the app fills whatever space it gets.
if (!(await detectPopupWindow())) {
  document.documentElement.classList.add('auth-fill-viewport')
}

mount(App, { target })
