// まず数が指定されて素因数の数x30フレームごとに切り替わる
// たとえば4なら2x2だから60フレーム取るわけね
// 大きい数とか自由に決められるといいけどとりあえず1から60まで出るようにしてね
// 数を与えるとそれに応じたシードを生成する関数を作る
// 数が更新されて順繰りにセットされる感じ
// 背景は工夫して下の方に数を分解した式を描く（30=5x3x2とかそういうの）
// 背景はグラデ使う感じで（長方形とかランダムに配置するのもいいかも）
// 解析関連はすべて無くしてね。

// AUTO:自動的に1ずつ増える
// RANDOM:2~999のどれかがランダムで現れるのが繰り返される感じ
// MANUAL:自由に指定してパターンを固定できる感じ
// ほんとは弾丸が全部消えてから次のパターンに行くようにしたいんだけどね。
// どうせ計算無理だからループなくして再生できるようにしようね。
// {fire:false→true(発射あと),bulletNum:(rectの数)}.trueで0になったら次、的な。

// 疲れた
// ループって要するにインデックス増やすのをやめるだけでしょ、次のパターンが同じパターンってだけの話。
// 右の方で

// これからやること
// 衝突判定部分カット
// 背景は白で影つけたい
// クリックで停止と再生（停止中はスライダー動かせないのとモード切替禁止）
// セーブボタン

"use strict";

const INF = Infinity; // 長いので
const DEFAULT_PATTERN_INDEX = 0;

// 今のままでいいからとりあえず関数化とか変数化、やる。
// 解析用グローバル変数
let isLoop = true;

let mySystem; // これをメインに使っていく

// モード用
const AUTO = 0;
const RANDOM = 1;
const MANUAL = 2;
const INITIAL_NUMBER = 111;

// ---------------------------------------------------------------------------------------- //
// system constants.

const EMPTY_SLOT = Object.freeze(Object.create(null)); // ダミーオブジェクト

// 衝突判定用フラグ(collisionFlag)
const OFF = 0;  // たとえばボスとかフラグをオフにしたうえで大きいパーティクル作る、とか出来る（予定）
const ENEMY_BULLET = 1;
const PLAYER_BULLET = 2;
const ENEMY = 3;
const PLAYER = 4;

const STAR_FACTOR = 2.618033988749895; // 1 + 2 * cos(36).
// cosとsinの0, 72, 144, 216, 288における値
const COS_PENTA = [1, 0.30901699437494745, -0.8090169943749473, -0.8090169943749473, 0.30901699437494745];
const SIN_PENTA = [0, 0.9510565162951535, 0.5877852522924732, -0.587785252292473, -0.9510565162951536];
const ROOT_THREE_HALF = 0.8660254037844386; // √3/2.

// 素数, 色（形は全部smallでいいよ・・）
const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const kindOfColor = ["red", "orange", "yellow", "killgreen", "green", "skblue", "blue", "purple", "pink"];

// 以下の定数はnwayやradialにおいて入れ子を作る際に、catch-backでループを戻るときの識別子を作るための変数で、
// 際限なく増えていく。理論上は無限まで。まあそんな増えないだろうと。
// パターンを変えるときに全部0にリセットすべき？でしょうね。何で書いてないの（（
let nwayId = 0;
let radialId = 0;
let lineId = 0;  // catchの度に増やしていく

// ---------------------------------------------------------------------------------------- //
// preload.
// もし画像とかjsonとか引き出す必要があれば。

function preload(){
  /* NOTHING */
}

// ---------------------------------------------------------------------------------------- //
// setup. seedの作成がメイン。
// createSystemは中身をそのまま写しちゃえばいい
// entityをmySystemで取り替えれば全部そのまま通用する。ほとんどいじってないので。

function setup(){
  mySystem = createSystem(480, 600, 1024);
  // AREA_WIDTH = 480, AREA_HEIGHT = 600が代入される。
  // さらにunitPoolも生成する（1024）
  // unitPoolはあっちでしか使ってないのでこれでいいはず・・・
  createCanvas(AREA_WIDTH + 160, AREA_HEIGHT);
  angleMode(DEGREES);
  textAlign(CENTER, CENTER);
  noStroke();

  let weaponData = [];
  let weaponCapacity = 0;

  // プレイヤーはいません

  mySystem.setPattern();
}

function draw(){
  mySystem.drawBackground(); // 背景

  mySystem.update(); // 更新

  //mySystem.collisionCheck(); // 衝突判定

  mySystem.execute(); // 行動

  mySystem.eject(); // 排除

  mySystem.draw(); // 描画

  drawConfig(); // コンフィグ
}

// ---------------------------------------------------------------------------------------- //
// PerformanceInfomation.
// 今回は無し。

// ---------------------------------------------------------------------------------------- //
// KeyAction.

// なんかkeyだと動かないから・・何で？
function keyTyped(){
  if(keyCode === 80){ // "P"キー。
    if(isLoop){ noLoop(); isLoop = false; return; }
    else{ loop(); isLoop = true; return; }
  }
}

function keyPressed(){
  // シフトキーでショットチェンジ（予定）
  if(keyCode === SHIFT){
    mySystem.player.shiftPattern();
  }
}

// ---------------------------------------------------------------------------------------- //
// ClickAction.

// モードチェンジ
function mousePressed(){
  if(mouseX < 540 || mouseX > 620){ return; }
  if(mouseY < 20 || mouseY > 180){ return; }
  if((mouseY - 20) % 60 > 40){ return; }
  let id = Math.floor((mouseY - 20) / 60);
  switch(id){
    case 0: mySystem.setMode(AUTO); break;
    case 1: mySystem.setMode(RANDOM); break;
    case 2: mySystem.setMode(MANUAL); break;
  }
}

function drawButton(x, y, name, r, g, b, flag){
  fill(r, g, b, (flag ? 255 : 64));
  rect(x - 40, y - 20, 80, 40);
  fill(255);
  text(name, x, y);
}
function drawButtonSet(){
  textSize(16);
  const _mode = mySystem.getMode();
  drawButton(580, 40, "AUTO", 237, 28, 36, _mode === AUTO);
  drawButton(580, 100, "RANDOM", 34, 177, 76, _mode === RANDOM);
  drawButton(580, 160, "MANUAL", 63, 72, 204, _mode === MANUAL);
}
function drawSlider(){
  fill(70);
  rect(480, 0, 40, 600);
  const cn = mySystem.getCurrentNumber();
  let pos = 10 + Math.floor(((cn - 2) / 997) * 580);
  fill(0, 128, 255);
  rect(480, pos - 10, 40, 20);
  fill(0);
  textSize(16);
  text(cn, 500, pos);
}
// AUTO/RANDOM/MANUAL
function drawConfig(){
  fill(220);
  rect(AREA_WIDTH, 0, 160, AREA_HEIGHT);
  drawButtonSet();
  drawSlider();
}

// ここから下にbulletLanguage関連を移植する
// まあ紛らわしいしbulletLanguage内ではentityを使うようにするか・・
// エイリアスを別に用意するのがいいのかどうかについては知らない（教えて）

// ---------------------------------------------------------------------------------------- //
// createSystem.

function createSystem(w, h, unitCapacity){
  window["AREA_WIDTH"] = w;
  window["AREA_HEIGHT"] = h;
  // デフォルトムーヴ
  window["STAY_MOVE"] = new StayMove();
  window["GO_MOVE"] = new GoMove();
  let _system = new System();
  window["entity"] = _system;
  // デフォルトカラーとシェイプ
  window["SQUARE_MIDDLE"] = entity.drawShape["squareMiddle"];
  window["WEDGE_SMALL"] = entity.drawShape["wedgeSmall"];
  window["PL_BLUE"] = entity.drawColor["plblue"];
  window["BLUE"] = entity.drawColor["blue"];
  // オブジェクトプール
  window["unitPool"] = new ObjectPool(() => { return new Unit(); }, unitCapacity);
  return _system;
}

// ---------------------------------------------------------------------------------------- //
// System.
// とりあえずplayerを持たせるだけ

// 分解中の数が何かを示すあれ。currentNumberが要るわね。
// その数から然るべきSeedを生成する関数も要るわね。
// で、AUTOのときは数が増えていくんだけど、設定するときに数が素因数分解される、
// いくつの数に分かれるかで持ち時間が決まる、持ち時間がセットされる、素因数列はシャッフルされる、素因数列からシードができる、
// シードがセットされる、次のパターンが始まる、パターン中に持ち時間が減っていき0になると次の数が・・・
// プレイヤー要らんね。
// MANUALにすると持ち時間がINFになり減らなくなる。AUTOにするとその時の数に応じた持ち時間がセットされてパターンもいったんリセット。
// そのあとはその数から再びインクリメント、999の次は1に戻る。
// MANUAL中はマウスホイールで数が変わり、再生ボタンクリックでそのパターンが再生されるね。以上。

