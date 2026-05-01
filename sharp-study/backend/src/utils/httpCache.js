const crypto = require('crypto');

function createEtag(payload) {
  return `"${crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex')}"`;
}

function sendCachedJson(req, res, payload, options = {}) {
  const etag = createEtag(payload);
  const lastModified = options.lastModified
    ? new Date(options.lastModified).toUTCString()
    : new Date().toUTCString();

  res.set('ETag', etag);
  res.set('Last-Modified', lastModified);
  res.set('Cache-Control', options.cacheControl || 'private, max-age=30, must-revalidate');

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  const ifModifiedSince = req.headers['if-modified-since'];
  if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(lastModified)) {
    return res.status(304).end();
  }

  return res.json(payload);
}

module.exports = { sendCachedJson };
