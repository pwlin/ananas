var utils = {

	remove_comments: function(str) {
 		
		/*
		 *  Modified from the original version at http://james.padolsey.com/javascript/javascript-comment-removal-revisted/
		 * 
		 */
		
	    var uid = '_' + (+new Date()),
	        primatives = [],
	        primIndex = 0;
	 
	    return (
	        str
	        /* Remove strings */
	        .replace(/(['"])(\\\1|.)+?\1/g, function(match){
	            primatives[primIndex] = match;
	            return (uid + '') + primIndex++;
	        })
	 
	        /* Remove Regexes */
	        .replace(/([^\/])(\/(?!\*|\/)(\\\/|.)+?\/[gim]{0,3})/g, function(match, $1, $2){
	            primatives[primIndex] = $2;
	            return $1 + (uid + '') + primIndex++;
	        })
	 
	        /*
	        - Remove single-line comments that contain would-be multi-line delimiters
	            E.g. // Comment /* <--
	        - Remove multi-line comments that contain would be single-line delimiters
	            E.g. /* // <-- 
	       */
	        .replace(/\/\/.*?\/?\*.+?(?=\n|\r|$)|\/\*[\s\S]*?\/\/[\s\S]*?\*\//g, '')
	 
	        /*
	        Remove single and multi-line comments,
	        no consideration of inner-contents
	       */
	        .replace(/\/\/.+?(?=\n|\r|$)|\/\*[\s\S]+?\*\//g, '')
	 
	        /*
	        Remove multi-line comments that have a replaced ending (string/regex)
	        Greedy, so no inner strings/regexes will stop it.
	       */
	        .replace(RegExp('\\/\\*[\\s\\S]+' + uid + '\\d+', 'g'), '')
	 
	        /* Bring back strings & regexes */
	        .replace(RegExp(uid + '(\\d+)', 'g'), function(match, n){
	            return primatives[n];
	        })
	    );
	 
	},
	
	
	format_date : function (date, format){
		// format="YYYY-MM-dd hh:mm:ss"
		var o = {
			"Y" : date.getFullYear(),
			"M" : date.getMonth() + 1, //month
			"F" : this.format_month_name(date.getMonth()), // Jan, Feb, etc
			"d" : date.getDate(), //day
			"h" : date.getHours(), //hour
			"m" : date.getMinutes(), //minute
			"s" : date.getSeconds(), //second
			"q" : Math.floor((date.getMonth() + 3) / 3), //quarter
			"S" : date.getMilliseconds() //millisecond
		};

		var str = "(";
		for(var k in o) {
			if(o.hasOwnProperty(k)){
				str += k + "+|";
			}
		}
		str = str.replace(/\|$/, ")");
		
		format = format.replace(new RegExp(str, "g"), function(a, b){
			var data = o[b.substr(0, 1)] + "";
			(data.length % 2 == 1 && data.length % 4 != 3) && (data = "0" + data);
			return data;
		});
		return format;
	},
	
	format_month_name : function(date_month){
		var date_month_name;    
		switch(date_month){
	    	case 0:
			date_month_name = 'Jan';
	          	break;
	   		case 1:
	          	date_month_name = 'Feb';
	          	break;
	        case 2:
	          	date_month_name = 'Mar';
	          	break;
	        case 3:
	          	date_month_name = 'Apr';
	          	break;
	        case 4:
	          	date_month_name = 'May';
	          	break;
	        case 5:
	          	date_month_name = 'Jun';
	          	break;
	        case 6:
	          	date_month_name = 'Jul';
	          	break;
	        case 7:
	          	date_month_name = 'Aug';
	          	break;
	        case 8:
	          	date_month_name = 'Sep';
	          	break;
	        case 9:
	          	date_month_name = 'Oct';
	          	break;
	        case 10:
	          	date_month_name = 'Nov';
	          	break;
	        case 11:
	          	date_month_name = 'Dec';
	          	break;
	        default:
	          	date_month_name = '';
		}
		
		return date_month_name;
	
	},	
	
	url_decode : function(str){
		return decodeURIComponent((str + '').replace(/\+/g, '%20'));
	},
	
	nice_size: function(bytes){
		var s = ['bytes', 'kb', 'MB', 'GB', 'TB', 'PB'],
		e = Math.floor(Math.log(bytes)/Math.log(1024)),
		m = (bytes/Math.pow(1024, Math.floor(e))).toFixed(2),
		se = s[e];
		if(m.match(/\.00$/)) { m = m.replace(/\.00$/, ''); }
		if (m == 'NaN') { 	m = '0'; se = 'bytes'; }
		return m + ' ' + se ; 
	},
	
	trim: function(str){
		str = str.replace(/^\s\s*/, '');
		var ws = /\s/, i = str.length;
		while (ws.test(str.charAt(--i)));
		return str.slice(0, i + 1);
	}
	
	
};

exports.remove_comments = function(str){ return utils.remove_comments(str); }; 
exports.format_date = function(date, format) { return utils.format_date(date, format); };
exports.url_decode = function(str) { return utils.url_decode(str); };
exports.nice_size = function(bytes){ return utils.nice_size(bytes); };
exports.trim = function(str){ return utils.trim(str); };