class System{
	constructor(){
    this.unitArray = new CrossReferenceArray();
    //this.particleArray = new SimpleCrossReferenceArray();
    this.backgroundColor = color(220, 220, 255); // デフォルト（薄い青）
    //this.infoColor = color(0); // デフォルト（情報表示の色、黒）
    this.drawColor = {}; // 色の辞書
    this.registUnitColors();
    this.drawShape = {}; // 形を表現する関数の辞書
    this.registUnitShapes();
    this.drawGroup = {}; // 描画用に用意されたCrossReferenceArrayからなるオブジェクト
    // になるみたいな、それを外部関数でやる。
    // this.drawGroup = {}; hasOwnでたとえばblueがないなってなったらnew CrossReferenceArray()して放り込むとか。
    // で、そこにも登録し、vanishのときにそこからはじく、パターンチェンジの際にもこれらの内容を破棄する。
    // 破棄するときはunitをPoolに戻すのはやってるから単にclearでいい。unitArrayをclearしちゃうとPoolに戻らないので駄目。
    this.patternIndex = 0;
    // プログラム用
    this.mode = AUTO; // 現在のモード
    this.currentNumber = INITIAL_NUMBER; // 表示中のパターンの数
    this.currentPrimeArray = getDecompo(this.currentNumber); // 素因数列、背景にも使う（計算式表示）
    this.primeArrayText = getPrimeArrayText(this.currentPrimeArray); // 数分解の様子を表示するテキスト。
    this.seed = this.createSeed(); // 表示中のパターンの種
    this.patternState = {onFire:false, next:false}; // onFire:弾丸出てる, next:次行ける
    // 背景作る
    this.prepareBackground();
	}
  createSeed(){
    let n = this.currentNumber;
    let seed = {x:0.5, y:0.4, shotSpeed:4, shotDirection:90, collisionFlag:ENEMY, shape:"starLarge", color:"black", bgColor:"plgrey"};
    // seedの中身を作っていく
    seed.short = {preparation:[{speed:["set", 0.1, "$span"]}, {shotDirection:["rel", 90]}]};
    let actionData = {};
    const waitSpan = Math.max(120, 60 * this.currentPrimeArray.length);
    actionData.main = [{deco:{shape:"rectSmall", color:"dkred"}}, {shotAction:"rad0"}, {fire:""}];
    let actionName = "";
    let divider, colorName;
    let span = 30; // 止まるまでのタイムスパンは徐々に減らしていく・・
    // 結局形は小さいrectで統一して色だけ変えることに決めた。
    for(let i = 0; i < this.currentPrimeArray.length; i++){
      actionName = "rad" + (i + 1).toString();
      divider = this.currentPrimeArray[i];
      n = n / divider;
      colorName = kindOfColor[Math.min(8, i)];
      actionData["rad" + i.toString()] = [{deco:{shape:"rectSmall", color:colorName}}, {short:"preparation", span:span},
                                          {shotAction:actionName}, {radial:{count:divider}}, {vanish:true}];
      span -= 2;
    }
    actionData["rad" + this.currentPrimeArray.length] = [];
    seed.action = actionData;
    return seed;
  }
  setPattern(){
    let seed = this.seed;
    // 背景色
    if(seed.hasOwnProperty("bgColor")){
      this.backgroundColor = this.drawColor[seed.bgColor];
    }else{
      this.backgroundColor = color(220, 220, 255); // 背景色のデフォルト
    }
    // 初期化
    this.initialize();
    // 種をパース
    let ptn = parsePatternSeed(seed);
    console.log(ptn);
    createUnit(ptn);
    // プレイヤーになんかしないの？って話。
  }
  registDrawGroup(unit){
    // colorから名前を引き出す。
    //const name = unit.color.name;
    let name = unit.color.name;
    //if(unit.collider.type === "laser"){ name = "laser"; } // laserは別立て描画

    if(!this.drawGroup.hasOwnProperty(name)){
      this.drawGroup[name] = new CrossReferenceArray();
    }
    this.drawGroup[name].add(unit);
  }
	initialize(){
		//this.player.initialize();
    this.unitArray.loopReverse("flagOff"); // 先に衝突フラグを消す
    this.unitArray.loopReverse("vanishAction");  // unitすべて戻す
    this.drawGroup = {};
	}
  registColor(name, _color, damageFactor = 1, lifeFactor = 1){
    _color.name = name; // 色の名前を.nameで参照できるようにしておく。
    _color.damageFactor = damageFactor; // ダメージファクター
    _color.lifeFactor = lifeFactor; // ライフファクター
    this.drawColor[name] = _color;
    return this; // こういうのはメソッドチェーンで書くといい
  }
  registShape(name, _shape){
    _shape.name = name; // 名前付けてないの？？
    this.drawShape[name] = _shape;
    return this; // メソッドチェーン
  }
  numberControl(){
    if(mouseX < AREA_WIDTH || mouseX > AREA_WIDTH + 40){ return; }
    let y = constrain(mouseY, 10, 590);
    let n = Math.floor((y - 10) / 580 * 997) + 2;
    this.setCurrentNumber(n);
  }
  patternStateUpdate(){
    let flag = false;
    for(let u of this.unitArray){
      if(u.shape.name.match(/rect/) !== null){ flag = true; break; } // 1個でも見つかればいいんだよ
    }
    if(flag){
      this.patternState.onFire = true;
    }else if(this.patternState.onFire){
      this.patternState.next = true;
    }
  }
  patternUpdate(){
    switch(this.mode){
      case AUTO:
        this.currentNumber++; if(this.currentNumber > 999){ this.currentNumber = 2; } break;
      case RANDOM:
        this.currentNumber = Math.floor(random() * 997) + 2; break;
      case MANUAL:
        break; // 変えない。というかスライダーで変える。
    }
    // 数を減らしていく。0になったら次。
    this.currentPrimeArray = getDecompo(this.currentNumber); // 素因数列、背景にも使う（計算式表示）
    this.primeArrayText = getPrimeArrayText(this.currentPrimeArray); // 数分解の様子を表示するテキスト。
    this.seed = this.createSeed(); // 表示中のパターンの種
    this.patternState = {onFire:false, next:false};
    this.setPattern();
  }
	update(){
    this.unitArray.loop("update");
    if(this.mode === MANUAL && mouseIsPressed){ this.numberControl(); } // MANUALモード限定
    this.patternStateUpdate();
    if(this.patternState.next){ this.patternUpdate(); }
	}
  execute(){
    this.unitArray.loop("execute");
  }
  eject(){
    this.unitArray.loopReverse("eject");
  }
  prepareBackground(){
    this.bg = createGraphics(AREA_WIDTH, AREA_HEIGHT);
    this.bg.noStroke();
    for(let i = 0; i < 100; i++){
      this.bg.fill(Math.floor(i * 2.55));
      this.bg.rect(0, Math.floor(AREA_HEIGHT * i * 0.01), AREA_WIDTH, AREA_HEIGHT * 0.01);
    }
  }
  drawBackground(){
    image(this.bg, 0, 0);
    fill(0);
    textSize(24);
    text(this.primeArrayText, AREA_WIDTH * 0.5, AREA_HEIGHT * 0.8);
  }
	draw(){
    Object.keys(this.drawGroup).forEach((name) => {
      fill(this.drawColor[name]);
      this.drawGroup[name].loop("draw"); // 色別に描画(laserは別立て)
    })
    // 数字書くのやめ。
	}
  getCapacity(){
    return this.unitArray.length;
  }
  getMode(){
    return this.mode;
  }
  setMode(newMode){
    this.mode = newMode;
  }
  getCurrentNumber(){
    return this.currentNumber;
  }
  setCurrentNumber(newNumber){
    this.currentNumber = newNumber;
  }
  registUnitColors(){
    // 第3引数：damageFactor, 第4引数：lifeFactor. バランス調整が課題。
    this.registColor("black", color(0), 1, 50)
        .registColor("white", color(255), 20, 1)
        .registColor("blue", color(63, 72, 204), 1, 1)
        .registColor("dkblue", color(35, 43, 131), 1, 1)
        .registColor("skblue", color(0, 128, 255), 1, 1)
        .registColor("dkskblue", color(0, 107, 153),1, 1)
        .registColor("plskblue", color(159, 226, 255), 1, 1)
        .registColor("plblue", color(125, 133, 221), 1, 1)
        .registColor("red", color(237, 28, 36), 1, 1)
        .registColor("plred", color(247, 153, 157), 1, 1)
        .registColor("dkred", color(146, 12, 18), 3, 3)
        .registColor("yellow", color(255, 242, 0), 1, 1)
        .registColor("dkyellow", color(142, 135, 0), 1, 1)
        .registColor("dkgreen", color(17, 91, 39), 2, 3)
        .registColor("green", color(34, 177, 76), 1, 1)
        .registColor("plgreen", color(108, 227, 145), 1, 1)
        .registColor("brown", color(128, 64, 0), 1, 1)
        .registColor("plbrown", color(215, 179, 159), 1, 1)
        .registColor("dkbrown", color(103, 65, 44), 2, 3)
        .registColor("purple", color(163, 73, 164), 1, 1)
        .registColor("dkpurple", color(95, 41, 95), 1, 1)
        .registColor("plorange", color(255, 191, 149), 1, 1)
        .registColor("orange", color(255, 127, 39), 1, 1)
        .registColor("dkorange", color(180, 70, 0), 2, 2)
        .registColor("gold", color(128, 128, 0), 1, 1)
        .registColor("dkgrey", color(64), 1, 1)
        .registColor("plgrey", color(200), 1, 1)
        .registColor("grey", color(128), 1, 1)
        .registColor("ltgreen", color(181, 230, 29), 1, 1)
        .registColor("killgreen", color(116, 149, 17), 20, 5) // 濃い黄緑
        .registColor("pink", color(255, 55, 120), 1, 1)
        .registColor("bossBrown", color(65, 40, 27), 5, 30)
        .registColor("bossPink", color(255, 26, 100), 5, 50)
        .registColor("bossBlue", color(57, 86, 125), 5, 50) // ボス用（急遽）。とりあえず500にしといて。
        .registColor("bossRed", color(74, 6, 10), 5, 50); // ボス用のワインレッド（1面のボス）
  }
  registUnitShapes(){
    this.registShape("wedgeSmall", new DrawWedgeShape(6, 3))
        .registShape("wedgeMiddle", new DrawWedgeShape(12, 6))
        .registShape("wedgeLarge", new DrawWedgeShape(18, 9))
        .registShape("wedgeHuge", new DrawWedgeShape(36, 18))
        .registShape("squareSmall", new DrawSquareShape(10))
        .registShape("squareMiddle", new DrawSquareShape(20))
        .registShape("squareLarge", new DrawSquareShape(30))
        .registShape("squareHuge", new DrawSquareShape(60))
        .registShape("starSmall", new DrawStarShape(3))
        .registShape("starMiddle", new DrawStarShape(6))
        .registShape("starLarge", new DrawStarShape(9))
        .registShape("starHuge", new DrawStarShape(18))
        .registShape("diaSmall", new DrawDiaShape(8))
        .registShape("rectSmall", new DrawRectShape(6, 4))
        .registShape("rectMiddle", new DrawRectShape(12, 8))
        .registShape("rectLarge", new DrawRectShape(18, 12))
        .registShape("rectHuge", new DrawRectShape(36, 24))
        .registShape("doubleWedgeSmall", new DrawDoubleWedgeShape(10))
        .registShape("doubleWedgeMiddle", new DrawDoubleWedgeShape(20))
        .registShape("doubleWedgeLarge", new DrawDoubleWedgeShape(30))
        .registShape("doubleWedgeHuge", new DrawDoubleWedgeShape(60))
        .registShape("cherryLarge", new DrawCherryShape(30));
  }
}

