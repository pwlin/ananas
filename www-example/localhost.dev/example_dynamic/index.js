var example_lib = {

	init : function(opts){
		// opts : request, config, querystring
		
		//return JSON.stringify({'config' : opts['config']});
		var $return = {
				'content' : JSON.stringify({ 'config' : opts['config'] }),
				'status_code' : 200,
				'content_type' : 'text/javascript; charset=utf-8' 
		};	
		return $return;
	}
	
};

exports.init = function(opts){ return example_lib.init(opts); };

