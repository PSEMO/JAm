import * as LJS from './node_modules/littlejsengine/dist/littlejs.esm.js';
const {vec2, rgb} = LJS;

//#region Constants

// Screen
const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = 720;

// Camera
const CAMERA_SMOOTHNESS = 0.05;
const CAMERA_BASE_SCALE = 55;
const CAMERA_MAX_SCALE = 8;
const CAMERA_ZOOM_SPEED_FACTOR = 0.5;
const CAMERA_ZOOM_SMOOTHNESS = 0.05;

// Player
const WALK_SPEED = 0.1;
const JUMP_VELOCITY = 0.225;
const JUMP_BOOST_VELOCITY = 0.1125;
const DASH_SPEED = 0.7;
const DASH_DURATION = 0.2;
const DASH_COOLDOWN = 1.5;
const SLAM_VELOCITY = -0.7;
const SLAM_SHOCKWAVE_RADIUS = 5;
const SLAM_SHOCKWAVE_FORCE = 0.2;
const PLAYER_GROWTH_MULTIPLIER = 2;
const PLAYER_POS_ADj_ON_GROW = 0.25;
const PLAYER_ANIM_FRAME_RATE = 10;
const PLAYER_SPRITE_TILE_SIZE = 25;

// UI
const DASH_BAR_WIDTH = 150;
const DASH_BAR_HEIGHT = 15;
const DASH_BAR_Y_OFFSET = 35;
const DASH_BAR_BG_COLOR = 'rgba(50, 50, 50, 0.8)';
const DASH_BAR_FILL_COLOR = 'rgba(0, 150, 255, 0.9)';
const DASH_BAR_STROKE_COLOR = 'rgba(255, 255, 255, 0.9)';
const DASH_BAR_LINE_WIDTH = 2;
const UNLOCK_MESSAGE_DURATION = 4;
const YOU_WON_MESSAGE_DURATION = 999;
const CHECKPOINT_MESSAGE_DURATION = 2;

// Other
const GAME_END_POS_X = 840;
const BACKGROUND_WIDTH = 45;
const BACKGROUND_OFFSET_Y = -2;
const GRAVITY_Y = -0.01;
const HALF_BLOCK_RESPAWN_TIME = 2.0;
const HALF_BLOCK_BREAK_DELAY = 0.7;
const JUMPER_BOUNCE_FACTOR = -0.85;
const JUMPER_MIN_BOUNCE_VELOCITY_SQ = 0.01;
const JUMPER_POSITION_ADJUST_ON_BOUNCE = 1;
const DEATH_Y_LIMIT = -23;

//#endregion
//-
//--
//--
//-
//#region Global Vars

var screenSize = vec2(SCREEN_WIDTH, SCREEN_HEIGHT);

var player;
let playerIdle, playerRun, playerJump, playerSlam, playerDash;

//TODO CHANGE BEFORE RELEASE
var ableToDash = false;
var ableToSmash = false;
var ableToClimb = false;
var ableToHold = false;
var maxJumps = 1;

var touchingClimbable = false;

var bg1, bg2;

let unlockMessageTimer;
var messageToDisplayAtUnlock;

var checkpoints = [];
var lastCheckpoint;
var lastCheckpointIndex = 0;

var resettableObjectTemplates = [];

//#endregion
//-
//--
//--
//-
//#region Functions

function keyJustDirection(
    up='ArrowUp',
    down='ArrowDown',
    left='ArrowLeft',
    right='ArrowRight')
{
    const k = (key)=> LJS.keyWasPressed(key) ? 1 : 0;
    return vec2(k(right) - k(left), k(up) - k(down));
}

function walk(input, player)
{
    if(player.isDashing == false && player.isHolding == false)
    {
        const currentWalkSpeed = WALK_SPEED * player.size.x;
        if(input.x > 0)
        {
            player.velocity = vec2(currentWalkSpeed, player.velocity.y);
        }
        else if(input.x < 0)
        {
            player.velocity = vec2(-currentWalkSpeed, player.velocity.y);
        }
        else
        {
            player.velocity = vec2(0, player.velocity.y);
        }
    }
}