// ここをpattern1本にして、shape, colorプロパティを用意して文字列データ入れておいて、
// shapeに従ってunitのshapeプロパティを設定して(クラス)、colorに従って以下略。
// shapeの方はさっそくsetを呼び出してdrawParamに必要なら入れる、これはvanishで初期化してなくす、
function createUnit(pattern){
  let newUnit = unitPool.use();
  newUnit.initialize();
  newUnit.setPattern(pattern);
  entity.unitArray.add(newUnit);
  entity.registDrawGroup(newUnit);
  // 色、形についてはsetPatternで行う感じ。
}

// やられるとき：sizeFactor = 0.7, life = 60, speed = 4, count = 20.
// ダメージ時：sizeFactor = 2.0, life = 30, speed = 4, count = 5.
// targetは発生場所。レーザーの場合はくらった相手の場所に発生させる。
// レーザーダメージ時：sizeFactor = 2.0, life = 15, speed = 4, count = 2.

// ---------------------------------------------------------------------------------------- //
// Player.
// 今は黒い四角形がくるくるしてるだけ。
// パッシブスキルを色付きの回転多角形で表現したいんだけどまだまだ先の話。
// 回転する四角形の色：ショットの色、伸縮する青い楕円：常時HP回復、みたいな。オレンジの六角形でHP表示とか面白そう。

// 今回プレイヤーはいません

// ---------------------------------------------------------------------------------------- //
// Unit.
// BulletとCannonの挙動をまとめる試み

class Unit{
  constructor(){
    this.isPlayer = false; // プレイヤーではない。
    this.position = createVector();
    this.previousPosition = createVector(); // 前フレームでの位置
    this.velocity = createVector();
    this.counter = new LoopCounter(); // クラス化. loopの制御はこれ以降このコンポジットに一任する。
    //this.collider = new CircleCollider(); // 最初に1回だけ作って使いまわす。種類が変わるときだけいじる。基本update.
    this.initialize();
  }
  initialize(){
    // vanishの際に呼び出される感じ
    // 動きに関する固有のプロパティ
    this.position.set(0, 0);
    this.previousPosition.set(0, 0);
    this.velocity.set(0, 0);
    this.speed = 0; // 1.
    this.direction = 0; // 2.
    this.delay = 0; // 3.
    this.move = GO_MOVE; // デフォはGO. 4.
    this.action = []; // 各々の行動はcommandと呼ばれる（今までセグメントと呼んでいたもの） 5.
    this.actionIndex = 0; // 処理中のcommandのインデックス

    this.counter.initialize();

    // 親の情報（bearingや親がやられたときの発動など用途様々）
    this.parent = undefined; // 自分を生み出したunitに関する情報。ノードでなければ何かしら設定される。
    // bulletを生成する際に使うプロパティ
    this.shotSpeed = 0; // 6.
    this.shotDirection = 0; // 7.
    this.shotAim = 0; // 11.
    this.shotDelay = 0;
    this.shotDistance = 0;  // ショットの初期位置（デフォは0,つまりunitの位置）
    this.shotMove = GO_MOVE; // デフォはGO.
    this.shotAction = [];
    this.shotCollisionFlag = ENEMY_BULLET; // 基本的にはショットのフラグは敵弾丸。いじるとき、いじる。
    // 色、形. デフォルトはこんな感じ。
    this.shape = SQUARE_MIDDLE; // これ使ってdrawするからね。描画用クラス。 // 8.
    this.color = PL_BLUE; // 9.
    this.shotShape = WEDGE_SMALL;
    this.shotColor = BLUE;
    this.drawParam = {}; // 描画用付加データは毎回初期化する
    // その他の挙動を制御する固有のプロパティ
    this.properFrameCount = 0;
    this.vanish = false; // trueなら、消す。
    this.hide = false; // 隠したいとき // appearでも作る？disappearとか。それも面白そうね。ステルス？・・・
    // 衝突判定関連
    this.collisionFlag = ENEMY_BULLET; // default. ENEMY, PLAYER_BULLETの場合もある。 // 10.
    // colliderがcircleでなくなってる場合は新たにCircleColliderを生成して当てはめる。
    //if(this.collider.type !== "circle"){ this.collider = new CircleCollider(); }
    //else{ /* Check(必要なら) */ this.collider.update(0, 0, 0); }
    // bindプロパティがtrueの場合、parentがvanishしたらactionをしないでvanishして切り上げる
    this.bind = false;
  }
  setPosition(x, y){
    this.position.set(x, y);
  }
  setPreviousPosition(){
    // 前フレームでの位置を記録しておく
    const {x, y} = this.position;
    this.previousPosition.set(x, y);
  }
  setVelocity(speed, direction){
    this.velocity.set(speed * cos(direction), speed * sin(direction));
  }
  velocityUpdate(){
    this.velocity.set(this.speed * cos(this.direction), this.speed * sin(this.direction));
  }
  setPattern(ptn){
    const {x, y} = ptn;
    // この時点でもうx, yはキャンバス内のどこかだしspeedとかその辺もちゃんとした数だし(getNumber通し済み)
    this.position.set(x, y);
    const moveProperties = ["speed", "direction", "delay", "shotSpeed", "shotDirection"];
    moveProperties.forEach((propName) => {
      if(ptn[propName] !== undefined){ this[propName] = ptn[propName]; } // 確定は済んでる
    })
    this.velocityUpdate(); // 速度が決まる場合を考慮する

    this.shotAim = this.shotDirection;

    // ノンデフォルトの場合に変更します（自分と同じものを出す場合は個別に決めてね。）
    if(ptn.color !== undefined){ this.color = ptn.color; }
    if(ptn.shape !== undefined){ this.shape = ptn.shape; }
    if(ptn.move !== undefined){ this.move = ptn.move; }
    if(ptn.collisionFlag !== undefined){ this.collisionFlag = ptn.collisionFlag; } // ENEMY_BULLETでない場合は別途指示
    this.action = ptn.action; // action配列

    // shotCollisionFlagの初期設定。基本的に複製。
    if(this.collisionFlag === PLAYER_BULLET){ this.shotCollisionFlag = PLAYER_BULLET; }
    if(this.collisionFlag === ENEMY_BULLET){ this.shotCollisionFlag = ENEMY_BULLET; }

    // parentの設定(用途様々)
    if(ptn.parent !== undefined){
      this.parent = ptn.parent;
    }
    // parentの情報を使う場合があるのでparentのあとでshapeのsetを実行する
    this.shape.set(this);
    // lifeとdamage(ptn作るときに事前に計算しておいた方がいい、)
    // (でないとたとえば100個作る場合に100回同じ計算する羽目になる。shapeとcolorから出るならここでしなくていいよ。)
    if(this.collisionFlag === ENEMY_BULLET || this.collisionFlag === PLAYER_BULLET){
      this.damage = calcDamage(this.shape, this.color); // shape:基礎ダメージ、color:倍率
    }
    if(this.collisionFlag === ENEMY){
      this.maxLife = calcLife(this.shape, this.color); // shape:基礎ライフ、color:倍率
      this.life = this.maxLife;
    }
  }
  eject(){
    if(this.vanish){ this.vanishAction(); }
  }
  vanishAction(){
    // 複数ある場合っての今回出て来てるので・・うん。うしろから。
    // とにかくね、remove関連は後ろからなのよ・・でないとやっぱバグるのよね。
    for(let i = this.belongingArrayList.length - 1; i >= 0; i--){
      this.belongingArrayList[i].remove(this);
    }
    if(this.belongingArrayList.length > 0){ console.log("REMOVE ERROR!"); noLoop(); } // 排除ミス
    // パーティクルも出さないの。ごめんね・・
    unitPool.recycle(this); // 名称をunitPoolに変更
  }
  flagOff(){
    // パーティクルが出ないよう、消滅前にフラグを消すことがある。(画面外で消えるときやパターン変更時)
    this.collisionFlag = OFF;
  }
  update(){
    // vanishのときはスルー
    if(this.vanish){ return; }
    // delay処理（カウントはexecuteの方で減らす・・分離されてしまっているので。）
    if(this.delay > 0){ return; }
    // previousPositionをセット
    this.setPreviousPosition();
    // moveとframeOutCheck.
    this.move.execute(this);
    this.frameOutCheck();
  }
  frameOutCheck(){
    const {x, y} = this.position;
    if(x < -AREA_WIDTH * 0.2 || x > AREA_WIDTH * 1.2 || y < -AREA_HEIGHT * 0.2 || y > AREA_HEIGHT * 1.2){
      this.flagOff(); // これにより外側で消えたときにパーティクルが出現するのを防ぐ
      this.vanish = true;
    }
  }
  lifeUpdate(diff){
    this.life += diff;
    if(this.life > this.maxLife){ this.life = this.maxLife; }
    if(this.life > 0){ return; }
    this.life = 0;
    this.vanish = true;
  }
  execute(){
    // vanishのときはスルー
    if(this.vanish){ return; }
    // delay処理. カウントはこっちで減らす。
    if(this.delay > 0){ this.delay--; return; }
    if(this.bind){
      // bindの場合、親が死んだら死ぬ。
      if(this.parent.vanish){ this.vanish = true; return; }
    }
    // 以下の部分をexecuteとして切り離す
    // アクションの実行（処理が終了しているときは何もしない）（vanish待ちのときも何もしない）
    if(this.action.length > 0 && this.actionIndex < this.action.length){
      let debug = 0; // デバッグモード
      let continueFlag = true;
      while(continueFlag){
        const command = this.action[this.actionIndex];
        continueFlag = execute(this, command); // flagがfalseを返すときに抜ける
        debug++; // デバッグモード
        if(debug > 10000){
          console.log("INFINITE LOOP ERROR!!");
          console.log(command, this.actionIndex);
          noLoop(); break; } // デバッグモード
        // actionの終わりに来たら勝手に抜ける。その後は永久にwaitになる（予定）
        if(this.actionIndex === this.action.length){ break; }
      }
    }
    // カウントの進行
    this.properFrameCount++;
  }
  draw(){
    if(this.hide || this.vanish){ return; } // hide === trueのとき描画しない
    this.shape.draw(this);
    // ライフゲージ無しで
  }
}

