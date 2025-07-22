/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from './data/config.js';
import i18n from './i18n/i18n.js';
import template from './ui/util/template.js';
import theme from './theme/theme.js';

// Initialize the application
(async function() {
  try {
    // Set up locale and i18n
    const locale = await config.get('locale', 'auto');
    if (locale !== 'auto') i18n.setLocale(locale);
    
    // Apply internationalization to all elements with data-i18n attribute
    Array.from(document.querySelectorAll('[data-i18n]')).forEach(element => {
      element.textContent = i18n.getMessage(element.dataset.i18n, ...element.children);
    });
    
    document.documentElement.lang = i18n.getMessage('locale');
    document.title = "Lexile Level Adjuster - Configuration";
    
    // Check if we should return to a specific page after config
    const urlParams = new URLSearchParams(window.location.search);
    const returnTo = urlParams.get('returnTo');
    const fileId = urlParams.get('fileId');
    
    // Set up theme selection
    const themeSelect = document.getElementById('theme_select');
    if (themeSelect) {
      // Populate theme options
      const themeOptions = [
        { value: 'auto', text: i18n.getMessage('configThemeAuto') },
        { value: 'light', text: i18n.getMessage('configThemeLight') },
        { value: 'dark', text: i18n.getMessage('configThemeDark') }
      ];
      
      themeOptions.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.text;
        themeSelect.appendChild(optionEl);
      });
      
      // Set current theme value
      const currentTheme = await config.get('theme', 'auto');
      themeSelect.value = currentTheme;
      
      // Add event listener for theme changes
      themeSelect.addEventListener('change', async () => {
        await config.set('theme', themeSelect.value);
        console.log(`Theme changed to ${themeSelect.value}`);
      });
    }
    
    // Set up save button
    const saveButton = document.getElementById('save_config_button');
    if (saveButton) {
      saveButton.addEventListener('click', async () => {
        try {
          // Save current configuration (already saved when changed, but this confirms it)
          console.log('Configuration saved successfully');
          
          // Show success message briefly
          const originalText = saveButton.textContent;
          saveButton.textContent = 'Saved!';
          saveButton.disabled = true;
          
          setTimeout(() => {
            // Navigate back to list page after a brief delay
            window.location.href = './list.html';
          }, 1000);
          
        } catch (error) {
          console.error('Error saving configuration:', error);
          saveButton.textContent = 'Error saving';
          setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
          }, 2000);
        }
      });
    }
    
    // Set up back button
    const backButton = document.querySelector('.back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        // Handle back navigation based on returnTo parameter
        if (returnTo === 'read') {
          if (fileId) {
            window.location.href = `./read.html?fileId=${fileId}`;
          } else {
            window.location.href = './list.html';
          }
        } else {
          window.location.href = './list.html'; // Default back to list page
        }
      });
    }

    // Setup service worker
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', {
          scope: './'
        });
        if (reg) {
          console.log('Service worker registered successfully on config page.');
          // Don't call update() as it might be causing the error
        }
      } catch (error) {
        console.warn('Service worker registration failed:', error);
      }
    }
  } catch (error) {
    console.error('Error initializing config page:', error);
    document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>Error Loading Configuration Page</h1>
      <p>There was an error initializing the configuration page:</p>
      <pre>${error.message || error}</pre>
      <p><a href="./list.html">Return to List Page</a></p>
    </div>`;
  }
})();
