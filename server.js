/**
 * 
 * Usage: node server.js [config_file]
 * 
 */

//check if a configuration file is passed as argument
if (!process.argv[2]) {
    console.error("\nAnanas Error:\n", "Sorry, no configuration file was passed as argument\n",
            "Usage: node server.js config_file\n", "Exiting...\n"
    );
    process.exit();
} else {
    var server = require('./lib/ananas/index.js');
    server.init(process.argv[2]);
}
