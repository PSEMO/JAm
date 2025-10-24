import * as LJS from './node_modules/littlejsengine/dist/littlejs.esm.js';
const {vec2, rgb} = LJS;
//
//#region Constants

// Screen
const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = 720;

// Camera
const CAMERA_SMOOTHNESS = 0.05;
const CAMERA_ZOOM_SPEED_FACTOR = 0.5;
const CAMERA_ZOOM_SMOOTHNESS = 0.05;

// Player
const WALK_SPEED = 0.1;
const JUMP_VELOCITY = 0.225;
const JUMP_BOOST_VELOCITY = 0.1125;
const JUMP_BUFFER_TIME = 0.1;
const DASH_SPEED = 0.7;
const DASH_DURATION = 0.2;
const DASH_COOLDOWN = 1.5;
const SLAM_VELOCITY = -0.7;
const SLAM_SHOCKWAVE_RADIUS = 5;
const SLAM_SHOCKWAVE_FORCE = 0.2;
const PLAYER_GROWTH_MULTIPLIER = 2;
const PLAYER_POS_ADj_ON_GROW = 0.25;
const PLAYER_ANIM_FRAME_RATE = 15;
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
const GAME_END_POS_X = 1173;
const BACKGROUND_WIDTH = 45;
const BACKGROUND_OFFSET_Y = -3;
const GRAVITY_Y = -0.01;
const HALF_BLOCK_RESPAWN_TIME = 2.0;
const HALF_BLOCK_BREAK_DELAY = 0.7;
const JUMPER_BOUNCE_FACTOR = -0.85;
const JUMPER_MIN_BOUNCE_VELOCITY_SQ = 0.01;
const JUMPER_POSITION_ADJUST_ON_BOUNCE = 1;
const DEATH_Y_LIMIT = -23;
const BACKGROUND_COLOR = rgb(0.66, 0.79, 0.81);

const zoomInPositions = [
    LJS.vec2(2, -3),
    LJS.vec2(5, -3),
    LJS.vec2(-5.5, 3),
    LJS.vec2(5.5, -3)
];

const IMAGE_STAY_DURATION = 0.5;
const FADE_DURATION = 3;
const ZOOM_LEVEL_IN = 48;
const ZOOM_LEVEL_OUT = 32;

const STATE_FADING_IN = 0;
const STATE_STAYING = 1;
const STATE_FADING_OUT = 2;
//#endregion
//-
//--
//--
//-
//#region Global Vars

var screenSize = vec2(SCREEN_WIDTH, SCREEN_HEIGHT);

const gameInputs =
{
    move: vec2(0, 0),
    moveJustPressed: vec2(0, 0),
    dashPressed: false,
    slamPressed: false,
};

var player;
let playerIdle, playerRun, playerJump, playerSlam, playerDash;
let dashGiverSprite, doubleJumpGiverSprite, smashGiverSprite;
let climbGiverSprite, holdGiverSprite;
let boxSprite, sboxSprite, holdableSprite;

var ableToDash = false;
var ableToSmash = false;
var ableToClimb = false;
var ableToHold = false;
var maxJumps = 1;

var touchingClimbable = false;

var bg0, bg1, bg2, bg3;

let unlockMessageTimer;
var messageToDisplayAtUnlock;

var checkpoints = [];
var lastCheckpoint;
var lastCheckpointIndex = 0;

var resettableObjectTemplates = [];

var CameraBaseScale = 55;
var CameraMaxScale = 8;

var isPlayerRespawning = false;

var alreadyDead = false;

var isShowingStory = true;
var gameSetupNeeded = true;

let storyImages = [];
let currentImageIndex = 0;
let storyImageObject;
let stateTimer;
let currentState = STATE_FADING_IN;

//#endregion
//-
//--
//--
//-
//#region Audio

const soundFiles =
{
    'Music': 'Music.mp3',
    'Jump': 'Jump.mp3',
    'PlatformDisappeared': 'PlatformDisappeared.mp3',
    'Shrink': 'Shrink.mp3',
    'GetBigger': 'GetBigger.mp3',
    'GiverCollected': 'GiverCollected.mp3',
    'Dash': 'Dash.mp3',
    'PlatformBreak': 'PlatformBreak.mp3',
    'JumpingPlatform': 'JumpingPlatform.mp3',
    'BoxHold': 'BoxHold.mp3',
    'GameVictory': 'GameVictory.mp3',
    'Smash': 'Smash.mp3',
    'Died': 'Died.mp3'
};

