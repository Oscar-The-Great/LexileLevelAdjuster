const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const PORT = process.env.PORT || 8080;

// Create data directory if it doesn't exist
const DATA_DIR = path.join(__dirname, 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');

async function ensureDirectoriesExist() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(FILES_DIR, { recursive: true });
    console.log('✅ Data directories created or verified');
  } catch (error) {
    console.error('❌ Error creating data directories:', error);
  }
}

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));

// Set proper MIME types
app.use((req, res, next) => {
  const url = req.url;
  if (url.endsWith('.css')) {
    res.type('text/css');
  } else if (url.endsWith('.js')) {
    res.type('application/javascript');
  } else if (url.endsWith('.json')) {
    res.type('application/json');
  } else if (url.endsWith('.svg')) {
    res.type('image/svg+xml');
  } else if (url.endsWith('.woff')) {
    res.type('font/woff');
  } else if (url.endsWith('.woff2')) {
    res.type('font/woff2');
  }
  next();
});

// Serve static files from the src directory
app.use(express.static(path.join(__dirname)));

// Special handling for service worker
app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'sw.js'));
});

// File storage in memory for development (replace with database in production)
let files = {};
let nextId = 1;

// Load existing files if available
async function loadExistingFiles() {
  try {
    const indexPath = path.join(DATA_DIR, 'file-index.json');
    const data = await fs.readFile(indexPath, 'utf8');
    const fileIndex = JSON.parse(data);
    files = fileIndex.files || {};
    nextId = fileIndex.nextId || 1;
    console.log(`✅ Loaded ${Object.keys(files).length} files from storage`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('❌ Error loading file index:', error);
    } else {
      console.log('ℹ️ No existing file index found, starting fresh');
    }
  }
}

// Save file index to disk
async function saveFileIndex() {
  try {
    const indexPath = path.join(DATA_DIR, 'file-index.json');
    await fs.writeFile(indexPath, JSON.stringify({ 
      files: Object.fromEntries(
        Object.entries(files).map(([id, file]) => [
          id, 
          { ...file, content: undefined } // Don't store content in the index
        ])
      ), 
      nextId 
    }, null, 2));
  } catch (error) {
    console.error('❌ Error saving file index:', error);
  }
}

// API Routes

// Get all files (metadata only)
app.get('/api/files', (req, res) => {
  const fileList = Object.entries(files).map(([id, file]) => ({
    id: parseInt(id),
    title: file.title,
    createTime: file.createTime,
    lastAccessTime: file.lastAccessTime,
    length: file.length
  }));
  res.json(fileList);
});

// Get a specific file's metadata
app.get('/api/files/:id', (req, res) => {
  const id = req.params.id;
  if (!files[id]) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const { content, ...metadata } = files[id];
  res.json(metadata);
});

// Get a specific file's content
app.get('/api/files/:id/content', async (req, res) => {
  const id = req.params.id;
  if (!files[id]) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  try {
    // Read file content from disk
    const filePath = path.join(FILES_DIR, `${id}.txt`);
    const content = await fs.readFile(filePath, 'utf8');
    
    // Update last access time
    files[id].lastAccessTime = new Date().toISOString();
    await saveFileIndex();
    
    res.json({ content });
  } catch (error) {
    console.error(`❌ Error reading file ${id}:`, error);
    
    // Fallback to in-memory content if available
    if (files[id].content) {
      console.log(`ℹ️ Using in-memory content for file ${id}`);
      res.json({ content: files[id].content });
    } else {
      res.status(500).json({ error: 'Failed to read file content' });
    }
  }
});

// Create a new file
app.post('/api/files', async (req, res) => {
  const { title, content, createTime, lastAccessTime, length } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  
  const id = nextId++;
  const file = {
    id,
    title,
    content,
    createTime: createTime || new Date().toISOString(),
    lastAccessTime: lastAccessTime || new Date().toISOString(),
    length: length || content.length
  };
  
  files[id] = file;
  
  // Save file content to disk
  try {
    await fs.writeFile(path.join(FILES_DIR, `${id}.txt`), content);
    await saveFileIndex();
    
    // Return metadata without content
    const { content: _, ...metadata } = file;
    res.status(201).json(metadata);
  } catch (error) {
    console.error('❌ Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Update a file
app.put('/api/files/:id', async (req, res) => {
  const id = req.params.id;
  if (!files[id]) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const { title, content } = req.body;
  if (title) files[id].title = title;
  if (content) {
    files[id].content = content;
    files[id].length = content.length;
    await fs.writeFile(path.join(FILES_DIR, `${id}.txt`), content);
  }
  
  files[id].lastAccessTime = new Date().toISOString();
  await saveFileIndex();
  
  const { content: _, ...metadata } = files[id];
  res.json(metadata);
});

// Delete a file
app.delete('/api/files/:id', async (req, res) => {
  const id = req.params.id;
  if (!files[id]) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  delete files[id];
  
  try {
    await fs.unlink(path.join(FILES_DIR, `${id}.txt`)).catch(() => {});
    await saveFileIndex();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Lexile adjustment API endpoint
app.post('/api/adjust-lexile', (req, res) => {
  const { passage, target_level } = req.body;
  
  if (!passage || !target_level) {
    return res.status(400).json({ error: 'Passage and target level are required' });
  }
  
  // This is a simplified implementation - in a real app, you would call an NLP service
  // For now, we'll just simulate the adjustment by simplifying some words
  
  // Simple word replacements to simulate lexile adjustment
  const complexToSimple = {
    'utilize': 'use',
    'commence': 'start',
    'terminate': 'end',
    'endeavor': 'try',
    'sufficient': 'enough',
    'demonstrate': 'show',
    'comprehend': 'understand',
    'purchase': 'buy',
    'inquire': 'ask',
    'obtain': 'get'
  };
  
  let adjusted_passage = passage;
  Object.entries(complexToSimple).forEach(([complex, simple]) => {
    const regex = new RegExp(`\\b${complex}\\b`, 'gi');
    adjusted_passage = adjusted_passage.replace(regex, simple);
  });
  
  // Calculate mock lexile levels
  const original_level = Math.floor(Math.random() * 300) + 800; // Random between 800-1100
  const adjusted_level = target_level;
  
  res.json({
    original_level,
    adjusted_level,
    adjusted_passage
  });
});

// Start server
async function startServer() {
  await ensureDirectoriesExist();
  await loadExistingFiles();
  
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ Service worker available at http://localhost:${PORT}/sw.js`);
  });
}

startServer();
