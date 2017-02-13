importScripts('/assets/sw/sw-toolbox.js');


const config = {
  offlinePage: '/offline.html'
};

const IGNORED_URLS = [];

config.filesToCache = [
    '/',
    config.offlinePage,
    '/offline.html',
    '/404.html',
    '/index.html',
    '/blog/index.html',
    '/assets/images/hero_image.jpg',
    '/sw.js',
    '/about/',
    '/assets/favicon/manifest.json',
    '/assets/lightbox/lightbox-plus-jquery.min.js'
];

/**
 * Generates a placeholder SVG image of the given size.
 */
function offlineImage(name, width, height) {
  return `<?xml version="1.0"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" version="1.1">
  <g fill="none" fill-rule="evenodd"><path fill="#F8BBD0" d="M0 0h${width}v${height}H0z"/></g>
  <text text-anchor="middle" x="${Math.floor(width / 2)}" y="${Math.floor(height / 2)}">image offline (${name})</text>
<style><![CDATA[
text{
  font: 48px Roboto,Verdana, Helvetica, Arial, sans-serif;
}
]]></style>
</svg>`;
}
/**
 * Returns true if the Accept header contains the given content type string.
 */
function requestAccepts(request, contentType) {
  return request.headers.get('Accept').indexOf(contentType) != -1;
}

/**
 * ampbyexample.com fetch handler:
 *
 * - one-behind caching
 * - shows offline page
 * - generates placeholder image for unavailable images
 */
function ampByExampleHandler(request, values) {
  // for samples show offline page if offline and samples are not cached
  if (requestAccepts(request, 'text/html')) {
    // never use cached version for AMP CORS requests (e.g. amp-live-list) or pages that shouldn't be cached
    if (request.url.indexOf("__amp_source_origin") != -1 || shouldNotCache(request)) {
      return toolbox.networkOnly(request, values);
    }
    // network first, we always want to get the latest
    return toolbox.networkFirst(request, values).catch(function() {
      return toolbox.cacheOnly(new Request(config.offlinePage), values)
        .then(function(response) {
          return response || new Response('You\'re offline. Sorry.', {
            status: 500,
            statusText: 'Offline Page Missing'
          });
        });
    });
  }
  // always try to load images from the cache first
  // fallback to placeholder SVG image if offline and image not available
  if (requestAccepts(request, 'image/')) {
    return toolbox.cacheFirst(request, values).catch(function() {
      const url = request.url;
      const fileName = url.substring(url.lastIndexOf('/') + 1);
      // TODO use correct image dimensions
      return new Response(offlineImage(fileName, 1080, 610),
          { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    });
  } else {
    // cache first for all other requests
    return toolbox.cacheFirst(request, values);
  }
}

function shouldNotCache(request) {
  return IGNORED_URLS.some(url => request.url.indexOf(url) != -1);
}

toolbox.options.debug = false;
toolbox.router.default = toolbox.networkFirst;
toolbox.router.get('/(.*)', ampByExampleHandler, {origin: self.location.origin});
// network first amp runtime

toolbox.precache(config.filesToCache);

// Cache the page registering the service worker. Without this, the
// "first" page the user visits is only cached on the second visit,
// since the first load is uncontrolled.
toolbox.precache(
  clients.matchAll({includeUncontrolled: true}).then(l => {
    return l.map(c => c.url);
  })
);

// Claim clients so that the very first page load is controlled by a service
// worker. (Important for responding correctly in offline state.)
self.addEventListener('activate', () => self.clients.claim());

// Make sure the SW the page we register() is the service we use.
self.addEventListener('install', () => self.skipWaiting());