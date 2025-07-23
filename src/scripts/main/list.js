/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from '../../data/config.js';
import i18n from '../../i18n/i18n.js';
import file from '../../data/file.js';
import text from '../text/text.js';
import template from '../ui/util/template.js';
import dom from '../ui/util/dom.js';
import ItemList from '../ui/component/itemlist.js';
import Menu from '../ui/component/menu.js';
import '../page/common.js';

// Global variables for list functionality
let fileButton, fileListContainer, fileListElement, fileListSensor, fileListTop;
let fileDropArea, searchContainer, searchInput, searchClearButton, sortButton, sortContent;
let importTip, addButton, configButton, sortMenu, fileList, langTag;
let options = { sortBy: 'dateread', search: '' };
let lastToken = {};

// Sort key translations
const sortKey = {
  dateread: '',
  dateadd: '',
  title: ''
};

// Initialize the application
(async function() {
  const locale = await config.get('locale', 'auto');
  if (locale !== 'auto') i18n.setLocale(locale);
  
  Array.from(document.querySelectorAll('[data-i18n]')).forEach(element => {
    element.textContent = i18n.getMessage(element.dataset.i18n, ...element.children);
  });
  
  document.documentElement.lang = i18n.getMessage('locale');
  document.title = "Lexile Level Adjuster - Files";
  
  // Initialize sort key translations
  sortKey.dateread = i18n.getMessage('listSortByDateRead');
  sortKey.dateadd = i18n.getMessage('listSortByDateAdd');
  sortKey.title = i18n.getMessage('listSortByTitle');
  
  // Add navigation header
  const listPage = document.querySelector('#list_page');
  const headerRef = template.create('header');
  listPage.insertBefore(headerRef.get('root'), listPage.firstChild);
  
  addButton = template.iconButton('add', i18n.getMessage('buttonAdd'));
  configButton = template.iconButton('settings', i18n.getMessage('buttonSettings'));
  headerRef.get('left').appendChild(addButton);
  headerRef.get('right').appendChild(configButton);
  
  // Initialize UI elements
  await initializeUI();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize the page
  await activatePage();
  
  // Setup service worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('../worker/sw.js', {
        scope: '../'
      });
      if (reg) {
        reg.update();
      }
    } catch (error) {
      console.warn('Service worker registration failed:', error);
    }
  }
})();

async function initializeUI() {
  // Get DOM elements
  fileButton = document.querySelector('#file');
  fileListContainer = document.querySelector('#file_list_container');
  fileListElement = document.querySelector('#file_list');
  fileListSensor = document.querySelector('#file_list_sensor');
  fileListTop = document.querySelector('#file_list_top');
  fileDropArea = document.querySelector('#drop_area');
  searchContainer = fileListContainer.querySelector('.list-filter');
  searchInput = searchContainer.querySelector('.list-filter input');
  sortButton = fileListContainer.querySelector('.list-sort button');
  sortContent = fileListContainer.querySelector('.list-sort-content');
  importTip = document.querySelector('#import_tip');
  
  // Setup search UI
  searchInput.placeholder = i18n.getMessage('listSearchPlaceholder');
  searchClearButton = template.iconButton('remove', i18n.getMessage('listFilterClear'));
  searchClearButton.classList.add('list-filter-clear');
  searchClearButton.disabled = true;
  searchContainer.appendChild(searchClearButton);
  
  // Setup sort menu
  sortMenu = new Menu({
    groups: [['dateread', 'dateadd', 'title'].map(value => ({
      title: sortKey[value],
      value,
    })), [{
      title: i18n.getMessage('listSortCancel'),
    }]],
  });
}

