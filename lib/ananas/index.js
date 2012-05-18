"use strict";

var http = require('http'),
    fs = require('fs'),
    url = require('url'),
    path = require('path'),
    querystring = require('querystring'),
    utils = require('./utils'),
    mime = require('./mime'),
    configuration_file = '',
    configuration_data = '',
    vhosts = {};

var ananas = {

        init : function(config_file) {
            var self = this;
            return fs.readFile(config_file, 'binary', function(err, data) {
                if(err) {
                    console.error("\nAnanas Error:\n", "Sorry, the configuration file you passed to Ananas (" + config_file + ") does not exists.\n",
                            "Please check the file name and try again.\n", "Exiting...\n"
                    );
                    process.exit();
                    return false;
                }
                else {
                    configuration_file = config_file;
                    configuration_data = data;
                    return self.create_server();
                }
            });
        },

        create_server : function() {
            var self = this;
            var config = JSON.parse(utils.remove_comments(configuration_data));
            var bind_ip = config['bind_ip'] && config['bind_ip'] != '*' ? config['bind_ip'] : null;
            var bind_port = config['bind_port'] ? config['bind_port'] : '8080';
            http.createServer(function(request, response) {
                return self.on_connection(request, response);
            }).listen(bind_port, bind_ip);
            console.log("\nAnanas up and running on:\n", "IP: " + config['bind_ip'] + "\n", "PORT: " + bind_port + "\n");
        },
        
        on_connection : function(request, response) {
            var requested_host_name = request.headers.host.match(/\:/) ? request.headers.host.match(/(.*)\:(.*)/)[1].toLowerCase() : request.headers.host.toLowerCase();
            var config = this.find_vhost_config(requested_host_name);
            config['uri'] = utils.url_decode(url.parse(request.url).pathname);
            return this.handle_dynamic(request, response, config) || this.handle_static(request, response, config);
        },
        
        find_vhost_config : function(requested_host_name, fresh) {
            fresh = fresh || false;
            if (vhosts[requested_host_name] && fresh === false) {
                return vhosts[requested_host_name];
            }
            var config_vhost_found = false;
            var config = {};
            if (fresh === false) {
                config = JSON.parse(utils.remove_comments(configuration_data));
            } 
            else {
                config = fs.readFileSync(configuration_file, 'binary');
                config = JSON.parse(utils.remove_comments(config));
            }
            var config_vhost = {};
            for(var vhost in config['vhosts']) {
               if(config['vhosts'].hasOwnProperty(vhost)) {
                   if(vhost.toLowerCase() == requested_host_name) {
                       if(config['vhosts'][vhost]['mirror']) {
                           config_vhost = utils.merge_objects(config['vhosts'][config['vhosts'][vhost]['mirror']], config['vhosts'][vhost]);
                           delete config_vhost['mirror'];
                       }
                       else {
                           config_vhost = config['vhosts'][vhost];
                       }
                       config_vhost_found = true;
                       break;
                   }
               }               
            }
            if (config_vhost_found === false) {
                config_vhost = config['vhosts']['default'];
            }
            config_vhost['app_status'] = config['app_status'];
            config_vhost['vhost_name'] = requested_host_name;
            config_vhost['server_name'] = config['server_name'];
            config_vhost['bind_port'] = config['bind_port'];
            vhosts[requested_host_name] = config_vhost;
            return config_vhost;            
        },
        
        handle_dynamic : function(request, response, config) {
            if(!config['routes']) {
                return false;
            }
            var status_code = 200;
            var content_type = 'text/plain';
            var data = {} || '';
            var content = '';
            var self = this;
            var route_found = false;
            if(config['app_status'].toLowerCase() == 'dev') {
                config = this.find_vhost_config(config['vhost_name'], true);
                config['uri'] = utils.url_decode(url.parse(request.url).pathname);
            }
            for(var route in config['routes']) {
                if(config['routes'].hasOwnProperty(route)) {
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

