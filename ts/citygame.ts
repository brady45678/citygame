/// <reference path="../js/lib/pixi.d.ts" />
/// <reference path="../data/js/cg.d.ts" />


var container;
var SCREEN_WIDTH, SCREEN_HEIGHT, TILE_WIDTH,TILE_HEIGHT,
TILES, WORLD_WIDTH, WORLD_HEIGHT;
SCREEN_WIDTH = 940
SCREEN_HEIGHT = 480
TILE_WIDTH = 64
TILE_HEIGHT = 32
TILES = 30
WORLD_WIDTH = TILES * TILE_WIDTH;
WORLD_HEIGHT = TILES * TILE_HEIGHT;



class Sprite extends PIXI.Sprite
{
  type: string;
  cell: Cell;
  content: Content;

  constructor( template )
  {
    var _texture = PIXI.Texture.fromImage(template.texture, false, 1); //scale mode
    super(_texture); //pixi caches and reuses the texture as needed
    
    this.type    = template.type;
    this.anchor = arrayToPoint(template.anchor);

    if (template.interactive === true)
    {
      this.interactive = true;
      this.hitArea = arrayToPolygon(template.hitArea);
    }
  }
}

class Content
{
  type: string;
  id: number;
  sprite: Sprite;
  cell: Cell;

  constructor( cell: Cell, template)
  {
    this.cell = cell;
    this.type = template["type"];

    this.init( template );

  }
  init( template )
  {
    var _s = this.sprite = new Sprite( cg["content"][this.type] );
    _s.content = this;
    var cellSprite = this.cell.sprite;
    var gridPos = this.cell.gridPos;
    _s.position = this.cell.sprite.position.clone();
    game.layers["content"].addChildAt(_s, gridPos[0] + gridPos[1]);
  }

}

class Cell
{
  type: string;
  sprite: Sprite;
  content: Content;
  gridPos: number[];
  buildable: boolean;

  constructor( gridPos, type )
  {
    this.gridPos = gridPos;
    this.type = type;

    this.init(type);
  }
  init( type:string )
  {
    var template = cg["terrain"][type]
    var _s = this.sprite = new Sprite( template );
    this.sprite.cell = this;
    this.buildable = template["buildable"];

    _s.mousedown = function(event)
    {
      //typescript doesnt like 
      game.mouseEventHandler.cellStart(event.target["cell"].gridPos);
    }
    _s.mouseover = function(event)
    {
      game.mouseEventHandler.cellOver(event.target["cell"].gridPos);
    }
    _s.mouseup = function(event)
    {
      game.mouseEventHandler.cellEnd(event.target["cell"].gridPos);
    }
  }
  replace( type:string )
  {
    var template = cg["terrain"][type];
    var _texture = template["texture"];
    this.sprite.setTexture( PIXI.Texture.fromImage( _texture ));
    this.type = type;
    this.buildable = template["buildable"];
    if (this.content !== undefined)
    {
      this.changeContent(this.content.type);
    }
    {

    }
  }
  changeContent( type:string )
  {
    if (this.buildable !== true && type !== "plant")
    {
      this.removeContent();
      return;
    }
    if (this.content !== undefined)
    {
      game.layers["content"].removeChildAt(this.content.sprite,
        this.gridPos[0] + this.gridPos[1]);
    }
    if (type === "plant")
    {
      type = cg["terrain"][this.type]["plant"];
      this.content = new Content( this, cg["content"][type] );
      this.content.type = "plant";
      return;
    }
    this.content = new Content( this, cg["content"][type] );
    
  }
  removeContent()
  {
    if (this.content === undefined)
    {
      return;
    }
    game.layers["content"].removeChildAt(this.content.sprite,
      this.gridPos[0] + this.gridPos[1]);
    this.content = undefined;
  }
}

class Board
{
  width: number;
  height: number;
  cells: Cell[][];
  constructor(width, height)
  {
    this.width = width;
    this.height = height
    this.cells = [];

    this.init();
  }
  init()
  {
    for (var i=0; i<this.width; i++)
    {
      this.cells[i] = [];
    }
  }
  makeMap( key? )
  {
    for (var i = 0; i < this.width; i++)
    {
      for (var j = 0; j < this.height; j++)
      {
        var cellType = "grass";
        var cell = this.cells[i][j] = new Cell([i, j], cellType);
        var sprite = cell.sprite;
        sprite.position = arrayToPoint( getIsoCoord(i, j,
          TILE_WIDTH, TILE_HEIGHT,
          [WORLD_WIDTH/2, TILE_HEIGHT]) );
        game.layers["ground"].addChild(sprite);
      }
    }
  }
  getCells(arr): Cell[]
  {
    var cells;
    cells = getFrom2dArray(this.cells, arr);
    return cells;
  }
}