function jump(input, player)
{
    if(player.isDashing == false && player.isHolding == false)
    {
        //disables falling and jumping the normal ammount
        if(!player.groundObject &&
            player.jumpCount == maxJumps &&
            !touchingClimbable)
        {
            player.jumpCount -= 1;
        }

        if (input.y > 0 && player.jumpCount > 0)
        {
            const sizeMult = player.size.x < 1? 0.5: 1;
            const currentJumpVelocity = JUMP_VELOCITY * sizeMult;
            const currentJumpBoost = JUMP_BOOST_VELOCITY * sizeMult;
            if (player.velocity.y < currentJumpVelocity)
            {
                player.velocity.y = currentJumpVelocity;
            }
            else
            {
                player.velocity.y += currentJumpBoost;
            }
            player.jumpCount -= 1
        }
    }
}

function dash(dashPressed, player)
{
    if(dashPressed &&
        !player.isDashing &&
        !player.dashCooldownTimer.active() &&
        ableToDash &&
        player.isHolding == false)
    {
        player.isDashing = true;
        
        player.dashtimer.set(DASH_DURATION);
        player.dashCooldownTimer.set(DASH_COOLDOWN);
        
        let inputDirection = LJS.keyDirection();
        let dashDirection = vec2(inputDirection.x, 0);
        if (dashDirection.lengthSquared() === 0)
        {
            dashDirection = vec2(player.mirror ? -1 : 1, 0);
        }
        const currentDashSpeed = DASH_SPEED * player.size.x;
        player.velocity = dashDirection.normalize(currentDashSpeed);

        player.gravityScale = 0;
    }

    if(player.isDashing)
    {
        if(player.dashtimer.elapsed())
        {
            player.isDashing = false;
            player.gravityScale = 1;
            player.velocity = vec2(0, 0);
        }
    }
}

function groundSlam(slamPressed, player)
{
    if(slamPressed && player.canSlam && !player.groundObject && ableToSmash)
    {
        player.isSlamming = true;
        player.canSlam = false;
        player.velocity.y = SLAM_VELOCITY * player.size.x;
    }
}

function changePlayerSize(toBigger, obj)
{
    if(toBigger)
    {
        player.size.x *= PLAYER_GROWTH_MULTIPLIER;
        player.size.y *= PLAYER_GROWTH_MULTIPLIER;
        
        player.pos.y += (PLAYER_POS_ADj_ON_GROW +
        (PLAYER_POS_ADj_ON_GROW / 10));
        
        player.mass = player.size.x + player.size.y
        obj.destroy()
    }
    else
    {
        player.size.x /= PLAYER_GROWTH_MULTIPLIER;
        player.size.y /= PLAYER_GROWTH_MULTIPLIER;
        
        player.pos.y -= (PLAYER_POS_ADj_ON_GROW -
        (PLAYER_POS_ADj_ON_GROW / 10));
        
        player.mass = player.size.x + player.size.y
        obj.destroy()
    }
}

function camControl()
{
    let targetPos = player.pos;

    LJS.setCameraPos(LJS.cameraPos.lerp(targetPos, CAMERA_SMOOTHNESS));
    const playerSpeed = player.velocity.length();
    const targetScale = LJS.lerp(
        CAMERA_BASE_SCALE,
        CAMERA_MAX_SCALE,
        LJS.clamp(playerSpeed * CAMERA_ZOOM_SPEED_FACTOR)
    );
    LJS.setCameraScale(LJS.lerp(LJS.cameraScale, targetScale, CAMERA_ZOOM_SMOOTHNESS));
}

function setTiles()
{
    playerRun = [
        LJS.tile(0, PLAYER_SPRITE_TILE_SIZE, 0),
        LJS.tile(1, PLAYER_SPRITE_TILE_SIZE, 0),
        LJS.tile(2, PLAYER_SPRITE_TILE_SIZE, 0),
        LJS.tile(3, PLAYER_SPRITE_TILE_SIZE, 0)
    ];
    playerIdle = LJS.tile(12, PLAYER_SPRITE_TILE_SIZE, 0);
    playerSlam = LJS.tile(4, PLAYER_SPRITE_TILE_SIZE, 0);
    playerJump = LJS.tile(8, PLAYER_SPRITE_TILE_SIZE, 0);
    playerDash = LJS.tile(16, PLAYER_SPRITE_TILE_SIZE, 0);
}

function setBackground()
{
    bg1 = new Background(vec2(0, BACKGROUND_OFFSET_Y));
    bg2 = new Background(vec2(BACKGROUND_WIDTH, BACKGROUND_OFFSET_Y));
    bg1.mass = 0;
    bg2.mass = 0;
}