const audioContext = {};

function loadSounds()
{
    for (const key in soundFiles)
    {
        audioContext[key] = new Audio(soundFiles[key]);
        if (key === 'Music')
        {
            audioContext[key].loop = true;
        }
    }
}

function playSound(name, volume = 1.0)
{
    console.log(name);
    if (audioContext[name])
    {
        const sound = audioContext[name].cloneNode();
        sound.volume = volume;
        sound.play().catch(error =>
            console.error(`Error playing sound: ${name}`, error));
    }
}

function playMusic()
{
    if (audioContext['Music'])
        {
        audioContext['Music'].volume = 0.65;
        const playPromise = audioContext['Music'].play();

        if (playPromise !== undefined)
        {
            playPromise.catch(error => {
                console.log(
                    "Music autoplay was prevented. Waiting for user interaction.");
                    
                const startMusic = () => {
                    audioContext['Music'].play();
                    document.body.removeEventListener('click', startMusic);
                    document.body.removeEventListener('keydown', startMusic);
                };
                document.body.addEventListener('click', startMusic, { once: true });
                document.body.addEventListener('keydown', startMusic, { once: true });
            });
        }
    }
}

function stopMusic()
{
    if (audioContext['Music'])
    {
        audioContext['Music'].pause();
        audioContext['Music'].currentTime = 0;
    }
}

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

function walk(player)
{
    if(player.isDashing == false && player.isHolding == false)
    {
        const currentWalkSpeed = WALK_SPEED * player.size.y;
        if(gameInputs.move.x > 0)
        {
            player.velocity = vec2(currentWalkSpeed, player.velocity.y);
        }
        else if(gameInputs.move.x < 0)
        {
            player.velocity = vec2(-currentWalkSpeed, player.velocity.y);
        }
        else
        {
            player.velocity = vec2(0, player.velocity.y);
        }
    }
}

function jump(player)
{
    if(player.isDashing == false && player.isHolding == false)
    {
        //disables falling and jumping the normal ammount when you fall
        if(!player.groundObject &&
            player.jumpCount == maxJumps &&
            !touchingClimbable)
        {
            player.jumpCount -= 1;
        }

        if (gameInputs.moveJustPressed.y > 0)
        {
            if (player.jumpCount > 0)
            {
                performJump();
            }
            else
            {
                player.jumpBufferTimer.set(JUMP_BUFFER_TIME);
            }
        }
    }
}

