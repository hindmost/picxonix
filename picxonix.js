/**
 * PicXonix
 * https://github.com/hindmost/picxonix
 * @author   Savr Goryaev
 * @license  MIT http://www.opensource.org/licenses/MIT
 */

// requestAnimationFrame/cancelAnimationFrame polyfill:
(function() {
    var tLast = 0;
    var vendors = ['webkit', 'moz'];
    for(var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
        var v = vendors[i];
        window.requestAnimationFrame = window[v+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[v+'CancelAnimationFrame'] ||
            window[v+'CancelRequestAnimationFrame'];
    }
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var tNow = Date.now();
            var dt = Math.max(0, 17 - tNow + tLast);
            var id = setTimeout(function() { callback(tNow + dt); }, dt);
            tLast = tNow + dt;
            return id;
        };
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

(function() {

    window.picxonix = function(v1, v2) {
        if (typeof v1 != 'string') {
            return init(v1, v2);
        }
        switch (v1) {
            case 'level': // start new level
                loadLevel(v2);
                break;
            case 'reset': // reset game
                resetGame();
                break;
            case 'end': // finish the current level
                endLevel(v2);
                break;
            case 'play': // set playing mode
                setPlayMode(v2);
                break;
            case 'cursorDir': // set the cursor movement direction
                typeof v2 == 'string'? setDir(v2) : setDirToward(v2);
                break;
            case 'cursorSpeed': // set the cursor speed
                setCursorSpeed(v2);
                break;
            case 'enemySpeed': // set enemy speed
                setEnemySpeed(v2);
                break;
            case 'enemySpawn': // introduce extra warder object
                spawn();
                break;
            case 'state': // get the current level state
                return buildLevelState();
            default:
        }
        return 0;
    }

    var cfgMain = {
        width: 600,
        height: 400,
        sizeCell: 10,
        colorFill: '#000000',
        colorBorder: '#00aaaa',
        colorBall: '#ffffff',
        colorBallIn: '#000000',
        colorWarder: '#000000',
        colorWarderIn: '#f80000',
        colorCursor: '#aa00aa',
        colorCursorIn: '#00aaaa',
        colorTrail: '#a800a8',
        timeoutCollision: 1000,
        callback: null,
        callbackOnFrame: false
    };
    var cfgLevel = {
        nBalls: 1,
        nWarders: 1,
        speedCursor: 5,
        speedEnemy: 5
    };
    // cell attributes:
    var CA_CLEAR = 1 << 0;
    var CA_TRAIL = 1 << 1;
    // dimensions:
    var sizeCell;
    var width, height;
    // host objects:
    var elContainer;
    var ctxPic;
    var ctxMain;
    var imgPic;
    var imgBall;
    var imgWarder;
    var imgCursor;
    // custom objects:
    var dirset;
    var cellset;
    var cursor;
    var aBalls = [], aWarders = [];
    var nBalls = 0, nWarders = 0;
    // level state:
    var idFrame = 0;
    var tLevel = 0;
    var tLastFrame = 0;
    var tLocked = 0;
    var bCollision = false;
    var bConquer = false;
    var dirhash = {
        'left': 180, 'right': 0, 'up': 270, 'down': 90, 'stop': false
    };

    function init(el, opts) {
        if (elContainer || !el || !el.appendChild) return false;
        elContainer = el;
        // set/modify cfgMain options:
        merge(cfgMain, opts);
        if (!cfgMain.sizeCell) return false;
        sizeCell = cfgMain.sizeCell;
        if (typeof cfgMain.callback != 'function') cfgMain.callback = null;
        // set/modify cfgLevel options:
        if (opts.speedCursor ^ opts.speedEnemy) {
            opts.speedCursor = opts.speedEnemy = Math.max(opts.speedCursor || 0, opts.speedEnemy || 0);
        }
        merge(cfgLevel, opts);
        setLevelData(cfgMain.width, cfgMain.height);
        var oWrap = document.createElement('div');
        oWrap.style.position = 'relative';
        // create background (picture) canvas:
        (function() {
            var canvas = document.createElement('canvas');
            ctxPic = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;
            canvas.style.position = 'absolute';
            canvas.style.left = canvas.style.top = (2*sizeCell) + 'px';
            ctxPic.fillStyle = cfgMain.colorTrail;
            ctxPic.fillRect(0, 0, width, height);
            oWrap.appendChild(canvas);
        }());
        // create main canvas:
        (function() {
            var canvas = document.createElement('canvas');
            ctxMain = canvas.getContext('2d');
            canvas.width = width+ 4*sizeCell;
            canvas.height = height+ 4*sizeCell;
            canvas.style.position = 'absolute';
            canvas.style.left = canvas.style.top = 0;
            fillCanvas();
            ctxMain.fillStyle = cfgMain.colorFill;
            ctxMain.fillRect(2*sizeCell, 2*sizeCell, width, height);
            oWrap.appendChild(canvas);
        }());
        elContainer.appendChild(oWrap);
        // create temp canvas:
        var canvas = document.createElement('canvas');
        var ctxTmp = canvas.getContext('2d');
        canvas.width = sizeCell;
        canvas.height = sizeCell;
        // prepare ball image:
        var r = sizeCell / 2, q = sizeCell / 4;
        ctxTmp.clearRect(0, 0, sizeCell, sizeCell);
        ctxTmp.beginPath();
        ctxTmp.arc(r, r, r, 0, Math.PI * 2, false);
        ctxTmp.fillStyle = cfgMain.colorBall;
        ctxTmp.fill();
        if (cfgMain.colorBallIn) {
            ctxTmp.beginPath();
            ctxTmp.arc(r, r, q, 0, Math.PI * 2, false);
            ctxTmp.fillStyle = cfgMain.colorBallIn;
            ctxTmp.fill();
        }
        imgBall = new Image();
        imgBall.src = ctxTmp.canvas.toDataURL();
        function prepareSquare(colorOut, colorIn) {
            ctxTmp.clearRect(0, 0, sizeCell, sizeCell);
            ctxTmp.fillStyle = colorOut;
            ctxTmp.fillRect(0, 0, sizeCell, sizeCell);
            if (colorIn) {
                ctxTmp.fillStyle = colorIn;
                ctxTmp.fillRect(q, q, sizeCell - r, sizeCell - r);
            }
        }
        // prepare warder image:
        prepareSquare(cfgMain.colorWarder, cfgMain.colorWarderIn);
        imgWarder = new Image();
        imgWarder.src = ctxTmp.canvas.toDataURL();
        // prepare cursor image:
        prepareSquare(cfgMain.colorCursor, cfgMain.colorCursorIn);
        imgCursor = new Image();
        imgCursor.src = ctxTmp.canvas.toDataURL();
        return true;
    }

    function loadLevel(data) {
        if (tLevel || tLastFrame || !data || !data.image) return;
        var img = new Image();
        img.onload = function() {
            applyLevel(img, data);
        };
        img.src = data.image;
    }

    function resetGame() {
        setPlayMode(false);
        endLevel(false);
        setLevelData(cfgMain.width, cfgMain.height);
        ctxMain.canvas.width = width+ 4*sizeCell;
        ctxMain.canvas.height = height+ 4*sizeCell;
        fillCanvas();
        ctxMain.fillStyle = cfgMain.colorFill;
        ctxMain.fillRect(2*sizeCell, 2*sizeCell, width, height);
        ctxPic.canvas.width = width;
        ctxPic.canvas.height = height;
    }

    function applyLevel(img, data) {
        imgPic = img;
        merge(cfgLevel, data, true);
        setLevelData(img.width, img.height);
        ctxMain.canvas.width = width+ 4*sizeCell;
        ctxMain.canvas.height = height+ 4*sizeCell;
        fillCanvas();
        cellset.reset();
        ctxPic.canvas.width = width;
        ctxPic.canvas.height = height;
        ctxPic.drawImage(imgPic, 0, 0, width, height, 0, 0, width, height);
        cfgMain.callback && cfgMain.callback(3);
        if (data.disabled) {
            endLevel(true); return;
        }
        if ('shuffle' in data)
            shuffleImage(data.shuffle);
        var pos = cellset.placeCursor();
        cursor.reset(pos[0], pos[1]);
        aBalls = []; aWarders = [];
        var i, aPos;
        aPos = cellset.placeBalls(nBalls);
        for (i = 0; i < nBalls; i++)
            aBalls.push(new Enemy(aPos[i][0], aPos[i][1], false));
        aPos = cellset.placeWarders(nWarders);
        for (i = 0; i < nWarders; i++)
            aWarders.push(new Enemy(aPos[i][0], aPos[i][1], true, 45));
        tLevel = Date.now();
        tLastFrame = 0;
        startLoop();
    }

    function endLevel(bClear) {
        if (tLastFrame) return;
        tLevel = 0;
        if (!bClear) return;
        fillCanvas();
        ctxMain.clearRect(2*sizeCell, 2*sizeCell, width, height);
    }

    function setLevelData(w, h) {
        if (w) width = w - w % (2*sizeCell);
        if (h) height = h - h % (2*sizeCell);
        if (cfgLevel.nBalls) nBalls = cfgLevel.nBalls;
        if (cfgLevel.nWarders) nWarders = cfgLevel.nWarders;
    }

    function setPlayMode(bOn) {
        if (bOn ^ !tLastFrame) return;
        tLastFrame? endLoop() : startLoop();
    }

    function setDir(key) {
        if (!tLastFrame) return;
        if (key in dirhash) cursor.setDir(dirhash[key]);
    }

    function setDirToward(pos) {
        if (!tLastFrame || !pos || pos.length < 2) return;
        var xc = Math.floor(pos[0] / sizeCell) - 2,
            yc = Math.floor(pos[1] / sizeCell) - 2;
        var b = cellset.isPosValid(xc, yc);
        if (!b) return;
        var posCr = cursor.pos(), dirCr = cursor.getDir(), dir = false;
        if (dirCr === false) {
            var dx = xc - posCr[0], dy = yc - posCr[1],
                dc = Math.abs(dx) - Math.abs(dy);
            if (dc == 0) return;
            dir = dirset.find(dx, dy);
            if (dir % 90 != 0) {
                var dir1 = dir-45, dir2 = dir+45;
                dir = dir1 % 180 == 0 ^ dc < 0? dir1 : dir2;
            }
        }
        else {
            var delta = dirCr % 180? xc - posCr[0] : yc - posCr[1];
            if (!delta) return;
            dir = (delta > 0? 0 : 180) + (dirCr % 180? 0 : 90);
        }
        cursor.setDir(dir);
    }

    function setCursorSpeed(v) {
        if (v > 0) cfgLevel.speedCursor = v;
    }

    function setEnemySpeed(v) {
        if (v > 0) cfgLevel.speedEnemy = v;
    }

    function startLoop() {
        if (!tLevel) return;
        idFrame = requestAnimationFrame(loop);
    }

    function endLoop() {
        if (idFrame) cancelAnimationFrame(idFrame);
        tLastFrame = idFrame = 0;
    }

    // The main animation loop
    function loop(now) {
        var dt = tLastFrame? (now - tLastFrame) / 1000 : 0;
        bCollision = bConquer = false;
        if (!tLastFrame || update(dt)) {
            render();
            tLastFrame = now;
        }
        if (bCollision) {
            lock();
            cfgMain.callback && cfgMain.callback(1);
            return;
        }
        if (bConquer) {
            bConquer = false;
            tLastFrame = 0;
            cellset.conquer();
            if (cfgMain.callback && cfgMain.callback(2))
                return;
        }
        else
            cfgMain.callback && cfgMain.callbackOnFrame && cfgMain.callback(0);
        startLoop();
    }

    function update(dt) {
        var distCursor = Math.round(dt * cfgLevel.speedCursor),
            distEnemy = Math.round(dt * cfgLevel.speedEnemy);
        if (!(distCursor >= 1 || distEnemy >= 1)) return false;
        cursor.update(distCursor);
        var i;
        for (i = 0; i < nBalls; i++) aBalls[i].update(distEnemy);
        for (i = 0; i < nWarders; i++) aWarders[i].update(distEnemy);
        return true;
    }

    function render() {
        cellset.render();
        cursor.render();
        var i;
        for (i = 0; i < nBalls; i++) aBalls[i].render();
        for (i = 0; i < nWarders; i++) aWarders[i].render();
    }

    function lock() {
        tLastFrame = 0;
        bCollision = false;
        var posCr = cursor.pos();
        cellset.add2Trail(posCr[0], posCr[1], false);
        setTimeout(unlock, cfgMain.timeoutCollision);
    }

    function unlock() {
        if (!tLevel) return;
        cellset.clearTrail();
        var pos = cellset.placeCursor();
        cursor.reset(pos[0], pos[1], true);
        var aPos = cellset.placeWarders(nWarders);
        for (var i = 0; i < nWarders; i++)
            aWarders[i].reset(aPos[i][0], aPos[i][1]);
        startLoop();
    }

    function spawn() {
        if (!tLevel) return;
        var pos = cellset.placeSpawned();
        if (!pos) return;
        aWarders.push(new Enemy(pos[0], pos[1], true));
        nWarders++;
    }

    function buildLevelState() {
        return {
            width: width+ 4*sizeCell,
            height: height+ 4*sizeCell,
            play: Boolean(tLastFrame),
            posCursor: cursor.pos(),
            warders: nWarders,
            speedCursor: cfgLevel.speedCursor,
            speedEnemy: cfgLevel.speedEnemy,
            cleared: cellset.getConqueredRatio()
        };
    }

    function shuffleImage(aData) {
        if (aData.length < 3) return;
        var aShuffle = aData.slice();
        var wCell = aShuffle.shift();
        var nShuffle = aShuffle.length;
        var nCols = 2* Math.floor(width/ 2/ wCell);
        var nRows = 2* Math.floor(height/ 2/ wCell);
        var canvas = document.createElement('canvas');
        var ctxTmp = canvas.getContext('2d');
        canvas.width = wCell;
        canvas.height = wCell;
        for (var i = 0; i < nShuffle; i+=2) {
            var ic1 = aShuffle[i], ic2 = aShuffle[i+1];
            var x1 = ic1 % nCols * wCell, y1 = Math.floor(ic1 / nCols) * wCell;
            var x2 = ic2 % nCols * wCell, y2 = Math.floor(ic2 / nCols) * wCell;
            ctxTmp.drawImage(ctxPic.canvas, x1, y1, wCell, wCell, 0, 0, wCell, wCell);
            ctxPic.drawImage(ctxPic.canvas, x2, y2, wCell, wCell, x1, y1, wCell, wCell);
            ctxPic.drawImage(canvas, 0, 0, wCell, wCell, x2, y2, wCell, wCell);
        }
    }

    function fillCanvas() {
        ctxMain.fillStyle = cfgMain.colorBorder;
        ctxMain.fillRect(0, 0, width+ 4*sizeCell, height+ 4*sizeCell);
    }

    function drawCellImg(img, x, y) {
        ctxMain.drawImage(img,
            0, 0, sizeCell, sizeCell,
            (x+2)*sizeCell, (y+2)*sizeCell, sizeCell, sizeCell
        );
    }

    function clearCellArea(x, y, w, h) {
        ctxMain.clearRect(
            (x+2)*sizeCell, (y+2)*sizeCell, (w || 1)* sizeCell, (h || 1)* sizeCell
        );
    }

    function fillCellArea(color, x, y, w, h) {
        ctxMain.fillStyle = color;
        ctxMain.fillRect(
            (x+2)*sizeCell, (y+2)*sizeCell, (w || 1)* sizeCell, (h || 1)* sizeCell
        );
    }

    // The set of available directions:
    dirset = {
        vecs: {
            0: [1, 0], 45: [1, 1], 90: [0, 1], 135: [-1, 1], 180: [-1, 0], 225: [-1, -1], 270: [0, -1], 315: [1, -1]
        },
        get: function(v) {
            return v in this.vecs? this.vecs[v] : [0, 0];
        },
        find: function(x, y) {
            x = x == 0? 0 : (x > 0? 1 : -1);
            y = y == 0? 0 : (y > 0? 1 : -1);
            for (var v in this.vecs) {
                var vec = this.vecs[v];
                if (vec[0] == x && vec[1] == y) return parseInt(v);
            }
            return false;
        }
    };

    // The playing field grid (set of available cells):
    cellset = {
        nW: 0, // width of image in cells
        nH: 0, // height of image in cells
        nWx: 0, // width of grid in cells
        nConquered: 0, // number of conquered cells
        dirTrail: 0, // last direction of the cursor trail (movement)
        cellPreTrail: 0, // index of cell preceding the cursor trail cells
        aCells: [], // array mapping cell index in the grid to a value indicating type of this cell
        aTrail: [], // array of the cursor trail cells' indices
        aTrailNodes: [], // array of the cursor trail node cells' indices
        aTrailRects: [], // array of rectangles comprising the cursor trail line
        reset: function() {
            var nW = this.nW = Math.floor(width / sizeCell);
            var nH = this.nH = Math.floor(height / sizeCell);
            var n = (this.nWx = nW+4)* (nH+4);
            this.nConquered = 0;
            this.aCells = [];
            var aAll = [];
            for (var i = 0; i < n; i++) {
                var pos = this.pos(i), x = pos[0], y = pos[1];
                this.aCells.push(x >= 0 && x < nW && y >= 0 && y < nH? 0 : CA_CLEAR);
                aAll.push(i);
            }
            this.aTrail = [];
            this.aTrailNodes = [];
            this.aTrailRects = [];
            fillCellArea(cfgMain.colorFill, 0, 0, nW, nH);
        },
        render: function() {
            if (this.aTrailRects.length) {
                for (var i = this.aTrailRects.length-1; i >= 0; i--) {
                    fillCellArea.apply(null, [cfgMain.colorFill].concat(this.aTrailRects[i]));
                }
                this.aTrailRects = [];
            }
        },
        isPosIn: function(x, y) {
            return x >= 0 && x < this.nW && y >= 0 && y < this.nH;
        },
        isPosValid: function(x, y) {
            return x >= -2 && x < this.nW+2 && y >= -2 && y < this.nH+2;
        },
        // get index of given cell in the grid
        index: function(x, y) {
            return this.isPosValid(x, y) ? (this.nWx)*(y+2) + x+2 : -1;
        },
        // convert index of a cell to appropriate position (coordinates) in the grid
        pos: function(i) {
            return [i % this.nWx - 2, Math.floor(i / this.nWx)-2];
        },
        posMap: function(arr) {
            var _this = this;
            return arr.map(function(v) { return _this.pos(v) });
        },
        value: function(x, y) {
            var i = this.index(x,y);
            return i >= 0? this.aCells[i] : 0;
        },
        set: function(x, y, v) {
            var i = this.index(x,y);
            if (i >= 0) this.aCells[i] = v;
            return i;
        },
        setOn: function(x, y, v) {
            var i = this.index(x,y);
            if (i >= 0) this.aCells[i] |= v;
            return i;
        },
        setOff: function(x, y, v) {
            var i = this.index(x,y);
            if (i >= 0) this.aCells[i] &= ~v;
            return i;
        },
        placeCursor: function() {
            return [Math.floor(this.nW/2), -2];
        },
        placeBalls: function(n) {
            var a = [], ret = [];
            for (var i = 0; i < n; i++) {
                var k;
                do k = Math.floor(Math.random() * this.nW * this.nH);
                while (a.indexOf(k) >= 0);
                a.push(k);
                var x = k % this.nW, y = Math.floor(k / this.nW);
                ret.push([x, y]);
            }
            return ret;
        },
        placeWarders: function(n) {
            var z;
            var aPos = [
                [Math.floor(this.nW/2), this.nH+1],
                [-1, this.nH+1], [this.nW, this.nH+1], [-1, -2], [this.nW, -2],
                [-1, z = Math.floor(this.nH/2)], [this.nW, z],
                [z = Math.floor(this.nW/4), this.nH+1], [3*z, this.nH+1]
            ];
            var i0 = (n+ 1)% 2;
            return aPos.slice(i0, Math.min(n+ i0, 9));
        },
        placeSpawned: function() {
            if (nWarders >= 9) return false;
            function dist(pos1, pos2) {
                return Math.pow(pos1[0]- pos2[0], 2) + Math.pow(pos1[1]- pos2[1], 2);
            }
            function find(pos0) {
                var n = nWarders;
                for (var l = 0; l < x0; l++) {
                    for (var dx = -1; dx <= 1; dx+= 2) {
                        var p = [pos0[0]+ l* dx, pos0[1]];
                        for (var i = 0; i < n && dist(aWarders[i].pos(), p) >= 4; i++) ;
                        if (i >= n) return p;
                    }
                }
                return pos0;
            }
            var x0 = Math.floor(this.nW/2);
            var aPos = [[x0, this.nH+1], [x0, -2]];
            var posCr = cursor.pos();
            var posSt = dist(aPos[0], posCr) > dist(aPos[1], posCr)? aPos[0] : aPos[1];
            var ret = find(posSt);
            return ret;
        },
        applyRelDirs: function(x, y, dir, aDeltas) {
            var ret = [];
            for (var n = aDeltas.length, i = 0; i < n; i++) {
                var d = (dir + aDeltas[i] + 360) % 360;
                var vec = dirset.get(d), xt, yt;
                ret.push([xt = x + vec[0], yt = y + vec[1], d, this.value(xt, yt)]);
            }
            return ret;
        },
        add2Trail: function(x, y, dir) {
            var i = this.setOn(x, y, CA_TRAIL);
            if (i < 0) return;
            var n = this.aTrail.length;
            if (!n || dir !== this.dirTrail) {
                var iNode = n? this.aTrail[n-1] : i;
                if (!n || iNode != this.aTrailNodes[this.aTrailNodes.length-1])
                    this.aTrailNodes.push(iNode);
                if (!n) {
                    var aPos = this.applyRelDirs(x, y, dir, [180]);
                    this.cellPreTrail = this.index(aPos[0][0], aPos[0][1]);
                }
            }
            this.aTrail.push(i);
            this.dirTrail = dir;
        },
        lastTrailLine: function() {
            var pos0 = this.pos(this.aTrailNodes[this.aTrailNodes.length-1]),
                pos = this.pos(this.aTrail[this.aTrail.length-1]);
            return [
                Math.min(pos[0], pos0[0]), Math.min(pos[1], pos0[1]),
                Math.abs(pos[0] - pos0[0])+1, Math.abs(pos[1] - pos0[1])+1
            ];
        },
        clearTrail: function() {
            this.aTrailRects = this._buildTrailRects();
            for (var n = this.aTrail.length, i = 0; i < n; i++) {
                this.aCells[this.aTrail[i]] &= ~CA_TRAIL;
            }
            this.aTrail = []; this.aTrailNodes = [];
        },
        getPreTrailCell: function() {
            return this.cellPreTrail;
        },
        // wrapper of conquered regions detection
        conquer: function() {
            var nTrail = this.aTrail.length;
            if (!nTrail) return;
            if (nTrail > 1)
                this.aTrailNodes.push(this.aTrail[nTrail-1]);
            var aConqRects = this._conquer() || this._buildTrailRects();
            this.aTrail = []; this.aTrailNodes = [];
            if (!aConqRects || !aConqRects.length) return;
            for (var n = aConqRects.length, i = 0; i < n; i++) {
                var rect = aConqRects[i];
                var x0 = rect[0], y0 = rect[1], w = rect[2], h = rect[3];
                for (var x = 0; x < w; x++) {
                    for (var y = 0; y < h; y++) {
                        if (this.value(x + x0, y + y0, CA_CLEAR) & CA_CLEAR) continue;
                        this.set(x + x0, y + y0, CA_CLEAR);
                        this.nConquered++;
                    }
                }
            }
            for (i = 0; i < n; i++) {
                clearCellArea.apply(null, aConqRects[i]);
            }
            aConqRects = [];
        },
        getConqueredRatio: function() {
            return this.nConquered / (this.nW * this.nH) * 100;
        },
        // conquered regions (polygons) detection:
        _conquer: function() {
            var nTrail = this.aTrail.length, nNodes = this.aTrailNodes.length;
            var aOutlineset = []; // outlines (boundaries) of found regions
            var delta;
            var bClosedTrail = nNodes >= 4 &&
                ((delta = Math.abs(this.aTrailNodes[0] - this.aTrailNodes[nNodes-1])) == 1 || delta == this.nWx);
            if (bClosedTrail) { // if the cursor trail is self-closed
                aOutlineset.push([this.aTrailNodes, 1]);
            }
            var bAddTrailRects = false;
            var posPre = this.pos(this.cellPreTrail), posCr = cursor.pos();
            var aDeltas = [-90, 90];
            for (var side = 0; side < 2; side++) {
                delta = aDeltas[side];
                var iLastNode = 0;
                var sum = 0, bNonTangent = false, bEndAtNode = false;
                for (var l = 0; l < nTrail && sum < nTrail; l++) {
                    var cellStart = this.aTrail[l];
                    var pos = this.pos(cellStart);
                    var pos0 = l? this.pos(this.aTrail[l - 1]) : posPre;
                    var x = pos[0], y = pos[1];
                    var dir = (dirset.find(x - pos0[0], y - pos0[1]) + delta + 360) % 360;
                    var aDirs = bEndAtNode? [] : [dir];
                    if (this.aTrailNodes.indexOf(cellStart) >= 0) {
                        var pos2 = l < nTrail - 1? this.pos(this.aTrail[l + 1]) : posCr;
                        dir = (dirset.find(pos2[0] - x, pos2[1] - y) + delta + 360) % 360;
                        if (dir != aDirs[0]) aDirs.push(dir);
                    }
                    if (this.aTrail[l] == this.aTrailNodes[iLastNode+1]) ++iLastNode;
                    var ret = 0;
                    for (var nDs = aDirs.length, j = 0; j < nDs && !ret; j++) {
                        dir = aDirs[j];
                        var vec = dirset.get(dir);
                        var xt = x + vec[0], yt = y + vec[1];
                        var v = this.value(xt, yt);
                        if (v & CA_CLEAR || v & CA_TRAIL) continue;
                        ret = this._findOutline(xt, yt, dir, l, iLastNode);
                    }
                    bEndAtNode = false;
                    if (!ret) continue;
                    var aNodes = ret[0], len = ret[1], lenTangent = ret[2];
                    if (ret.length > 3) {
                        iLastNode = ret[3];
                        l = ret[4];
                        bEndAtNode = ret[5];
                    }
                    aOutlineset.push([aNodes, len]);
                    sum += lenTangent;
                    if (!lenTangent) bNonTangent = true;
                }
                if (!sum && !bNonTangent && !bClosedTrail) return false;
                if (sum < nTrail && !bClosedTrail) bAddTrailRects = true;
            }
            if (!aOutlineset.length)
                return false;
            aOutlineset.sort(function (el1, el2) {
                return el1[1] - el2[1];
            });
            var aRects = [], n = aOutlineset.length, bUnbroken = true;
            for (var i = 0; i < (bUnbroken? n-1 : n); i++) {
                ret = this._buildConquerRects(aOutlineset[i][0]);
                if (ret)
                    aRects = aRects.concat(ret);
                else
                    bUnbroken = false;
            }
            if (!aRects.length)
                return false;
            return bAddTrailRects? aRects.concat(this._buildTrailRects()) : aRects;
        },
        // find outline of conquered region (polygon)
        //  from given cell position (x0, y0) and starting direction (dir)
        //  as well as indices of starting cell and last node cell in the trail:
        _findOutline: function(x0, y0, dir, iStartCell, iLastNode) {
            function isClear(arr) {
                return arr[3] & CA_CLEAR;
            }
            var aNodes = [], aUniqNodes = [], aUsedDirs = [], aBackDirs = [];
            var x = x0, y = y0,
                lim = 6 * (this.nW + this.nH), n = 0, bClosed = false;
            do {
                bClosed = n && x == x0 && y == y0;
                var cellCurr = this.index(x,y), iUniq = aUniqNodes.indexOf(cellCurr);
                var aCurrUsed = iUniq >= 0? aUsedDirs[iUniq] : [];
                var aCurrBack = iUniq >= 0? aBackDirs[iUniq] : [];
                var aPosOpts = this.applyRelDirs(x,y, dir, [-90, 90, 0]);
                var aTestDirs = [180+45, -45, 45, 180-45, -45, 45];
                var aPassIdx = [], aPassWeight = [];
                for (var i = 0; i < 3; i++) {
                    var d = aPosOpts[i][2];
                    if (aCurrUsed.indexOf(d) >= 0) continue;
                    if (isClear(aPosOpts[i])) continue;
                    var aTestOpts = this.applyRelDirs(x,y, dir, aTestDirs.slice(i*2,i*2+2));
                    var b1 = isClear(aTestOpts[0]), b2 = isClear(aTestOpts[1]);
                    var b = b1 || b2 || (i == 2? isClear(aPosOpts[0]) || isClear(aPosOpts[1]) : isClear(aPosOpts[2]));
                    if (!b) continue;
                    aPassIdx.push(i);
                    aPassWeight.push(
                        (b1 && b2? 0 : b1 || b2? 1 : 2) + (aCurrBack.indexOf(d) >= 0? 3 : 0)
                    );
                }
                var nPass = aPassIdx.length;
                var min = false, idx = false;
                for (i = 0; i < nPass; i++) {
                    if (!i || aPassWeight[i] < min) {
                        min = aPassWeight[i]; idx = aPassIdx[i];
                    }
                }
                var pos = nPass? aPosOpts[idx] : this.applyRelDirs(x,y, dir, [180])[0];
                var dir0 = dir;
                x = pos[0]; y = pos[1]; dir = pos[2];
                if (pos[2] == dir0) continue;
                nPass? aNodes.push(cellCurr) : aNodes.push(cellCurr, cellCurr);
                dir0 = (dir0 + 180) % 360;
                if (iUniq < 0) {
                    aUniqNodes.push(cellCurr);
                    aUsedDirs.push([dir]);
                    aBackDirs.push([dir0]);
                }
                else {
                    aUsedDirs[iUniq].push(dir);
                    aBackDirs[iUniq].push(dir0);
                }
            }
            while (n++ < lim && !(this.value(x, y) & CA_TRAIL));
            if (!(n < lim)) return false;
            if (bClosed) {
                aNodes.push(cellCurr);
                if (aNodes[0] != (cellCurr = this.index(x0,y0))) aNodes.unshift(cellCurr);
                var nNodes = aNodes.length;
                if (nNodes % 2 && aNodes[0] == aNodes[nNodes-1]) aNodes.pop();
                return [aNodes, n+1, 0];
            }
            var cellStart = this.aTrail[iStartCell], cellEnd = this.index(x,y);
            aNodes.push(cellEnd);
            var nTrail = this.aTrail.length;
            var aTangentNodes = [cellStart];
            for (var l = iStartCell+1; l < nTrail && this.aTrail[l] != cellEnd; l++) {
                if (this.aTrail[l] == this.aTrailNodes[iLastNode+1])
                    aTangentNodes.push(this.aTrailNodes[++iLastNode]);
            }
            var bEndAtNode = this.aTrail[l] == this.aTrailNodes[iLastNode+1];
            if (bEndAtNode) l++;
            var lenTangent = l - iStartCell;
            return [
                aNodes.concat(aTangentNodes.reverse()), n+1+lenTangent, lenTangent,
                iLastNode, l, bEndAtNode
            ];
        },
        // break the cursor trail line into a set of rectangles:
        _buildTrailRects: function() {
            if (this.aTrailNodes.length == 1)
                this.aTrailNodes.push(this.aTrailNodes[0]);
            var aRects = [];
            for (var n = this.aTrailNodes.length, i = 0; i < n-1; i++) {
                var pos1 = this.pos(this.aTrailNodes[i]), pos2 = this.pos(this.aTrailNodes[i+1]);
                var x0 = Math.min(pos1[0], pos2[0]), y0 = Math.min(pos1[1], pos2[1]);
                var w = Math.max(pos1[0], pos2[0]) - x0 + 1, h = Math.max(pos1[1], pos2[1]) - y0 + 1;
                var rect = [x0, y0, w, h];
                aRects.push(rect);
            }
            return aRects;
        },
        // break region specified by its outline into a set of rectangles:
        _buildConquerRects: function(aOutline) {
            // checks if rectangle contains at least one ball (enemy):
            function containBall(rect) {
                var x1 = rect[0], x2 = x1+ rect[2] - 1;
                var y1 = rect[1], y2 = y1+ rect[3] - 1;
                for (var i = 0; i < nBalls; i++) {
                    var o = aBalls[i], x = o.x, y = o.y;
                    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return true;
                }
                return false;
            }
            if (aOutline.length < 4) return false;
            var aNodes = this.posMap(aOutline);
            var n = aNodes.length;
            if (n > 4 && n % 2 != 0) {
                var b1 = aNodes[0][0] == aNodes[n-1][0], b2;
                if (b1 ^ aNodes[0][1] == aNodes[n-1][1]) {
                    b2 = aNodes[n-2][0] == aNodes[n-1][0];
                    if (!(b2 ^ b1) && b2 ^ aNodes[n-2][1] == aNodes[n-1][1])
                        aNodes.pop();
                    b2 = aNodes[0][0] == aNodes[1][0];
                    if (!(b2 ^ b1) && b2 ^ aNodes[0][1] == aNodes[1][1])
                        aNodes.shift();
                }
                b1 = aNodes[0][0] == aNodes[1][0]; b2 = aNodes[1][0] == aNodes[2][0];
                if (!(b1 ^ b2) && b1 ^ aNodes[0][1] == aNodes[1][1] && b2 ^ aNodes[1][1] == aNodes[2][1])
                    aNodes.shift();
            }
            if (aNodes.length % 2 != 0) return false;
            var aRects = [];
            for (var l = 0; l < 10 && aNodes.length > 4; l++) {
                n = aNodes.length;
                var dim1 = 0, dim2 = 0, iBase = 0, iCo = 0;
                var posB1, posB2, posT1, posT2;
                for (var i = 0; i < n; i++) {
                    posB1 = aNodes[i]; posB2 = aNodes[(i+1)%n];
                    posT1 = aNodes[(i-1+n)%n]; posT2 = aNodes[(i+2)%n];
                    var dir = dirset.find(posT1[0]-posB1[0], posT1[1]-posB1[1]);
                    if (dir != dirset.find(posT2[0]-posB2[0], posT2[1]-posB2[1])) continue;
                    var dirTest = Math.floor((dirset.find(posB2[0]-posB1[0], posB2[1]-posB1[1])+ dir) / 2);
                    var vec = dirset.get(dirTest - dirTest% 45);
                    if (this.value([posB1[0]+ vec[0], posB1[1]+ vec[1]]) & CA_CLEAR) continue;
                    var b = false, t, w, k;
                    if ((t = Math.abs(posB1[0]-posB2[0])) > dim1) {
                        b = true; k = 0; w = t;
                    }
                    if ((t = Math.abs(posB1[1]-posB2[1])) > dim1) {
                        b = true; k = 1; w = t;
                    }
                    if (!b) continue;
                    var k2 = (k+1)%2;
                    vec = dirset.get(dir);
                    var sgn = vec[k2];
                    var co2 = posB1[k2];
                    var left = Math.min(posB1[k], posB2[k]), right = Math.max(posB1[k], posB2[k]);
                    var min = Math.min(sgn* (posT1[k2]- co2), sgn* (posT2[k2]- co2));
                    for (var j = i% 2; j < n; j+= 2) {
                        if (j == i) continue;
                        var pos = aNodes[j], pos2 = aNodes[(j+1)%n], h;
                        if (pos[k2] == pos2[k2] && (h = sgn*(pos[k2]- co2)) >= 0 && h < min &&
                            pos[k] > left && pos[k] < right && pos2[k] > left && pos2[k] < right)
                            break;
                    }
                    if (j < n) continue;
                    dim1 = w; dim2 = sgn*min;
                    iBase = i; iCo = k;
                }
                var iB2 = (iBase+1)%n, iT1 = (iBase-1+n)%n, iT2 = (iBase+2)%n;
                posB1 = aNodes[iBase];
                posB2 = aNodes[iB2];
                posT1 = aNodes[iT1];
                posT2 = aNodes[iT2];
                var aDim = [0, 0], pos0 = [];
                var iCo2 = (iCo+1)%2;
                aDim[iCo] = dim1;
                aDim[iCo2] = dim2;
                pos0[iCo] = Math.min(posB1[iCo], posB2[iCo]);
                pos0[iCo2] = Math.min(posB1[iCo2], posB2[iCo2]) + (aDim[iCo2] < 0? aDim[iCo2]: 0);
                var rect = [pos0[0], pos0[1], Math.abs(aDim[0])+1, Math.abs(aDim[1])+1];
                var bC = Math.abs(posT1[iCo2] - posB1[iCo2]) == Math.abs(dim2);
                if (containBall(rect)) return false;
                aRects.push(rect);
                if (bC) {
                    posB2[iCo2] += dim2;
                    aNodes.splice(iBase,1);
                    aNodes.splice(iT1 < iBase? iT1 : iT1-1, 1);
                }
                else {
                    posB1[iCo2] += dim2;
                    aNodes.splice(iT2,1);
                    aNodes.splice(iB2 < iT2? iB2 : iB2-1, 1);
                }
            }
            var aX = aNodes.map(function(v) {return v[0]});
            var aY = aNodes.map(function(v) {return v[1]});
            var x0 = Math.min.apply(null, aX);
            var y0 = Math.min.apply(null, aY);
            rect = [x0, y0, Math.max.apply(null, aX)-x0+1, Math.max.apply(null, aY)-y0+1];
            if (containBall(rect)) return false;
            aRects.push(rect);
            return aRects;
        }
    };

    // The cursor object:
    cursor = {
        x: 0, // current x coordinate
        y: 0, // current y coordinate
        x0: 0, // previous x coordinate
        y0: 0, // previous y coordinate
        dir: false, // current movement direction (angle in degrees)
        state: false, // current state (true - trial)
        state0: false, // previous state
        // reset the cursor position:
        reset: function(x, y, bUnlock) {
            var bPre = bUnlock && cellset.value(this.x, this.y) & CA_CLEAR;
            this.x0 = bPre? this.x : x;
            this.y0 = bPre? this.y : y;
            this.x = x;
            this.y = y;
            this.dir = this.state = this.state0 = false;
        },
        // update current position - move by given distance:
        update: function(dist) {
            if (this.dir === false) return;
            var x = this.x, y = this.y;
            var vec = dirset.get(this.dir), vecX = vec[0], vecY = vec[1];
            var bEnd =  false;
            for (var n = 0; n < dist; n++) {
                if (cellset.index(x + vecX, y + vecY) < 0) {
                    this.dir = false; break;
                }
                x += vecX; y += vecY;
                if (cellset.value(x, y) & CA_TRAIL) {
                    bCollision = true; break;
                }
                var b = cellset.value(x, y) & CA_CLEAR;
                if (this.state && b) {
                    bEnd = true; break;
                }
                this.state = !b;
                if (this.state) cellset.add2Trail(x, y, this.dir);
            }
            this.x = x;
            this.y = y;
            if (!bEnd) return;
            if (cellset.getPreTrailCell() == cellset.index(x,y))
                bCollision = true;
            else {
                this.dir = this.state = false;
                bConquer = true;
            }
        },
        // render current position:
        render: function() {
            if (this.x0 == this.x && this.y0 == this.y) {
                if (tLastFrame) return;
            }
            else {
                if (this.state0) {
                    var rect = cellset.lastTrailLine();
                    fillCellArea.apply(null, [cfgMain.colorTrail].concat(rect));
                }
                else {
                    if (cellset.isPosIn(this.x0, this.y0))
                        clearCellArea(this.x0, this.y0);
                    else
                        fillCellArea(cfgMain.colorBorder, this.x0, this.y0);
                }
                this.x0 = this.x; this.y0 = this.y;
            }
            this.state0 = this.state;
            drawCellImg(imgCursor, this.x, this.y);
        },
        // get current position:
        pos: function() {
            return [this.x, this.y];
        },
        // get current movement direction:
        getDir: function() {
            return this.dir;
        },
        // set/change movement direction:
        setDir: function(dir) {
            if (dir === this.dir) return;
            if (this.state && this.dir !== false && dir !== false && Math.abs(dir - this.dir) == 180)
                return;
            this.dir = dir;
        }
    };

    // Enemy class constructor:
    function Enemy(x, y, type, dir) {
        this.x = x; // current x position
        this.y = y; // current y position
        this.x0 = x; // previous x position
        this.y0 = y; // previous y position
        var aDirs = [45, 135, 225, 315];
        this.dir = dir === undefined? aDirs[Math.floor(Math.random()*4)] : dir; // current movement direction (angle in degrees)
        this.type = Boolean(type); // (boolean) type of enemy (false - Ball, true - Warder)
    }
    // Enemy class methods:
    Enemy.prototype = {
        // reset enemy position:
        reset: function(x, y) {
            this.x = x;
            this.y = y;
        },
        // update position - move by given distance:
        update: function(dist) {
            var ret = this._calcPath(this.x, this.y, dist, this.dir);
            this.x = ret.x;
            this.y = ret.y;
            this.dir = ret.dir;
        },
        // render current position:
        render: function() {
            if (this.x0 == this.x && this.y0 == this.y) {
                if (tLastFrame) return;
            }
            else {
                if (this.type && cellset.isPosIn(this.x0, this.y0))
                    clearCellArea(this.x0, this.y0);
                else
                    fillCellArea(this.type? cfgMain.colorBorder : cfgMain.colorFill, this.x0, this.y0);
                this.x0 = this.x; this.y0 = this.y;
            }
            drawCellImg(this.type? imgWarder : imgBall, this.x, this.y);
        },
        // current position:
        pos: function() {
            return [this.x, this.y];
        },
        // calculate movement path:
        _calcPath: function(x, y, dist, dir) {
            var vec = dirset.get(dir), vecX = vec[0], vecY = vec[1];
            var posCr = cursor.pos();
            var xC = posCr[0], yC = posCr[1],
                vC = cellset.value(xC, yC), bC = !this.type ^ vC & CA_CLEAR;
            if (bC && Math.abs(x - xC) <= 1 && Math.abs(y - yC) <= 1 ||
                !this.type && this._isCollision(x, y, dir)) {
                bCollision = true;
            }
            for (var n = 0; n < dist && !bCollision; n++) {
                var xt = x + vecX, yt = y + vecY;
                var dirB = this._calcBounce(x, y, dir, xt, yt);
                if (dirB !== false)
                    return this._calcPath(x, y, dist - n, dirB);
                if (bC && Math.abs(xt - xC) <= 1 && Math.abs(yt - yC) <= 1 ||
                    !this.type && this._isCollision(xt, yt, dir))
                    bCollision = true;
                if (!this.type && !cellset.isPosIn(xt, yt))
                    break;
                x = xt; y = yt;
            }
            return {x: x, y: y, dir: dir};
        },
        // calculate bounce direction if any:
        _calcBounce: function(x, y, dir, xt, yt) {
            var ret = cellset.applyRelDirs(x,y, dir, [-45, 45]);
            var b1 = this.type ^ ret[0][3] & CA_CLEAR,
                b2 = this.type ^ ret[1][3] & CA_CLEAR;
            return b1 ^ b2?
                (b1? dir + 90 : dir + 270) % 360 :
                this.type ^ cellset.value(xt, yt) & CA_CLEAR || b1 && b2?
                    (dir+180) % 360 : false;
        },
        // checks if enemy position is in collision with the cursor trail:
        _isCollision: function(x, y, dir) {
            if (cellset.value(x, y) & CA_TRAIL) return true;
            var aDirs = [-45, 45, -90, 90];
            for (var i = 0; i < 4; i++) {
                var d = (dir + aDirs[i] + 360) % 360, vec = dirset.get(d);
                if (cellset.value(x + vec[0], y + vec[1]) & CA_TRAIL) return true;
            }
            return false;
        }
    };
    

    function merge(dest, src, bFilter) {
        if (!src) return dest;
        for(var key in dest) {
            if (!dest.hasOwnProperty(key) || !src.hasOwnProperty(key)) continue;
            var v = src[key];
            if ((!bFilter || v) && (typeof v != 'number' || v >= 0))
                dest[key] = v;
        }
        return dest;
    }

})();
