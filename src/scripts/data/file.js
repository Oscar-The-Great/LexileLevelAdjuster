/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import storage from './storage.js';

const file = {};

export default file;

file.add = async function ({ title, content, createTime, lastAccessTime, length, id, serverStored }) {
  const time = new Date();
  const meta = {
    title,
    createTime: createTime || time,
    lastAccessTime: lastAccessTime || time,
    length: length || (content ? content.length : 0),
    id,
    serverStored
  };
  
  // If serverStored is true, don't store content in IndexedDB
  if (serverStored) {
    await storage.files.add(meta, '');
  } else {
    await storage.files.add(meta, content);
  }
  
  return meta;
};

file.list = async function () {
  return storage.files.list();
};

file.getMeta = async function (id) {
  return storage.files.getMeta(id);
};

file.setMeta = async function (id, meta) {
  // Handle both old and new function signature
  if (typeof id === 'object' && meta === undefined) {
    // Old signature: file.setMeta(meta)
    meta = id;
    id = meta.id;
  }
  
  // Ensure meta is an object
  meta = meta || {};
  meta.id = id;
  meta.lastAccessTime = new Date();
  return storage.files.setMeta(meta);
};

file.getIndex = async function (id) {
  return storage.files.getIndex(id);
};

file.setIndex = async function (index) {
  return storage.files.setIndex(index);
};

file.content = async function (id) {
  return storage.files.getContent(id);
};

file.remove = async function (id) {
  return storage.files.remove(id);
};
