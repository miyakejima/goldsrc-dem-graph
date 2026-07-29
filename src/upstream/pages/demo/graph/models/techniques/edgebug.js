import { sprintf } from 'sprintf-js';
import Technique from './technique';

/**
 * @property {Number} inAirSinceFrame
 * @property {Number} frame
 * @property {Number} msec
 * @property {Number} horizontalVelocityBefore
 * @property {Number} horizontalVelocityAfter
 * @property {Number} fallingVelocityBefore
 * @property {Number} fallingVelocityAfter
 * @property {Number} planeZNormal
 */
export default class EdgeBug extends Technique {
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
        return 'Edge bug';
    }

    getTechniqueData() {
        let data = super.getTechniqueData();

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
            label: 'Falling velocity post:',
            value: sprintf('%.3f', this.fallingVelocityAfter),
        });

        data.push({
            label: 'Plane Z normal:',
            value: sprintf('%.3f (%.1f°)', this.planeZNormal, Math.acos(this.planeZNormal) * 180 / Math.PI),
        });

        return data;
    }
}

