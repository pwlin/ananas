/**
 * 
 * Usage: 
 * node server.js [config_file]
 *    
 */

// check if a configuration file is passed as argument
if (!process.argv[2]) {
    console.error("Usage: node server.js [config_file]\nNo configuration file was passed as argument.\nExiting...");
    process.exit();
} 
else {
    var server = require('./lib/ananas/index.js');
    server.init(process.argv[2]);
}







