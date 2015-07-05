PicXonix
===============

PicXonix is a sort of framework for making [Xonix](https://en.wikipedia.org/wiki/Xonix) clones on JavaScript/Canvas. It features a picture (image) hidden behind the playing field; this modification is borrowed from Sexonix, another Xonix clone. But unlike the latter PicXonix extends the meaning of a picture, allowing to create image-based quiz games.

PicXonix is almost ready-to-use application apart from the lack of real window output and UI (game control).

[Play Demo](http://demos.savreen.com/picxonix/)


Usage
-------------
PicXonix game is initialized by the following syntax:

``` javascript
picxonix(element, options);
```

`element` is a DOM element the PicXonix output (graphics) has to be attached to.

`options` - the main configuration, object containing any combination of the following properties:
* `width`, `height` - default dimensions (width/height) of PicXonix image.
* `sizeCell` - dimension (width = height) of the playfield cell;
* `colorFill`, `colorBorder`, `colorBall`, `colorBallIn` - colors of the playfield elements and objects;
* `timeoutCollision` - time to freeze game after collision;
* `callback` - callback function has to be called when a PicXonix event occurs (see the list below);
* `callbackOnFrame` - boolean indicating whether the above callback function should be called at each animation frame.

`callback` should have the following signature:
``` javascript
function (event) {...}
```

`event` is a PicXonix event index which take one of the following values:
* 0 - "animation frame" event, occurs at each animation frame rendering;
* 1 - "collision" event, occurs when the cursor collide with any of enemy objects;
* 2 - "conquer" event, occurs when the cursor captures area inside the playfield.

Also `options` may contain any of the level configuration properties (see below).

See the demo.html file for an example of usage.


API
-------------
### New Level
Start new level

**Syntax**:
``` javascript
picxonix('level', options);
```

`options` - new level configuration, object containing any combination of the following properties:
* `image` - new level image URL (path). **Mandatory property**;
* `nBalls` - number of Ball objects (white circles in the default configuration);
* `nWarders` - number of Warder objects (black squares in the default configuration);
* `speedCursor` - rate of the Cursor object (dark violet square in the default configuration) speed;
* `speedEnemy` - rate of enemy object (Ball or Warder) speed.


### End Level
Finishes the current level

**Syntax**:
``` javascript
picxonix('end', flag);
```

`flag` - boolean indicating whether the current level's image should be fully disclosed at the level's end


### Playing Mode
Set playing mode for the current level

**Syntax**:
``` javascript
picxonix('play', flag);
```

`flag` - boolean indicating whether the current level is playing or not (paused)


### Level State 
Get the current level state

**Syntax**:
``` javascript
picxonix('state');
```

Returns an object containing the following properties:
* `play` - playing mode flag (boolean);
* `posCursor` - the cursor position in cells (array of 2 elements);
* `warders` - number of Warder objects;
* `speedCursor` - rate of the Cursor object speed;
* `speedEnemy` - rate of enemy object speed.
* `cleared` - percentage of the cleared/conquered area;


### Cursor Movement Direction
Set the cursor movement direction

**Syntax**:
``` javascript
picxonix('cursorDir', dir);
```

`dir` - can be either:
1) `string` - indicates the new direction, take one of the following values: 'left', 'right', 'up', 'down', 'stop'.
2) `array` - position in cells (top/left) where the cursor movement should be directed toward.


### Cursor Speed
Set the cursor speed rate to given value

**Syntax**:
``` javascript
picxonix('cursorSpeed', value);
```


### Enemy Speed
Set enemy speed rate to given value

**Syntax**:
``` javascript
picxonix('enemySpeed', value);
```


### Enemies Spawn
Introduce extra Warder object into the current level

**Syntax**:
``` javascript
picxonix('enemySpawn');
```


License
-------------
PicXonix is released under the [MIT License](http://www.opensource.org/licenses/MIT).
