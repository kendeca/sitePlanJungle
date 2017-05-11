// ===============================================
// Global variables
var socket;
var focusedTiles = {};

// ===============================================
// Main Routine 
window.onload = function() { 
    var paper = new Raphael(document.getElementById('canvas_container'), 500, 500);
    socket = io.connect('/');
    var img = paper.image("http://i.imgur.com/L9uSTVr.png", 0, 0, 3024, 2160);
    var tiles = [];

    // tile 0
    tiles.push(paper.rect(210, 200, 80, 50).attr({fill: '#000', 'fill-opacity': 0.5, stroke: 'none'}));
    tiles[0].node.onclick = function() {
        stealSelection(0, focusedTiles, tiles);
    };
    // requestTilePosition(0);

    // select tile 0
    tiles[0].attr({ stroke: '#802', 'stroke-width': 3, 'stroke-opacity': 0.5, cursor: 'move'});
    // make tile 0 draggable
    tiles[0].drag(ongoingDrag, onStartDrag, onEndDrag);
    focusedTiles.selectedTile = 0;

    // tile 1
    tiles.push(paper.rect(210, 265, 80, 50).attr({fill: '#000', 'fill-opacity': 0.5, stroke: 'none'}));
    tiles[1].node.onclick = function() {
        stealSelection(1, focusedTiles, tiles);
    };
    // requestTilePosition(1);

    requestAllTiles();

    // ------------------------------------
    // Render buttons
    var button = [];
    // A button included to trigger various debugging related activities.
    button.push(paper.rect(450, 450, 40, 40).attr({fill: '#005'}));
    button[0].node.onclick = function() {
        requestTilePosition(1);
    };

    // ------------------------------------
    // We will receive (as well as send) tile location updates on the broadcast channel
    socket.on('broadcast', function(data) {
        console.log("Received: 'broadcast' => tile_id " + data.tile_id + " at " + data.x + " " + data.y);

        if(data.tile_id in tiles) {
            // Tile is already in array; update the data for the tile.
            tiles[data.tile_id].attr({ x: data.x, y: data.y });
        } else {
            // This is a new tile; add it at the specified location.
            tiles.push(paper.rect(data.x, data.y, 80, 50).attr({fill: '#000', 'fill-opacity': 0.5, stroke: 'none'}));
            tiles[data.tile_id].node.onclick = function() {
                stealSelection(data.tile_id, focusedTiles, tiles);
            };
        }
    });
}

// ===============================================
// OnClick callback making tiles draggable
function stealSelection(thisTileNum, focusedTiles, tiles) {
    if(thisTileNum != focusedTiles.selectedTile) {
        // remove highlight on previously selected tile
        tiles[focusedTiles.selectedTile].attr({ stroke: 'none', cursor: 'auto' });
        // set undrag on previously selected tile
        tiles[focusedTiles.selectedTile].undrag();

        // highlight tile with red stroke
        tiles[thisTileNum].attr({ stroke: '#802', 'stroke-width': 3, 'stroke-opacity': 0.5, cursor: 'move' });
        // make tile draggable
        tiles[thisTileNum].drag(ongoingDrag, onStartDrag, onEndDrag);

        focusedTiles.selectedTile = thisTileNum;
    }
}

// ===============================================
// Callbacks for dragging tiles
function ongoingDrag(dx, dy) {
    this.attr({ x: this.ox + dx, y: this.oy + dy });
}

function onStartDrag() {
    this.ox = this.attr("x");
    this.oy = this.attr("y");
}

function onEndDrag() {
    // report new final position to server
    updateTilePosition(focusedTiles.selectedTile, this.attr("x"), this.attr("y"));
}

// ===============================================
// Send updated tile position through the socket back to the database
function updateTilePosition(id, xpos, ypos) {
    console.log("Sending position: " + xpos + " " + ypos + " for tile number: " + id);

    var data = {
        tile_id: id,
        x: xpos,
        y: ypos
    };

    // Send that object to the socket
    socket.emit('broadcast', data);
}

// ===============================================
// Send message on server channel requesting update of tile position
function requestTilePosition(id) {
    console.log("Sending: 'server' => requesting update of tile_id " + id);

    var message = {
        tile_id: id
    };

    socket.emit('server', message);
}

// ===============================================
// Send message on server channel requesting update on ALL tiles 
function requestAllTiles() {
    console.log("Sending: 'server' => requesting update on all tiles");

    // Any message received by the server on the 'server' channel that lacks the 'tile_id' key
    // will generate the full dump of all tile data.
    socket.emit('server', {});
}
