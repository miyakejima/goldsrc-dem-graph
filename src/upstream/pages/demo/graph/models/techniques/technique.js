import { sprintf } from 'sprintf-js';

export default class Technique {
    constructor() {
    }

    getStartFrame() {
        return null;
    }

    getEndFrame() {
        return null;
    }

    getFullName() {
        return '';
    }

    /**
     * @returns {Array<{label: string, value: string}>}
     */
    getTechniqueData() {
        return [{
            label: 'Frame:',
            value: sprintf('%d', this.getEndFrame()),
        }];
    }
}

