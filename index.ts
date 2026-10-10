import { registerRootComponent } from 'expo';
import App from './App';
import { hideWebScrollbars } from './src/ui/scrollbars';
hideWebScrollbars();
registerRootComponent(App);