// ---------------------------------------------------------------------------------------- //
// loopCounter. ループのcommandについて。

class LoopCounter extends Array{
  constructor(){
    super();
    this.initialize();
  }
  initialize(){
    this.length = 0;
    this.currentIndex = 0;
  }
  getLoopCount(){
    // そのときのloopCountを取得する。0～limit-1が返る想定。
    if(this.currentIndex === this.length){ this.push(0); }
    return this[this.currentIndex];
  }
  loopCheck(limit){
    // countを増やす。limitに達しなければfalseを返す。達するならcountを進める。
    if(this.currentIndex === this.length){ this.push(0); }
    this[this.currentIndex]++;
    if(this[this.currentIndex] < limit){ return false; }
    // limitに達した場合はindexを増やす。
    this.currentIndex++;
    return true;
  }
  loopBack(unit, back){
    // unitのactionIndexをbackだけ戻す。その間にcountプロパティをもつcommandがあったら
    // そのたびにcurrentIndexを1減らしてそこの値を0にならす。
    let {action, actionIndex} = unit;
    for(let i = 1; i <= back; i++){
      const currentCommand = action[actionIndex - i];
      if(currentCommand.hasOwnProperty("count")){
        this.currentIndex--;
        this[this.currentIndex] = 0;
      }
    }
    unit.actionIndex -= back; // 最後にまとめて戻す
  }
}

// ---------------------------------------------------------------------------------------- //
// particle.

// は、出ません。

// ---------------------------------------------------------------------------------------- //
// drawFunction. bullet, cannon用の描画関数.
// もっと形増やしたい。剣とか槍とか手裏剣とか。3つ4つの三角形や四角形がくるくるしてるのとか面白いかも。
// で、色とは別にすれば描画の負担が減るばかりかさらにバリエーションが増えて一石二鳥。
// サイズはsmall, middle, large, hugeの4種類。

// colliderはDrawShapeをセットするときに初期設定する感じ。

class DrawShape{
  constructor(){
    //this.colliderType = "";
  }
  set(unit){ /* drawParamに描画用のプロパティを準備 */}
  draw(unit){ /* 形の描画関数 */ }
}

// drawWedge
// 三角形。(h, b) = (6, 3), (12, 6), (18, 9), (36, 18).
// 三角形の高さの中心に(x, y)で, 頂点と底辺に向かってh, 底辺から垂直にb.
// 当たり判定はsize=(h+b)/2半径の円。戻した。こっちのがくさびっぽいから。
class DrawWedgeShape extends DrawShape{
  constructor(h, b){
    super();
    //this.colliderType = "circle";
    this.h = h; // 6
    this.b = b; // 3
    this.size = (h + b) / 2;
    this.damage = this.size / 4.5; // 基礎ダメージ。1, 2, 3, 6.
  }
  set(unit){
    // colliderInitialize.
    //unit.collider.update(unit.position.x, unit.position.y, this.size);
    //return;
  }
  draw(unit){
    const {x, y} = unit.position;
    const direction = unit.direction;
    const dx = cos(direction);
    const dy = sin(direction);
    triangle(x + this.h * dx,          y + this.h * dy,
             x - this.h * dx + this.b * dy, y - this.h * dy - this.b * dx,
             x - this.h * dx - this.b * dy, y - this.h * dy + this.b * dx);
  }
}

// いわゆるダイヤ型。8, 12, 16, 32.
// 当たり判定はsize半径の・・0.75倍の方がいいかな。そういうのできるんだっけ？(知らねぇよ)
class DrawDiaShape extends DrawShape{
  constructor(size){
    super();
    //this.colliderType = "circle";
    this.size = size;
    this.damage = 1; // 基礎ダメージ。サイズで変えたい・・
  }
  set(unit){
    // colliderInitialize.
    //unit.collider.update(unit.position.x, unit.position.y, this.size * 0.75);
  }
  draw(unit){
    const {x, y} = unit.position;
    const {direction} = unit;
    const c = cos(direction);
    const s = sin(direction);
    const r = this.size;
    quad(x + r * c, y + r * s, x + 0.5 * r * s, y - 0.5 * r * c,
         x - r * c, y - r * s, x - 0.5 * r * s, y + 0.5 * r * c);
  }
}

// 長方形（指向性のある）
// (6, 4), (12, 8), (18, 12), (36, 24).
// 当たり判定はsizeで・・
// 弾丸にしよかな・・円弧と長方形組み合わせるの。
class DrawRectShape extends DrawShape{
  constructor(h, w){
    super();
    //this.colliderType = "circle";
    this.h = h;
    this.w = w;
    this.size = (h + w) / 2;
    this.damage = this.h / 4; // 基礎ダメージ。1.5, 3.0, 4.5, 9.0
  }
  set(unit){
    // colliderInitialize.
    //unit.collider.update(unit.position.x, unit.position.y, this.size);
  }
  draw(unit){
    // unit.directionの方向に長い長方形
    const {x, y} = unit.position;
    const {direction} = unit;
    const c = cos(direction);
    const s = sin(direction);
    quad(x + c * this.h + s * this.w, y + s * this.h - c * this.w,
         x + c * this.h - s * this.w, y + s * this.h + c * this.w,
         x - c * this.h - s * this.w, y - s * this.h + c * this.w,
         x - c * this.h + s * this.w, y - s * this.h - c * this.w);
  }
}


// drawSquare.
// 回転する四角形。10, 20, 30, 60.
// 当たり判定はsize半径の円。
// 重なるの嫌だからちょっと変えようかな。白い線入れたい。
class DrawSquareShape extends DrawShape{
  constructor(size){
    super();
    //this.colliderType = "circle";
    this.size = size;
    this.life = size / 2; // 基礎ライフ。5, 10, 15, 30
  }
  set(unit){
    // colliderInitialize.
    //unit.collider.update(unit.position.x, unit.position.y, this.size);
    unit.drawParam = {rotationAngle:45, rotationSpeed:2};
  }
  draw(unit){
    const {x, y} = unit.position;
    const c = cos(unit.drawParam.rotationAngle) * this.size;
    const s = sin(unit.drawParam.rotationAngle) * this.size;
    quad(x + c, y + s, x - s, y + c, x - c, y - s, x + s, y - c);
    unit.drawParam.rotationAngle += unit.drawParam.rotationSpeed;
  }
}

// drawStar. 回転する星型。
// size:3, 6, 9, 18.
// 三角形と鋭角四角形を組み合わせてさらに加法定理も駆使したらクソ速くなった。すげー。
// 当たり判定はsize半径の円（コアの部分）だけど1.5倍の方がいいかもしれない。
class DrawStarShape extends DrawShape{
  constructor(size){
    super();
    //this.colliderType = "circle";
    this.size = size;
    this.life = size * 5; // 基礎ライフ。15, 30, 45, 90.
    this.damage = size;   // 基礎ダメージ。3, 6, 9, 18.
  }
  set(unit){
    // colliderInitialize.
    //unit.collider.update(unit.position.x, unit.position.y, this.size * 1.2); // ちょっと大きく
    unit.drawParam = {rotationAngle:0, rotationSpeed:2};
  }
  draw(unit){
    const {x, y} = unit.position;
    const r = this.size;
    const direction = unit.drawParam.rotationAngle;
    let u = [];
  	let v = [];
    // cos(direction)とsin(direction)だけ求めてあと定数使って加法定理で出せばもっと速くなりそう。
    // またはtriangle5つをquad1つとtriangle1つにすることもできるよね。高速化必要。
    const c = cos(direction);
    const s = sin(direction);
  	for(let i = 0; i < 5; i++){
  		u.push([x + (r * STAR_FACTOR) * (c * COS_PENTA[i] - s * SIN_PENTA[i]),
              y + (r * STAR_FACTOR) * (s * COS_PENTA[i] + c * SIN_PENTA[i])]);
  	}
    v.push(...[x - r * c, y - r * s]);
    // u1 u4 v(三角形), u0 u2 v u3(鋭角四角形).
    triangle(u[1][0], u[1][1], u[4][0], u[4][1], v[0], v[1]);
    quad(u[0][0], u[0][1], u[2][0], u[2][1], v[0], v[1], u[3][0], u[3][1]);
    unit.drawParam.rotationAngle += unit.drawParam.rotationSpeed;
  }
}

