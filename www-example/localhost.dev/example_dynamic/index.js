var example_lib = {

	init : function(opts){
		// opts : request, config, querystring
		return JSON.stringify({'config' : opts['config']});
	}
	
};

exports.init = function(opts){ return example_lib.init(opts); }

