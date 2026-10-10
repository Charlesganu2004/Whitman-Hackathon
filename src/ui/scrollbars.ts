import { Platform } from 'react-native';

const STYLE_ID = 'unscroll-hidden-scrollbars';

// iPhone content scrolls without a persistent bar. The web preview matches that for every scroller, including multiline answer fields.
export function hideWebScrollbars() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = '*{scrollbar-width:none;-ms-overflow-style:none}*::-webkit-scrollbar{display:none;width:0;height:0}';
  document.head.appendChild(style);
}
