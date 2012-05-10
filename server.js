/**
 * 
 * Usage: node server.js [config_file]
 * 
 */

//check if a configuration file is passed as argument
if (!process.argv[2]) {
    console.log('Usage: node server.js [config_file]');
    console.error('No configuration file was passed as argument. Exiting...');
    process.exit();
} else {
    var server = require('./lib/ananas/index.js');
    server.init(process.argv[2]);
}