function setupEventListeners() {
  // Add button - opens file picker
  addButton.addEventListener('click', () => {
    fileButton.click();
  });
  
  // File input change - import file
  fileButton.addEventListener('change', async event => {
    const files = fileButton.files;
    if (files.length === 1) {
      await importFile(files.item(0));
    }
    fileButton.value = null;
  });
  
  // Config button - navigate to config
  configButton.addEventListener('click', () => {
    window.location.href = '../pages/config.html';
  });
  
  // Search input focus - scroll to top
  searchInput.addEventListener('focus', event => {
    fileListContainer.scrollTop = 0;
  });
  
  // Search input - update search
  searchInput.addEventListener('input', event => {
    updateSearch();
  });
  
  // Clear search button
  searchClearButton.addEventListener('click', event => {
    clearSearch();
  });
  
  // Sort button - show sort menu
  sortButton.addEventListener('click', async event => {
    const result = await sortMenu.popup(event.target);
    if (result && result.value && result.value !== options.sortBy) {
      options.sortBy = result.value;
      updateSort();
      updateList();
    }
  });
  
  // File drop area
  fileDropArea.addEventListener('dragover', event => {
    event.preventDefault();
  });
  
  fileDropArea.addEventListener('drop', async event => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length === 1) {
      await importFile(files.item(0));
    }
  });
  
  // Service worker message handler
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', async event => {
      if (event.data.action === 'import') {
        await importFile(event.data.file);
      }
    });
  }
  
  // Navigation event handlers
  window.addEventListener('pageNavigation', event => {
    if (event.detail.page === 'read') {
      const fileId = event.detail.fileId;
      window.location.href = `../pages/read.html?fileId=${fileId}`;
    } else if (event.detail.page === 'config') {
      window.location.href = '../pages/config.html';
    }
  });
}

async function activatePage() {
  updateSort();
  langTag = await config.get('cjk_lang_tag', navigator.language || 'und');
  await updateList();
  scrollToList();
}

async function importFile(item) {
  if (!item) return null;
  
  let result = null;
  importTip.style.display = 'block';
  
  try {
    const content = await text.readFile(item);
    
    // Check if this is a Lexile level adjustment request
    if (content.includes('LEXILE_ADJUST:')) {
      // Extract the target Lexile level and passage
      const lines = content.split('\n');
      let targetLevel = null;
      let passage = '';
      let inPassage = false;
      
      for (const line of lines) {
        if (line.startsWith('LEXILE_ADJUST:')) {
          targetLevel = parseInt(line.split(':')[1].trim());
        } else if (line.startsWith('PASSAGE:')) {
          inPassage = true;
        } else if (inPassage) {
          passage += line + '\n';
        }
      }
      
      if (targetLevel && passage.trim()) {
        // Call Lexile adjustment API
        const response = await fetch('/api/adjust-lexile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            passage: passage.trim(),
            target_level: targetLevel
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          const adjusted_passage = data.adjusted_passage;
          
          // Display the results
          const resultContainer = document.createElement('div');
          resultContainer.id = 'lexile-results';
          resultContainer.innerHTML = `
            <h3>Lexile Level Adjustment Results</h3>
            <p><strong>Target Level:</strong> ${targetLevel}L</p>
            <p><strong>Original Level:</strong> ${data.original_level}L</p>
            <p><strong>Adjusted Level:</strong> ${data.adjusted_level}L</p>
            <div>
              <h4>Adjusted Passage:</h4>
              <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; background: #f9f9f9;">
                ${adjusted_passage.replace(/\n/g, '<br>')}
              </div>
            </div>
          `;
          
          // Remove any existing results
          const existingResults = document.getElementById('lexile-results');
          if (existingResults) {
            existingResults.remove();
          }
          
          // Append the results to the file list container
          fileListContainer.insertBefore(resultContainer, fileListTop);
          
          // Process the adjusted content
          const processedContent = await text.preprocess(adjusted_passage);
          const raw_title = text.parseFilename(item.name) + ` (Lexile ${data.adjusted_level}L)`;
          const title = await text.preprocess(raw_title);
          
          // Save file metadata and content to server
          const serverResponse = await fetch('/api/files', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title,
              content: processedContent,
              createTime: new Date().toISOString(),
              lastAccessTime: new Date().toISOString(),
              length: processedContent.length
            })
          });
          
          if (serverResponse.ok) {
            const fileData = await serverResponse.json();
            result = fileData;
            // Still save minimal metadata locally for listing
            await file.add({ 
              title, 
              createTime: new Date(), 
              lastAccessTime: new Date(), 
              length: processedContent.length,
              id: fileData.id,
              serverStored: true
            }, ''); // Empty content as it's stored on server
          } else {
            throw new Error('Failed to save file to server');
          }
        } else {
          throw new Error('Failed to adjust Lexile level');
        }
      } else {
        throw new Error('Invalid Lexile adjustment format');
      }
    } else {
      // Regular file processing
      const processedContent = await text.preprocess(content);
      const raw_title = text.parseFilename(item.name);
      const title = await text.preprocess(raw_title);
      
      // Save file metadata and content to server
      const serverResponse = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content: processedContent,
          createTime: new Date().toISOString(),
          lastAccessTime: new Date().toISOString(),
          length: processedContent.length
        })
      });
      
      if (serverResponse.ok) {
        const fileData = await serverResponse.json();
        result = fileData;
        // Still save minimal metadata locally for listing
        await file.add({ 
          title, 
          createTime: new Date(), 
          lastAccessTime: new Date(), 
          length: processedContent.length,
          id: fileData.id,
          serverStored: true
        }, ''); // Empty content as it's stored on server
      } else {
        throw new Error('Failed to save file to server');
      }
    }
  } catch (e) {
    console.error('Import error:', e);
    alert(i18n.getMessage('listImportFail'));
  } finally {
    importTip.style.display = 'none';
    clearSearch();
    updateList();
    scrollToList();
  }
  
  return result;
}

