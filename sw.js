importScripts('/assets/js/sw-toolbox.js');

const config = {
  offlinePage: '/404.html'
};

config.filesToCache = [
    '/',
    config.offlinePage,
    '/index.html',
    '/blog/index.html',
    '/assets/images/hero_image.jpg',
    '/sw.js',
    '/about/',
    '/assets/favicon/manifest.json'
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
    // never use cached version for AMP CORS requests (e.g. amp-live-list)
    if (request.url.indexOf("__amp_source_origin") != -1) {
      return toolbox.networkOnly(request, values);
    }
    // cache or network - whatever is fastest
    return toolbox.fastest(request, values).catch(function() {
        return toolbox.cacheOnly(new Request(config.offlinePage), values);
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
    // cache all other requests
    return toolbox.fastest(request, values);
  }
}

toolbox.options.debug = false;
toolbox.router.default = toolbox.networkOnly;
toolbox.router.get('/(.*)', ampByExampleHandler, {origin: self.location.origin});
// cache first google fonts
toolbox.router.get('/(.+)', toolbox.cacheFirst, {origin: /https?:\/\/fonts.+/});

toolbox.precache(config.filesToCache);