/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from '../data/config.js';

const deepseek = {};

export default deepseek;

/**
 * DeepSeek Chat API endpoint
 * This should be replaced with your actual API endpoint
 */
const API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

/**
 * Get API key from configuration or environment variable
 * @returns {Promise<string>} The API key
 */
deepseek.getApiKey = async function() {
  // First try to get from config storage
  let apiKey = await config.get('deepseek_api_key', '');
  
  // If not in config, try to get from window.ENV
  if (!apiKey && typeof window !== 'undefined' && window.ENV) {
    apiKey = window.ENV.DEEPSEEK_API_KEY;
    if (apiKey) {
      // Save to config for future use
      await config.set('deepseek_api_key', apiKey);
    }
  }
  
  // If still no API key, throw an error
  if (!apiKey) {
    throw new Error('DeepSeek API key not found. Please set DEEPSEEK_API_KEY in your env.js file.');
  }
  
  return apiKey;
};

/**
 * Make a request to the DeepSeek Chat API
 * @param {string} prompt - The prompt to send to the API
 * @returns {Promise<string>} The response from the API
 */
deepseek.makeRequest = async function(prompt) {
  try {
    const apiKey = await this.getApiKey();
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`DeepSeek API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error making DeepSeek API request:', error);
    throw error;
  }
};

/**
 * Generate a title based on the content
 * @param {string} content - The content to generate a title for
 * @returns {Promise<string>} The generated title
 */
deepseek.generateTitle = async function(content) {
  // Truncate content if it's too long
  const truncatedContent = content.length > 3000 
    ? content.substring(0, 3000) + '...' 
    : content;
  
  const prompt = `Generate a concise and descriptive title for the following text. The title should be no more than 5-7 words and capture the main topic or theme of the content:\n\n${truncatedContent}`;
  
  try {
    const title = await this.makeRequest(prompt);
    // Clean up the title (remove quotes if present)
    return title.replace(/^["']|["']$/g, '').trim();
  } catch (error) {
    console.error('Error generating title:', error);
    return 'Untitled Document';
  }
};

/**
 * Rephrase content based on Lexile level
 * @param {string} content - The original content
 * @param {number} lexileLevel - The target Lexile level
 * @returns {Promise<string>} The rephrased content
 */
deepseek.rephraseContent = async function(content, lexileLevel) {
  // Determine complexity level based on Lexile
  let complexity = 'moderate';
  if (lexileLevel < 500) {
    complexity = 'very simple';
  } else if (lexileLevel < 800) {
    complexity = 'simple';
  } else if (lexileLevel < 1100) {
    complexity = 'moderate';
  } else if (lexileLevel < 1400) {
    complexity = 'advanced';
  } else {
    complexity = 'very advanced';
  }
  
  // Process content in chunks if it's too long
  const MAX_CHUNK_SIZE = 2500;
  if (content.length <= MAX_CHUNK_SIZE) {
    return this.rephraseChunk(content, complexity, lexileLevel);
  }
  
  // Split by paragraphs to maintain structure
  const paragraphs = content.split(/\n\s*\n/);
  let currentChunk = '';
  let result = '';
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > MAX_CHUNK_SIZE && currentChunk) {
      // Process current chunk
      const processedChunk = await this.rephraseChunk(currentChunk, complexity, lexileLevel);
      result += processedChunk + '\n\n';
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Process final chunk
  if (currentChunk) {
    const processedChunk = await this.rephraseChunk(currentChunk, complexity, lexileLevel);
    result += processedChunk;
  }
  
  return result;
};

/**
 * Helper function to rephrase a chunk of content
 * @param {string} chunk - Content chunk to rephrase
 * @param {string} complexity - Complexity level description
 * @param {number} lexileLevel - The target Lexile level
 * @returns {Promise<string>} The rephrased chunk
 */
deepseek.rephraseChunk = async function(chunk, complexity, lexileLevel) {
  const prompt = `Rephrase the following text to match a Lexile level of approximately ${lexileLevel}. 
Use ${complexity} vocabulary and sentence structures appropriate for this reading level.
Maintain the original meaning and key information, but adjust the complexity of language.
Do not add explanatory notes or change the content's message.
Only return the rephrased text without any additional comments:

${chunk}`;

  try {
    return await this.makeRequest(prompt);
  } catch (error) {
    console.error('Error rephrasing content:', error);
    return chunk; // Return original chunk if there's an error
  }
};

/**
 * Generate a list of hard words based on the Lexile level
 * @param {string} content - The content to analyze
 * @param {number} lexileLevel - The target Lexile level
 * @returns {Promise<Array<{word: string, definition: string}>>} List of hard words with definitions
 */
deepseek.generateHardWordList = async function(content, lexileLevel) {
  // Truncate content if it's too long
  const truncatedContent = content.length > 4000 
    ? content.substring(0, 4000) + '...' 
    : content;
  
  const prompt = `Analyze the following text and identify 5-10 words that would be challenging for a reader at Lexile level ${lexileLevel}.
For each word, provide a simple definition that would be understandable at this reading level.
Format the response as a JSON array with objects containing 'word' and 'definition' properties.
Example format: [{"word": "example", "definition": "a simple explanation"}]

Text to analyze:
${truncatedContent}`;

  try {
    const response = await this.makeRequest(prompt);
    
    // Extract JSON array from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback parsing if the response isn't properly formatted
    const lines = response.split('\n');
    const wordList = [];
    
    for (const line of lines) {
      // Look for patterns like "word - definition" or "word: definition"
      const match = line.match(/^["\s]*([^":,-]+)[":,-]+\s*(.+?)["]*$/);
      if (match) {
        wordList.push({
          word: match[1].trim(),
          definition: match[2].trim()
        });
      }
    }
    
    return wordList.length > 0 ? wordList : JSON.parse(response);
  } catch (error) {
    console.error('Error generating hard word list:', error);
    return []; // Return empty array if there's an error
  }
};
