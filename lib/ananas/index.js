/**
 * Ananas - An Experimental Web Server
 */

var ananas = {

        http : null,
        fs : null,
        url : null,
        path : null,
        utils : null,
        mime : null,
        config : {},
        vhosts : {},

        init : function(config_file){

            this.http = require('http');
            this.fs = require('fs');
            this.url = require('url');
            this.path = require('path');
            this.utils = require('./utils');
            this.mime = require('./mime');
            var self = this;

            this.fs.readFile(config_file, 'binary', function(err, data) {
                if (err) {
                    console.error("Error: the configuration file you passed as first argument does not exist.\n" + 
                    "Please check the file name.\nExiting...");
                    process.exit();
                }
                else {
                    self.config = self.parse_config(data);
                    self.create_server(self.config['http_port']);
                }
            });	     

        },

        parse_config : function(config) {
            return JSON.parse(this.utils.remove_comments(config));
        },

        create_server : function(http_port) {
            var self = this;
            this.http.createServer(function(request, response){ 
                self.on_connection(request, response); 
            }).listen(http_port);
            console.log('Ananas up and running on port ' + http_port + ' ...'); 
        },

        on_connection : function(request, response) {
            var requested_host_name = request.headers.host.match(/\:/) ? request.headers.host.match(/(.*)\:(.*)/)[1].toLowerCase() : request.headers.host.toLowerCase();
            // @todo : enable routing for dynamic pages
            // for now, only static pages:
            this.handle_static(request, response, this.find_vhost_config(requested_host_name));
        },

        find_vhost_config : function(requested_host_name) {
            if (this.vhosts[requested_host_name]) {
                return this.vhosts[requested_host_name];
            }

            var config_vhost_found = false,
            config_vhost = {};

            for(var vhost in this.config['vhosts']) {
                if(this.config['vhosts'].hasOwnProperty(vhost)) {
                    if(vhost.toLowerCase() == requested_host_name) {
                        config_vhost_found = true;
                        config_vhost = this.config['vhosts'][vhost];
                        break;
                    }                       
                }
            }

            if(config_vhost_found === false) {
                config_vhost = this.config['vhosts']['default'];
            }
            config_vhost['vhost_name'] = requested_host_name;
            config_vhost['server_name'] = this.config['server_name'];
            config_vhost['http_port'] = this.config['http_port'];

            this.vhosts[requested_host_name] = config_vhost;
            return this.vhosts[requested_host_name];

        },

        handle_static : function(request, response, config) {

            var filename, 
            private_uri_regexp_pattern = config['private_uri'] ? new RegExp(config['private_uri'], 'ig') : null,
                    uri = this.utils.url_decode(this.url.parse(request.url).pathname),
                    status_code = 200,
                    data = '',
                    content_type = '',
                    self = this;

            config['uri'] = uri;

            if(uri.match(/\/\.|404\.html$/ig) || (config['private_uri'] && uri.match(private_uri_regexp_pattern))) {
                filename = this.path.join(config['www_root'], '404.html');
                status_code = 404;
            }
            else {
                filename = this.path.join(config['www_root'], uri);
            }

            this.fs.stat(filename, function(err, stats) {

                if (stats) {
                    if(stats.isDirectory()) {
                        if(config['directory_listing'] === true && !self.path.existsSync(self.path.join(filename , config['directory_index']))) {
                            data = self.print_directory_listing({'parent' : filename, 'files' : self.fs.readdirSync(filename), 'config' : config});
                            content_type = 'text/html; charset=utf-8';
                        }
                        else {
                            filename = self.path.join(filename, config['directory_index']);                  
                        }
                    }
                }
                else {
                    stats = false;
                    try {
                        stats = self.fs.statSync(filename + '.html');
                    }
                    catch(e) {
                        //console.log(e);
                    }

                    if(stats) {
                        filename += '.html';
                    }
                    else {
                        filename = self.path.join(config['www_root'], '404.html'); 
                        status_code = 404; 
                    }

                }

                self.serve({ 
                    'request': request, 
                    'response' : response, 
                    'filename' : filename, 
                    'status_code' : status_code, 
                    'stats' : stats, 
                    'config' : config, 
                    'data' : data, 
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
            '<tr><td class="parent bordertop"><img src="'+this.mime.mime_type('parent_dir')[1]+'"/><a href="../" title="Parent Directory">Parent Directory</a></td><td class="bordertop">-</td><td class="bordertop">-</td><td class="bordertop">-</td></tr>' +
            '';
            var private_uri_regexp_pattern = opts['config']['private_uri'] ? new RegExp(opts['config']['private_uri'], 'ig') : null; 
            var self = this;
            opts['files'].forEach(function(file, i) {

                var stat = self.fs.statSync(self.path.join(opts['parent'], file)),
                is_dir = false,
                file_icon = '',
                file_size = '';

                if(stat.isDirectory(file)){
                    if((self.path.join(opts['parent'], file)).match(/\/\./ig) || (opts['config']['private_uri'] && (self.path.join(opts['config']['uri'], file).replace(/\\/ig,'/')).match(private_uri_regexp_pattern))) {
                        return;
                    }
                    file = self.path.basename(file)+ '/';
                    is_dir = true ;
                }
                else{
                    file = self.path.basename(file);
                }

                if((self.path.join(opts['parent'], file)).match(/\/\.|404\.html$/ig) || (opts['config']['private_uri'] && (self.path.join(opts['config']['uri'], file)).match(private_uri_regexp_pattern))) {
                    return;
                }

                if(is_dir === true){
                    file_icon = self.mime.mime_type('dir')[1];
                    file_size = '-';
                }           
                else {
                    file_icon = self.mime.mime_type(file)[1];
                    file_size = self.utils.nice_size(stat.size);
                }

                txt += '<tr><td><img src="'+file_icon+'"/><a href="'+file+'">'+file+'</a></td><td>'+self.utils.format_date(stat.mtime, 'F-dd-YYYY hh:mm:ss')+'</td><td>'+file_size+'</td><td>-</td></tr>';           

            });
            txt += '<tr><td colspan="4" class="borderbottom"></td></tr></table>'+
            '<address>'+opts['config']['server_name']+' Server at '+opts['config']['vhost_name']+' Port '+opts['config']['http_port']+'</address>'+
            '</body></html>';

            return txt;

        },

        serve : function(opts) {
            /**
             * opts:
             * request, response, filename, status_code, stats, config, data, content_Type
             */

            if (opts['data'] != '') {
                this.serve_data(opts);
            }
            else {
                this.serve_file(opts);
            }
        },

        serve_data : function(opts) {
            var headers = {
                    'Date' : (new Date()).toUTCString(),
                    'Server' : opts['config']['server_name'],
                    'Content-Length' : Buffer.byteLength(opts['data'], 'utf8'),
                    'Content-Type' : opts['content_type'],
                    'Connection' : 'close'
            };
            opts['response'].writeHead(opts['status_code'], headers); 
            opts['response'].write(opts['data']);
            opts['response'].end();
        },

        serve_file : function(opts) {
            var self = this;

            self.fs.readFile(opts['filename'], 'binary', function(err, data) {

                if(err) {
                    opts['data'] = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">' +
                    '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" />' +
                    '<title>403 Forbidden</title></head><body><h1>Forbidden</h1><p>You don\'t have permission to access '+opts['config']['uri']+' on this server.</p><hr />' +
                    '<address>'+opts['config']['server_name']+' Server at '+opts['config']['vhost_name']+' Port '+opts['config']['http_port']+'</address></body></html>';
                    opts['content_type'] = 'text/html; charset=utf-8';
                    opts['status_code'] = 403;
                    self.serve(opts);
                    return ; 
                }
                else {

                    var headers = {
                            'Date' : (new Date()).toUTCString(),
                            'Server' : opts['config']['server_name'],
                            'Content-Length' : Buffer.byteLength(data, 'binary'),
                            'Content-Type' : self.mime.mime_type(opts['filename'])[0],
                            'Connection' : 'close'
                    };              

                    var modified = true;

                    if (opts['stats'].mtime) {
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

                }

            });

        }



};

exports.init = function(config_file){ 
    ananas.init(config_file); 
}; 