class Game
{
  board: Board;
  tools: any = {};
  activeTool: Tool;
  mouseEventHandler: MouseEventHandler;
  highlighter: Highlighter;
  stage: PIXI.Stage;
  renderer: any;
  layers: any = {};
  constructor()
  {
  }
  init()
  {
    this.initContainers();
    this.initTools();
    this.changeTool("grass");
    this.bindElements();

    this.board = new Board(TILES, TILES);
    this.board.makeMap();

    this.highlighter = new Highlighter();

    this.mouseEventHandler = new MouseEventHandler();
    this.mouseEventHandler.scroller = new Scroller(this.layers["main"],
      SCREEN_WIDTH, SCREEN_HEIGHT, 0.5);
    }
    initContainers()
    {

      var _stage = this.stage = new PIXI.Stage(0xFFFFFF);
      var _renderer = this.renderer =
        PIXI.autoDetectRenderer(SCREEN_WIDTH, SCREEN_HEIGHT, null, false, true);
      var _main = this.layers["main"] = new PIXI.DisplayObjectContainer();
      _main.position.set(SCREEN_WIDTH / 2 - WORLD_WIDTH/2,
        SCREEN_HEIGHT / 2 - WORLD_HEIGHT/2);
      _stage.addChild(_main);
      var _ground = this.layers["ground"] = new PIXI.DisplayObjectContainer();
      _ground.interactive = true;
      _main.addChild(_ground);
      var _content = this.layers["content"] = new SortedDisplayObjectContainer(TILES * 2);
      _main.addChild(_content);
    }
    initTools()
    {
      this.tools.water = new WaterTool();
      this.tools.grass = new GrassTool();
      this.tools.sand = new SandTool();
      this.tools.snow = new SnowTool();
      this.tools.remove = new RemoveTool();
      this.tools.plant = new PlantTool();
      this.tools.house = new HouseTool();

      //this.tools.pineapple = new PineappleTool();
    }

    bindElements()
    {
      var self = this;

      //zoom
      var zoomBtn = document.getElementById("zoomBtn");
      zoomBtn.addEventListener("click", function()
        {
          var zoomAmount = document.getElementById("zoom-amount")["value"];
          game.mouseEventHandler.scroller.zoom( zoomAmount );
        });
      //tools
      for (var tool in this.tools)
      {
        var btn = document.getElementById( ""+tool+"Btn" );
        (function addBtnFn(btn, tool)
        {
          btn.addEventListener("click", function()
          {
            self.changeTool([tool]);
          });
        })(btn, tool);
      }
      //renderer
      var _canvas = document.getElementById("pixi-container");
      _canvas.appendChild(this.renderer.view);
  }
  changeTool( tool )
  {
    this.activeTool = this.tools[tool];
  }
  render()
  {
    this.renderer.render(this.stage);

    requestAnimFrame( this.render.bind(this) );
  }
}

class SortedDisplayObjectContainer extends PIXI.DisplayObjectContainer
{
  container: PIXI.DisplayObjectContainer;
  indexes: number[];
  // arr[1] = index 1
  // when adding new displayobject increment following indexes
  
  constructor( layers:number)
  {
    this.indexes = new Array(layers);
    super();
    this.init();
  }
  
  init()
  {
    for (var i = 0; i < this.indexes.length; i++)
    {
      this.indexes[i] = 0;
    };
  }
  incrementIndexes(start:number)
  {
    for (var i = start + 1; i < this.indexes.length; i++)
    {
      this.indexes[i]++
    }
  }
  decrementIndexes(start:number)
  {
    for (var i = start + 1; i < this.indexes.length; i++)
    {
      this.indexes[i]--
    }
  }

  
  addChildAt(element:PIXI.DisplayObject, index:number)
  {
    super.addChildAt( element, this.indexes[index] );
    this.incrementIndexes(index);
  }
  removeChildAt(element:PIXI.DisplayObject, index:number)
  {
    super.removeChild(element);
    this.decrementIndexes(index);
  }
}