function moveBackground()
{
    // Teleport backgrounds when player moves far enough
    if (player.pos.x > bg1.pos.x + BACKGROUND_WIDTH) {
        bg1.pos.x += 2 * BACKGROUND_WIDTH;
    } else if (player.pos.x < bg1.pos.x - BACKGROUND_WIDTH) {
        bg1.pos.x -= 2 * BACKGROUND_WIDTH;
    }

    if (player.pos.x > bg2.pos.x + BACKGROUND_WIDTH) {
        bg2.pos.x += 2 * BACKGROUND_WIDTH;
    } else if (player.pos.x < bg2.pos.x - BACKGROUND_WIDTH) {
        bg2.pos.x -= 2 * BACKGROUND_WIDTH;
    }
}

function createMessage(text, duration)
{
    unlockMessageTimer = new LJS.Timer();
    messageToDisplayAtUnlock = text;
    unlockMessageTimer.set(duration);
}

function displayMessage()
{
    if (unlockMessageTimer.active()) {
    LJS.drawTextScreen(
        messageToDisplayAtUnlock,
        vec2(screenSize.x / 2, screenSize.y / 2),
        40,
        rgb(1, 1, 0.5),
        3,
        rgb(0, 0, 0)
    );
}
}

function drawDashBar()
{
    if (player.dashCooldownTimer.active())
    {
        const barX = (screenSize.x - DASH_BAR_WIDTH) / 2;
        const barY = DASH_BAR_Y_OFFSET;

        const percentRemaining = 1 - player.dashCooldownTimer.getPercent();
        const fillWidth = DASH_BAR_WIDTH * percentRemaining;

        LJS.overlayContext.fillStyle = DASH_BAR_BG_COLOR;
        LJS.overlayContext.fillRect(barX, barY, DASH_BAR_WIDTH, DASH_BAR_HEIGHT);

        LJS.overlayContext.fillStyle = DASH_BAR_FILL_COLOR; 
        LJS.overlayContext.fillRect(barX, barY, fillWidth, DASH_BAR_HEIGHT);

        LJS.overlayContext.strokeStyle = DASH_BAR_STROKE_COLOR;
        LJS.overlayContext.lineWidth = DASH_BAR_LINE_WIDTH;
        LJS.overlayContext.strokeRect(barX, barY, DASH_BAR_WIDTH, DASH_BAR_HEIGHT);
    }
}

function deathTracker()
{
    if(player.pos.y < DEATH_Y_LIMIT)
    {
        die();
    }
}

function die()
{
    player.pos = lastCheckpoint.copy();
    LJS.setCameraPos(lastCheckpoint.copy());
    player.velocity = vec2(0, 0);

    for (let i = LJS.engineObjects.length - 1; i >= 0; i--) {
        const obj = LJS.engineObjects[i];
        if (obj.isResettable) {
            obj.destroy();
        }
    }

    resettableObjectTemplates.forEach(template => {
        new template.constructor(template.pos, template.size);
    });
}

function checkGameEnd()
{
    return player.pos.x > GAME_END_POS_X;
}

function triggerGameEnd()
{
    createMessage("You Won!", YOU_WON_MESSAGE_DURATION);
    displayMessage();
}

function checkCheckpoints() {
    for (let i = lastCheckpointIndex + 1; i < checkpoints.length; i++) {
        const checkpoint = checkpoints[i];
        if (player.pos.x > checkpoint.x) {
            lastCheckpoint = checkpoint;
            lastCheckpointIndex = i;
            if(i !== 0)
            {
                createMessage("Checkpoint Acquired",
                    CHECKPOINT_MESSAGE_DURATION);
            }
            break;
        }
    }
}

function createLevel()
{
    setBackground();

    createBlocks();
    setCheckPoints();
    setResettableObjectTemplates();

    //TODO CHANGE BEFORE RELEASE
    player = new Player(vec2(0, 1.5), vec2(1, 1));
    //player = new Player(vec2(785, 2), vec2(1, 1));
    //ableToDash = true;
    //ableToSmash = true;
    //ableToClimb = true;
    //ableToHold = true;
    //maxJumps = 99;
}

function setCheckPoints()
{
    checkpoints = [
        vec2(0, 1.5), 
        vec2(85, 5.5),
        vec2(230, 1.5),
        vec2(330, 1.5),
        vec2(470, 12.5),
        vec2(560, 12.5),
        vec2(680, 1.5),
        vec2(780, 1.5)
    ];
    lastCheckpoint = checkpoints[0].copy();
    lastCheckpointIndex = 0;
}