// 互いに逆向きのくさび型を組み合わせた形。
// 回転する。サイズ：10, 20, 30, 60.
class DrawDoubleWedgeShape extends DrawShape{
  constructor(size){
    super();
    //this.colliderType = "circle";
    this.size = size;
    this.life = size; // 基礎ライフ：10, 20, 30, 60.
  }
  set(unit){
    // colliderInitialize.
    //unit.collider.update(unit.position.x, unit.position.y, this.size); // 本来の大きさで。
    unit.drawParam = {rotationAngle:0, rotationSpeed:4};
  }
  draw(unit){
    const {x, y} = unit.position;
    const direction = unit.drawParam.rotationAngle
    const c = cos(direction) * this.size;
    const s = sin(direction) * this.size;
    quad(x + c, y + s, x - 0.5 * c + ROOT_THREE_HALF * s, y - 0.5 * s - ROOT_THREE_HALF * c,
             x,     y, x - 0.5 * c - ROOT_THREE_HALF * s, y - 0.5 * s + ROOT_THREE_HALF * c);
    quad(x - c, y - s, x + 0.5 * c + ROOT_THREE_HALF * s, y + 0.5 * s - ROOT_THREE_HALF * c,
             x,     y, x + 0.5 * c - ROOT_THREE_HALF * s, y + 0.5 * s + ROOT_THREE_HALF * c);
    unit.drawParam.rotationAngle += unit.drawParam.rotationSpeed;
  }
}

// DrawCherryShape.
// 桜っぽい感じのやつ。敵専用。1面のボス。typeはcircleでsizeは10, 20, 30, 60で
// 基礎lifeはそれぞれ8, 16, 24, 48（0.8倍）
class DrawCherryShape extends DrawShape{
  constructor(size){
    super();
    //this.colliderType = "circle";
    this.size = size;
    this.life = size * 0.8;
  }
  set(unit){
    // colliderInitialize.
    //unit.collider.update(unit.position.x, unit.position.y, this.size); // 本来の大きさで。
    unit.drawParam = {rotationAngle:0, rotationSpeed:4};
  }
  draw(unit){
    const {x, y} = unit.position;
    const direction = unit.drawParam.rotationAngle;
    const c = cos(direction) * this.size * 0.75;
    const s = sin(direction) * this.size * 0.75;
    for(let i = 0; i < 5; i++){
      arc(x + c * COS_PENTA[i] - s * SIN_PENTA[i], y + c * SIN_PENTA[i] + s * COS_PENTA[i],
          this.size, this.size, 45 + 72 * i + direction, 315 + 72 * i + direction);
    }
    unit.drawParam.rotationAngle += unit.drawParam.rotationSpeed;
  }
}

// 剣みたいなやつ。
// 先端とunit.positionとの距離を指定してコンストラクトする。剣先からなんか出す場合の参考にする。

// レーザーは使いません

// ダメージ計算
function calcDamage(_shape, _color){
  return _shape.damage * _color.damageFactor;
}
// ライフ計算
function calcLife(_shape, _color){
  return _shape.life * _color.lifeFactor;
}
// ---------------------------------------------------------------------------------------- //
// ここからしばらく衝突判定関連

// 衝突判定はしません

// ---------------------------------------------------------------------------------------- //
// ObjectPool.
// どうやって使うんだっけ・・

class ObjectPool{
	constructor(objectFactory = (() => ({})), initialCapacity = 0){
		this.objPool = [];
		this.nextFreeSlot = null; // 使えるオブジェクトの存在位置を示すインデックス
		this.objectFactory = objectFactory;
		this.grow(initialCapacity);
	}
	use(){
		if(this.nextFreeSlot == null || this.nextFreeSlot == this.objPool.length){
		  this.grow(this.objPool.length || 5); // 末尾にいるときは長さを伸ばす感じ。lengthが未定義の場合はとりあえず5.
		}
		let objToUse = this.objPool[this.nextFreeSlot]; // FreeSlotのところにあるオブジェクトを取得
		this.objPool[this.nextFreeSlot++] = EMPTY_SLOT; // その場所はemptyを置いておく、そしてnextFreeSlotを一つ増やす。
		return objToUse; // オブジェクトをゲットする
	}
	recycle(obj){
		if(this.nextFreeSlot == null || this.nextFreeSlot == -1){
			this.objPool[this.objPool.length] = obj; // 図らずも新しくオブジェクトが出来ちゃった場合は末尾にそれを追加
		}else{
			// 考えづらいけど、this.nextFreeSlotが0のときこれが実行されるとobjPool[-1]にobjが入る。
			// そのあとでrecycleが発動してる間は常に末尾にオブジェクトが増え続けるからFreeSlotは-1のまま。
			// そしてuseが発動した時にその-1にあったオブジェクトが使われてそこにはEMPTY_SLOTが設定される
			this.objPool[--this.nextFreeSlot] = obj;
		}
	}
	grow(count = this.objPool.length){ // 長さをcountにしてcount個のオブジェクトを追加する
		if(count > 0 && this.nextFreeSlot == null){
			this.nextFreeSlot = 0; // 初期状態なら0にする感じ
		}
		if(count > 0){
			let curLen = this.objPool.length; // curLenはcurrent Lengthのこと
			this.objPool.length += Number(count); // countがなんか変でも数にしてくれるからこうしてるみたい？"123"とか。
			// こうするとかってにundefinedで伸ばされるらしい・・長さプロパティだけ増やされる。
			// 基本的にはlengthはpushとか末尾代入（a[length]=obj）で自動的に増えるけどこうして勝手に増やすことも出来るのね。
			for(let i = curLen; i < this.objPool.length; i++){
				// add new obj to pool.
				this.objPool[i] = this.objectFactory();
			}
			return this.objPool.length;
		}
	}
	size(){
		return this.objPool.length;
	}
}

// ---------------------------------------------------------------------------------------- //
// Simple Cross Reference Array.
// 改造する前のやつ。

class SimpleCrossReferenceArray extends Array{
	constructor(){
    super();
	}
  add(element){
    this.push(element);
    element.belongingArray = this; // 所属配列への参照
  }
  addMulti(elementArray){
    // 複数の場合
    elementArray.forEach((element) => { this.add(element); })
  }
  remove(element){
    let index = this.indexOf(element, 0);
    this.splice(index, 1); // elementを配列から排除する
  }
  loop(methodName){
		if(this.length === 0){ return; }
    // methodNameには"update"とか"display"が入る。まとめて行う処理。
		for(let i = 0; i < this.length; i++){
			this[i][methodName]();
		}
  }
	loopReverse(methodName){
		if(this.length === 0){ return; }
    // 逆から行う。排除とかこうしないとエラーになる。もうこりごり。
		for(let i = this.length - 1; i >= 0; i--){
			this[i][methodName]();
		}
  }
	clear(){
		this.length = 0;
	}
}

// ---------------------------------------------------------------------------------------- //
// Cross Reference Array.

// 配列クラスを継承して、要素を追加するときに自動的に親への参照が作られるようにしたもの
// 改造して複数の配列に所属できるようにした。
class CrossReferenceArray extends Array{
	constructor(){
    super();
	}
  add(element){
    this.push(element);
    // 複数のCRArrayが存在する場合に備えての仕様変更
    if(!element.hasOwnProperty("belongingArrayList")){
      element.belongingArrayList = [];
    }
    element.belongingArrayList.push(this); // 所属配列への参照
  }
  addMulti(elementArray){
    // 複数の場合
    elementArray.forEach((element) => { this.add(element); })
  }
  remove(element){
    // 先にbelongingArrayListから排除する
    let belongingArrayIndex = element.belongingArrayList.indexOf(this, 0);
    element.belongingArrayList.splice(belongingArrayIndex, 1);
    // elementを配列から排除する
    let index = this.indexOf(element, 0);
    this.splice(index, 1);
  }
  loop(methodName){
		if(this.length === 0){ return; }
    // methodNameには"update"とか"display"が入る。まとめて行う処理。
		for(let i = 0; i < this.length; i++){
			this[i][methodName]();
		}
  }
	loopReverse(methodName){
		if(this.length === 0){ return; }
    // 逆から行う。排除とかこうしないとエラーになる。もうこりごり。
		for(let i = this.length - 1; i >= 0; i--){
			this[i][methodName]();
		}
  }
	clear(){
		this.length = 0;
	}
}

// ---------------------------------------------------------------------------------------- //
// Utility.

// 自機方向の取得
function getPlayerDirection(pos, margin = 0){
  const {x, y} = entity.player.position;
  return atan2(y - pos.y, x - pos.x) + margin * random(-1, 1);
}

// 自機方向の2乗の取得
function getPlayerDistSquare(pos){
  const {x, y} = entity.player.position;
  return pow(pos.x - x, 2) + pow(pos.y - y, 2);
}

// パースの時に関数にしちゃった方がいいかも。あとcase:3は廃止でいいかも。
function getNumber(data){
  // dataが単なる数ならそれを返す。
  // [2, 4]とかなら2から4までのどれかの実数を返す。
  // [2, 8, 0.2]とかなら2以上8未満の0.2刻みの（2, 2.2, 2.4, ...）どれかを返す。
  if(typeof(data) === "number"){ return data; }
  switch(data.length){
		case 2:
		  return random(data[0], data[1]);
		case 3:
		  const a = data[0];
			const b = data[1];
			const step = data[2];
			return a + Math.floor(random((b - a) / step)) * step;
	}
}

// Objectから最初のキーを取り出す
function getTopKey(obj){
  let keyArray = Object.keys(obj);
  if(keyArray.length > 0){ return keyArray[0]; }
  return "";
}

// 0～360の値2つに対して角度としての距離を与える
function directionDist(d1, d2){
  return min(abs(d1 - d2), 360 - abs(d1 - d2));
}

// 与えられた2以上の整数を素因数分解して配列を返す。
function getDecompo(n){
  if(n < 2 || n > 999 || typeof(n) !== "number"){ return []; }
  if(Math.floor(n) !== n){ return []; }
  let result = [];
  let m, divider;
  let debug = 10000;
  while(n > 1 && debug > 0){
    debug--;
    m = Math.sqrt(n);
    for(let p of primes){
      if(p > m){ divider = n; break; }
      if(n % p === 0){ divider = p; break; }
    }
    result.push(divider);
    n = n / divider;
  }
  return shuffle(result);
}