class Scroller
{
  container: PIXI.DisplayObjectContainer;
  width: number
  height: number
  bounds: any = {};
  startPos: number[];
  startClick: number[];
  currZoom: number = 1;
  zoomField: any; //TEMP

  constructor( container:PIXI.DisplayObjectContainer, width, height, bound)
  {
    this.container = container;
    this.width = width;
    this.height = height;
    this.bounds.min = bound;  // sets clamp limit to percentage of screen from 0.0 to 1.0
    this.bounds.max = fround(1 - bound);
    this.zoomField = document.getElementById("zoom-amount");
  }
  startScroll( mousePos )
  {
    this.setBounds();
    this.startClick = mousePos;
    this.startPos = [this.container.position.x, this.container.position.y];
  }
  end()
  {
    this.startPos = undefined;
  }
  setBounds()
  {
    var rect = this.container.getLocalBounds();
    this.bounds =
    {
      xMin: (this.width  * this.bounds.min) - rect.width * this.container.scale.x,
      xMax: (this.width  * this.bounds.max),
      yMin: (this.height * this.bounds.min) - rect.height * this.container.scale.y,
      yMax: (this.height * this.bounds.max),
      min: this.bounds.min,
      max: this.bounds.max
    }
  }
  getDelta( currPos )
  {
    var x = this.startClick[0] - currPos[0];
    var y = this.startClick[1] - currPos[1];
    return [-x, -y];
  }
  move( currPos )
  {
    var delta = this.getDelta(currPos);
    this.container.position.x = this.startPos[0] + delta[0];
    this.container.position.y = this.startPos[1] + delta[1];
    this.clampEdges();
  }
  zoom( zoomAmount: number)
  {
    var container = this.container;
    var oldZoom = this.currZoom;
    var zoomDelta = oldZoom - zoomAmount;
    var rect = container.getLocalBounds();
    //var centerX = SCREEN_WIDTH / 2 - rect.width / 2 * zoomAmount;
    //var centerY = SCREEN_HEIGHT / 2 - rect.height / 2 * zoomAmount;
    var xRatio = 1 - ((container.x - SCREEN_WIDTH/2) / rect.width / oldZoom + 1);
    var yRatio = 1 - ((container.y - SCREEN_HEIGHT/2) / rect.height / oldZoom + 1);

    var xDelta = rect.width * xRatio * zoomDelta;
    var yDelta = rect.height * yRatio * zoomDelta;
    container.position.x += xDelta;
    container.position.y += yDelta;
    container.scale.set(zoomAmount, zoomAmount);
    this.zoomField.value = this.currZoom = zoomAmount;
  }
  deltaZoom( delta, scale )
  {
    if (delta === 0)
    {
      return;
    }
    var absDelta = Math.abs(delta);
    var direction = delta < 0 ? "out" : "in";
    delta = Math.pow(absDelta, scale);
    if (direction === "out")
    {
      this.zoom(this.currZoom / delta);
    }
    else
    {
      this.zoom(this.currZoom * delta);
    }
    //this.zoom(this.currZoom + delta * scale);
  }
  clampEdges()
  {
    var x = this.container.position.x;
    var y = this.container.position.y;

    //horizontal
    //left edge
    if ( x < this.bounds.xMin)
    {
      x = this.bounds.xMin;
    }
    //right edge
    else if ( x > this.bounds.xMax)
    {
      x = this.bounds.xMax;
    }

    //vertical
    //top
    if ( y < this.bounds.yMin )
    {
      y = this.bounds.yMin;
    }
    //bottom
    else if ( y > this.bounds.yMax )
    {
      y = this.bounds.yMax;
    }

    

    this.container.position.set(x, y)
  }
}

class MouseEventHandler
{
  startPoint: number[];
  currPoint: number[];

  startCell: number[];
  currCell: number[];

  currAction: string;