function setResettableObjectTemplates()
{
    resettableObjectTemplates = [];
    LJS.engineObjects.forEach(obj => {
        if (obj.isResettable) {
            resettableObjectTemplates.push({
                constructor: obj.constructor,
                pos: obj.initialPos.copy(),
                size: obj.initialSize.copy()
            });
        }
    });
}

function createBlocks()
{
    //new Ground(vec2(0, 0), vec2(0, 0));
    //new HalfBlock(vec2(0, 0), vec2(0, 0));
    //new BreakableBlock(vec2(0, 0), vec2(0, 0));
    //new Climbable(vec2(0, 0), vec2(0, 0));
    //new Box(vec2(0, 0), vec2(0, 0));
    //new SBox(vec2(0, 0), vec2(0, 0));
    //new Jumper(vec2(0, 0), vec2(0, 0));
    //new DashGiver(vec2(0, 0));
    //new ClimbGiver(vec2(0, 0));
    //new SmashGiver(vec2(0, 0));
    //new DoubleJumpGiver(vec2(0, 0));

    // Start
    new Ground(vec2(0, 0), vec2(19, 1));
    
    // Staircase
    new Ground(vec2(6, 1), vec2(1, 1));
    new Ground(vec2(7, 2), vec2(1, 1));
    new Ground(vec2(8, 3), vec2(1, 1));
    new Ground(vec2(9, 4), vec2(1, 1));
    new Ground(vec2(7, 1), vec2(1, 1));
    new Ground(vec2(8, 1), vec2(1, 1));
    new Ground(vec2(8, 2), vec2(1, 1));
    new Ground(vec2(9, 1), vec2(1, 1));
    new Ground(vec2(9, 2), vec2(1, 1));
    new Ground(vec2(9, 3), vec2(1, 1));

    // 3 wide blocks with space between them
    new HalfBlock(vec2(13, 4), vec2(3, 1));
    new HalfBlock(vec2(18, 4), vec2(3, 1));
    new HalfBlock(vec2(23, 4), vec2(3, 1));

    // Wide platforms going upwards and downwards
    new Ground(vec2(28, 5), vec2(3, 1));
    new Ground(vec2(33, 6), vec2(3, 1));
    new Ground(vec2(38, 7), vec2(3, 1));
    new Ground(vec2(43, 6), vec2(3, 1));
    new Ground(vec2(48, 5), vec2(3, 1));
    new Ground(vec2(53, 4), vec2(3, 1));

    // A long platform at the end
    new Ground(vec2(73, 4), vec2(31, 1));
    new SBox(vec2(66, 5), vec2(1, 1));
    new Ground(vec2(75, 13), vec2(15, 15));
    new Box(vec2(85, 6), vec2(1, 1));

    // 3 wide blocks with space between them
    new HalfBlock(vec2(94, 4), vec2(3, 1));
    new HalfBlock(vec2(100.5, 4), vec2(3, 1));
    new HalfBlock(vec2(107, 4), vec2(3, 1));

    // A long platform at the end
    new Ground(vec2(124, 4), vec2(24, 1));

    // Wide platforms going upwards and downwards
    new Ground(vec2(140, 5), vec2(3, 1));
    new Ground(vec2(145, 6), vec2(3, 1));
    new Ground(vec2(150, 7), vec2(3, 1));
    new Ground(vec2(155, 6), vec2(3, 1));
    new Ground(vec2(160, 5), vec2(3, 1));
    new Ground(vec2(165, 4), vec2(3, 1));
    new Ground(vec2(170, 3), vec2(3, 1));
    new Ground(vec2(175, 2), vec2(3, 1));
    new Ground(vec2(180, 1), vec2(3, 1));
    new Ground(vec2(185, 0), vec2(3, 1));

    // 3 wide blocks with space between them
    new Ground(vec2(192, 0), vec2(3, 1));
    new Ground(vec2(199, 0), vec2(3, 1));
    new Ground(vec2(206, 0), vec2(3, 1));

    // A long platform at the end
    new Ground(vec2(227, 0), vec2(31, 1));
    new DashGiver(vec2(240, 2), vec2(1, 1));

    // Wide platforms far away
    new Ground(vec2(255, 0), vec2(3, 1));
    new HalfBlock(vec2(260, 0), vec2(3, 1));
    new Ground(vec2(265, 0), vec2(3, 1));

    // Upward platforms far away
    new Ground(vec2(275, 1), vec2(3, 1));
    new HalfBlock(vec2(280, 2), vec2(3, 1));
    new Ground(vec2(285, 3), vec2(3, 1));

    // Wide platforms far away that are apart from each other
    new Ground(vec2(295, 3), vec2(3, 1));
    new Ground(vec2(305, 3), vec2(3, 1));
    new Ground(vec2(315, 0), vec2(3, 1));

    // A long platform at the end
    new Ground(vec2(345, 0), vec2(40, 1));
    new BreakableBlock(vec2(345, 10), vec2(1, 19));
    new SmashGiver(vec2(350, 2), vec2(1, 1));

    //platforms to go down
    new BreakableBlock(vec2(380, -5), vec2(20, 1));
    new Ground(vec2(385, -8), vec2(3, 1));
    new Ground(vec2(380, -10), vec2(3, 1));
    new Ground(vec2(375, -12), vec2(3, 1));
    new BreakableBlock(vec2(380, -14), vec2(30, 1));
    new Ground(vec2(385, -19), vec2(10, 1));
    new ClimbGiver(vec2(385, -17), vec2(1, 1));

    // climbable place, cube and shrinking etc.
    new Climbable(vec2(390.5, -10.75), vec2(1, 23.5));
    new Ground(vec2(402.75, -10.75), vec2(23.5, 23.5));
    new Ground(vec2(430, -10), vec2(15, 15));
    new Ground(vec2(460, 0), vec2(25, 23.5));
    new SBox(vec2(453, 12.5), vec2(1, 1));
    new Box(vec2(469, 12.5), vec2(1, 1));
    new Ground(vec2(460, 17.5), vec2(10, 10));
    new Climbable(vec2(447, 0), vec2(1, 23.5));

    //platforms after
    new Ground(vec2(484, 6), vec2(3, 1));
    new Ground(vec2(497, 4), vec2(3, 1));
    new Ground(vec2(510, 2), vec2(3, 1));
    new Ground(vec2(523, 0), vec2(3, 1));
    new Ground(vec2(536, 2), vec2(3, 1));
    new HalfBlock(vec2(549, 0), vec2(3, 1));

    //climbable box after
    new Climbable(vec2(557.75, 5), vec2(1, 13.5));
    new Ground(vec2(570, 5), vec2(23.5, 13.5));
    new DoubleJumpGiver(vec2(580, 13.5));

    //platforms that follow
    new BreakableBlock(vec2(590, 5.5), vec2(10, 1));
    new Ground(vec2(600, 0), vec2(30, 1));
    new Ground(vec2(620, 4), vec2(3, 1));
    new Ground(vec2(627, 0), vec2(3, 1));
    new HalfBlock(vec2(640, 4), vec2(3, 1));
    new HalfBlock(vec2(645, 2), vec2(3, 1));
    new Ground(vec2(650, 0), vec2(3, 1));

    //shrink or climb block
    new Ground(vec2(672, 0), vec2(24, 1));
    new Climbable(vec2(667.5, 5.5), vec2(1, 8));
    new Ground(vec2(672, 5.5), vec2(8, 8));
    new SBox(vec2(665, 2), vec2(1, 1));
    new Box(vec2(678, 2), vec2(1, 1));
    new BreakableBlock(vec2(671, 14.5), vec2(1, 10));

    //jumpers afterwards
    new Jumper(vec2(690, 4), vec2(3, 1));
    new Jumper(vec2(690, 11), vec2(3, 1));
    new Jumper(vec2(703, 7), vec2(3, 1));
    new Ground(vec2(715, 16), vec2(20, 1));
    new Jumper(vec2(730, 13), vec2(3, 1));
    new Jumper(vec2(735, 10), vec2(3, 1));
    new Jumper(vec2(740, 7), vec2(3, 1));
    new Jumper(vec2(745, 4), vec2(3, 1));

    //platform later on
    new Ground(vec2(770, 0), vec2(43, 1));
    new BreakableBlock(vec2(770, 10.5), vec2(1, 20));

    new HoldGiver(vec2(790, 2), vec2(1, 1));
    new Holdable(vec2(795, 3), vec2(1, 1));
    new Holdable(vec2(800, 3), vec2(1, 1));
    new Holdable(vec2(805, 3), vec2(1, 1));
    new Holdable(vec2(810, 3), vec2(1, 1));
    new Holdable(vec2(815, 3), vec2(1, 1));
    new Holdable(vec2(820, 3), vec2(1, 1));
    new Holdable(vec2(825, 3), vec2(1, 1));
    new Ground(vec2(835, 0), vec2(15, 1));
}