// data=[2, 2, 3]だとして12=2x2x3みたいなテキストを作るやつね。reduceで積を取る感じ。
function getPrimeArrayText(data){
  if(data.length === 1){ return data[0].toString() + " is prime number."; }
  const product = data.reduce((a, b) => { return a * b });
  let result = product.toString() + "=";
  result += data[0].toString();
  for(let i = 1; i < data.length; i++){
    result += "x" + data[i].toString();
  }
  return result;
}

// ---------------------------------------------------------------------------------------- //
// Move. behaviorは廃止。

class StayMove{
  constructor(){}
  execute(unit){ return; }
}

class GoMove{
  constructor(){}
  execute(unit){ unit.position.add(unit.velocity); return; }
}

// 円形移動。parentを中心にbearingのディグリー角速度で回転する。動く場合でも可能。楕円軌道も可能。
class CircularMove{
  constructor(param){
    this.bearing = param.bearing;
    this.radiusDiff = (param.hasOwnProperty("radiusDiff") ? param.radiusDiff : 0);
    this.ratioXY = (param.hasOwnProperty("ratioXY") ? param.ratioXY : 1.0);
  }
  execute(unit){
    const {x, y} = unit.position;
    const {x:px, y:py} = unit.parent.previousPosition;
    const {x:cx, y:cy} = unit.parent.position;
    const dx = x - px;
    const dy = (y - py) / this.ratioXY;
    const r = Math.sqrt(dx * dx + dy * dy);
    const dir = atan2(dy, dx);
    const newX = cx + (r + this.radiusDiff) * cos(dir + this.bearing);
    const newY = cy + (r + this.radiusDiff) * sin(dir + this.bearing) * this.ratioXY;
    unit.direction = atan2(newY - y, newX - x);
    unit.setPosition(newX, newY);
  }
}

// えーと、fall.
class FallMove{
  constructor(param){
    this.gravity = param.gravity;
  }
  execute(unit){
    const {x, y} = unit.position;
    unit.velocity.y += this.gravity;
    unit.position.add(unit.velocity);
    unit.direction = atan2(unit.velocity.y, unit.velocity.x);
    return;
  }
}

// ---------------------------------------------------------------------------------------- //
// createFirePattern.

function executeFire(unit){
  // bulletにセットするパターンを作ります。
  let ptn = {};

  // formation, fitting, nway, radial, lineすべて廃止

  // 位置ずらし
  ptn.x = unit.position.x + cos(unit.shotDirection) * unit.shotDistance;
  ptn.y = unit.position.y + sin(unit.shotDirection) * unit.shotDistance;
  // speed, direction.
  ptn.speed = unit.shotSpeed;
  ptn.direction = unit.shotDirection;
  ptn.shotDirection = unit.shotAim; // ???
  ptn.shotSpeed = ptn.speed;
  // option.
  ptn.delay = unit.shotDelay;
  ptn.move = unit.shotMove;
  // action(無くても[]が入るだけ)
  ptn.action = unit.shotAction;
  // 色、形関連
  ptn.color = unit.shotColor;
  ptn.shape = unit.shotShape;
  // collisionFlag.
  ptn.collisionFlag = unit.shotCollisionFlag;
  // <<---重要--->> parentの設定。createUnitのときに設定される。
  ptn.parent = unit;

  createUnit(ptn); // 形を指定する。基本的にWedge.
}

// ---------------------------------------------------------------------------------------- //
// parse.
// やり直し。ほぼ全部書き換え。
// 簡略形式のpatternSeedってやつをいっちょまえのpatternに翻訳する処理。
// 段階を踏んで実行していく。
// step1: x, y, speed, direction, delay, shotSpeed, shotDirection, shotDelayは、
// 2, 3, [3, 6], [1, 10, 1]みたく設定
// behavior, shotBehaviorの初期設定は略系は["name1", "name2", ...]みたくしてオブジェクトに変換する、
// だから最初にやるのはfireとbehaviorを関数にする、それで、setterのところを完成させる。
// step2: short展開
// step3: action展開
// step4: commandの略系を実行形式に直す
// step5: commandの実行関数を作る（execute(unit, command)
// ↑ここ言葉の乱用でセグメント部分もactionって名前になっちゃってるけど、
// actionの部分部分はcommandって名前で統一しようね。

// ああーそうか、setでくくらないとbehaviorんとこごっちゃになってしまう・・
// だから略形式ではset:{....}, action:{....}, fire, short, behaviorってしないとまずいのね。

// 略系で書かれたパターンはパターンシードと呼ぶことにする。
function parsePatternSeed(seed){
  let ptn = {}; // 返すやつ
  let data = {}; // 補助データ(関数化したfireやbehaviorを入れる)
  // setter部分(behavior以外)
  const {x, y} = seed;
  // x, yは0.4や0.3や[0.1, 0.9]や[0.4, 0.8, 0.05]みたいなやつ。
  // ここでもう数にしてしまおうね。
  // x, yは存在しないこともある（プレイヤーのとか）ので。
  if(x !== undefined){ ptn.x = getNumber(x) * AREA_WIDTH; }
  if(y !== undefined){ ptn.y = getNumber(y) * AREA_HEIGHT; }

  // move関連
  const moveProperties = ["speed", "direction", "delay", "shotSpeed", "shotDirection"]
  moveProperties.forEach((propName) => {
    if(seed[propName] !== undefined){ ptn[propName] = getNumber(seed[propName]); }
  })
  // 色、形関連
  // ここでオブジェクトにしてしまう（色や形はこのタイミングでは登録済み）
  // seed[propName]は文字列（キー）なのでこれを元にオブジェクトを召喚する。
  if(seed.color !== undefined){ ptn.color = entity.drawColor[seed.color]; }
  if(seed.shape !== undefined){ ptn.shape = entity.drawShape[seed.shape]; }

  // fireDef廃止。

  // colliは未指定ならOFFでそうでないならENEMYでOK.
  // たとえばOFFにENEMY放らせたいならあとで指定してね。
  if(seed.collisionFlag === undefined){ ptn.collisionFlag = OFF; }else{ ptn.collisionFlag = ENEMY; }

  // ここでseed.actionのキー配列を取得
  const actionKeys = Object.keys(seed.action);

  // actionの各valueの展開(main, その他, その他, ...)
  if(seed.hasOwnProperty("short")){
    actionKeys.forEach((name) => {
      seed.action[name] = getExpansion(seed.short, seed.action[name], {});
    })
  }

  // まずnway, line, radialがあればなんとかする（増やすかも）
  // actionをキー配列の下から見ていって適宜シード列で置き換える感じ。下からでないと失敗する。
  // それが終わったら、loopとsignal(そのうちjumpやswitchも作りたい・・)に出てくるbackの文字列を
  // どのくらい戻るかの整数で置き換える。というわけでもう-1記法は使わない。
  let preData = {};
  for(let i = actionKeys.length - 1; i >= 0; i--){
    const key = actionKeys[i];
    preData[key] = expandPatternData(preData, seed.action[key]); // nwayやradialをあれする
    preData[key] = setBackNum(preData[key]); // backを定数にする。
  }

  // actionの内容を実行形式にする・・
  // 配列内のactionコマンドに出てくる文字列はすべて後者のものを参照しているので、
  // キー配列で後ろから見ていって・・
  // 得られた翻訳結果は順繰りにdata.actionに放り込んでいくイメージ。
  data.action = {}; // これがないと記法的にアウト
  for(let i = actionKeys.length - 1; i >= 0; i--){
    data.action[actionKeys[i]] = createAction(data, preData[actionKeys[i]]);
  }
  // 配列はもう出てこないのでcreateActionの内容も大幅に書き換えることになる。
  // たとえば2番目のactionの配列を実行形式にするのに3番目以降のactionの実行形式のデータが使えるとかそういう感じ。
  // 最終的にdata.action.mainが求めるactionとなる。
  ptn.action = data.action.main;
  return ptn;
}

function expandPatternData(preData, seedArray){
  // action:"uuu" で preData.uuuを放り込むような場合にpreDataが役に立つイメージ。
  let result = [];
  for(let i = 0; i < seedArray.length; i++){
    const seed = seedArray[i];
    const _type = getTopKey(seed);
    switch(_type){
      case "nway":
        const parsed1 = createNwayArray(seed, preData);
        result.push(...parsed1);
        break;
      case "radial":
        const parsed2 = createRadialArray(seed, preData);
        result.push(...parsed2);
        break;
      case "line":
        const parsed3 = createLineArray(seed, preData);
        result.push(...parsed3);
        break;
      default:
        result.push(seed);
    }
  }
  return result;
}

function createNwayArray(seed, data){
  // count, interval, action:"hoge" ← data.hoge.
  let result = [];
  const {count, interval, action} = seed.nway;
  result.push({shotDirection:["add", -(count - 1) * interval / 2]});
  result.push({catch:("nway" + nwayId)});
  if(action === undefined){
    result.push({fire:""});
  }else if(typeof(action) === "string"){
    result.push(...data[action]);
  }else{
    result.push(...action); // 文字列でない、これはそのまま放り込むケース。action:[{}, {}, ...]とかそういうイメージ。
  }
  result.push({shotDirection:["add", interval]});
  result.push({loop:count, back:("nway" + nwayId)});
  result.push({shotDirection:["add", -(count + 1) * interval / 2]}); // 戻す
  nwayId++;  // id増やしておく。
  return result;
}

function createRadialArray(seed, data){
  // count, action = "hoho" ← data.hoho.
  let result = [];
  const {count, action} = seed.radial;
  result.push({catch:("radial" + radialId)});
  if(action === undefined){
    result.push({fire:""});
  }else if(typeof(action) === "string"){
    result.push(...data[action]);
  }else{
    result.push(...action);
  }
  result.push({shotDirection:["add", 360 / count]}); // 負の数で逆回転
  result.push({loop:count, back:("radial" + radialId)});
  radialId++;
  return result;
}

