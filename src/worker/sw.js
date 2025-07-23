/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

const version = '1.0.0';

const resourceList = [
  '../styles/normalize-8.0.1.css',
  '../styles/index.css',
  '../styles/config.css',
  '../styles/common/main.css',
  '../styles/common/input.css',
  '../styles/icons/icons.css',
  '../styles/icons/icons.svg',
  '../styles/theme/dark.css',
  '../styles/theme/light.css',
  '../scripts/config/config.js',
  '../scripts/data/config.js',
  '../scripts/i18n/i18n.js',
  '../scripts/theme/theme.js',
  '../scripts/ui/util/template.js',
  '../pages/config.html',
  '../pages/list.html',
  '../pages/read.html',
  '../assets/icons/icon.png',
  '../assets/icons/icon.svg',
  '../assets/icons/icon.ico',
  '../',
];

const cacheKey = `page-cache-${version}`;

const cacheFiles = async function () {
  const cache = await caches.open(cacheKey);
  
  // Cache files one by one to handle errors gracefully
  const cachePromises = resourceList.map(async (resource) => {
    try {
      await cache.add(resource);
      console.log(`Cached: ${resource}`);
    } catch (error) {
      console.warn(`Failed to cache: ${resource}`, error);
      // Continue with other resources even if one fails
    }
  });
  
  await Promise.all(cachePromises);
  
  // Clean up old caches
  const keys = await caches.keys();
  await Promise.all(keys.map(async key => {
    if (key === cacheKey) return;
    await caches.delete(key);
  }));
};

self.addEventListener('install', function (event) {
  event.waitUntil(cacheFiles());
});

self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET') {
    if (url.href === new URL('?version', location.href).href) {
      const versionText = `/* VERSION */${JSON.stringify(version)}/* VERSION */`;
      const init = { status: 200, headers: { 'Content-Type': 'text/plain' } };
      event.respondWith(new Response(versionText, init));
      return;
    }
    
    // Handle API requests separately
    if (url.pathname.startsWith('/api/')) {
      return; // Let the network handle API requests
    }
    
    event.respondWith(
      caches.match(event.request).then(function (response) {
        if (response) {
          return response;
        }
        
        // If not in cache, fetch from network
        return fetch(event.request).then(function (networkResponse) {
          // Don't cache non-successful responses
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          
          // Clone the response as it can only be consumed once
          const responseToCache = networkResponse.clone();
          
          // Add to cache for future use
          caches.open(cacheKey).then(function (cache) {
            cache.put(event.request, responseToCache);
          });
          
          return networkResponse;
        }).catch(function (error) {
          console.error('Fetch failed:', error);
          // Return a fallback response if available
          return new Response('Network error occurred', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
    );
  }
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== cacheKey) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