//#endregion
//-
//--
//--
//-
//#region Classes

class Background extends LJS.EngineObject
{
    constructor(pos)
    {
        const tileInfo = new LJS.TileInfo(vec2(0,0), vec2(750, 500), 1);
        super(pos, vec2(45, 30), tileInfo);
        this.renderOrder = -1; // Render behind all other objects
    }
}

class Barrier extends LJS.EngineObject
{
    constructor(pos, size)
    {
        super(pos, size);
        
        this.setCollision();
        this.mass = 0;
        this.color = new LJS.Color(0, 0, 0, 0);
    }
}

class Block extends Barrier
{
    constructor(pos, size)
    {
        super(pos, size);
        
        this.color = new LJS.Color(0.5, 0.5, 0.5);

        this.tag = "wall";
    }
}

class Disappears extends Barrier
{
    //size is here to prevent null.copy()
    //for other classes it is set later at the engine level
    constructor(pos, size = vec2(1, 1))
    {
        super(pos, size);
        this.isResettable = true;
        this.initialPos = pos.copy();
        this.initialSize = size.copy();
    }
}

class BreakableBlock extends Disappears
{
    constructor(pos, size)
    {
        super(pos, size);
        this.color = new LJS.Color(0.2, 0.6, 0.8);
        this.tag = "breakableBlock";
    }

