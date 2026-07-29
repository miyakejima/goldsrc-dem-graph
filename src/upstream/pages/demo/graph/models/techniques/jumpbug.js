import { sprintf } from 'sprintf-js';
import Technique from './technique';

/**
 * @property {Number} inAirSinceFrame
 * @property {Number} jumpedAt
 * @property {Number} duckedAt
 * @property {Number} jumpedAtDistance
 * @property {Number} duckedAtDistance
 * @property {Boolean} jumpedFirst
 * @property {Number} planeZNormal
 */
export default class JumpBug extends Technique {
    constructor(data) {
        super();

        Object.assign(this, data);
    }

    getStartFrame() {
        return this.inAirSinceFrame;
    }

    getEndFrame() {
        return this.jumpedAt;
    }

    getFullName() {
        return 'Jump bug';
    }

    getTechniqueData() {
        var data = super.getTechniqueData();

        data.push({
            label: 'Ducked at frame:',
            value: sprintf('%d', this.duckedAt),
        });

        data.push({
            label: 'Ducked at distance:',
            value: sprintf('%.3f', this.duckedAtDistance),
        });

        data.push({
            label: 'Jumped at distance:',
            value: sprintf('%.3f', this.jumpedAtDistance),
        });

        data.push({
            label: 'Jump before unduck:',
            value: this.jumpedFirst ? 'Yes' : 'No',
        });

        data.push({
            label: 'Plane Z normal:',
            value: sprintf('%.3f (%.1f°)', this.planeZNormal, Math.acos(this.planeZNormal) * 180 / Math.PI),
        });

        return data;
    }
}

