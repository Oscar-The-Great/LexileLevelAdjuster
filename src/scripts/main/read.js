/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from '../../data/config.js';
import file from '../../data/file.js';
import template from '../ui/util/template.js';
import '../page/common.js';
import onResize from '../ui/util/onresize.js';
import wakelock from '../ui/util/wakelock.js';

// Import JumpPage dependencies manually to avoid circular import
import RangeInput from '../ui/component/range.js';
import dom from '../ui/util/dom.js';

/**
 * Simplified JumpPage class to avoid circular dependency
 */
class JumpPage {
  constructor(container, readPage) {
    this.container = container;
    this.readPage = readPage;
    this.isCurrent = false;
    this.hide();
    this.onFirstActivate();
  }

  onFirstActivate() {
    this.rangeBar = this.container.querySelector('#jump_range');
    if (this.rangeBar) {
      this.rangeInput = new RangeInput(this.rangeBar, { min: 0, max: 1, step: 1 });
      this.rangeInput.onChange(cursor => {
        if (this.readPage.setCursor) {
          this.readPage.setCursor(cursor, { resetSpeech: true, resetRender: true });
        }
      });
    }
    this.coverElement = this.container.querySelector('.read-jump-cover');
    if (this.coverElement) {
      this.coverElement.addEventListener('touchstart', event => {
        this.hide();
      });
      this.coverElement.addEventListener('click', event => {
        this.hide();
      });
    }
  }

  show() {
    this.isCurrent = true;
    this.container.classList.add('read-sub-page-current');
    this.container.removeAttribute('aria-hidden');
    dom.enableKeyboardFocus(this.container);
    if (this.readPage.controlPage) {
      dom.disableKeyboardFocus(this.readPage.controlPage.container);
    }
    this.onActivate();
  }

  hide() {
    this.isCurrent = false;
    this.container.classList.remove('read-sub-page-current');
    this.container.setAttribute('aria-hidden', 'true');
    dom.disableKeyboardFocus(this.container);
    if (this.readPage.controlPage) {
      dom.enableKeyboardFocus(this.readPage.controlPage.container);
    }
    this.onInactivate();
  }

  onActivate() {
    if (this.rangeInput && this.readPage.pages && this.readPage.pages.length > 0) {
      this.rangeInput.setConfig({ min: 0, max: this.readPage.pages.length - 1, step: 1 });
      this.rangeInput.setValue(this.readPage.cursor || 0);
    }
  }

  onInactivate() {
    // No specific action needed
  }

  onResize() {
    // No specific action needed for jump page
  }
}

/**
 * Standalone Read Page Controller
 * Merges ReadPage functionality with initialization logic
 */
class ReadPageController {
  constructor() {
    this.container = document.querySelector('#read_page');
    this.useSideIndex = null;
    this.onResize = this.onResize.bind(this);
    this.keyboardEvents = this.keyboardEvents.bind(this);
    
    // File data
    this.articleId = null;
    this.meta = null;
    this.index = null;
    this.content = null;
    this.pages = null;
    this.cursor = 0;
    
    // Configuration
    this.langTag = null;
    this.renderStyle = null;
    this.autoLockConfig = null;
    this.screenWidthSideIndex = null;
    
    // Sub-components
    this.controlPage = null;
    this.indexPage = null;
    this.jumpPage = null;
    this.speech = null;
    this.textPage = null;
    this.readIndex = null;
    this.subPages = [];
  }

  /**
   * Initialize the read page application
   */
  async initialize() {
    console.log('🔧 Read page initialization started');
    
    try {
      // Basic app initialization
      await this.initializeApp();
      
      // Parse and validate file ID
      const fileId = this.parseFileId();
      if (!fileId) return;
      
      // Create navigation header
      await this.createHeader(fileId);
      
      // Initialize components
      await this.initializeComponents();
      
      // Load and display file
      await this.loadFile(fileId);
      
      console.log('✅ Read page initialization completed');
    } catch (error) {
      console.error('❌ Read page initialization failed:', error);
      this.handleError('Failed to initialize read page', error);
    }
  }

  /**
   * Initialize basic app settings
   */
  async initializeApp() {
    console.log('🔧 Initializing app settings');
    
    try {
      // Register resize handler
      onResize.addListener(this.onResize);
      
      console.log('✅ App settings initialized');
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      throw new Error(`App initialization failed: ${error.message}`);
    }
  }

