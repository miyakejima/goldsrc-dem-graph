import { Graphics } from 'pixi.js';

import GraphBar from '../bar';
import { buttons } from '../../consts';
import { getActiveFramesRanges } from '../utils';

export default class BarForward extends GraphBar {
    constructor(graph) {
        super(graph);

        this.setLabel('forward');

        graph.on('dataLoaded', () => this.drawBar());
    }

    drawBar() {
        var movingForwardsGraphics = this.getMovingForwardsGraphics(),
            turningUpGraphics = this.getTurningUpGraphics();

        this.addBarElement(movingForwardsGraphics);
        this.addBarElement(turningUpGraphics);
    }

    getMovingForwardsGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isMovingForwards.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0x555555, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height);
        }

        graphics.endFill();

        return graphics;
    }

    getTurningUpGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isTurningUp.bind(this)),
            graphics = new Graphics();

        graphics.position.y = 7.5;
        graphics.beginFill(0x888888, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height - graphics.position.y);
        }

        graphics.endFill();

        return graphics;
    }

    isMovingForwards(frame) {
        return !!(this.graph.data['cmd']['buttons'][frame] & buttons.FORWARD);
    }

    isTurningUp(frame) {
        if (frame <= 1) {
            return false;
        }

        var angles = this.graph.data['esp']['angles[0]'].getAt(frame),
            anglesPrev = this.graph.data['esp']['angles[0]'].getAt(frame - 1),
            delta = angles - anglesPrev;

        if (delta < -180) {
            delta += 360;
        } else if (delta > 180) {
            delta -= 360;
        }

        return delta > 0;
    }
}

