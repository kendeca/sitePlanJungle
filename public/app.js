// ===============================================
// Global variables
var socket;

// The following items had to be moved up here simply so that scale_factor would be global and thus 
// it would be available in all the functions.
var image_size_pixels = {'x': 3024, 'y': 2160};
var console_size_phys = {'x':300000 /* mm */};
var aspect_ratio = image_size_pixels.y/image_size_pixels.x;
console_size_phys.y = aspect_ratio*console_size_phys.x;
var scale_factor = console_size_phys.x/image_size_pixels.x /* mm/pixel */;

// Keeps track of the tile_id on which mousedown() was last triggered.  Effectively this is our
// selected tile.
var lastClickedId;

// There are times when we must perform an order N scan of all the tiles in the system.
// To perform this operation we need to know the bounds 0, ... , id_max of all tiles.
// Let's keep track of id_max on the fly.
var max_tile_id = 0;

// These two unfortunate globals keep track of the offset when the user picks up a tile
// to drag it.  Since only one element can be dragged at a time I don't anticipate any 
// issue with keeping a single copy of the data as a global.
// @TODO - Find a way to store this data in the tile element rather than as a global
//   simply because this is so ugly.
var grab_deltax;
var grab_deltay;

// ===============================================
// Main Routine 
window.onload = function() { 
    
    socket = io.connect('/');
    // We will define our own physical coords tied to the map.  In this coordinate system 1 unit in this app will 
    // correspond to 1 mm measured on the ground in the Van Nuys Civic Center Plaza.  I intend to avoid the use 
    // of floats in this code, thus I have chosen 1 mm since that exceeds the finest resolution I ever expect 
    // this code to need for any purpose.

    // ------------------------------------
    // Load tiles from server
    requestAllTiles();

    // ------------------------------------
    // Install callback responsible for handling dragging of tiles on mousemove
    $(document).mousemove(function(event) {
        // There should only be one element on the page with a 'move' attached,
        // that one being the one selected when mousedown was triggered. That 
        // is why it is safe to operate 'mousemove' at document level.  
        // Furthermore this insures that 'mousemove' will still operate even if 
        // the mouse drifts off of the element being dragged.
        $('.moveTile').css('left', event.pageX - grab_deltax).css('top', event.pageY - grab_deltay);
    });

    // ------------------------------------
    // Install callback responsible for handling dropping of tiles
    $(document).mouseup(function(event) {
        reportTileLocationToServer(retrieveTileLocationViaEvent(event));
        $('.moveTile').removeClass('moveTile');
    });

    // ------------------------------------
    // Install keyboard listeners to handle tile nudging commands
    Mousetrap.bind('ctrl+w', function() {
        var tile = nudgeTile(lastClickedId, 'up');
        reportTileLocationToServer(tile);
    });
    Mousetrap.bind('ctrl+s', function() {
        var tile = nudgeTile(lastClickedId, 'down');
        reportTileLocationToServer(tile);
    });
    Mousetrap.bind('ctrl+a', function() {
        var tile = nudgeTile(lastClickedId, 'left');
        reportTileLocationToServer(tile);
    }); 
    Mousetrap.bind('ctrl+d', function() {
        var tile = nudgeTile(lastClickedId, 'right');
        reportTileLocationToServer(tile);
    });  
    Mousetrap.bind('ctrl+q', function() {
        var tile = nudgeTile(lastClickedId, 'ccw'); // counter-clockwise
        reportTileAngleToServer(tile);
    });
    Mousetrap.bind('ctrl+e', function() {
        var tile = nudgeTile(lastClickedId, 'cw'); // clockwise
        reportTileAngleToServer(tile);
    });
    
    // ------------------------------------
    // 'broadcast' channel listener
    //     supports all CRUD operations
    socket.on('broadcast', function(data) {
        if (!('op' in data)) {
            console.log("Error: 'broadcast' => data received with unspecified operation (no op found).");
            // @TODO - Should probably throw an error here if the op param is not found in data.
            // @TODO - Need to check that value of 'op' is 'c', 'r', 'u' or 'd' and if not, throw an error.
            //     Or perhaps I should just use a switch statement and have the default throw an error.

        } else if(data.op == 'u') {
            // ------------------------------
            // Update operation implementation
            console.log("Received: 'broadcast' => update tile_id " + data.tile_id + " to " + data.x + " " + data.y 
                + " with theta " + data.theta + " etc...");

            // @TODO - Implement an update operation here.  Using renderTile() is incorrect.  We could call moveTile
            //   except that it does not handle changes in theta.
            // renderTile(data);

        } else if(data.op == 'c') {
            // ------------------------------
            // Create operation implementation
            console.log("Received: 'broadcast' => create (op = 'c') tile_id " + data.tile_id + " at " + data.location.x 
                + " " + data.location.y + " with theta " + data.theta + " etc...");

            renderTile(data);

        } else if(data.op == 'r') {
            // ------------------------------
            // Read operation implementation
            //   Querying clients for tile locations is stupid.
            console.log("Error: 'broadcast' => client queried for tile location.");

            // do nothing

        } else if(data.op == 'd') {
            // ------------------------------
            // Delete operation implementation
            console.log("Received: 'broadcast' => delete (op = 'd') tile_id " + data.tile_id);

            // @TODO - reimplement delete operation.
            // tiles[data.tile_id][0].remove();
            // delete tiles[data.tile_id];

        } // @TODO - else throw error
    });
}


// ===============================================
// ===============================================
// Report creation of new tile to the server
function reportTileCreationToServer(tile) {
    console.log("Sending 'broadcast': created tile_id " + tile.tile_id + " at " + tile.location.x + " " 
        + tile.location.y);

    tile.op = 'c';

    socket.emit('broadcast', tile);
}

// ===============================================
// Send updated tile position through the socket back to the server
function reportTileLocationToServer(tile) {
    var new_x = Math.round(tile.screen.x*scale_factor);
    var new_y = Math.round(tile.screen.y*scale_factor);

    console.log("Sending 'broadcast': update tile_id " + tile.tile_id + " at " + new_x + " " + new_y);

    var data = {
        op: 'l',  // op 'l' refers to a location-only update.
        tile_id: tile.tile_id,
        x: new_x,
        y: new_y,
    };

    socket.emit('broadcast', data);
}

// ===============================================
// Send updated tile angle to the server
function reportTileAngleToServer(tile) {
    console.log("Sending 'broadcast': update tile_id " + tile.tile_id + " with theta " + tile.theta);

    var data = {
        op: 'a',  // op 'a' refers to an angle-only update.
        tile_id: tile.tile_id,
        theta: tile.theta
    };

    socket.emit('broadcast', data);
}

// ===============================================
// Report tile deletion to the server
function reportTileDeletionToServer(tile) {
    console.log("Sending 'broadcast': deleted tile_id " + tile.tile_id);

    var data = {
        op: 'd',  // op 'd' for delete
        tile_id: tile.tile_id
    };

    socket.emit('broadcast', data);
}

// ===============================================
// Send message on server channel requesting update on ALL tiles 
function requestAllTiles() {
    console.log("Sending: 'server' => requesting initialization on all tiles");

    // Any message received by the server on the 'server' channel that lacks the 'tile_id' key
    // will generate the full dump of all tile data.
    socket.emit('server', {});
}