  /**
   * Parse file ID from URL parameters
   */
  parseFileId() {
    console.log('🔍 Parsing file ID from URL');
    
    try {
      const params = new URLSearchParams(window.location.search);
      // Check for both 'id' and 'fileId' parameters
      const fileId = params.get('id') || params.get('fileId');
      
      if (!fileId) {
        console.error('❌ No file ID provided in URL');
        this.handleError('No file ID provided', new Error('Missing file ID parameter'));
        return null;
      }
      
      console.log('✅ File ID parsed:', fileId);
      return fileId;
    } catch (error) {
      console.error('❌ Failed to parse file ID:', error);
      this.handleError('Failed to parse file ID', error);
      return null;
    }
  }

  /**
   * Create navigation header
   */
  async createHeader(fileId) {
    try {
      // Create header with back and config buttons
      const headerRef = template.create('header');
      this.container.insertBefore(headerRef.get('root'), this.container.firstChild);
      
      // Back button
      const backButton = template.iconButton('back', 'Back to List');
      backButton.addEventListener('click', () => {
        window.location.href = '../pages/list.html';
      });
      headerRef.get('left').appendChild(backButton);
      
      // Config button
      const configButton = template.iconButton('settings', 'Settings');
      configButton.addEventListener('click', () => {
        window.location.href = `../pages/config.html?returnTo=read&fileId=${fileId}`;
      });
      headerRef.get('right').appendChild(configButton);
      
      // Set header title
      headerRef.get('mid').textContent = 'Reading';
      
      return true;
    } catch (error) {
      console.error('Error creating header:', error);
      return false;
    }
  }

  /**
   * Initialize ReadPage components
   */
  initializeComponents() {
    console.log('🔧 Initializing components');
    
    // Initialize control page
    const controlContainer = this.container.querySelector('.read-control');
    if (controlContainer) {
      this.controlPage = {
        container: controlContainer,
        isShow: false,
        hasFocus: false,
        onActivate() {},
        onResize() {},
        disable() {
          this.container.classList.add('read-control-disabled');
        },
        enable() {
          this.container.classList.remove('read-control-disabled');
        },
        focus() {},
        hide() {},
        registerMoreMenu() {}
      };
      this.subPages.push(this.controlPage);
    }
    
    // Initialize jump page
    const jumpContainer = this.container.querySelector('.read-jump');
    if (jumpContainer) {
      this.jumpPage = new JumpPage(jumpContainer, this);
      this.subPages.push(this.jumpPage);
    }
    
    // Initialize text page (simplified)
    const textContainer = this.container.querySelector('.read-text');
    if (textContainer) {
      this.textPage = {
        container: textContainer,
        contentElement: textContainer.querySelector('#read_content'),
        onActivate() {
          if (this.meta && this.meta.title) {
            const titleElement = document.createElement('h1');
            titleElement.textContent = this.meta && this.meta.title ? this.meta.title : 'Untitled Document';
            this.contentElement.appendChild(titleElement);
          }
          
          if (this.content) {
            const contentElement = document.createElement('div');
            contentElement.className = 'read-body';
            contentElement.innerHTML = this.content.split('\n\n').map(p => `<p>${p}</p>`).join('');
            this.contentElement.appendChild(contentElement);
          }
        },
        onResize() {},
        initUpdatePage() {},
        show() {
          this.container.style.display = 'block';
        },
        hide() {
          this.container.style.display = 'none';
        },
        setCursor(cursor) {}
      };
      this.subPages.push(this.textPage);
    }
    
    // Initialize speech component (minimal)
    this.speech = {
      stop() {}
    };
    
    // Initialize read index (minimal)
    this.readIndex = {
      bookmarks: [],
      content: []
    };
    
    console.log('✅ Components initialized');
  }