    destroy()
    {
        new LJS.ParticleEmitter(
            this.pos, 0, this.size, 0.1, 100, LJS.PI,
            undefined,
            new LJS.Color(0.2, 0.6, 0.8), new LJS.Color(0.5, 0.8, 1),
            new LJS.Color(0.2, 0.6, 0.8, 0), new LJS.Color(0.5, 0.8, 1, 0),
            .5, .5, 0, .1, .05,
            .9, 1, .5, LJS.PI, .1,
            .5, false, true
        );
        super.destroy();
    }
}

class Box extends Barrier
{
    constructor(pos, size, mass = size.x + size.y)
    {
        super(pos, size);
        
        this.mass = mass;
        this.color = new LJS.Color(0.5, 0.25, 0.1);

        this.tag = "box";
    }
}

class SBox extends Box
{
    constructor(pos, size, mass = size.x + size.y)
    {
        super(pos, size);
        
        this.mass = mass;
        this.color = new LJS.Color(0.1, 0.5, 0.25);

        this.tag = "sbox";
    }
}

class Giver extends Disappears
{
    constructor(pos, size)
    {
        super(pos, size);
        this.color = new LJS.Color(0.8, 0, 0);
    }
}

class DashGiver extends Giver
{
    constructor(pos, size)
    {
        super(pos, size);

        this.tag = "dashGiver";
    }
}

class DoubleJumpGiver extends Giver
{
    constructor(pos, size)
    {
        super(pos, size);

        this.tag = "doubleJumpGiver";
    }
}

class SmashGiver extends Giver
{
    constructor(pos, size)
    {
        super(pos, size);

        this.tag = "smashGiver";
    }
}

class ClimbGiver extends Giver
{
    constructor(pos, size)
    {
        super(pos, size);

        this.tag = "climbGiver";
    }
}

class HoldGiver extends Giver
{
    constructor(pos, size)
    {
        super(pos, size);

        this.tag = "holdGiver";
    }
}

class Holdable extends Barrier
{
    constructor(pos, size)
    {
        super(pos, size);
        
        this.color = new LJS.Color(1, 1, 0);

        this.tag = "holdable";
    }
}

class Jumper extends Barrier
{
    constructor(pos, size)
    {
        super(pos, size);
        
        this.color = new LJS.Color(1, 1, 0);

        this.tag = "jumper";
    }
}

class HalfBlock extends Barrier
{
    constructor(pos, size)
    {
        super(pos, size);
        this.color = new LJS.Color(0.3, 0.75, 0.3);
        this.tag = "breaks";
        
        this.breakTimer = new LJS.Timer();
        this.respawnTimer = new LJS.Timer();
        this.isBroken = false;
    }

    update()
    {
        if (this.breakTimer.elapsed())
        {
            this.isBroken = true;
            this.color.a = 0.5;
            this.breakTimer.unset();
            this.respawnTimer.set(HALF_BLOCK_RESPAWN_TIME);
        }

        if (this.respawnTimer.elapsed())
        {
            this.isBroken = false;
            this.color.a = 1;
            this.respawnTimer.unset();
        }
    }

}