function createLineArray(seed, data){
  // count, upSpeed, action = "fikk" ← data.fikk.
  let result = [];
  const {count, upSpeed, action} = seed.line;
  result.push({catch:("line" + lineId)});
  if(action === undefined){
    result.push({fire:""});
  }else if(typeof(action) === "string"){
    result.push(...data[action]);
  }else{
    result.push(...action);
  }
  result.push({shotSpeed:["add", upSpeed]});
  result.push({loop:count, back:("line" + lineId)});
  result.push({shotSpeed:["add", upSpeed * (-1) * count]}); // 戻す
  lineId++;
  return result;
}

// 垂直方向にいくつか(distanceの位置を起点として垂直にいくつか)
// function createVerticalArray(){}

// 水平方向にいくつか(distanceの位置を中心に水平でいくつか)
// function createHorizontalArray(){}

function setBackNum(seedArray){
  // dataArrayの中のback持ってるオブジェクトのbackの文字列に対して
  // そこからいくつ遡ったら同じ文字列のcatchにたどり着くか調べてその値をひとつ減らして数とする。
  let result = [];
  for(let i = 0; i < seedArray.length; i++){
    const seed = seedArray[i];
    if(!seed.hasOwnProperty("back")){
      // backがなければそのまま
      result.push(seed);
      continue;
    }
    const key = seed.back;
    if(typeof(key) === "number"){
      // backが計算済みならそのまま
      result.push(seed);
      continue;
    }
    let n = 1;
    while(n < seedArray.length){
      const backSeed = seedArray[i - n];
      if(backSeed.hasOwnProperty("catch") && backSeed.catch === key){ break; } // catchプロパティが合致したらOK.
      n++; // これないと無限ループ。
    }
    // seedのback変えちゃうとまずいんでレプリカを作ります。
    let replica = {};
    Object.assign(replica, seed);
    replica.back = n - 1;
    result.push(replica);
  }
  //console.log(result);
  return result;
}

// 展開関数作り直し。
// ここは再帰を使って下位区分までstringを配列に出来るように工夫する必要がある。
// 名前空間・・seed.shortに入れておいて逐次置き換える感じ。
// seed.shortにはショートカット配列が入ってて、それを元にseed.actionの内容を展開して
// 一本の配列を再帰的に構成する流れ。要はstringが出てくるたびにshortから引っ張り出してassignでクローンして
// 放り込んでいくだけ。
// action内のmainやらなんやらすべてに対して適用。

// shortもプロパティにしますね。
// {short:"文字列", option....} たとえば{short:"eee", fire1:"gratony"}とかすると、
// プロパティで"$fire1"とかあったときに, str="$fire1"からstr[0]==='$'でチェック、さらにstr.substr(1)で
// "fire1"になる。これを使って置き換えを行う仕組みですよ。多分ね。
// 新しい引数としてdictを設ける（shortのときだけ{}でなくなる感じ）

// dictを重ねたい？わがままがすぎるな・・
function getExpansion(shortcut, action, dict){
  let actionArray = [];
  for(let i = 0; i < action.length; i++){
    const command = action[i];
    const _type = getTopKey(command);
    if(_type === "short"){
      const commandArray = getExpansion(shortcut, shortcut[command.short], command);
      commandArray.forEach((obj) => {
        // objはオブジェクトなので普通にアサイン
        let copyObj = {};
        Object.assign(copyObj, obj);
        actionArray.push(copyObj);
      })
    }else{
      // shortでない場合は普通に。ここでオブジェクトになんか書いてあるときはそこら辺の処理も行う。
      // dictが{}でないのはcommandがshortを持っててさらにそれ以外を持ってる時。これを使って、
      // 文字列で"$fire1"みたいになってるやつをいじる、つもり・・
      let result = interpretNestedData(command, dict);
      actionArray.push(result);
    }
  }
  return actionArray;
}

// 応用すれば、一定ターン移動するとかそういうのもbackupで表現できそう（waitの派生形）

// やり直し
function createAction(data, targetAction){
  // targetActionの翻訳に出てくるactionのところの文字列はactionのプロパティネームで、
  // そこについては翻訳が終わっているのでそれをそのまま使えるイメージ。dataにはfireとbehaviorの
  // 翻訳関数が入っている。
  let actionArray = [];
  for(let index = 0; index < targetAction.length; index++){
    const command = targetAction[index];
    actionArray.push(interpretCommand(data, command, index));
  }
  return actionArray;
}

// 翻訳。
// 1.セット系
// speed, shotSpeed, direction, shotDirectionについては"set"と"add"... {speed:["set", [3, 7]]}
// {fire:"radial16way7"}とかね。
// 今interpretに書いてある内容を、クラスを渡す形式に書き換える。そんで、今executeって書いてあるところはなくして、
// クラス内のexecuteを実行させるように書き換える（とりあえず過渡として一旦executeは残してそれから無くす流れ。）

// ---------------------------------------------------------------------------------------- //

// これがreturnするのがクラスになればいいのね。
// ここでreturnされるのがクラスになって、executeのところについては、
// コマンドのメソッドのexecuteに設定されてるやつがそのまま実行されるようになればいいのよね。
function interpretCommand(data, command, index){
  let result = {};
  // だからgetTopKeyをもっと活用する必要があるかもね。
  const _type = getTopKey(command); // 最初のキーがそのままtypeになる。
  result.type = _type;
  if(["speed", "direction", "shotSpeed", "shotDirection", "shotDelay", "shotDistance", "shotAim"].includes(_type)){
    result.mode = command[_type][0]; // "set" or "add" or "mirror" or etc...
    result[_type + "Change"] = command[_type][1]; // 3とか[2, 9]とか[1, 10, 1]
    // 長さが3の場合はcountを設定する。この場合、waitの変種となる。
    if(command[_type].length > 2){ result.count = command[_type][2]; }
    // set:count数でその値になる. add:count数でその値だけ足す。
    return result;
  }

  // 色、形、衝突フラグ関連
  if(["shotColor", "shotShape", "collisionFlag", "shotCollisionFlag"].includes(_type)){
    result.style = command[_type]; // 文字列
    return result;
  }

  // 例：{move:"go"} {move:"stay"} {shotMove:"circular", bearing:3}
  if(["move", "shotMove"].includes(_type)){
    switch(command[_type]){
      case "go": result.move = GO_MOVE; break;
      case "stay": result.move = STAY_MOVE; break;
      case "circular":
        result.move = new CircularMove(command); // 余計なもの入ってるけど気にしなくてOK!
        break;
    }
    return result;
  }

  if(_type === "fire"){
    // fireするだけ
    return result;
  }
  // shotAction. 発射する弾丸の挙動を指定する。
  if(_type === "shotAction"){
    result.shotAction = data.action[command.shotAction];
    return result;
  }
  // あとはwait, loop, aim, vanish, triggerなど。triggerは未準備なのでまた今度でいい。手前の3つやってね。
  // backとかjumpとかswitchも面白そう。
  // そのあとexecute作ったらデバッグに移る。
  if(_type === "wait"){
    // {wait:3}のような形。
    result.count = command.wait;
    return result;
  }
  if(_type === "loop"){
    // {loop:10, back:5}のような形。
    result.count = command.loop;
    // たとえば-1なら先頭、のように負の場合はindex+1を加える感じ。
    result.back = (command.back >= 0 ? command.back : command.back + index + 1);
    return result;
  }
  if(_type === "aim"){ result.margin = command.aim; return result; } // 狙う際のマージン
  if(_type === "vanish"){ result.flag = command.vanish; return result; } // true.
  if(_type === "hide"){
    // 隠れる. trueのとき見えなくする。falseで逆。
    //console.log(command.hide);
    result.flag = command.hide; return result;
  }
  if(_type === "bind"){
    // bindをtruefalseにする
    result.flag = command.bind; return result;
  }
  if(_type === "set"){
    // 位置をいじる。{set:{x:100, y:40}}なら強制的に(100, 40)に移動する。
    // 配列を使うとランダムも可能
    result.x = command.set.x; result.y = command.set.y;
    return result;
  }
  if(_type === "deco"){
    // shotプロパティをいじる。{deco:{speed:8, direction:90, color:"grey", shape:"wedgeMiddle"}}とかする。
    // プログラムのために"num"を追加
    const propNames = ["speed", "direction", "color", "shape"];
    propNames.forEach((name) => {
      if(command.deco.hasOwnProperty(name)){
        result[name] = command.deco[name];
      }
    })
    return result;
  }
  if(_type === "signal"){
    // signalプロパティにはmodeが入っててそれにより指示が決まる。
    // 基本的に、modeには「それが為されたら次ね」といった内容が入る（消滅したらとか近付いたらとか）
    // "vanish": parentがvanishしてなければ離脱、vanishしたらカウントを進めて抜けない。
    // "approach": 自機のサイズx2まで近づいたら次へ、とか？
    // "reflect": 壁に接触したら方向変えるやつ。たとえば3回反射で消える、とかはこれで実装できるはず。
    //
    result.mode = command.signal;
    // 付加データがある場合はそれも・・
    if(result.mode === "vanish"){
      // たとえばvanishによって解除時に親の位置に移動するかどうかを定める。デフォはfalse.
      result.follow = (command.hasOwnProperty("follow") ? command.follow : false);
    }
    return result;
    // 自機に近付いたら次へ、みたいな場合は数を指定するかも？
  }
  if(_type === "catch"){
    return result; // {type:"catch"}だけ。
  }
}

// fireのところに変数使ってて、それを翻訳する関数。
// ネストを掘り下げないといけないので若干めんどくさくなってる。
// たぶん、behaviorにも使えるけどそのためにはaddBehaviorとかしてaddやらなんやらをやめないといけないね。