  /**
   * Load and display file directly from server
   */
  async loadFile(id) {
    try {
      console.log('🔄 Loading file with ID:', id);
      
      // Load configuration
      console.log('📋 Loading configuration...');
      this.langTag = await config.get('cjk_lang_tag', 'und');
      this.renderStyle = await config.get('view_mode', 'flip');
      this.autoLockConfig = await config.get('auto_lock', 'speech');
      this.screenWidthSideIndex = await config.expert('appearance.screen_width_side_index', 'number', 960);
      console.log('✅ Configuration loaded');

      this.articleId = id;
      
      // Load file metadata from local storage
      console.log('📋 Loading meta data for file ID:', id);
      const meta = await file.getMeta(id);
      console.log('✅ Meta data loaded:', meta);
      
      // Load index data from local storage
      console.log('📑 Loading index data for file ID:', id);
      const index = await file.getIndex(id) || { bookmarks: [], content: [] };
      console.log('✅ Index data loaded:', index);
      
      // Load content directly from server
      console.log('📖 Loading content data for file ID:', id);
      let content;
      try {
        // Always fetch content from server
        const response = await fetch(`/api/files/${id}/content`);
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        content = data.content;
        
        console.log('✅ Content data loaded from server, length:', content?.length);
      } catch (contentError) {
        console.error('❌ Failed to load content from server:', contentError);
        
        // Fallback to local storage if server fetch fails
        try {
          console.log('⚠️ Attempting to load content from local storage as fallback');
          content = await file.content(id);
          console.log('✅ Content loaded from local storage, length:', content?.length);
        } catch (localError) {
          console.error('❌ Failed to load content from local storage:', localError);
          throw new Error(`Failed to load file content: ${contentError.message || 'Unknown error'}`);
        }
      }

      this.meta = meta;
      this.index = index;
      this.content = content;

      // Split content into pages
      this.pages = content.split('\n\n').filter(p => p.trim());
      this.cursor = 0;

      this.readIndex = {
        bookmarks: index.bookmarks || [],
        content: index.content || []
      };
      
      // Initialize text page based on render style
      this.textPage = {
        onActivate: async (params) => {
          // Display the content in a simple way
          const contentElement = this.container.querySelector('.read-text') || this.container;
          if (contentElement && this.content) {
            // Create a simple text display with better styling
            const textDiv = document.createElement('div');
            textDiv.className = 'read-content-container';
            textDiv.style.cssText = 'padding: 20px; line-height: 1.6; font-size: 18px; white-space: pre-wrap; max-width: 800px; margin: 0 auto; color: #333; background: #fff;';
            
            // Set title with null check for meta
            const titleElement = document.createElement('h1');
            titleElement.style.cssText = 'font-size: 24px; margin-bottom: 20px; text-align: center; padding-bottom: 10px; border-bottom: 1px solid #eee;';
            titleElement.textContent = this.meta && this.meta.title ? this.meta.title : 'Untitled Document';
            textDiv.appendChild(titleElement);
            
            // Set content
            const contentTextElement = document.createElement('div');
            contentTextElement.textContent = this.content;
            textDiv.appendChild(contentTextElement);
            
            contentElement.innerHTML = '';
            contentElement.appendChild(textDiv);
          }
          return Promise.resolve();
        },
        initUpdatePage: () => {},
        onResize: () => {},
        setCursor: (cursor) => { this.cursor = cursor; },
        show: () => {},
        hide: () => {}
      };
      
      // Apply appropriate styling based on render style
      if (this.renderStyle === 'flip') {
        this.container.classList.add('read-page-flip');
      } else {
        this.container.classList.add('read-page-scroll');
      }
      
      // Activate the text page
      await this.textPage.onActivate({ id });

      // Setup keyboard events and update title
      document.addEventListener('keydown', this.keyboardEvents);
      // CHANGE TO THIS (with null check):
      const title = this.meta && this.meta.title ? this.meta.title : 'Untitled Document';
      document.title = `${title} - Lexile Level Adjuster`;
            
      // Update header title if it exists (with null check)
      const headerMid = this.container.querySelector('.header-mid');
      if (headerMid) {
        headerMid.textContent = title;
      }

      // Activate sub-pages and update layout
      this.subPages.forEach(page => { 
        if (page && typeof page.onActivate === 'function') {
          page.onActivate(); 
        }
      });
      this.updateSideIndex();

      // Setup auto-lock if needed
      if (this.autoLockConfig === 'normal') {
        wakelock.request();
      }

      // Update last access time
      if (meta) {
        meta.lastAccessTime = new Date();
        await file.setMeta(meta);
      }

      console.log('📖 File opened successfully');
    } catch (error) {
      console.error('Failed to open file:', error);
      this.handleError('Failed to open file', error);
    }
  }