class Ground extends Barrier
{
    constructor(pos, size)
    {
        super(pos, size);
        
        this.color = new LJS.Color(0.75, 0.75, 0.75);

        this.tag = "ground";
    }

}

class Climbable extends Barrier
{
    constructor(pos, size)
    {
        super(pos, size);
            
        this.color = new LJS.Color(0.5, 0, 0.5);

        this.tag = "climbable";
    }
}

class Player extends LJS.EngineObject
{
    constructor(pos, size = vec2(1,1))
    {
        super(pos, size);
        this.mass = size.x + size.y;
        this.setCollision();
        this.jumpCount = 0;
        this.canSlam = true;
        this.isSlamming = false;
        this.isDashing = false;
        this.isHolding = false;
        this.dashtimer = new LJS.Timer;
        this.dashCooldownTimer = new LJS.Timer;

        this.tileInfo = playerIdle;
        this.animTimer = new LJS.Timer();
        this.animTimer.set();
    }

    SetLandedParameters()
    {
        this.jumpCount = maxJumps;
        this.canSlam = true;
    }
    
    update()
    {
        //messy but works
        touchingClimbable = false;

        super.update();

        if (player.groundObject)
        {
            this.SetLandedParameters();
        }

        if (this.isDashing)
        {
            this.tileInfo = playerDash;
        }
        else if (this.groundObject)
        {
            if (this.velocity.x === 0)
            {
                this.tileInfo = playerIdle;
            }
            else
            {
                const frame = Math.floor(
                    (this.animTimer.get() * PLAYER_ANIM_FRAME_RATE) % playerRun.length);
                this.tileInfo = playerRun[frame];
            }
        }
        else
        {
            if (this.isSlamming)
            {
                this.tileInfo = playerSlam;
            }
            else
            {
                this.tileInfo = playerJump;
            }
        }

        if (this.velocity.x !== 0 && !this.isDashing) {
            this.mirror = this.velocity.x < 0;
        }
    }