function scrollToList() {
  const scrollable = fileListSensor.clientHeight;
  if (scrollable) {
    fileListContainer.scrollTop = fileListTop.clientHeight + 1;
  } else {
    requestAnimationFrame(() => {
      scrollToList();
    });
  }
}

async function updateList() {
  const token = lastToken = {};
  const files = await file.list();
  searchFiles(files);
  sortFiles(files);
  if (token !== lastToken) return;
  
  clearList();
  
  const render = (container, file) => {
    if (container.firstChild) return;
    const ref = template.create('file_list_item');
    const title = ref.get('title');
    title.textContent = file.title;
    title.lang = langTag;
    const dateLang = i18n.getMessage('locale');
    const date = file.lastAccessTime.toLocaleDateString(dateLang);
    ref.get('date').textContent = date;
    ref.get('date').lang = dateLang;
    ref.get('date').setAttribute('datetime', file.lastAccessTime.toISOString());
    const percent = file.cursor ?
      (file.cursor / file.length * 100).toFixed(2) + '%' :
      i18n.getMessage('listNotYetRead');
    ref.get('detail').textContent = percent;
    container.appendChild(ref.get('root'));
  };
  
  const onItemClick = file => {
    window.location.href = `../pages/read.html?fileId=${file.id}`;
  };
  
  const onRemove = async (item, index) => {
    await file.remove(item.id);
    fileList.removeItem(index);
  };
  
  const emptyListRender = container => {
    const text = container.appendChild(document.createElement('div'));
    if (options.search) {
      text.textContent = i18n.getMessage('listEmptySearchTip');
    } else {
      text.textContent = i18n.getMessage('listEmptyTip');
    }
  };
  
  fileList = new ItemList(fileListElement, {
    list: files.slice(0),
    render,
    onItemClick,
    onRemove,
    emptyListRender,
  });
}

function clearList() {
  if (fileList) {
    fileList.dispatch();
    fileList = null;
  }
}

function updateSearch() {
  const search = searchInput.value.trim();
  options.search = search;
  searchClearButton.disabled = !search;
  return updateList();
}

function clearSearch() {
  searchInput.value = '';
  return updateSearch();
}

function updateSort() {
  sortContent.querySelector('span').textContent = sortKey[options.sortBy];
}

function searchFiles(files) {
  for (let i = 0; i < files.length;) {
    if (files[i].title.includes(options.search)) i++;
    else files.splice(i, 1);
  }
}

function sortFiles(files) {
  const sortBy = options.sortBy;
  const cmp = {
    dateread: (a, b) => b.lastAccessTime - a.lastAccessTime,
    dateadd: (a, b) => b.createTime - a.createTime,
    title: (a, b) => a.title.localeCompare(b.title, langTag || navigator.language),
  }[sortBy];
  files.sort(cmp);
}

// Export functions for external use
window.listPageFunctions = {
  importFile,
  updateList,
  clearSearch,
  scrollToList
};
