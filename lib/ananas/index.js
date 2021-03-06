// Enter strict mode
"use strict";

// Include essential libraries
var http = require('http'),
    fs = require('fs'),
    url = require('url'),
    path = require('path'),
    querystring = require('querystring'),
    utils = require('./utils'),
    mime = require('./mime');

/**
 * Holds the path to current config file
 * @type {String}
 */
var configuration_file = '';

/**
 * Holds the unparsed config data
 * @type {String}
 */
var configuration_data = '';

/**
 * Hold a list of current virtual hosts
 * @type {Object}
 */
var vhosts = {};

/**
 * Ananas main library
 * @type {Object}
 */
var ananas = {

        /**
         * Starting point
         * @param {String} config_file the path to a valid configuration file 
         * @returns {Boolean}
         */
        init : function(config_file) {
            // cache this locally
            var self = this;
            // read config_file
            return fs.readFile(config_file, 'binary', function(err, data) {
                // if there is any error, return a message and stop processing further
                if(err) {
                    console.error("\nAnanas Error:\n", "Sorry, the configuration file you passed to Ananas (" + config_file + ") does not exists.\n",
                            "Please check the file name/path and try again.\n", "Exiting...\n"
                    );
                    process.exit();
                    return false;
                }
                else {
                    // we could read config_file successfully
                    // save config_file path and its contents
                    configuration_file = config_file;
                    configuration_data = data;
                    // start the server
                    return self.create_server();
                }
            });
        },

        /**
         * Start the server
         * @returns {Void}
         */
        create_server : function() {
            // cache this locally
            var self = this;
            // convert the configuration data to a temporary JSON object
            var config = JSON.parse(utils.remove_comments(configuration_data));
            // if we have a bind_ip key in our configuration and it's not "*" (meaning all IP addresses), 
            // use it when creating the server 
            var bind_ip = config['bind_ip'] && config['bind_ip'] != '*' ? config['bind_ip'] : null;
            // if we have a bind_port key in our configuration, use it when creating the server, otherwise use port 8080
            var bind_port = config['bind_port'] ? config['bind_port'] : '8080';
            // create the server
            http.createServer(function(request, response) {
                // set the callback function for accepting connections
                return self.on_connection(request, response);
            }).listen(bind_port, bind_ip);
            console.log("\nAnanas up and running on:\n", "IP: " + config['bind_ip'] + "\n", "PORT: " + bind_port + "\n");
        },
        
        /**
         * Callback function for accepting connections
         * @param {Object} request
         * @param {Object} response
         * @returns {Boolean}
         */
        on_connection : function(request, response) {
            // define the requested host name
            var requested_host_name = request.headers.host.match(/\:/) ? request.headers.host.match(/(.*)\:(.*)/)[1].toLowerCase() : request.headers.host.toLowerCase();
            // get the configuration for the requested host name
            var config = this.find_vhost_config(requested_host_name);
            // add the uri to the configuration object for the requested host name
            config['uri'] = utils.url_decode(url.parse(request.url).pathname);
            // check if this is a dynamic uri, otherwise fallback to handle staic files
            return this.handle_dynamic(request, response, config) || this.handle_static(request, response, config);
        },
        
        /**
         * Find the configuration for the requested host name
         * @param {String} requested_host_name get the configuration for this host name
         * @param {Boolean} fresh may get the fresh configuration instead of the memory cache
         * @returns {Object}
         */
        find_vhost_config : function(requested_host_name, fresh) {
            // if fresh is not defined, set it to false
            fresh = fresh || false;
            // if vhosts[requested_host_name] is defined and we don't want a fresh configuration, just return the results
            if (vhosts[requested_host_name] && fresh === false) {
                return vhosts[requested_host_name];
            }
            // temporary variable to check if the requested host name has been found
            var config_vhost_found = false;
            // define the configuration object
            var config = {};
            // if we don't want a fresh configuration, parse the configuration data
            if (fresh === false) {
                config = JSON.parse(utils.remove_comments(configuration_data));
            } 
            // if we want a fresh configuration, read the configuration file and parse it
            else {
                config = fs.readFileSync(configuration_file, 'binary');
                config = JSON.parse(utils.remove_comments(config));
            }
            // define the configuration object for the requested host name
            var config_vhost = {};
            // loop through all configurations
            for(var vhost in config['vhosts']) {
               if(config['vhosts'].hasOwnProperty(vhost)) {
                   // if the current vhost is the same as the requested host name
                   if(vhost.toLowerCase() == requested_host_name) {
                       // if the vhost has a 'mirror' key, we need to get the configuration for the original vhost 
                       //and merge it with the configuration of the current vhost
                       if(config['vhosts'][vhost]['mirror']) {
                           config_vhost = utils.merge_objects(config['vhosts'][config['vhosts'][vhost]['mirror']], config['vhosts'][vhost]);
                           // delete the 'mirror' key, as we don't need it anymore
                           delete config_vhost['mirror'];
                       }
                       // if there is no 'mirror' key, this the vhost we were looking for
                       else {
                           config_vhost = config['vhosts'][vhost];
                       }
                       // vhost configurations were found, so we set the temporary varialbe to true
                       config_vhost_found = true;
                       // break from the loop, as we don't need to loop further
                       break;
                   }
               }               
            }
            // if after looping through all the vhosts, we still have no configuration, set it to the 'default' vhost
            if (config_vhost_found === false) {
                config_vhost = config['vhosts']['default'];
            }
            // add some useful stuff to the configuration object for the requested host name
            config_vhost['app_status'] = config['app_status'];
            config_vhost['vhost_name'] = requested_host_name;
            config_vhost['server_name'] = config['server_name'];
            config_vhost['bind_port'] = config['bind_port'];
            vhosts[requested_host_name] = config_vhost;
            // return the configuration object for the requested host name
            return config_vhost;            
        },
        
        /**
         * Handle a dynamic uri
         * @param {Object} request
         * @param {Object} response
         * @param {Object} config the configuration for the requested host name
         * @returns {Boolean} || {Void}
         */
        handle_dynamic : function(request, response, config) {
            // if there are no routes defined, stop processing the configuration and return false
            if(!config['routes']) {
                return false;
            }
            // default HTTP status code
            var status_code = 200;
            // default HTTP content type
            var content_type = 'text/plain';
            
            var data = {} || '';
            var content = '';
            var self = this;
            // a temporary variable to see if route is found, default to false
            var route_found = false;
            // if app_status = dev, we reload the config on every request so there is no need to restart 
            // the script after every change to config file
            if(config['app_status'].toLowerCase() == 'dev') {
                config = this.find_vhost_config(config['vhost_name'], true);
                config['uri'] = utils.url_decode(url.parse(request.url).pathname);
            }
            // loop through the routes  
            for(var route in config['routes']) {
                if(config['routes'].hasOwnProperty(route)) {
                    // if route == uri
                    if((route.replace(/\/$/,'')).toLowerCase() == (config['uri'].replace(/\/$/,'')).toLowerCase()) {
                        try {
                            var my_route_lib = require(config['routes'][route]['map_to']);
                            if(config['app_status'].toLowerCase() == 'dev') {
                                delete require.cache[require.resolve(config['routes'][route]['map_to'])];
                            }
                            data = my_route_lib.init({
                                'request' : request,
                                'config' : config,
                                'querystring' : querystring.parse(url.parse(request.url).query)
                            }); 
                        }
                        catch(e) {
                            console.error("\nAnanas route error:\n", "Route:\n", route + "\n", "Strack trace:\n", e.stack + "\n");
                        }
                        content_type =  data['content_type'] ||  (config['routes'][route]['content_type'] || content_type);                      
                        status_code = data['status_code'] || (config['routes'][route]['status_code'] || status_code);
                        content = data['content'] || (data || content);
                        route_found = true;                 
                        break;                        
                    }
                }
            }
            if (route_found === true) {
                return self.serve({ 
                    'request': request, 
                    'response' : response, 
                    'status_code' : status_code, 
                    'config' : config, 
                    'content' : content, 
                    'content_type' : content_type 
                });
            } else {
                return false;
            }
        },

        handle_static : function(request, response, config) {
            var filename = '';
            var private_uri_regexp_pattern = config['private_uri'] ? new RegExp(config['private_uri'], 'ig') : false;
            var status_code = 200;
            var content = '';
            var content_type = '';
            var self = this;
            if(config['uri'].match(/\/\.|404\.html$/ig) || (config['private_uri'] && config['uri'].match(private_uri_regexp_pattern))) {
                filename = path.join(config['www_root'], '404.html');
                status_code = 404;
            }
            else {
                filename = path.join(config['www_root'], config['uri']);
            }
            return fs.stat(filename, function(err, stats) {
                if (stats) {
                    if(stats.isDirectory()) {
                        if(config['directory_listing'] === true && !path.existsSync(path.join(filename , config['directory_index']))) {
                            return fs.readdir(filename, function(err, files){
                                return self.serve({ 
                                    'request': request, 
                                    'response' : response, 
                                    'filename' : filename, 
                                    'status_code' : status_code, 
                                    'stats' : stats, 
                                    'config' : config, 
                                    'content' : self.print_directory_listing({'parent' : filename, 'files' : files, 'config' : config}), 
                                    'content_type' : 'text/html; charset=utf-8' 
                                });
                            }); 
                        }
                        else {
                            filename = path.join(filename, config['directory_index']);                  
                        }
                    }
                }
                else {
                    return fs.stat(filename + '.html', function(err, stats){
                        if (err){
                            return self.serve({ 
                                'request': request, 
                                'response' : response, 
                                'filename' : path.join(config['www_root'], '404.html'), 
                                'status_code' : 404, 
                                'stats' : false, 
                                'config' : config, 
                                'content' : content, 
                                'content_type' : content_type 
                            });
                        }
                        else {
                            return self.serve({ 
                                'request': request, 
                                'response' : response, 
                                'filename' : filename += '.html', 
                                'status_code' : status_code, 
                                'stats' : stats, 
                                'config' : config, 
                                'content' : content, 
                                'content_type' : content_type 
                            });
                        }
                    });
                }
                return self.serve({ 
                    'request': request, 
                    'response' : response, 
                    'filename' : filename, 
                    'status_code' : status_code, 
                    'stats' : stats, 
                    'config' : config, 
                    'content' : content, 
                    'content_type' : content_type 
                });
            });
        },
        
        print_directory_listing: function(opts){
            /**
             * opts:
             * parent, files, config 
             */
            var txt = '';
            txt += '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">' +
            '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">' +
            '<head><title>Index of '+opts['config']['uri']+'</title><meta http-equiv="Content-Type" content="text/html; charset=utf-8" />' +
            '<style type="text/css" media="screen">' +
            'body { background: #fff;   color: #000; }' +
            'a:link, a:visited { color: blue; background: transparent; }' +
            'table { font-family: monospace; border: none; width: 90%; border-collapse: collapse; }' +
            'td, th { width: 25%; vertical-align: top; padding-top: 0.3em; padding-bottom: 0.3em; }' +
            'td > img { margin-right: 5px; vertical-align: middle; }' +
            'th { font-weight: normal; text-align: left;}' +
            '.bordertop { border-top: 2px outset #ccc; } ' +
            '.borderbottom { border-bottom: 2px outset #ccc;}' +
            'address { margin: 0; padding: 0.5em 0;}'+
            '</style></head>' +
            '<body><h1>Index of '+opts['config']['uri']+'</h1>' +
            '<table summary="Index of '+opts['config']['uri']+'">' +
            '<tr><th scope="col">Name</th><th scope="col">Last Modified</th><th scope="col">Size</th><th scope="col">Description</th></tr>' +
            '<tr><td class="parent bordertop"><img src="'+mime.mime_type('parent_dir')[1]+'"/><a href="../" title="Parent Directory">Parent Directory</a></td><td class="bordertop">-</td><td class="bordertop">-</td><td class="bordertop">-</td></tr>' +
            '';
            var private_uri_regexp_pattern = opts['config']['private_uri'] ? new RegExp(opts['config']['private_uri'], 'ig') : false; 
            opts['files'].forEach(function(file, i) {
                var stat = fs.statSync(path.join(opts['parent'], file)),
                is_dir = false,
                file_icon = '',
                file_size = '';
                if(stat.isDirectory(file)){
                    if((path.join(opts['parent'], file)).match(/\/\./ig) || (opts['config']['private_uri'] && (path.join(opts['config']['uri'], file).replace(/\\/ig,'/')).match(private_uri_regexp_pattern))) {
                        return false;
                    }
                    file = path.basename(file)+ '/';
                    is_dir = true ;
                }
                else{
                    file = path.basename(file);
                }
                if((path.join(opts['parent'], file)).match(/\/\.|404\.html$/ig) || (opts['config']['private_uri'] && (path.join(opts['config']['uri'], file)).match(private_uri_regexp_pattern))) {
                    return false;
                }
                if(is_dir === true){
                    file_icon = mime.mime_type('dir')[1];
                    file_size = '-';
                }           
                else {
                    file_icon = mime.mime_type(file)[1];
                    file_size = utils.nice_size(stat.size);
                }
                txt += '<tr><td><img src="'+file_icon+'"/><a href="'+file+'">'+file+'</a></td><td>'+utils.format_date(stat.mtime, 'F-dd-YYYY hh:mm:ss')+'</td><td>'+file_size+'</td><td>-</td></tr>';           
            });
            txt += '<tr><td colspan="4" class="borderbottom"></td></tr></table>'+
            '<address>'+opts['config']['server_name']+' Server at '+opts['config']['vhost_name']+' Port '+opts['config']['bind_port']+'</address>'+
            '</body></html>';
            return txt;
        },

        serve : function(opts) {
            /**
             * opts:
             * request, response, filename, status_code, stats, config, data, content_Type
             */
            if (opts['content'] != '') {
                return this.serve_data(opts);
            }
            else {
                return this.serve_file(opts);
            }
        },

        serve_data : function(opts) {
            var headers = {
                    'Date' : (new Date()).toUTCString(),
                    'Server' : opts['config']['server_name'],
                    'Content-Length' : Buffer.byteLength(opts['content'], 'utf8'),
                    'Content-Type' : opts['content_type'],
                    'Connection' : 'close'
            };
            opts['response'].writeHead(opts['status_code'], headers); 
            opts['response'].write(opts['content']);
            opts['response'].end();
            return true;
        },

        serve_file : function(opts) {
            var self = this;
            return fs.readFile(opts['filename'], 'binary', function(err, data) {
                if(err) {
                    opts['data'] = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">' +
                    '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" />' +
                    '<title>403 Forbidden</title></head><body><h1>Forbidden</h1><p>You don\'t have permission to access '+opts['config']['uri']+' on this server.</p><hr />' +
                    '<address>'+opts['config']['server_name']+' Server at '+opts['config']['vhost_name']+' Port '+opts['config']['bind_port']+'</address></body></html>';
                    opts['content_type'] = 'text/html; charset=utf-8';
                    opts['status_code'] = 403;
                    return self.serve(opts);
                }
                else {
                    var headers = {
                            'Date' : (new Date()).toUTCString(),
                            'Server' : opts['config']['server_name'],
                            'Content-Length' : Buffer.byteLength(data, 'binary'),
                            'Content-Type' : mime.mime_type(opts['filename'])[0],
                            'Connection' : 'close'
                    };              
                    var modified = true;
                    if (opts['stats'] && opts['stats'].mtime) {
                        var mtime = (new Date(opts['request'].headers['if-modified-since'])).valueOf();
                        if(mtime >= opts['stats'].mtime.valueOf()){
                            modified = false;
                        }
                    }
                    if (modified === false) {
                        opts['response'].writeHead(304, {'Connection': 'close'});
                    } 
                    else {
                        if(opts['stats'] && !headers['Content-Type'].match(/text\/html/)) {
                            headers['Last-Modified'] = (new Date(opts['stats'].mtime)).toUTCString();
                        }
                        opts['response'].writeHead(opts['status_code'], headers); 
                        opts['response'].write(data, 'binary');
                    }
                    opts['response'].end();
                    return true;
                }
            });
        }

};

exports.init = function(config_file) {
    return ananas.init(config_file);
};