// dataが配列か、stringか、numberか、オブジェクトか。
// ごめんなさい、boolean考慮してませんでした・・Oh no. 直したよ。これでうまくいく。
// なるほど、オブジェクト扱いになってたのか・・どうりで・・・
function interpretNestedData(data, dict){
  if(typeof(data) !== "string" && data.hasOwnProperty("length")){ // 配列かどうかを見ている
    let result = [];
    data.forEach((elem) => {
      result.push(interpretNestedData(elem, dict));
    })
    return result;
  }
  const dataType = typeof(data);
  switch(dataType){
    case "string": // 文字列のケース
      if(data[0] === '$'){
        return dict[data.substr(1)];
      }else{
        return data;
      }
    case "number": // 数字のケース
      return data;
    case "boolean": // 真偽値のケース（考慮するの忘れてたごめんなさい！！）
      return data;
    default: // オブジェクトのケース
      let result = {};
      const keyArray = Object.keys(data);
      keyArray.forEach((key) => {
        result[key] = interpretNestedData(data[key], dict);
      })
      return result;
  }
}

// ---------------------------------------------------------------------------------------- //
// execute.

function execute(unit, command){
  const _type = command.type;
  if(["speed", "direction", "shotSpeed", "shotDirection", "shotDelay", "shotDistance", "shotAim"].includes(_type)){
    // speedとかshotDirectionとかいじる
    // 第2引数（3番目)がある場合。
    // まずループを抜けるかどうかはプロパティの有無で純粋に決まる。プロパティが無ければ抜けないで進む(true)。
    // 次にインデックスを増やすかどうかはプロパティが無ければ増やし、
    // ある場合はアレがtrueを返せば増やす。
    const newParameter = getNumber(command[_type + "Change"]);
    const hasCount = command.hasOwnProperty("count"); // countを持っているかどうか
    // ループを抜けるかどうか. countがある場合はwaitのように毎フレーム抜ける。
    const loopAdvanceFlag = (hasCount ? false : true);
    if(command.mode === "set"){
      if(hasCount){
        const cc = unit.counter.getLoopCount();
        // cc(currentLoopCount)から目標値との割合を計算する感じ.
        unit[_type] = map(cc + 1, cc, command.count, unit[_type], newParameter);
      }else{
        unit[_type] = newParameter; // ターンを消費しないで普通にセットする
      }
    }else if(command.mode === "add"){
      if(hasCount){
        unit[_type] += newParameter / command.count; // 単に割り算の結果を足すだけ。
      }else{
        unit[_type] += newParameter; // ターンを消費しないで普通に足す
      }
    }else if(command.mode === "aim"){
      // direction限定。意味は、わかるよね。
      unit.direction = getPlayerDirection(unit.position, newParameter);
      unit.velocityUpdate();
    }else if(command.mode === "rel"){
      // shotSpeedとshotDirectionで、unit自身のspeed, directionを使いたいときに使う。普通にaddする。
      // たとえば["rel", 40]で自分のdirection+40がshotDirectionに設定される。
      if(_type === "shotSpeed"){ unit[_type] = unit.speed + newParameter; }
      if(_type === "shotDirection"){ unit[_type] = unit.direction + newParameter; }
      if(_type === "shotAim"){ unit[_type] = unit.shotDirection + newParameter; }
    }else if(command.mode === "fromParent"){
      // shotDirection限定。親から自分に向かう方向に対していくつか足してそれを自分のshotDirectionとする。
      // つまり0なら親から自分に向かう方向ってことね。180だと逆。
      const {x:px, y:py} = unit.parent.position;
      if(_type === "shotDirection"){
        unit[_type] = atan2(unit.position.y - py, unit.position.x - px) + newParameter;
      }
    }
    if(["speed", "direction"].includes(_type)){ unit.velocityUpdate(); }
    // インデックスを増やすかどうか（countがあるならカウント進める）
    // countがある場合は処理が終了している時に限り進める感じ。
    const indexAdvanceFlag = (hasCount ? unit.counter.loopCheck(command.count) : true);
    if(indexAdvanceFlag){ unit.actionIndex++; }
    return loopAdvanceFlag; // フラグによる
  }
  // 色、形.
  // styleには文字列が入ってるのでentity経由でオブジェクトを召喚する。
  if(["shotColor", "shotShape"].includes(_type)){
    if(_type === "shotColor"){ unit.shotColor = entity.drawColor[command.style]; }
    else if(_type === "shotShape"){ unit.shotShape = entity.drawShape[command.style]; }
    unit.actionIndex++;
    return true; // ループは抜けない
  }
  // 衝突フラグ、ショットの衝突フラグ
  if(["collisionFlag", "shotCollisionFlag"].includes(_type)){
    unit[_type] = command.style;
    unit.actionIndex++;
    return true; // ループは抜けない
  }

  // たとえば{type:"move", move:GO_MOVE}みたいになってるわけ。
  if(["move", "shotMove"].includes(_type)){
    unit[_type] = command.move; // もう出来てる
    unit.actionIndex++;
    return true;
  }

  if(_type === "fire"){
    // fire忘れてた
    if(unit.isPlayer && !keyIsDown(32)){
      return false; // プレイヤーの場合はスペースキーが押されなければ離脱する。
    }
    executeFire(unit);
    unit.actionIndex++;
    return true; // 発射したら次へ！
  }
  // shotにactionをセットする場合
  // clearを廃止したい
  if(_type === "shotAction"){
    unit.shotAction = command.shotAction;
    unit.actionIndex++;
    return true;
  }
  if(_type === "wait"){
    // loopCounterを1増やす。countと一致した場合だけloopCounterとcurrentのインデックスを同時に増やす。
    // loopCheckは該当するカウントを1増やしてlimitに達したらtrueを返すもの。
    if(unit.counter.loopCheck(command.count)){
      unit.actionIndex++;
    }
    return false; // waitは常にループを抜ける
  }
  if(_type === "loop"){
    if(unit.counter.loopCheck(command.count)){
      unit.actionIndex++;
    }else{
      // バック処理(INFの場合常にこっち)
      unit.counter.loopBack(unit, command.back);
    }
    return true; // ループは抜けない
  }
  if(_type === "aim"){
    // marginの揺れ幅でエイムする。
    unit.shotDirection = getPlayerDirection(unit.position, command.margin);
    unit.velocityUpdate();
    unit.actionIndex++;
    return true; // ループは抜けない
  }
  if(_type === "vanish"){
    // flagを当てはめるだけ。
    unit.vanish = command.flag;
    return false; // ループを抜ける
  }
  if(_type === "hide"){
    // 関数で分けて書きたいね・・
    unit.hide = command.flag;
    unit.actionIndex++;
    return true; // ループは抜けない
  }
  if(_type === "bind"){
    unit.bind = command.flag;
    unit.actionIndex++;
    return true; // ループは抜けない
  }
  if(_type === "set"){
    unit.setPosition(getNumber(command.x), getNumber(command.y));
    unit.actionIndex++;
    return true; // ループは抜けない
  }
  if(_type === "deco"){
    // ショットいろいろ（shotNumを設定できるように改良してる）
    if(command.hasOwnProperty("speed")){ unit.shotSpeed = command.speed; }
    if(command.hasOwnProperty("direction")){ unit.shotDirection = command.direction; }
    if(command.hasOwnProperty("color")){ unit.shotColor = entity.drawColor[command.color]; }
    if(command.hasOwnProperty("shape")){ unit.shotShape = entity.drawShape[command.shape]; }
    unit.actionIndex++;
    return true;
  }
  if(_type === "signal"){
    if(command.mode === "vanish"){
      // parentのvanishを参照してfalseならそのまま抜けるがtrueなら次へ進む
      if(unit.parent.vanish){
        unit.actionIndex++;
        // follow===trueなら親の位置に移動する
        if(command.follow){ unit.setPosition(unit.parent.position.x, unit.parent.position.y); }
        return true; // ループは抜けない。すすめ。
      }else{
        return false; // なにもしない
      }
    }else if(command.mode === "approach"){
      // 自機のsize*5に近付いたら挙動を進める
      // 5とか10とかはオプションでなんとかならないかな。close, farみたいに。ひとつくらい、いいでしょ。
      const {x, y} = entity.player.position;
      const size = entity.player.size;
      if(dist(x, y, unit.position.x, unit.position.y) < size * 5){
        unit.actionIndex++;
        return true; // ループは抜けない。すすめ。
      }else{
        return false; // なにもしない
      }
    }else if(command.mode === "reflect"){
      // 壁で反射する
      const {x, y} = unit.position;
      if(x < 0 || x > AREA_WIDTH || y < 0 || y > AREA_HEIGHT){
        reflection(x, y, unit);
        unit.actionIndex++; // やべぇactionIndex増やすの忘れてたわわわ・・・
        return true; // すすめ
      }else{
        return false;
      }
    }else if(command.mode === "ground"){
      // ground:下端に達したら。roof:上端。right:右端、left:左端。
      if(unit.position.y > AREA_HEIGHT){ unit.actionIndex++; return true; }else{ return false; }
    }else if(command.mode === "frameOut"){
      // frameOut:画面外に出たら。
      const {x, y} = unit.position;
      if(y < 0 || y > AREA_HEIGHT || x < 0 || x > AREA_WIDTH){
        unit.actionIndex++; return true;
      }else{
        return false;
      }
    }
  }
  if(_type === "catch"){ unit.actionIndex++; return true; } // いわゆるスルー
}

// 反射
function reflection(x, y, unit){
  if(x < 0 || x > AREA_WIDTH){
    unit.direction = 180 - unit.direction;
    if(x < 0){ unit.setPosition(-x, y); }else{ unit.setPosition(AREA_WIDTH * 2 - x, y); }
  }else if(y < 0 || y > AREA_HEIGHT){
    unit.direction = 360 - unit.direction;
    if(y < 0){ unit.setPosition(x, -y); }else{ unit.setPosition(x, AREA_HEIGHT * 2 - y); }
  }
  unit.velocityUpdate();
}
