## Ananas
**An Experimental NodeJS Web Server.**

![directory listing](https://a248.e.akamai.net/camo.github.com/62590934d753d230b9c3f78bcf4d6448d7955846/687474703a2f2f692e696d6775722e636f6d2f484674786e2e706e67)


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
2. review config.json and modify `http_port` if you like
2. run:
<pre>node server config.json</pre>

## License
[MIT] (http://www.opensource.org/licenses/mit-license.php)
