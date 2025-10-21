import * as LJS from './node_modules/littlejsengine/dist/littlejs.esm.js';
'use strict';

let storyImages = [];
const zoomInPositions = [
    LJS.vec2(2, -6.5),
    LJS.vec2(7.5, -3.5),
    LJS.vec2(-6.5, 3),
    LJS.vec2(8.5, -8)
];
let currentImageIndex = 0;
let storyImageObject;
let stateTimer;

const IMAGE_STAY_DURATION = 0.5;
const FADE_DURATION = 3;
const ZOOM_LEVEL_IN = 48;
const ZOOM_LEVEL_OUT = 32;

const STATE_FADING_IN = 0;
const STATE_STAYING = 1;
const STATE_FADING_OUT = 2;
let currentState = STATE_FADING_IN;

function gameInit() {
    LJS.setCanvasFixedSize(LJS.vec2(1280, 720));
    storyImages = [
        LJS.tile(0, LJS.vec2(1280, 720), 0),
        LJS.tile(0, LJS.vec2(1280, 720), 1),
        LJS.tile(0, LJS.vec2(1280, 720), 2),
        LJS.tile(0, LJS.vec2(1280, 720), 3)
    ];

    storyImageObject = new LJS.EngineObject(LJS.vec2(0, 0), LJS.vec2(1920 / 50, 1080 / 50));
    storyImageObject.renderOrder = -1;

    storyImageObject.tileInfo = storyImages[currentImageIndex];
    storyImageObject.color = new LJS.Color(1, 1, 1, 0);

    LJS.setCameraScale(ZOOM_LEVEL_OUT);
    LJS.setCameraPos(LJS.vec2(0, 0));

    stateTimer = new LJS.Timer();
    stateTimer.set(FADE_DURATION);
}

function gameUpdate() {
    const percent = stateTimer.getPercent();

    switch (currentState) {
        case STATE_FADING_IN:
            storyImageObject.color.a = LJS.lerp(0, 1, percent);
            LJS.setCameraScale(LJS.lerp(ZOOM_LEVEL_OUT, ZOOM_LEVEL_IN, percent));
            LJS.setCameraPos(
                LJS.vec2(
                    LJS.lerp(0, zoomInPositions[currentImageIndex].x, percent),
                    LJS.lerp(0, zoomInPositions[currentImageIndex].y, percent)
                )
            );

            if (stateTimer.elapsed()) {
                currentState = STATE_STAYING;
                stateTimer.set(IMAGE_STAY_DURATION);
            }
            break;

        case STATE_STAYING:
            if (stateTimer.elapsed()) {
                currentState = STATE_FADING_OUT;
                stateTimer.set(FADE_DURATION);
            }
            break;

        case STATE_FADING_OUT:
            storyImageObject.color.a = LJS.lerp(1, 0, percent);

            if (stateTimer.elapsed()) {
                currentImageIndex = (currentImageIndex + 1) % storyImages.length;
                storyImageObject.tileInfo = storyImages[currentImageIndex];

                LJS.setCameraPos(LJS.vec2(0, 0));
                LJS.setCameraScale(ZOOM_LEVEL_OUT);

                currentState = STATE_FADING_IN;
                stateTimer.set(FADE_DURATION);
            }
            break;
    }
}

function gameUpdatePost() {
}

function gameRender() {
}

function gameRenderPost() {
}

LJS.engineInit(
    gameInit,
    gameUpdate,
    gameUpdatePost,
    gameRender,
    gameRenderPost,
    [
        'Story1.png',
        'Story2.png',
        'Story3.png',
        'Story4.png'
    ]
);