  scroller: Scroller
  constructor()
  {
    this.currAction = undefined;
  }
  scrollStart(event)
  {
    if (this.currAction === undefined)
    {
      this.startPoint = [event.global.x, event.global.y];
      this.currAction = "scroll";
      this.scroller.startScroll(this.startPoint);
      event.originalEvent.stopPropagation();
    }
  }
  zoomStart(event)
  {
    if (this.currAction === undefined)
    {
      this.startPoint = this.currPoint = [event.global.x, event.global.y];
      this.currAction = "zoom";
      event.originalEvent.stopPropagation();
    }
  }
  stageMove(event)
  {
    if (this.currAction === "scroll")
    {   
      this.scroller.move([event.global.x, event.global.y]);
      event.originalEvent.stopPropagation();
    }
    else if (this.currAction === "zoom")
    {
      var delta = event.global.x + this.currPoint[1] - 
        this.currPoint[0] - event.global.y;
      this.scroller.deltaZoom(delta, 0.05);
      this.currPoint = [event.global.x, event.global.y];
      event.originalEvent.stopPropagation();
    }
  }
  stageEnd(event)
  {
    if (this.currAction === "scroll")
    {
      this.scroller.end();
      event.originalEvent.stopPropagation();
      this.startPoint = undefined;
      this.currAction = undefined;
    }
    if (this.currAction === "zoom")
    {
      event.originalEvent.stopPropagation();
      this.startPoint = undefined;
      this.currAction = undefined;
    }
  }
  cellStart(pos: number[])
  {
    if (this.currAction === undefined)
    {
      this.currAction = "cellAction";
      this.startCell = pos;
    }
  }
  cellOver(pos: number[])
  {
    if (this.currAction === "cellAction")
    {
      this.currCell = pos;
      var selectedCells = game.board.getCells(
        game.activeTool.selectType(this.startCell, this.currCell));
      game.highlighter.clearSprites();
      game.highlighter.tintCells(selectedCells, game.activeTool.tintColor);
    }
  }
  cellEnd(pos: number[])
  {
    if (this.currAction === "cellAction")
    {
      this.currCell = pos;
      var selectedCells = game.board.getCells(
        game.activeTool.selectType(this.startCell, this.currCell));
      game.activeTool.activate(selectedCells);
      game.highlighter.clearSprites();
      this.currAction = undefined;
    }
  }
  
}

class Highlighter
{
  currHighlighted: Sprite[] = [];
  tintSprites(sprites: Sprite[], color: number)
  {
    for (var i = 0; i < sprites.length; i++)
    {
      var _sprite = sprites[i];
      _sprite.tint = color;
      this.currHighlighted.push( sprites[i] );
    }
  }
  clearSprites()
  {
    for (var i = 0; i < this.currHighlighted.length; i++)
    {
      var _sprite = this.currHighlighted[i];
      _sprite.tint = 0xFFFFFF;
    }
    this.currHighlighted = [];
  }
  tintCells(cells: Cell[], color: number)
  {
    var _sprites = [];
    for (var i = 0; i < cells.length; i++)
    {
      _sprites.push(cells[i].sprite);
      if (cells[i].content !== undefined)
      {
        _sprites.push(cells[i].content.sprite);
      }
    }
    this.tintSprites(_sprites, color);
  }
}

interface Tool
{
  selectType: any
  tintColor: number;

  activate(target:Cell[]);
}

class WaterTool implements Tool
{
  selectType: any;
  tintColor: number;
  constructor()
  {
    this.selectType = manhattanSelect;
    this.tintColor = 0x4444FF;
  }
  activate(target)
  {
    for (var i = 0; i < target.length; i++)
    {
      target[i].replace( "water" );
    };
  }
}

class GrassTool implements Tool
{
  selectType: any
  tintColor: number;
  constructor()
  {
    this.selectType = rectSelect;
    this.tintColor = 0x617A4E;
  }
  activate(target)
  {
    for (var i = 0; i < target.length; i++)
    {
      target[i].replace( "grass" );
    }
  }
}

class SandTool implements Tool
{
  selectType: any
  tintColor: number;
  constructor()
  {
    this.selectType = rectSelect;
    this.tintColor = 0xE2BF93;
  }
  activate(target)
  {
    for (var i = 0; i < target.length; i++)
    {
      target[i].replace( "sand" );
    }
  }
}

class SnowTool implements Tool
{
  selectType: any
  tintColor: number;
  constructor()
  {
    this.selectType = rectSelect;
    this.tintColor = 0xBBDFD7;
  }
  activate(target)
  {
    for (var i = 0; i < target.length; i++)
    {
      target[i].replace( "snow" );
    }
  }
}
class RemoveTool implements Tool
{
  selectType: any
  tintColor: number;
  constructor()
  {
    this.selectType = rectSelect;
    this.tintColor = 0xFF5555;
  }
  activate(target)
  {
    for (var i = 0; i < target.length; i++)
    {
      target[i].removeContent();
    }
  }
}

