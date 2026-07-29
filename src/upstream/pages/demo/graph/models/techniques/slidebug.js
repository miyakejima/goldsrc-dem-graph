import { sprintf } from 'sprintf-js';
import Technique from './technique';

/**
 * @property {Number} inAirSinceFrame
 * @property {Number} frame
 * @property {Number} msec
 * @property {Number} horizontalVelocityBefore
 * @property {Number} horizontalVelocityAfter
 * @property {Number} fallingVelocityBefore
 * @property {Number} upwardVelocityAfter
 * @property {Number} slidePlaneZNormal
 * @property {Number} slidePlaneDistance
 */
export default class SlideBug extends Technique {
    constructor(data) {
        super();

        Object.assign(this, data);
    }

    getStartFrame() {
        return this.inAirSinceFrame;
    }

    getEndFrame() {
        return this.frame;
    }

    getFullName() {
        return 'Slide bug';
    }

    getTechniqueData() {
        var data = super.getTechniqueData();

        data.push({
            label: 'Msec:',
            value: sprintf('%d', this.msec),
        });

        data.push({
            label: 'Horizontal velocity pre:',
            value: sprintf('%.3f', this.horizontalVelocityBefore),
        });

        data.push({
            label: 'Horizontal velocity post:',
            value: sprintf('%.3f', this.horizontalVelocityAfter),
        });

        data.push({
            label: 'Falling velocity pre:',
            value: sprintf('%.3f', this.fallingVelocityBefore),
        });

        data.push({
            label: 'Upward velocity post:',
            value: sprintf('%.3f', this.upwardVelocityAfter),
        });

        data.push({
            label: 'Slide plane Z normal:',
            value: sprintf('%.3f (%.1f°)', this.slidePlaneZNormal, Math.acos(this.slidePlaneZNormal) * 180 / Math.PI),
        });

        data.push({
            label: 'Slide plane distance:',
            value: sprintf('%.3f', this.slidePlaneDistance),
        });

        return data;
    }
}

