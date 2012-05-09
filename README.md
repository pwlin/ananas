## Ananas
An Experimental NodeJS Web Server.

## Features
- Static file serving
- Apache-like directory listing with appropriate content-type icons
- Virtual hosts
- Proper `Date`, `Last-Modified`, `Content-Type` and `Content-Length` headers
- Configuration keys for server name, http port, directory index file and private urls

##TODO
- Documentation
- Routing & dynamic pages

## Usage
1. copy config.sample.json to config.json
2. review config.js and modify `http_port` if you like
2. run:
<pre>node server config.js</pre>

## License
[MIT] (http://www.opensource.org/licenses/mit-license.php)
