## Ananas
**An Experimental NodeJS Web Server.**

![directory listing](http://i.imgur.com/ZL0as.png)


## Features
- Static file serving
- Routing and dynamic requests
- Apache-like directory listing with appropriate content-type icons
- Virtual hosts
- Proper `Date`, `Last-Modified`, `Content-Type` and `Content-Length` headers
- Configuration keys for server name, ip, port, directory index file and private urls

##TODO
- Documentation

## Usage
1. copy config.sample.json to config.json
2. review config.json and modify `bind_port` if you like
2. run:
<pre>node server config.json</pre>

## License
[MIT] (http://www.opensource.org/licenses/mit-license.php)