function performJump()
{
    playSound('Jump');

    const sizeMult = player.size.y < 1? 0.65: 1;
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

function dash(player)
{
    if(gameInputs.dashPressed &&
        !player.isDashing &&
        !player.dashCooldownTimer.active() &&
        ableToDash &&
        player.isHolding == false)
    {
        playSound('Dash');
        player.isDashing = true;
        
        player.dashtimer.set(DASH_DURATION);
        player.dashCooldownTimer.set(DASH_COOLDOWN);
        
        let dashDirection = vec2(gameInputs.move.x, 0);
        if (dashDirection.lengthSquared() === 0)
        {
            dashDirection = vec2(player.mirror ? -1 : 1, 0);
        }
        const currentDashSpeed = DASH_SPEED * player.size.y;
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

function groundSlam(player)
{
    if(gameInputs.slamPressed && player.canSlam && !player.groundObject && ableToSmash)
    {
        player.isSlamming = true;
        player.canSlam = false;
        player.velocity.y = SLAM_VELOCITY * player.size.y;
    }
}

function changePlayerSize(toBigger, obj)
{
    if(toBigger)
    {
        playSound('GetBigger');
        player.size.x *= PLAYER_GROWTH_MULTIPLIER;
        player.size.y *= PLAYER_GROWTH_MULTIPLIER;
        
        player.pos.y += (PLAYER_POS_ADj_ON_GROW +
        (PLAYER_POS_ADj_ON_GROW / 10));
        
        player.mass = player.size.x + player.size.y
        obj.destroy()
    }
    else
    {
        playSound('Shrink');
        player.size.x /= PLAYER_GROWTH_MULTIPLIER;
        player.size.y /= PLAYER_GROWTH_MULTIPLIER;
        
        player.pos.y -= (PLAYER_POS_ADj_ON_GROW -
        (PLAYER_POS_ADj_ON_GROW / 10));
        
        player.mass = player.size.x + player.size.y
        obj.destroy()
    }

    if(player.size.x > 0.5 || player.size.y > 1)
    {
        player.size.x = 0.5;
        player.size.y = 1;
    }
    if(player.size.x < 0.25 || player.size.y < 0.5)
    {
        player.size.x = 0.25;
        player.size.y = 0.5;
    }

    player.drawSize = vec2(player.size.x * 2,  player.size.y);
}

function camControl()
{
    let targetPos = player.pos;

    LJS.setCameraPos(LJS.cameraPos.lerp(targetPos, CAMERA_SMOOTHNESS));
    const playerSpeed = player.velocity.length();
    const targetScale = LJS.lerp(
        CameraBaseScale,
        CameraMaxScale,
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

function setGiverTiles()
{
    dashGiverSprite = new LJS.TileInfo(vec2(0, 0), vec2(25, 25), 2);
    doubleJumpGiverSprite = new LJS.TileInfo(vec2(0, 0), vec2(25, 25), 3);
    smashGiverSprite = new LJS.TileInfo(vec2(0, 0), vec2(25, 25), 4);
    climbGiverSprite = new LJS.TileInfo(vec2(0, 0), vec2(25, 25), 5);
    holdGiverSprite = new LJS.TileInfo(vec2(0, 0), vec2(25, 25), 6);

    boxSprite = new LJS.TileInfo(vec2(0, 0), vec2(25, 25), 7);
    sboxSprite = new LJS.TileInfo(vec2(0, 0), vec2(25, 25), 8);
    holdableSprite = new LJS.TileInfo(vec2(0, 0), vec2(25, 25), 9);
}

function setBackground()
{
    bg0 = new Background(vec2(-BACKGROUND_WIDTH, BACKGROUND_OFFSET_Y));
    bg1 = new Background(vec2(0, BACKGROUND_OFFSET_Y));
    bg2 = new Background(vec2(BACKGROUND_WIDTH, BACKGROUND_OFFSET_Y));
    bg3 = new Background(vec2(2 * BACKGROUND_WIDTH, BACKGROUND_OFFSET_Y));
    bg0.mass = 0;
    bg1.mass = 0;
    bg2.mass = 0;
    bg3.mass = 0;
}

function moveBackground()
{
    const backgrounds = [bg0, bg1, bg2, bg3];
    const totalWidth = 4 * BACKGROUND_WIDTH;
    const teleportThreshold = 2 * BACKGROUND_WIDTH;

    backgrounds.forEach(bg => {
        if (player.pos.x > bg.pos.x + teleportThreshold)
        {
            bg.pos.x += totalWidth;
        }
        else if (player.pos.x < bg.pos.x - teleportThreshold)
        {
            bg.pos.x -= totalWidth;
        }
    });
}

function createMessage(text, duration)
{
    unlockMessageTimer = new LJS.Timer();
    messageToDisplayAtUnlock = text;
    unlockMessageTimer.set(duration);
}

function displayMessage()
{
    if (unlockMessageTimer.active())
    {
        LJS.drawTextScreen(
            messageToDisplayAtUnlock,
            vec2(screenSize.x / 2, screenSize.y / 2 - 150),
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
    isPlayerRespawning = true;
    playSound('Died');
    player.pos = lastCheckpoint.copy();
    LJS.setCameraPos(lastCheckpoint.copy());
    player.velocity = vec2(0, 0);

    for (let i = LJS.engineObjects.length - 1; i >= 0; i--)
    {
        const obj = LJS.engineObjects[i];
        if (obj.isResettable)
        {
            obj.destroy();
        }
    }

    resettableObjectTemplates.forEach(template => {
        new template.constructor(template.pos, template.size);
    });

    isPlayerRespawning = false;
}

function checkGameEnd()
{
    return player.pos.x > GAME_END_POS_X;
}

function triggerGameEnd()
{
    playSound('GameVictory');
    stopMusic();
    createMessage("You Won!", YOU_WON_MESSAGE_DURATION);
    displayMessage();
}

function checkCheckpoints()
{
    for (let i = lastCheckpointIndex + 1; i < checkpoints.length; i++)
    {
        const checkpoint = checkpoints[i];
        if (player.pos.x > checkpoint.x)
        {
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

    if(lastCheckpointIndex == checkpoints.length - 3)
    {
        CameraBaseScale = 38;
        CameraMaxScale = 5;
    }
    else if(lastCheckpointIndex == checkpoints.length - 2)
    {
        CameraBaseScale = 32;
        CameraMaxScale = 4;
    }
    else if(lastCheckpointIndex == checkpoints.length - 1)
    {
        CameraBaseScale = 70;
        CameraMaxScale = 10;
    }
}

function createLevel()
{
    setBackground();

    createBlocks();
    setCheckPoints();
    setResettableObjectTemplates();

    //TODO CHANGE BEFORE RELEASE
    player = new Player(vec2(0, 1.5));
    //player = new Player(vec2(1130, 1));
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
        vec2(575, 12.5),
        vec2(663, 1.5),
        vec2(680, 1.5),
        vec2(780, 1.5),
        vec2(840, 1.5),
        vec2(990, 1.5),
        vec2(1130, 1.5)
    ];
    lastCheckpoint = checkpoints[0].copy();
    lastCheckpointIndex = 0;
}

function setResettableObjectTemplates()
{
    resettableObjectTemplates = [];
    LJS.engineObjects.forEach(obj => {
        if (obj.isResettable)
        {
            resettableObjectTemplates.push(
            {
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
    //new HoldGiver(vec2(790, 2), vec2(1, 1));

    // Start
    new Ground(vec2(0, 0), vec2(19, 1));
    
    // Staircase
    new Ground(vec2(6, 1), vec2(1, 1));
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
    new Ground(vec2(13, 4), vec2(3, 1));
    new Ground(vec2(18, 4), vec2(3, 1));
    new Ground(vec2(23, 4), vec2(3, 1));

    // Wide platforms going upwards and downwards
    new Ground(vec2(28, 5), vec2(3, 1));
    new Ground(vec2(33, 6), vec2(3, 1));
    new Ground(vec2(38, 7), vec2(3, 1));
    new HalfBlock(vec2(43, 6), vec2(3, 1));
    new HalfBlock(vec2(48, 5), vec2(3, 1));
    new HalfBlock(vec2(53, 4), vec2(3, 1));

    // A long platform and hollowed out box
    new Ground(vec2(73, 4), vec2(31, 1));
    new SBox(vec2(66, 5), vec2(1, 1));
    new Ground(vec2(68, 13), vec2(1, 15));
    new Ground(vec2(75, 20), vec2(15, 1));
    new Ground(vec2(82, 13), vec2(1, 15));
    new Ground(vec2(71, 4.5), vec2(1.5, 0.5));
    new HalfBlock(vec2(73, 5), vec2(1.5, 0.5));
    new HalfBlock(vec2(74.8, 5.5), vec2(1.5, 0.5));
    new HalfBlock(vec2(76.6, 6), vec2(1.5, 0.5));
    new Ground(vec2(78.4, 6), vec2(1.5, 0.5));
    new Ground(vec2(80.2, 5.5), vec2(0.5, 3));
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
    new HalfBlock(vec2(150, 7), vec2(3, 1));
    new HalfBlock(vec2(155, 6), vec2(3, 1));
    new HalfBlock(vec2(160, 5), vec2(3, 1));
    new HalfBlock(vec2(165, 4), vec2(3, 1));
    new HalfBlock(vec2(170, 3), vec2(3, 1));
    new HalfBlock(vec2(175, 2), vec2(3, 1));
    new HalfBlock(vec2(180, 1), vec2(3, 1));
    new HalfBlock(vec2(185, 0), vec2(3, 1));

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
    new SBox(vec2(450, 12.5), vec2(1, 1));
    new Box(vec2(470, 12.5), vec2(1, 1));
    new Climbable(vec2(447, 0), vec2(1, 23.5));
    // hollow box
    new Ground(vec2(453, 20.5), vec2(1, 16));
    new Ground(vec2(460, 28.5), vec2(15, 1));
    new Ground(vec2(467, 20.5), vec2(1, 16));
    new Ground(vec2(457, 12), vec2(1.5, 0.5));
    new HalfBlock(vec2(459, 12.8), vec2(1.5, 0.5));
    new HalfBlock(vec2(463, 13.6), vec2(1.5, 0.5));
    new Ground(vec2(464.5, 13), vec2(0.5, 3));

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
    new DoubleJumpGiver(vec2(580, 13), vec2(1, 1));

    //platforms that follow
    new BreakableBlock(vec2(590, 5.5), vec2(10, 1));
    new Ground(vec2(600, 0), vec2(30, 1));
    new Ground(vec2(620, 4), vec2(3, 1));
    new Ground(vec2(627, 0), vec2(3, 1));
    new HalfBlock(vec2(640, 4), vec2(3, 1));
    new HalfBlock(vec2(645, 2), vec2(3, 1));
    new Ground(vec2(650, 0), vec2(3, 1));

    //shrink or climb block
    new Ground(vec2(664, 0), vec2(8, 1));
    new HalfBlock(vec2(669.6, 0), vec2(1.5, 0.5));
    new HalfBlock(vec2(672, 0), vec2(1.5, 0.5));
    new HalfBlock(vec2(674.4, 0), vec2(1.5, 0.5));
    new Ground(vec2(680, 0), vec2(8, 1));
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

    //teaches the holdable object
    new HoldGiver(vec2(790, 2), vec2(1, 1));
    new Holdable(vec2(795, 3), vec2(1, 1));
    new Holdable(vec2(800, 3), vec2(1, 1));
    new Holdable(vec2(805, 3), vec2(1, 1));
    new Holdable(vec2(810, 3), vec2(1, 1));
    new Holdable(vec2(815, 3), vec2(1, 1));
    new Holdable(vec2(820, 3), vec2(1, 1));
    new Holdable(vec2(825, 3), vec2(1, 1));
    new Ground(vec2(835, 0), vec2(15, 1));

    //End section
    new HalfBlock(vec2(854, 4), vec2(3, 1));
    new HalfBlock(vec2(867, 0), vec2(3, 1));
    new HalfBlock(vec2(880, 4), vec2(3, 1));
    new HalfBlock(vec2(893, 0), vec2(3, 1));
    new Holdable(vec2(906, 4), vec2(1, 1));
    new Holdable(vec2(911, 4), vec2(1, 1));
    new Holdable(vec2(916, 4), vec2(1, 1));
    new Holdable(vec2(921, 4), vec2(1, 1));
    new Jumper(vec2(930, 0), vec2(3, 1));
    new HalfBlock(vec2(947, 0), vec2(3, 1));
    new Jumper(vec2(960, 0), vec2(3, 1));
    new HalfBlock(vec2(977, 0), vec2(3, 1));
    new Ground(vec2(990, 0), vec2(3, 1));
    new Ground(vec2(1010, 0), vec2(3, 1));
    new Ground(vec2(1030, 0), vec2(3, 1));
    new Ground(vec2(1050, 0), vec2(3, 1));
    new Holdable(vec2(1067, 3), vec2(1, 1));
    new HalfBlock(vec2(1080, 0), vec2(3, 1));
    new Holdable(vec2(1097, 3), vec2(1, 1));
    new HalfBlock(vec2(1110, 0), vec2(3, 1));
    new Ground(vec2(1130, 0), vec2(3, 1));
    new SBox(vec2(1130, 2), vec2(1, 1));
    new HalfBlock(vec2(1133, 0), vec2(1.5, 0.5));
    new HalfBlock(vec2(1138, 0), vec2(1.5, 0.5));
    new HalfBlock(vec2(1143, 0), vec2(1.5, 0.5));
    new HalfBlock(vec2(1148, 0), vec2(1.5, 0.5));
    new HalfBlock(vec2(1153, 0), vec2(1.5, 0.5));
    new Ground(vec2(1170, 10.8), vec2(10, 20));
    new Ground(vec2(1165, -9.8), vec2(20, 20));
    new BreakableBlock(vec2(1155.25, 1.2), vec2(0.5, 2));
    new Climbable(vec2(1163, 1.2), vec2(0.5, 2));

    new Cat(vec2(1174.5, 0.5));
}

function setupGameWorld()
{
    LJS.setGravity(vec2(0, GRAVITY_Y));
    LJS.setCameraScale(CameraBaseScale);

    setTiles();
    setGiverTiles();

    createLevel();

    createMessage("\"W\" \"A\" \"D\" or Arrow Keys to Move", UNLOCK_MESSAGE_DURATION);
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
        const tileInfo = new LJS.TileInfo(vec2(0,-10), vec2(750, 750), 1);
        super(pos, vec2(45, 45), tileInfo);
        this.renderOrder = -1;
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
        if (!isPlayerRespawning)
        {
            playSound('PlatformBreak');
            new LJS.ParticleEmitter(
                this.pos, 0, this.size, 0.1, 100, LJS.PI,
                undefined,
                new LJS.Color(0.2, 0.6, 0.8), new LJS.Color(0.5, 0.8, 1),
                new LJS.Color(0.2, 0.6, 0.8, 0), new LJS.Color(0.5, 0.8, 1, 0),
                .5, .5, 0, .1, .05,
                .9, 1, .5, LJS.PI, .1,
                .5, false, true
            );
        }
        super.destroy();
    }
}

class Box extends Barrier
{
    constructor(pos, size, mass = size.x + size.y)
    {
        super(pos, size);
        
        this.mass = mass;
        this.tileInfo = boxSprite;
        this.color = undefined;

        this.tag = "box";
    }
}

class SBox extends Box
{
    constructor(pos, size, mass = size.x + size.y)
    {
        super(pos, size);
        
        this.mass = mass;
        this.tileInfo = sboxSprite;
        this.color = undefined;

        this.tag = "sbox";
    }
}

class Giver extends Disappears
{
    constructor(pos, size)
    {
        super(pos, size);
        this.color = new LJS.Color(0.2, 0, 0);
    }
}

class DashGiver extends Giver
{
    constructor(pos, size)
    {
        super(pos, size);
        this.tag = "dashGiver";
        this.tileInfo = dashGiverSprite;
        this.color = undefined;
    }
}

class DoubleJumpGiver extends Giver
{
    constructor(pos, size)
    {
        super(pos, size);
        this.tag = "doubleJumpGiver";
        this.tileInfo = doubleJumpGiverSprite;
        this.color = undefined;
    }
}

class SmashGiver extends Giver
{
    constructor(pos, size)
    {
        super(pos, size);
        this.tag = "smashGiver";
        this.tileInfo = smashGiverSprite;
        this.color = undefined;
    }
}

class ClimbGiver extends Giver
{
    constructor(pos, size)
    {
        super(pos, size);
        this.tag = "climbGiver";
        this.tileInfo = climbGiverSprite;
        this.color = undefined;
    }
}

class HoldGiver extends Giver
{
    constructor(pos, size)
    {
        super(pos, size);
        this.tag = "holdGiver";
        this.tileInfo = holdGiverSprite;
        this.color = undefined;
    }
}

class Holdable extends Barrier
{
    constructor(pos, size)
    {
        super(pos, size);
        
        this.tileInfo = holdableSprite;
        this.color = undefined;

        this.tag = "holdable";
    }
}

class Jumper extends Barrier
{
    constructor(pos, size)
    {
        super(pos, size);
        
        this.color = new LJS.Color(0.3, 0.3, 0);

        this.tag = "jumper";
    }
}

class HalfBlock extends Barrier
{
    constructor(pos, size)
    {
        super(pos, size);
        this.color = new LJS.Color(0, 0.4, 0);
        this.tag = "breaks";
        
        this.breakTimer = new LJS.Timer();
        this.respawnTimer = new LJS.Timer();
        this.isBroken = false;
    }

    update()
    {
        if (this.breakTimer.elapsed())
        {
            if (!this.isBroken)
            {
                playSound('PlatformDisappeared');
            }
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
        
        this.color = new LJS.Color(0, 0, 0.1);

        this.tag = "ground";
    }

}

class Climbable extends Barrier
{
    constructor(pos, size)
    {
        super(pos, size);
            
        this.color = new LJS.Color(0, 0.2, 0.2);

        this.tag = "climbable";
    }
}

class Player extends LJS.EngineObject
{
    constructor(pos, size = vec2(0.5,1))
    {
        super(pos, size);
        this.mass = size.x + size.y;
        this.setCollision();
        this.drawSize = vec2(this.size.x * 2,  this.size.y);
        this.jumpCount = 0;
        this.canSlam = true;
        this.isSlamming = false;
        this.isDashing = false;
        this.isHolding = false;
        this.dashtimer = new LJS.Timer;
        this.dashCooldownTimer = new LJS.Timer;
        this.jumpBufferTimer = new LJS.Timer;

        this.tileInfo = playerIdle;
        this.animTimer = new LJS.Timer();
        this.animTimer.set();

        // Sets to track objects the player is colliding with
        this.collidingObjects = new Set();
        this.lastCollidingObjects = new Set();
    }

    /**
     * This function is triggered when a new collision starts.
     * @param {LJS.EngineObject} obj The object the player has started colliding with.
     */
    onCollisionStart(obj)
    {
        if(obj.tag == "holdable")
        {
            playSound('BoxHold');
            this.isHolding = true;
        }
    }

    /**
     * This function is triggered when a collision ends.
     * @param {LJS.EngineObject} obj The object the player has stopped colliding with.
     */
    onCollisionEnd(obj)
    {
        if(obj.tag == "holdable")
        {
            this.isHolding = false;
        }
    }

    SetLandedParameters()
    {
        this.jumpCount = maxJumps;
        this.canSlam = true;

        if (this.jumpBufferTimer.active())
        {
            this.jumpBufferTimer.unset();
            
            performJump();
        }
    }
    
    update()
    {
        //messy but works
        touchingClimbable = false;
        
        this.lastCollidingObjects = this.collidingObjects;
        this.collidingObjects = new Set();

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

        if (this.velocity.x !== 0 && !this.isDashing)
        {
            this.mirror = this.velocity.x < 0;
        }

        super.update();
        
        for (const obj of this.collidingObjects)
        {
            if (!this.lastCollidingObjects.has(obj))
            {
                this.onCollisionStart(obj);
            }
        }

        for (const obj of this.lastCollidingObjects)
        {
            if (!this.collidingObjects.has(obj))
            {
                this.onCollisionEnd(obj);
            }
        }
    }

    collideWithObject(obj)
    {
        this.collidingObjects.add(obj);
        
        if (typeof obj.tag != "undefined")
        {
            var slammed = false;

            if(this.isSlamming && 
                (obj.tag == "ground" || obj.tag == "box" || obj.tag == "jumper" || 
                obj.tag == "breaks" || obj.tag == "breakableBlock" ||
                obj.tag == "climbable"))
            {
                playSound('Smash');
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
                playSound('GiverCollected');
                obj.destroy();
                ableToDash = true;
                createMessage("You unlocked a new skill!\n" + 
                    "\"Left Shift\" to Dash",
                    UNLOCK_MESSAGE_DURATION);
                return 0;
            }
            else if(obj.tag == "doubleJumpGiver")
            {
                playSound('GiverCollected');
                obj.destroy();
                maxJumps = 2;
                createMessage("You unlocked a new skill!\n" + 
                    "\"W\" to Double Jump",
                    UNLOCK_MESSAGE_DURATION);
                return 0;
            }
            else if(obj.tag == "climbGiver")
            {
                playSound('GiverCollected');
                obj.destroy();
                ableToClimb = true;
                createMessage("You unlocked a new skill!\n" + 
                    "\"W\" to Special Walls, Wall Jump",
                    UNLOCK_MESSAGE_DURATION);
                return 0;
            }
            else if(obj.tag == "smashGiver")
            {
                playSound('GiverCollected');
                obj.destroy();
                ableToSmash = true;
                createMessage("You unlocked a new skill!\n" + 
                    "\"S\" while on air to Smash!",
                    UNLOCK_MESSAGE_DURATION);
                return 0;
            }
            else if(obj.tag == "holdGiver")
            {
                playSound('GiverCollected');
                obj.destroy();
                ableToHold = true;
                createMessage("You unlocked a new skill!\n" + 
                    "Hold on to the purple boxes!",
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
                if(LJS.keyWasPressed("KeyQ"))
                {
                    this.isHolding = this.isHolding == true? false : true;
                }

                if(ableToHold)
                {
                    if (this.isHolding)
                    {
                        const HOLD_LERP_SPEED = 0.2;
                        this.gravityScale = 0;
                        this.velocity = vec2(0, 0);
                        this.pos = this.pos.lerp(obj.pos, HOLD_LERP_SPEED);
        
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
                playSound('JumpingPlatform');
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

class Cat extends LJS.EngineObject
{
    constructor(pos, size = vec2(0.5, 0.5))
    {
        const tileInfo = new LJS.TileInfo(vec2(0,0), vec2(21, 20), 14);
        super(pos, size, tileInfo);
        this.gravityScale = 0;
        this.mass = 0;
        this.renderOrder = 1;
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
    LJS.setCanvasClearColor(BACKGROUND_COLOR);
    loadSounds();
    playMusic();
    
    storyImages = [
        LJS.tile(0, LJS.vec2(1280, 720), 10),
        LJS.tile(0, LJS.vec2(1280, 720), 11),
        LJS.tile(0, LJS.vec2(1280, 720), 12),
        LJS.tile(0, LJS.vec2(1280, 720), 13)
    ];

    storyImageObject = new LJS.EngineObject(LJS.vec2(0, 0),
        LJS.vec2(38.4, 21.6));
    storyImageObject.renderOrder = -1;
    storyImageObject.tileInfo = storyImages[currentImageIndex];
    storyImageObject.color = new LJS.Color(1, 1, 1, 0);

    LJS.setCameraScale(ZOOM_LEVEL_OUT);
    LJS.setCameraPos(LJS.vec2(0, 0));

    stateTimer = new LJS.Timer();
    stateTimer.set(FADE_DURATION);
}

function updateInputs()
{
    gameInputs.move = LJS.keyDirection();
    gameInputs.moveJustPressed = keyJustDirection();
    gameInputs.dashPressed = LJS.keyWasPressed("ShiftLeft") ||
        LJS.keyWasPressed("ShiftRight");
    gameInputs.slamPressed = LJS.keyWasPressed('ArrowDown') ||
        LJS.keyWasPressed('KeyS');
}

function gameUpdate()
{
    if (isShowingStory)
    {
        const percent = stateTimer.getPercent();

        switch (currentState)
        {
            case STATE_FADING_IN:
                storyImageObject.color.a = LJS.lerp(0, 1, percent);
                LJS.setCameraScale(
                    LJS.lerp(ZOOM_LEVEL_OUT, ZOOM_LEVEL_IN, percent));
                LJS.setCameraPos(
                    LJS.vec2(
                        LJS.lerp(0,
                            zoomInPositions[currentImageIndex].x, percent),
                        LJS.lerp(0,
                            zoomInPositions[currentImageIndex].y, percent)
                    )
                );

                if (stateTimer.elapsed())
                {
                    currentState = STATE_STAYING;
                    stateTimer.set(IMAGE_STAY_DURATION);
                }
                break;

            case STATE_STAYING:
                if (stateTimer.elapsed())
                {
                    currentState = STATE_FADING_OUT;
                    stateTimer.set(FADE_DURATION);
                }
                break;

            case STATE_FADING_OUT:
                storyImageObject.color.a = LJS.lerp(1, 0, percent);

                if (stateTimer.elapsed())
                {
                    if (currentImageIndex >= storyImages.length - 1)
                    {
                        isShowingStory = false;
                        gameSetupNeeded = true;
                        storyImageObject.destroy();
                    }
                    else
                    {
                        currentImageIndex++;
                        storyImageObject.tileInfo =
                            storyImages[currentImageIndex];
                        LJS.setCameraPos(LJS.vec2(0, 0));
                        LJS.setCameraScale(ZOOM_LEVEL_OUT);
                        currentState = STATE_FADING_IN;
                        stateTimer.set(FADE_DURATION);
                    }
                }
                break;
        }
    }
    else if (gameSetupNeeded)
    {
        setupGameWorld();
        gameSetupNeeded = false;
    }
    else
    {
        if(checkGameEnd())
        {
            if(!alreadyDead)
            {
                triggerGameEnd();
            }
            alreadyDead = true;
            return;
        }

        updateInputs();
        
        if(player.isHolding == true && 
            (gameInputs.moveJustPressed.x != 0 ||
                gameInputs.moveJustPressed.y != 0 ||
                gameInputs.dashPressed ||
                gameInputs.slamPressed)
        )
        {
            player.isHolding = false;
        }

        walk(player);
        
        jump(player);
        
        dash(player);

        groundSlam(player);

        deathTracker();

        checkCheckpoints();

        camControl();

        moveBackground();
    }
}

function gameUpdatePost()
{
}

function gameRender()
{
}

function gameRenderPost()
{
    if (!gameSetupNeeded)
    {
        drawDashBar();
        displayMessage();
    }
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
    [
        'tiles.png', 
        'background.png',
        'DashGiver.png',
        'DoubleJumpGiver.png',
        'SmashGiver.png',
        'ClimbGiver.png',
        'HoldGiver.png',
        'Box.png',
        'SBox.png',
        'Holdable.png',
        'Story1.png',
        'Story2.png',
        'Story3.png',
        'Story4.png',
        'cat.png'
    ]
);

//#endregion
//