import { Graphics } from 'pixi.js';

import GraphBar from '../bar';
import { buttons } from '../../consts';
import { getActiveFramesRanges } from '../utils';

export default class BarMoveRight extends GraphBar {
    constructor(graph) {
        super(graph);

        this.setLabel('moveright');

        graph.on('dataLoaded', () => this.drawBar());
    }

    drawBar() {
        var movingRightGraphics = this.getMovingRightGraphics(),
            turningRightGraphics = this.getTurningRightGraphics();

        this.addBarElement(movingRightGraphics);
        this.addBarElement(turningRightGraphics);
    }

    getMovingRightGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isMovingRight.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0x555555, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height);
        }

        graphics.endFill();

        return graphics;
    }

    getTurningRightGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isTurningRight.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0x888888, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height - 7.5);
        }

        graphics.endFill();

        return graphics;
    }

    isMovingRight(frame) {
        return !!(this.graph.data['cmd']['buttons'][frame] & buttons.MOVERIGHT);
    }

    isTurningRight(frame) {
        if (frame <= 1) {
            return false;
        }

        var angles = this.graph.data['esp']['angles[1]'].getAt(frame),
            anglesPrev = this.graph.data['esp']['angles[1]'].getAt(frame - 1),
            delta = angles - anglesPrev;

        if (delta < -180) {
            delta += 360;
        } else if (delta > 180) {
            delta -= 360;
        }

        return delta < 0;
    }
};