  /**
   * Handle errors
   */
  handleError(message, error) {
    console.error(`${message}:`, error);
    
    // Clear existing content
    this.container.innerHTML = '';
    
    // Create error message
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-container';
    errorContainer.style.cssText = 'padding: 20px; text-align: center; max-width: 600px; margin: 100px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);';
    
    const errorTitle = document.createElement('h2');
    errorTitle.textContent = message;
    errorTitle.style.cssText = 'color: #e74c3c; margin-bottom: 20px;';
    
    const errorDetails = document.createElement('p');
    errorDetails.textContent = error.message || 'Unknown error';
    errorDetails.style.cssText = 'margin-bottom: 30px; color: #555;';
    
    const backButton = document.createElement('button');
    backButton.textContent = 'Back to List';
    backButton.style.cssText = 'padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;';
    backButton.addEventListener('click', () => this.gotoList());
    
    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorDetails);
    errorContainer.appendChild(backButton);
    
    this.container.appendChild(errorContainer);
  }

  // ReadPage methods (simplified versions without router dependency)
  show() {
    this.container.classList.add('active-page');
    this.container.removeAttribute('aria-hidden');
    this.textPage?.initUpdatePage();
    this.indexPage?.initUpdatePage();
    onResize.addListener(this.onResize);
  }

  hide() {
    this.container.classList.remove('active-page');
    this.container.setAttribute('aria-hidden', 'true');
    onResize.removeListener(this.onResize);
  }

  onResize() {
    this.updateSideIndex();
    this.subPages.forEach(page => { 
      if (page && typeof page.onResize === 'function') {
        page.onResize(); 
      }
    });
  }

  keyboardEvents(event) {
    if (event.code === 'Escape') {
      const current = this.activedSubpage();
      if (current) current.hide();
      else if (this.controlPage.hasFocus) this.controlPage.hide();
      else this.controlPage.focus();
    }
  }

  updateSideIndex() {
    const [pageWidth, pageHeight] = onResize.currentSize();
    const sideIndex = pageWidth >= this.screenWidthSideIndex;
    if (sideIndex === this.useSideIndex) return;
    this.useSideIndex = sideIndex;
    if (sideIndex) {
      this.container.classList.add('read-page-wide');
      this.container.classList.remove('read-page-thin');
    } else {
      this.container.classList.remove('read-page-wide');
      this.container.classList.add('read-page-thin');
    }
    if (this.isIndexActive()) {
      this.updateIndexRender(true);
    }
  }

  updateIndexRender(resized = this.useSideIndex) {
    const active = this.isIndexActive();
    if (active) {
      this.container.classList.add('read-show-index');
    } else {
      this.container.classList.remove('read-show-index');
    }
    if (active && !this.useSideIndex) {
      this.controlPage.disable();
      this.textPage.hide();
    } else {
      this.controlPage.enable();
      this.textPage.show();
    }
    if (resized) {
      window.requestAnimationFrame(() => {
        this.onResize();
      });
      this.textPage.onResize();
    }
  }

  // Utility methods
  isIndexActive() { return this.indexPage?.isCurrent; }
  isControlActive() { return this.controlPage.isShow; }
  isJumpActive() { return this.jumpPage.isCurrent; }
  isSideIndexActive() { return this.useSideIndex && this.indexPage.isCurrent; }
  
  activedSubpage() {
    if (this.isIndexActive()) return this.indexPage;
    if (this.isControlActive()) return this.controlPage;
    if (this.isJumpActive()) return this.jumpPage;
    return null;
  }

  // Navigation methods
  gotoList() { window.location.href = '../pages/list.html'; }
  
  // File sharing methods
  canShareFile() {
    try {
      if (!navigator.share) return false;
      if (!navigator.canShare) return false;
      const testFile = new File([''], 'file.txt', { type: 'text/plain' });
      return navigator.canShare({ files: [testFile] });
    } catch (_ignore) {
      return false;
    }
  }

  downloadContent() {
    const text = '\ufeff' + this.content.replace(/\r\n|\r|\n/g, '\r\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.meta.title + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Cursor management
  setCursor(cursor, opts = {}) {
    if (cursor < 0) cursor = 0;
    if (this.pages && cursor >= this.pages.length) cursor = this.pages.length - 1;
    this.cursor = cursor;
    
    if (opts.resetSpeech && this.speech) {
      this.speech.stop();
    }
    
    console.log('📍 Cursor set to:', cursor);
  }
}

// Initialize the read page controller
const readPageController = new ReadPageController();
readPageController.initialize();

// Setup service worker
if ('serviceWorker' in navigator) {
  try {
    const reg = await navigator.serviceWorker.register('../worker/sw.js', {
      scope: '../'
    });
    if (reg) {
      console.log('Service worker registered successfully on read page.');
    }
  } catch (error) {
    console.warn('Service worker registration failed:', error);
  }
}