class PlantTool implements Tool
{
  selectType: any
  tintColor: number;
  constructor()
  {
    this.selectType = rectSelect;
    this.tintColor = 0x338833;
  }
  activate(target)
  {
    for (var i = 0; i < target.length; i++)
    {
      target[i].changeContent("plant");
    }
  }
}

class HouseTool implements Tool
{
  selectType: any
  tintColor: number;
  constructor()
  {
    this.selectType = rectSelect;
    this.tintColor = 0x696969;
  }
  activate(target)
  {
    for (var i = 0; i < target.length; i++)
    {
      target[i].changeContent("house");
    }
  }
}
/*
class PineappleTool implements Tool
{
  selectType: any
  tintColor: number;
  constructor()
  {
    this.selectType = rectSelect;
    this.tintColor = 0xF7B218;
  }
  activate(target)
  {
    for (var i = 0; i < target.length; i++)
    {
      target[i].changeContent("pineapple");
    }
  }
}
*/

function rectSelect(a:number[], b:number[]): number[]
{
  var cells = [];
  var xLen = Math.abs(a[0] - b[0]);
  var yLen = Math.abs(a[1] - b[1]);
  var xDir = (b[0] < a[0]) ? -1 : 1;
  var yDir = (b[1] < a[1]) ? -1 : 1;
  var x,y;
  for (var i = 0; i <= xLen; i++)
  {
    x = a[0] + i * xDir;
    for (var j = 0; j <= yLen; j++)
    {
      y = a[1] + j * yDir;
      cells.push([x,y]);
    }
  }
  return cells;
}

function manhattanSelect(a, b) : number[]
{
  var xLen = Math.abs(a[0] - b[0]);
  var yLen = Math.abs(a[1] - b[1]);
  var xDir = (b[0] < a[0]) ? -1 : 1;
  var yDir = (b[1] < a[1]) ? -1 : 1;
  var y, x;
  var cells = [];
  if (xLen >= yLen)
  {
    for (var i = 0; i <= xLen; i++)
    {
      x = a[0] + i * xDir;
      cells.push([x, a[1]]);
    }
    for (var j = 1; j <= yLen; j++)
    {
      y = a[1] + j * yDir;
      cells.push([b[0], y]);
    }
  }
  else
  {
    for (var j = 0; j <= yLen; j++)
    {
      y = a[1] + j * yDir;
      cells.push([a[0], y]);
    }
    for (var i = 1; i <= xLen; i++)
    {
      x = a[0] + i * xDir;
      cells.push([x, b[1]]);
    }
  }
  return cells;
}


function getFrom2dArray(target, arr): number[][]
{
  var result = [];
  for (var i = 0; i < arr.length; i++)
  {
    result.push( target[arr[i][0]][arr[i][1]] );
  };
  return result;
}

function arrayToPolygon(points)
{
  var _points = [];
  for (var i = 0; i < points.length; i++)
  {
    _points.push( new PIXI.Point(points[i][0], points[i][1]) );
  }
  return new PIXI.Polygon(_points);
}

function arrayToPoint(point)
{
  return new PIXI.Point(point[0], point[1]);
}

function getIsoCoord(x: number, y: number,
  width: number, height: number,
  offset?: number[])
{
  var _w2 = width / 2;
  var _h2 = height / 2;
  var _isoX = (x - y) * _w2;
  var _isoY = (x + y) * _h2;
  if (offset)
  { 
    _isoX += offset[0];
    _isoY += offset[1];
  }
  return [_isoX, _isoY];
}

function fround(x)
{
  var f32 = new Float32Array(1);
  return f32[0] = x, f32[0];
}

var game = new Game();


document.addEventListener('DOMContentLoaded', function()
{
  game.init();
  var stage = game.stage;
  /* check center
  var gfx = new PIXI.Graphics();
  gfx.beginFill();
  gfx.drawEllipse(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 3, 3);
  gfx.endFill();
  stage.addChild(gfx);
  */


  stage.mousedown = function(event)
  {
    if (event.originalEvent.ctrlKey === true)
    {
      game.mouseEventHandler.scrollStart(event);
    }
    if (event.originalEvent.shiftKey === true)
    {
      game.mouseEventHandler.zoomStart(event);
    }
  }
  stage.mousemove = function(event)
  {
    game.mouseEventHandler.stageMove(event);
  }
  stage.mouseup = function(event)
  {
    game.mouseEventHandler.stageEnd(event);
  }
  game.render();
});