import { sprintf } from 'sprintf-js';
import Technique from './technique';

/**
 * @property {Number} type
 * @property {?Boolean} isStandup
 * @property {Number} distance
 * @property {?Number} distanceXy
 * @property {Number} prestrafe
 * @property {Number} maxspeed
 * @property {Number} strafes
 * @property {Number} sync
 * @property {?Number} block
 * @property {?Number} jumpoff
 * @property {?Number} landing
 * @property {Number} jumpoffFrame
 * @property {Number} landingFrame
 * @property {Number} frames
 * @property {Number} framesInDuck
 * @property {Number} framesOnGround
 * @property {?Number} doubleDucks
 * @property {?Number} preJumpVelocityJumpoff
 * @property {?Number} preJumpVelocityBeforeJumpoff
 * @property {?Boolean} isIdealBhop
 */
export default class Longjump extends Technique {
    constructor(data) {
        super();

        Object.assign(this, data);
    }

    getStartFrame() {
        return this.jumpoffFrame;
    }

    getEndFrame() {
        return this.landingFrame;
    }

    getFullName() {
        switch (this.type) {
            case 0:
                return 'Longjump';
            case 1:
                return 'Highjump';
            case 2:
                return this.isStandup ? 'Stand-up bhop jump' : 'Bhop jump';
            case 3:
                return 'Weird jump';
            case 4:
                if (this.doubleDucks > 1) {
                    return this.isStandup ? 'Multi stand-up count jump' : 'Multi count jump';
                }

                return this.isStandup ? 'Stand-up count jump' : 'Count jump';
            case 6:
                return 'Ladder jump';
            case 7:
                return 'Slide longjump';
        }

        return '';
    }

    getTechniqueData() {
        var data = super.getTechniqueData();

        data.push({
            label: 'Distance:',
            value: sprintf('%.3f', this.distance),
        });

        if (this.distanceXy) {
            data.push({
                label: 'Distance X/Y:',
                value: sprintf('%.3f', this.distanceXy),
            });
        }

        data.push({
            label: 'MaxSpeed:',
            value: sprintf('%.3f', this.maxspeed),
        });

        data.push({
            label: 'Prestrafe:',
            value: this.preJumpVelocityJumpoff !== null && this.preJumpVelocityJumpoff !== this.prestrafe
                ? sprintf('%.3f (%.3f)', this.prestrafe, this.preJumpVelocityJumpoff)
                : sprintf('%.3f', this.prestrafe),
        });

        if (this.preJumpVelocityBeforeJumpoff !== null) {
            data.push({
                label: 'OldSpeed:',
                value: sprintf('%.3f', this.preJumpVelocityBeforeJumpoff),
            });
        }

        data.push({
            label: 'Strafes:',
            value: sprintf('%d', this.strafes),
        });

        data.push({
            label: 'Sync:',
            value: sprintf('%d%%', this.sync),
        });

        data.push({
            label: 'Frames (duck/air):',
            value: sprintf('%d/%d', this.framesInDuck, this.frames),
        });

        if (this.block) {
            data.push({
                label: 'Block:',
                value: sprintf('%d', this.block),
            });
        }

        if (this.jumpoff) {
            data.push({
                label: 'Jump off:',
                value: sprintf('%.3f', this.jumpoff),
            });
        }

        if (this.landing) {
            data.push({
                label: 'Landing:',
                value: sprintf('%.3f', this.landing),
            });
        }

        return data;
    }
}