    collideWithObject(obj)
    {
        if (typeof obj.tag != "undefined")
        {
            var slammed = false;

            if(this.isSlamming && 
                (obj.tag == "ground" || obj.tag == "box" || obj.tag == "jumper" || 
                obj.tag == "breaks" || obj.tag == "breakableBlock" || obj.tag == "climbable"))
            {
                slammed = true;
                this.isSlamming = false;
                new LJS.ParticleEmitter(
                    this.pos.add(vec2(0, -this.size.y/2)), 0,
                    vec2(SLAM_SHOCKWAVE_RADIUS * 2, 1),
                    0.1, 200, 0, undefined, rgb(0.5,0.5,0.5), rgb(0.4,0.4,0.4),
                    rgb(0.5,0.5,0.5,0), rgb(0.4,0.4,0.4,0), .4, .2, 1, .05, 0, .8
                );

                LJS.engineObjectsCallback(this.pos, SLAM_SHOCKWAVE_RADIUS, (o) => {
                    if (o instanceof Box)
                    {
                        const direction = o.pos.subtract(this.pos);
                        o.applyForce(direction.normalize(SLAM_SHOCKWAVE_FORCE));
                    }
                });
            }

            if(obj.tag == "dashGiver")
            {
                obj.destroy();
                ableToDash = true;
                createMessage("You unlocked a new skill!\n" + 
                    "\"Left Shift\" to Dash",
                    UNLOCK_MESSAGE_DURATION);
                return 0;
            }
            else if(obj.tag == "doubleJumpGiver")
            {
                obj.destroy();
                maxJumps = 2;
                createMessage("You unlocked a new skill!\n" + 
                    "\"W\" to Double Jump",
                    UNLOCK_MESSAGE_DURATION);
                return 0;
            }
            else if(obj.tag == "climbGiver")
            {
                obj.destroy();
                ableToClimb = true;
                createMessage("You unlocked a new skill!\n" + 
                    "\"W\" at a purple wall to Wall Jump",
                    UNLOCK_MESSAGE_DURATION);
                return 0;
            }
            else if(obj.tag == "smashGiver")
            {
                obj.destroy();
                ableToSmash = true;
                createMessage("You unlocked a new skill!\n" + 
                    "\"S\" while on air to Smash!",
                    UNLOCK_MESSAGE_DURATION);
                return 0;
            }
            else if(obj.tag == "holdGiver")
            {
                obj.destroy();
                ableToHold = true;
                createMessage("You unlocked a new skill!\n" + 
                    "\"E\" at a yellow box to Hold!",
                    UNLOCK_MESSAGE_DURATION);
                return 0;
            }
            else if (obj.tag == "climbable")
            {
                touchingClimbable = true;

                if((player.jumpCount == maxJumps || player.jumpCount == 0) &&
                ableToClimb)
                {
                    this.jumpCount = 1;
                }
            }
            else if (obj.tag == "breakableBlock")
            {
                if(this.isDashing || slammed)
                {
                    obj.destroy();
                    return 0; 
                }
            }
            else if(obj.tag == "box")
            {
                changePlayerSize(true, obj);
            }
            else if(obj.tag == "sbox")
            {
                changePlayerSize(false, obj);
            }
            else if(obj.tag == "holdable")
            {
                if(LJS.keyWasPressed("KeyE"))
                {
                    this.isHolding = this.isHolding == true? false : true;
                }

                if(ableToHold)
                {
                    if (this.isHolding)
                    {
                        const HOLD_LERP_SPEED = 0.2; // How fast player moves to the holdable
                        this.gravityScale = 0; // Disable gravity
                        this.velocity = vec2(0, 0); // Stop movement from other sources
                        this.pos = this.pos.lerp(obj.pos, HOLD_LERP_SPEED);
        
                        // Once close enough, snap to position and allow a jump
                        if (this.pos.distance(obj.pos) < 0.1)
                        {
                            this.pos = obj.pos.copy();
                        }
                        
                        this.jumpCount = 1;
                    }
                    else
                    {
                        this.gravityScale = 1;
                    }
                }

                return 0;
            }
            else if(obj.tag == "jumper")
            {
                this.SetLandedParameters();

                this.velocity.y = this.velocity.y * JUMPER_BOUNCE_FACTOR;
                
                //KNOWN BUG
                //we are not under it but might be at its side and this will trigger
                if(this.velocity.y * this.velocity.y > JUMPER_MIN_BOUNCE_VELOCITY_SQ &&
                    !(this.pos.y <= obj.pos.y)) 
                {
                    this.pos.y += JUMPER_POSITION_ADJUST_ON_BOUNCE;
                    return 0;
                }
            }
            else if (obj.tag == "breaks")
            {
                if (obj.isBroken)
                {
                    if(player.jumpCount == maxJumps)
                    {
                        this.jumpCount = 1;
                    }
                    return 0;
                }

                //KNOWN BUG
                //we are not under it but might be at its side and this will trigger
                if (!obj.breakTimer.active() && !obj.breakTimer.elapsed() &&
                this.velocity.y * this.velocity.y < 0.01 && !(this.pos.y <= obj.pos.y))
                {
                    obj.breakTimer.set(HALF_BLOCK_BREAK_DELAY);
                }
            }
        }

        return 1;
    }
}

//#endregion
//-
//--
//--
//-
//#region Engine funcs

function gameInit()
{
    LJS.setCanvasFixedSize(screenSize);

    LJS.setGravity(vec2(0, GRAVITY_Y));

    LJS.setCameraScale(CAMERA_BASE_SCALE);

    setTiles();

    createLevel();

    createMessage("\"W\" \"A\" \"D\" or Arrow Keys to Move",
        UNLOCK_MESSAGE_DURATION);
}

function gameUpdate()
{
    if(checkGameEnd())
    {
        triggerGameEnd();
        return;
    }

    var moveInput = LJS.keyDirection();
    var moveInputDown = keyJustDirection();
    var dashKeyDown = LJS.keyWasPressed("ShiftLeft");
    var downKeyDown = LJS.keyWasPressed('ArrowDown');
    
    if(player.isHolding == true && 
        (moveInputDown.x != 0 || moveInputDown.y != 0 || dashKeyDown || downKeyDown)
    )
    {
        player.isHolding = false;
    }

    walk(moveInput, player);
    
    jump(moveInputDown, player);
    
    dash(dashKeyDown, player);

    groundSlam(downKeyDown, player);

    deathTracker();

    checkCheckpoints();

    camControl();

    moveBackground();
}

function gameUpdatePost()
{
}

function gameRender()
{
}

function gameRenderPost()
{
    drawDashBar();
    displayMessage();
}

//#endregion
//-
//--
//--
//-
//#region Init

LJS.engineInit(
    gameInit,
    gameUpdate,
    gameUpdatePost,
    gameRender,
    gameRenderPost,
    ['tiles.png', 'background.png']);

//#endregion