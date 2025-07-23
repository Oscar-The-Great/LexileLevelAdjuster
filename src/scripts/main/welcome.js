/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from '../data/config.js';
import i18n from '../i18n/i18n.js';
import '../page/common.js';

// Initialize the application
(async function() {
  const locale = await config.get('locale', 'auto');
  if (locale !== 'auto') i18n.setLocale(locale);
  
  Array.from(document.querySelectorAll('[data-i18n]')).forEach(element => {
    element.textContent = i18n.getMessage(element.dataset.i18n, ...element.children);
  });
  
  document.documentElement.lang = i18n.getMessage('locale');
  document.title = "Lexile Level Adjuster";
  
  // Setup service worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('../worker/sw.js', {
        scope: '../'
      });
      if (reg) {
        console.log('Service worker registered successfully on welcome page.');
      }
    } catch (error) {
      // Service Worker may be rejected due to not supported, privacy setting, etc.
      console.warn('Service worker registration failed:', error);
    }
  }
  
  // Add event listener for the start button
  document.getElementById('start-button').addEventListener('click', function() {
    window.location.href = '../pages/list.html';
  });
})();